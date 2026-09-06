import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';

const run=promisify(execFile),here=path.dirname(fileURLToPath(import.meta.url));
const ffmpeg=process.env.PROMO_FFMPEG||'D:/APP/JianyingPro/11.3.0.14362/ffmpeg.exe';
const manifest=JSON.parse(fs.readFileSync(path.join(here,'render-manifest.json'),'utf8'));
const checks=await Promise.all(manifest.formats.map(async f=>{
  const infile=path.join(here,f.file);
  const r=await run(ffmpeg,['-hide_banner','-nostdin','-i',infile,'-vf','blackdetect=d=0.12:pix_th=0.05','-af','ebur128=peak=true','-f','null','-'],{windowsHide:true,maxBuffer:8*1024*1024});
  fs.writeFileSync(path.join(here,'qc',`${f.id}-final-validation.log`),r.stderr);
  if(/black_start|Error while decoding|Invalid data|corrupt/i.test(r.stderr))throw Error('Media error in '+f.id);
  const frames=[...r.stderr.matchAll(/frame=\s*(\d+)/g)].at(-1)?.[1];
  if(Number(frames)!==manifest.frames)throw Error('Wrong frame count');
  if(!r.stderr.includes(`${f.w}x${f.h}`)||!r.stderr.includes('60 fps')||!r.stderr.includes('yuv420p(tv, bt709'))throw Error('Wrong format');
  if(!r.stderr.includes('Audio: aac (LC)')||!r.stderr.includes('48000 Hz, stereo'))throw Error('Wrong audio format');
  const loudness=[...r.stderr.matchAll(/I:\s*(-?[\d.]+) LUFS/g)].at(-1)?.[1];
  const peak=[...r.stderr.matchAll(/Peak:\s*(-?[\d.]+) dBFS/g)].at(-1)?.[1];
  if(Number(peak)>-.8)throw Error('Insufficient audio headroom');
  for(const t of [f.id==='landscape'?6.2:8.2,18.15,22])await run(ffmpeg,['-hide_banner','-loglevel','error','-y','-ss',String(t),'-i',infile,'-frames:v','1',path.join(here,'qc',`${f.id}-final-${t.toFixed(2)}.png`)],{windowsHide:true});
  return {format:f.id,size:[f.w,f.h],frames:Number(frames),fps:manifest.fps,duration:manifest.duration,loudnessLUFS:Number(loudness),truePeakDBFS:Number(peak),decoded:true,blackSegments:0};
}));
const beatAnalysis=JSON.parse(fs.readFileSync(path.join(here,'assets','tech-house-analysis-beats.json'),'utf8'));
const syncChecks=[8,12,16,30].map(b=>{
  const expected=manifest.sourceStart+b*manifest.beat;
  const observed=beatAnalysis.strong.reduce((best,v)=>Math.abs(v[0]-expected)<Math.abs(best[0]-expected)?v:best,beatAnalysis.strong[0]);
  return {beat:b,videoTime:b*manifest.beat,musicTransientTime:observed[0]-manifest.sourceStart,deltaMs:Math.round((observed[0]-expected)*1000)};
});
fs.writeFileSync(path.join(here,'qc','final-verification.json'),JSON.stringify({checks,syncChecks},null,2));
console.log(JSON.stringify({checks,syncChecks},null,2));
