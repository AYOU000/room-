import { test, expect, chromium, type Page } from '@playwright/test';
import { resolve } from 'node:path';

// Browser media primitive checks, not a substitute for the missing Room media/auth feature E2E.
async function capture(page: Page) {
  await page.goto('http://127.0.0.1:4174');
  return page.evaluate(async()=>{
    const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}});
    (window as any).localStream=stream;
    const recorder=new MediaRecorder(stream,{mimeType:'audio/webm;codecs=opus'});
    const chunks:Blob[]=[];recorder.ondataavailable=e=>chunks.push(e.data);
    recorder.start(100);
    await new Promise(r=>setTimeout(r,1000));
    const stopped=new Promise<void>(r=>recorder.onstop=()=>r());recorder.stop();await stopped;
    const blob=new Blob(chunks,{type:recorder.mimeType});
    const audio=new AudioContext();const decoded=await audio.decodeAudioData(await blob.arrayBuffer());
    const pcm=decoded.getChannelData(0);let crossings=0;
    for(let i=1;i<pcm.length;i++)if(pcm[i-1]<0&&pcm[i]>=0)crossings++;
    await audio.close();
    return {bytes:blob.size,duration:decoded.duration,hz:crossings/decoded.duration,tracks:stream.getAudioTracks().length};
  });
}
async function connection(page:Page) {
  const relay=process.env.TURN_ONLY==='1';
  if(relay && (!process.env.TURN_TEST_URL || !process.env.TURN_TEST_USERNAME || !process.env.TURN_TEST_PASSWORD)) throw new Error('TURN-only test requires TURN_TEST_URL, TURN_TEST_USERNAME and TURN_TEST_PASSWORD');
  await page.evaluate(config=>{
    const pc=new RTCPeerConnection(config);(window as any).pc=pc;
    for(const track of (window as any).localStream.getTracks())pc.addTrack(track,(window as any).localStream);
    pc.ontrack=e=>{(window as any).remoteStream=e.streams[0];};
  },{iceTransportPolicy:relay?'relay':'all',iceServers:relay?[{urls:process.env.TURN_TEST_URL!,username:process.env.TURN_TEST_USERNAME,credential:process.env.TURN_TEST_PASSWORD}]:[]});
}
async function localDescription(page:Page,type:'offer'|'answer') {
  return page.evaluate(async type=>{
    const pc:RTCPeerConnection=(window as any).pc;
    await pc.setLocalDescription(type==='offer'?await pc.createOffer():await pc.createAnswer());
    if(pc.iceGatheringState!=='complete')await new Promise<void>(r=>pc.addEventListener('icegatheringstatechange',()=>{if(pc.iceGatheringState==='complete')r();}));
    return pc.localDescription!.toJSON();
  },type);
}
for(const live of [false,true]) test(live?'live Open primitive: two browsers exchange audio':'recorded Solo primitive: distinct fixtures and recorder loss',async()=>{
  const browsers=await Promise.all(['pro','con'].map(name=>chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:[
    '--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--autoplay-policy=no-user-gesture-required',
    `--use-file-for-fake-audio-capture=${resolve('tests/e2e/fixtures',`${name}.wav`)}`,
  ]})));
  try {
    const pages=await Promise.all(browsers.map(b=>b.newPage()));
    const captured=await Promise.all(pages.map(capture));
    await test.info().attach('recording-metrics.json',{body:JSON.stringify(captured,null,2),contentType:'application/json'});
    for(let i=0;i<2;i++){
      expect(captured[i].tracks).toBe(1);expect(captured[i].bytes).toBeGreaterThan(1000);
      expect(captured[i].duration).toBeGreaterThan(.8);expect(Math.abs(captured[i].hz-[440,660][i])).toBeLessThan(40);
    }
    if(!live){
      expect(await pages[0].evaluate(()=>{const t=(window as any).localStream.getAudioTracks()[0];t.stop();return t.readyState;})).toBe('ended');
      return;
    }
    await Promise.all(pages.map(connection));
    const offer=await localDescription(pages[0],'offer');
    await pages[1].evaluate(sdp=>(window as any).pc.setRemoteDescription(sdp),offer);
    const answer=await localDescription(pages[1],'answer');
    expect(Boolean(offer.sdp?.includes('a=candidate:')), 'No offer ICE candidates; check browser/network policy').toBe(true);
    expect(Boolean(answer.sdp?.includes('a=candidate:')), 'No answer ICE candidates; check browser/network policy').toBe(true);
    await pages[0].evaluate(sdp=>(window as any).pc.setRemoteDescription(sdp),answer);
    for(const page of pages){
      await expect.poll(()=>page.evaluate(()=>(window as any).pc.connectionState)).toBe('connected');
      await expect.poll(()=>page.evaluate(async()=>{
        const stats=await (window as any).pc.getStats();let bytes=0;
        stats.forEach((s:any)=>{if(s.type==='inbound-rtp'&&s.kind==='audio')bytes+=s.bytesReceived;});return bytes;
      })).toBeGreaterThan(1000);
      expect(await page.evaluate(()=>(window as any).remoteStream.getAudioTracks().length)).toBe(1);
      if(process.env.TURN_ONLY==='1') {
        expect(await page.evaluate(async()=>{
          const stats=await (window as any).pc.getStats();let relay=false;
          stats.forEach((s:any)=>{if(s.type==='transport'&&s.selectedCandidatePairId){
            const pair=stats.get(s.selectedCandidatePairId);relay=stats.get(pair.localCandidateId).candidateType==='relay';
          }});return relay;
        })).toBe(true);
      }

    }
    // Recorder loss is observable; it must not be mistaken for a successful complete debate.
    expect(await pages[0].evaluate(()=>{const t=(window as any).localStream.getAudioTracks()[0];t.stop();return t.readyState;})).toBe('ended');
  } finally { await Promise.all(browsers.map(b=>b.close())); }
});
