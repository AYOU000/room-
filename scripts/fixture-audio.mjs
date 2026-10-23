import { mkdir, writeFile } from 'node:fs/promises';
const directory = new URL('../tests/e2e/fixtures/',import.meta.url);
await mkdir(directory,{recursive:true});
for (const [name,hz] of [['pro',440],['con',660]]) {
 const rate=48000, samples=rate*5, data=Buffer.alloc(44+samples*2);
 data.write('RIFF');data.writeUInt32LE(data.length-8,4);data.write('WAVEfmt ',8);data.writeUInt32LE(16,16);
 data.writeUInt16LE(1,20);data.writeUInt16LE(1,22);data.writeUInt32LE(rate,24);data.writeUInt32LE(rate*2,28);
 data.writeUInt16LE(2,32);data.writeUInt16LE(16,34);data.write('data',36);data.writeUInt32LE(samples*2,40);
 for(let i=0;i<samples;i++)data.writeInt16LE(Math.round(Math.sin(2*Math.PI*hz*i/rate)*8192),44+i*2);
 await writeFile(new URL(`${name}.wav`,directory),data);
}
console.log('Generated deterministic 5-second mono fixtures: PRO 440Hz, CON 660Hz.');
