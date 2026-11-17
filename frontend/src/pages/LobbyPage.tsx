import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useAuthSession, type AuthSession } from '../lib/auth-session';
import { roomRequest, type RoomSnapshot } from '../lib/room-api';

export function LobbyPage() {
 const auth = useAuthSession();
 return <main className="mx-auto max-w-3xl space-y-5 py-10"><h1 className="text-3xl font-bold">Room lobby</h1>{auth ? <SignedInLobby key={auth.userId} auth={auth}/> : <p role="status">Sign in to create or join a room.</p>}</main>;
}
function SignedInLobby({auth}: {auth:AuthSession}) {
 const [params,setParams] = useSearchParams();
 const roomId = params.get('room');
 const [room,setRoom] = useState<RoomSnapshot|null>(null);
 const [invite,setInvite] = useState('');
 const [topic,setTopic] = useState('');
 const [description,setDescription] = useState('');
 const [minutes,setMinutes] = useState(10);
 const [code,setCode] = useState('');
 const [consent,setConsent] = useState(false);
 const [error,setError] = useState('');
 const [busy,setBusy] = useState(false);
 const pending = useRef(false);
 const revision = useRef(0);
 const message = (e:unknown) => setError(e instanceof Error ? e.message : 'Connection failed. Try again.');
 const settings = useRef('');
 const apply = (snapshot:RoomSnapshot) => {
  const signature = JSON.stringify([snapshot.room.title,snapshot.room.description,snapshot.room.durationSeconds]);
  if (settings.current !== signature) setConsent(false);
  settings.current = signature;
  setRoom(snapshot);
 };
 useEffect(() => {
  setRoom(null); setConsent(false); setError('');
  if (!roomId) return;
  const controller = new AbortController();
  let stopped = false;
  let timer:ReturnType<typeof setTimeout>;
  const refresh = async () => {
   const version = revision.current;
   try { const snapshot = await roomRequest<RoomSnapshot>(auth.accessToken,`/rooms/${encodeURIComponent(roomId)}`,'GET',undefined,controller.signal); if (!stopped && !pending.current && version === revision.current) apply(snapshot); }
   catch(e) {if (!stopped) message(e);}
   if (!stopped) timer = setTimeout(refresh,2000);
  };
  void refresh();
  return () => {stopped=true;controller.abort();clearTimeout(timer);};
 },[roomId,auth.accessToken]);
 async function perform(task:()=>Promise<void>) {
  if (pending.current) return;
  pending.current=true; revision.current++; setBusy(true);setError('');
  try {await task();} catch(e) {message(e);} finally {pending.current=false;setBusy(false);}
 }
 const fields = <><label className="block">Topic<input className="block w-full border p-2" required minLength={5} maxLength={200} value={topic} onChange={e=>setTopic(e.target.value)}/></label><label className="block">Description<textarea className="block w-full border p-2" maxLength={2000} value={description} onChange={e=>setDescription(e.target.value)}/></label><label className="block">Duration (minutes)<input className="block border p-2" type="number" required min={2} max={30} step={1} value={minutes} onChange={e=>setMinutes(Number(e.target.value))}/></label></>;
 const body = () => ({title:topic.trim(),description,durationSeconds:minutes*60});
 const open = (snapshot:RoomSnapshot) => {setInvite(snapshot.inviteCode ?? '');setConsent(false);apply(snapshot);setParams({room:snapshot.room.id});};
 const me = room?.participants.find(p=>p.participantId===auth.userId);
 const creator = room?.room.creatorId===auth.userId;
 return <div className="space-y-5">
 {error && <p role="alert" className="text-red-700">{error}</p>}
 {!roomId ? <>
 <form className="space-y-3 rounded border p-5" onSubmit={e=>{e.preventDefault();void perform(async()=>open(await roomRequest<RoomSnapshot>(auth.accessToken,'/rooms','POST',body())));}}><h2 className="text-xl font-bold">Create a room</h2><fieldset disabled={busy} className="space-y-3">{fields}<button className="border px-4 py-2" type="submit">Create room</button></fieldset></form>
 <form className="space-y-3 rounded border p-5" onSubmit={e=>{e.preventDefault();void perform(async()=>open(await roomRequest<RoomSnapshot>(auth.accessToken,'/rooms/join','POST',{inviteCode:code.trim()})));}}><h2 className="text-xl font-bold">Join a room</h2><label>Invite code<input className="block w-full border p-2" required pattern="[A-Za-z0-9_-]{43}" autoCapitalize="none" autoComplete="off" spellCheck={false} value={code} onChange={e=>setCode(e.target.value)} disabled={busy}/></label><button className="border px-4 py-2" disabled={busy}>Join room</button></form>
 </> : !room ? <p role="status">Loading room…</p> : <>
 <h2 className="text-2xl font-bold">{room.room.title}</h2><p>{room.room.description}</p><p>{room.room.durationSeconds/60} minutes · {room.session.state}</p>
 {invite && <p>Invite code: <code className="break-all select-all">{invite}</code></p>}
 <ul aria-label="Participants">{[1,2].map(slot=>{const p=room.participants.find(p=>p.slot===slot);return <li key={slot}>Slot {slot}: {p ? `${p.participantId===auth.userId?'You':'Opponent'} — ${p.ready?'Ready':'Not ready'} — ${p.connection}` : 'Waiting for opponent'}</li>;})}</ul>
 {room.session.state==='waiting' && <>
 {creator && <form className="space-y-3 border p-4" onSubmit={e=>{e.preventDefault();void perform(async()=>{apply(await roomRequest<RoomSnapshot>(auth.accessToken,`/rooms/${room.room.id}`,'PATCH',body()));setConsent(false);});}}><h3>Edit topic or duration</h3><button type="button" className="underline" onClick={()=>{setTopic(room.room.title);setDescription(room.room.description??'');setMinutes(room.room.durationSeconds/60);}}>Load current settings</button><fieldset disabled={busy}>{fields}<button className="border px-4 py-2">Save changes</button></fieldset></form>}
 <p>One timed discussion with both microphones available. AI feedback can be wrong. Transcripts are temporary; speech text may be processed by external transcription and AI services. Check the privacy notice before consenting.</p>
 <label className="block"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} disabled={busy}/> I have reviewed the topic, duration and processing notice and consent.</label>
 <button className="border px-4 py-2" disabled={busy||(!me?.ready&&!consent)} onClick={()=>void perform(async()=>apply(await roomRequest<RoomSnapshot>(auth.accessToken,`/rooms/${room.room.id}/ready`,'POST',{ready:!me?.ready,consentVersion:'privacy-v1'})))}>{me?.ready?'Withdraw readiness':'Ready'}</button>
 <button className="border px-4 py-2" disabled={busy} onClick={()=>void perform(async()=>{await roomRequest<void>(auth.accessToken,`/rooms/${room.room.id}/leave`,'POST',{});setInvite('');setParams({});setRoom(null);})}>{creator?'Cancel and leave':'Leave room'}</button>
 </>}
 </>}
 </div>;
}
