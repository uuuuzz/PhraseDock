import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createHash} from 'node:crypto';

const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../../..');
const require=createRequire(import.meta.url);
const runtime=process.env.PROMO_NODE_MODULES||'C:/Users/24092/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const {chromium}=require(path.join(runtime,'playwright')),sharp=require(path.join(runtime,'sharp'));
const browserExe=process.env.PROMO_CHROMIUM||'C:/Users/24092/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe';
const ffmpeg=process.env.PROMO_FFMPEG||'D:/APP/JianyingPro/11.3.0.14362/ffmpeg.exe';
const config=JSON.parse(fs.readFileSync(path.join(root,'config/phrases.json'),'utf8'));
const timing=JSON.parse(fs.readFileSync(path.join(here,'timing.json'),'utf8'));
const {radialLayout}=require(path.join(root,'src/core/radial-layout.cjs'));
fs.writeFileSync(path.join(here,'data.js'),'window.FILM_DATA='+JSON.stringify({timing,phrases:config.phrases,layout:radialLayout(config.phrases.length)})+';\n');
const hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const formats=[{id:'landscape',w:1920,h:1080,name:'V2_Bilibili_1920x1080_60fps'},{id:'portrait',w:1080,h:1920,name:'V2_Douyin_1080x1920_60fps'}];
fs.mkdirSync(path.join(here,'qc'),{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:browserExe,args:['--allow-file-access-from-files','--font-render-hinting=none','--disable-lcd-text']});
const problems=[];
async function pageFor(f){
  const page=await browser.newPage({viewport:{width:f.w,height:f.h},deviceScaleFactor:1});
  page.on('pageerror',e=>problems.push(e.message));
  await page.goto(pathToFileURL(path.join(here,'index.html')).href+'?format='+f.id);
  await page.evaluate(()=>document.fonts.ready);
  await page.waitForFunction(()=>[...document.images].every(n=>n.complete&&n.naturalWidth));
  return page;
}
async function preview(f){
  const page=await pageFor(f),beats=[1.5,3.3,6.8,8.9,12.6,16.6,22.5,26.8,30.8,36.8,38.1,44.7],checks=[];
  for(const b of beats){
    const state=await page.evaluate(t=>window.renderAt(t),b*timing.beat);
    const file=path.join(here,'qc',`${f.id}-b${b.toFixed(1)}.png`);
    await page.screenshot({path:file,type:'png'});
    const layout=await page.evaluate(()=>({
      fontLoaded:document.fonts.check('450 39px Film'),
      labels:[...document.querySelectorAll('.label')].map(n=>({text:n.textContent,clipped:n.scrollWidth>n.clientWidth})),
      promptBottom:document.getElementById('prompt').getBoundingClientRect().bottom,
      controlsTop:document.querySelector('.input-bottom').getBoundingClientRect().top,
      inputRect:document.getElementById('composer-card').getBoundingClientRect().toJSON(),
      dockRects:[...document.querySelectorAll('.phrase')].map(n=>n.getBoundingClientRect().toJSON()),
      outroRect:document.getElementById('outro-copy').getBoundingClientRect().toJSON()
    }));
    if(!layout.fontLoaded)throw Error('Font missing');
    if(layout.labels.some(n=>n.clipped))throw Error('Clipped actual preset');
    if(b>12.2&&state.appended[0]!==config.phrases[0].text)throw Error('First paste differs from configured text');
    if(b>16.2&&state.appended[1]!==config.phrases[1].text)throw Error('Second paste differs from configured text');
    if(b>=6&&b<=30&&layout.promptBottom>layout.controlsTop-12)throw Error('Input text overlaps controls');
    if(b>=8.9&&b<=28&&layout.dockRects.some(r=>r.left<25||r.right>f.w-25||r.top<30||r.bottom>f.h-30))throw Error('Menu outside frame');
    checks.push({b,t:b*timing.beat,state,layout});
    if(b===44.7)fs.copyFileSync(file,path.join(here,`${f.name}_cover.png`));
  }
  const tw=f.id==='landscape'?480:270,th=f.id==='landscape'?270:480,items=[];
  for(let i=0;i<beats.length;i++)items.push({input:await sharp(path.join(here,'qc',`${f.id}-b${beats[i].toFixed(1)}.png`)).resize(tw,th).png().toBuffer(),left:i%4*tw,top:Math.floor(i/4)*th});
  await sharp({create:{width:tw*4,height:th*3,channels:3,background:'#f8f9f5'}}).composite(items).png().toFile(path.join(here,'qc',`${f.id}-contact-sheet.png`));
  // Check the frame-level boundary: no prompt before paste, full prompt afterward.
  const boundaries=[];
  for(const [name,b] of Object.entries(timing.events).filter(([k])=>k.endsWith('Paste'))){
    const frame=Math.ceil(b*timing.beat*timing.fps);
    const before=await page.evaluate(t=>window.renderAt(t),(frame-1)/timing.fps);
    const after=await page.evaluate(t=>window.renderAt(t),frame/timing.fps);
    const i=name==='firstPaste'?0:1;
    if(before.appended[i]!==''||after.appended[i]!==config.phrases[i].text)throw Error('Paste was not atomic');
    boundaries.push({name,frame,before:before.appended[i],after:after.appended[i]});
  }
  fs.writeFileSync(path.join(here,'qc',`${f.id}-checks.json`),JSON.stringify({checks,boundaries},null,2));
  await page.close();console.log(`Preview and interaction checks ready: ${f.id}`);
}
const manifest={createdAt:new Date().toISOString(),...timing,source:{config:hash(path.join(root,'config/phrases.json')),icon:hash(path.join(root,'resources/icons/source/PhraseDock-windows.png')),soundtrack:hash(path.join(here,'soundtrack.wav'))},formats:[]};
async function render(f){
  const page=await pageFor(f),outfile=path.join(here,`${f.name}.mp4`),log=fs.createWriteStream(path.join(here,`${f.id}-encode.log`));
  const ff=spawn(ffmpeg,['-hide_banner','-loglevel','warning','-y','-f','image2pipe','-vcodec','mjpeg','-framerate',String(timing.fps),'-i','pipe:0','-i',path.join(here,'soundtrack.wav'),'-map','0:v:0','-map','1:a:0','-vf','scale=in_range=full:out_range=tv:out_color_matrix=bt709,format=yuv420p','-c:v','h264_nvenc','-preset','p6','-profile:v','high','-rc','vbr','-cq','19','-b:v','12M','-maxrate','20M','-bufsize','40M','-color_primaries','bt709','-color_trc','bt709','-colorspace','bt709','-c:a','aac','-b:a','256k','-ar','48000','-t',String(timing.duration),'-movflags','+faststart','-metadata','title=One click. Appended. | AI Prompt Quick Appender V2',outfile],{stdio:['pipe','ignore','pipe'],windowsHide:true});
  let failure;ff.on('error',e=>failure=e);ff.stdin.on('error',e=>failure=e);ff.stderr.pipe(log);const done=once(ff,'close'),start=Date.now();
  for(let frame=0;frame<timing.frames;frame++){
    if(failure)throw failure;
    await page.evaluate(t=>window.renderAt(t),frame/timing.fps);
    const shot=await page.screenshot({type:'jpeg',quality:97});
    if(!ff.stdin.write(shot))await once(ff.stdin,'drain');
    if(frame%240===0)console.log(`${f.id}: ${frame}/${timing.frames} frames, ${((Date.now()-start)/1000).toFixed(1)}s`);
  }
  ff.stdin.end();const [code]=await done;if(code!==0)throw Error('Encode failed: '+f.id);log.end();await page.close();
  manifest.formats.push({...f,bytes:fs.statSync(outfile).size,sha256:hash(outfile),file:path.basename(outfile)});
  console.log(`Exported ${f.name}: ${(fs.statSync(outfile).size/1048576).toFixed(1)} MiB`);
}
try{
  if(process.argv.includes('--preview'))await Promise.all(formats.map(preview));
  else{for(const f of formats)await render(f);fs.writeFileSync(path.join(here,'render-manifest.json'),JSON.stringify(manifest,null,2));}
  if(problems.length)throw Error(problems.join('\n'));
}finally{await browser.close();}
