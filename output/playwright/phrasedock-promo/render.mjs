import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createHash } from 'node:crypto';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'../../..');
const require=createRequire(import.meta.url);
const runtime=process.env.PROMO_NODE_MODULES||'C:/Users/24092/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const {chromium}=require(path.join(runtime,'playwright'));
const sharp=require(path.join(runtime,'sharp'));
const browserExe=process.env.PROMO_CHROMIUM||'C:/Users/24092/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe';
const ffmpeg=process.env.PROMO_FFMPEG||'D:/APP/JianyingPro/11.3.0.14362/ffmpeg.exe';
const fps=30,duration=25;
const config=JSON.parse(fs.readFileSync(path.join(root,'config/phrases.json'),'utf8'));
const {radialLayout}=require(path.join(root,'src/core/radial-layout.cjs'));
const source={phrases:config.phrases,layout:radialLayout(config.phrases.length)};
fs.writeFileSync(path.join(here,'data.js'),'window.PROMO_DATA = '+JSON.stringify(source)+';\n');
fs.mkdirSync(path.join(here,'qc'),{recursive:true});
const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const manifest={createdAt:new Date().toISOString(),duration,fps,kind:'Reconstructed product interaction animation, not a screen recording',source:{configSHA256:hash(path.join(root,'config/phrases.json')),iconSHA256:hash(path.join(root,'resources/icons/source/PhraseDock-windows.png'))},formats:[]};
const formats=[{id:'landscape',width:1920,height:1080,name:'Bilibili_1920x1080'},{id:'portrait',width:1080,height:1920,name:'Douyin_1080x1920'}];
const errors=[];
const browser=await chromium.launch({headless:true,executablePath:browserExe,args:['--allow-file-access-from-files','--font-render-hinting=none','--disable-lcd-text']});
async function makePage(format){
  const page=await browser.newPage({viewport:{width:format.width,height:format.height},deviceScaleFactor:1});
  page.on('pageerror',error=>errors.push(`${format.id}: ${error.message}`));
  await page.goto(pathToFileURL(path.join(here,'index.html')).href+'?format='+format.id);
  await page.evaluate(()=>document.fonts.ready);
  await page.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0));
  return page;
}
async function preview(format){
  const page=await makePage(format);
  const timestamps=[1.85,6.3,8.15,10.05,13.25,17.8,19.25,23.5];
  const checks=[];
  for(const t of timestamps){
    const state=await page.evaluate(t=>window.renderAt(t),t);
    const screenshot=path.join(here,'qc',`${format.id}-${t.toFixed(2)}.png`);
    await page.screenshot({path:screenshot,type:'png'});
    const layout=await page.evaluate(()=>({
      fontLoaded:document.fonts.check('500 32px Promo'),
      labels:[...document.querySelectorAll('.label')].map(n=>({text:n.textContent,clipped:n.scrollWidth>n.clientWidth})),
      textHeight:document.querySelector('.text-area').getBoundingClientRect().height,
      inputHeight:document.getElementById('composer').getBoundingClientRect().height,
      inputRect:document.getElementById('composer').getBoundingClientRect().toJSON(),
      titleRect:document.getElementById('demo-title').getBoundingClientRect().toJSON()
    }));
    if(layout.labels.some(n=>n.clipped))throw Error('A real prompt button label is clipped');
    if(t>=9.8&&state.appended[0]!==config.phrases[0].text)throw Error('First prompt is not exact');
    if(t>=13&&state.appended[1]!==config.phrases[1].text)throw Error('Second prompt is not exact');
    if(t>5&&t<20&&layout.textHeight>layout.inputHeight-110)throw Error('Text overlaps the input controls');
    checks.push({t,state,layout,file:path.basename(screenshot)});
    if(t===1.85)fs.copyFileSync(screenshot,path.join(here,`${format.name}_cover.png`));
  }
  const thumbWidth=format.id==='landscape'?480:270,thumbHeight=format.id==='landscape'?270:480;
  const columns=4,rows=2;
  const composites=[];
  for(let i=0;i<timestamps.length;i++){
    const thumb=await sharp(path.join(here,'qc',`${format.id}-${timestamps[i].toFixed(2)}.png`)).resize(thumbWidth,thumbHeight).png().toBuffer();
    composites.push({input:thumb,left:(i%columns)*thumbWidth,top:Math.floor(i/columns)*thumbHeight});
  }
  await sharp({create:{width:columns*thumbWidth,height:rows*thumbHeight,channels:3,background:'#f5f5f3'}}).composite(composites).png().toFile(path.join(here,'qc',`${format.id}-contact-sheet.png`));
  fs.writeFileSync(path.join(here,'qc',`${format.id}-checks.json`),JSON.stringify(checks,null,2));
  await page.close();
  console.log(`Preview ready: ${format.id}, ${timestamps.length} frames`);
}
async function render(format){
  const page=await makePage(format);
  const outfile=path.join(here,`${format.name}.mp4`);
  const logFile=fs.createWriteStream(path.join(here,`${format.id}-encode.log`));
  const ff=spawn(ffmpeg,['-hide_banner','-loglevel','warning','-y','-f','image2pipe','-vcodec','mjpeg','-framerate',String(fps),'-i','pipe:0','-i',path.join(here,'soundtrack.wav'),'-map','0:v:0','-map','1:a:0','-vf','scale=in_range=full:out_range=tv:out_color_matrix=bt709,format=yuv420p','-c:v','h264_nvenc','-preset','p6','-profile:v','high','-rc','vbr','-cq','18','-b:v','0','-color_primaries','bt709','-color_trc','bt709','-colorspace','bt709','-c:a','aac','-b:a','192k','-ar','48000','-t',String(duration),'-movflags','+faststart','-metadata','title=AI Prompt Quick Appender | Product Animation',outfile],{stdio:['pipe','ignore','pipe'],windowsHide:true});
  let ffError=null;ff.on('error',e=>{ffError=e});ff.stdin.on('error',e=>{ffError=e});ff.stderr.pipe(logFile);
  const exit=once(ff,'close');
  const start=Date.now();
  for(let frame=0;frame<duration*fps;frame++){
    if(ffError)throw ffError;
    await page.evaluate(t=>window.renderAt(t),frame/fps);
    const buffer=await page.screenshot({type:'jpeg',quality:97});
    if(!ff.stdin.write(buffer))await once(ff.stdin,'drain');
    if(frame%150===0)console.log(`${format.id}: ${frame}/${duration*fps} frames, ${((Date.now()-start)/1000).toFixed(1)}s elapsed`);
  }
  ff.stdin.end();
  const [code]=await exit;if(code!==0)throw Error(`${format.id} encoding failed (${code}); read log`);
  logFile.end();await page.close();
  manifest.formats.push({...format,file:path.basename(outfile),frames:duration*fps,bytes:fs.statSync(outfile).size,sha256:hash(outfile)});
  console.log(`Render complete: ${format.name}, ${(fs.statSync(outfile).size/1024/1024).toFixed(1)} MiB`);
}
try{
  if(process.argv.includes('--preview'))await Promise.all(formats.map(preview));
  else{
    if(!fs.existsSync(path.join(here,'soundtrack.wav')))throw Error('Run audio.py first');
    for(const format of formats)await render(format);
    fs.writeFileSync(path.join(here,'render-manifest.json'),JSON.stringify(manifest,null,2));
  }
  if(errors.length)throw Error(errors.join('\n'));
}finally{await browser.close();}
