'use strict';
// Deterministic, frame-addressable product animation. This never controls an OS app.
const el = id => document.getElementById(id);
const portrait = new URLSearchParams(location.search).get('format') === 'portrait';
document.body.classList.toggle('portrait', portrait);
const data = window.PROMO_DATA;
const positions = data.layout.positions;
const phrases = data.phrases.map((phrase, index) => {
  const node = document.createElement('div'); node.className = 'phrase';
  const number = document.createElement('span'); number.className = 'number'; number.textContent = String(index+1).padStart(2,'0');
  const label = document.createElement('span'); label.className = 'label'; label.textContent = phrase.label;
  node.append(number,label); el('phrases').append(node); return node;
});
// Keep the pointer and click accents attached to the same gently moving camera.
el('demo').append(el('cursor'),el('click-ring'));
const clamp = x => Math.max(0,Math.min(1,x));
const unit = (t,a,b) => clamp((t-a)/(b-a));
const ease = x => x*x*x*(x*(x*6-15)+10);
const progress = (t,a,b) => ease(unit(t,a,b));
const mix = (a,b,k) => a+(b-a)*k;
const alpha = (t,a,b,c,d) => progress(t,a,b)*(1-progress(t,c,d));
const style = (id,attrs) => Object.assign(el(id).style,attrs);
const geo = portrait ? {cx:506,cy:773,s:2.4,tx:178,ty:1224,w:1080,h:1920} : {cx:1440,cy:601,s:1.65,tx:300,ty:517,w:1920,h:1080};
const press = (t,event) => Math.sin(Math.PI*unit(t,event,event+.22)) * (t>=event&&t<event+.22?1:0);
const textBase='帮我分析一下这个项目。';
const textExtra='重点看看交互体验。';
const titleSegments=[
  {start:3.4,end:7.9,step:'01  /  写下需求',title:'从你的想法开始。',sub:'先在 Codex 输入框写下需求。'},
  {start:7.9,end:11.9,step:'02  /  点一下',title:'整句提示，立刻追加。',sub:'常用的，不必每次再打。'},
  {start:11.9,end:15.65,step:'03  /  再点一下',title:'继续点击，接着组合。',sub:'把想要的提示词，一句句加上。'},
  {start:15.65,end:18.45,step:'04  /  接着写',title:'光标还在，思路继续。',sub:'追加之后，可以继续输入。'},
  {start:18.45,end:21.35,step:'05  /  由你确认',title:'看一眼，再发送。',sub:'每一次表达，都由你决定。'}
];
function cursorPoint(t){
  const g=geo, focus={x:g.tx,y:g.ty}, hub={x:g.cx,y:g.cy};
  const p0={x:g.cx+positions[0].x*g.s,y:g.cy+positions[0].y*g.s};
  const p1={x:g.cx+positions[1].x*g.s,y:g.cy+positions[1].y*g.s};
  const segments=[
    [3.92,4.58,{x:g.w*.84,y:g.h*.83},focus],
    [4.58,6.48,focus,focus],
    [6.48,7.21,focus,hub],
    [7.21,8.71,hub,hub],
    [8.71,9.44,hub,p0],
    [9.44,11.72,p0,p0],
    [11.72,12.5,p0,p1],
    [12.5,14.47,p1,p1],
    [14.47,15.32,p1,{x:g.w*.88,y:g.h*.84}],
    [15.32,20.9,{x:g.w*.88,y:g.h*.84},{x:g.w*.88,y:g.h*.84}]
  ];
  let part=segments.find(s=>t>=s[0]&&t<=s[1]); if(!part) part=segments[0];
  const k=progress(t,part[0],part[1]); return {x:mix(part[2].x,part[3].x,k),y:mix(part[2].y,part[3].y,k)};
}
window.renderAt=function(t){
  t=Math.max(0,Math.min(25,t));
  const heroA=alpha(t,0,.7,3.35,4.08), demoA=alpha(t,3.5,4.16,20.48,21.3), outroA=progress(t,20.72,21.55);
  style('hero',{opacity:heroA,transform:`translateY(${-progress(t,3.35,4.08)*55}px) scale(${1+progress(t,3.35,4.08)*.024})`});
  const icon=document.querySelector('.hero-icon');
  const entrance=progress(t,.18,1.56);
  icon.style.transform=`translateY(${(1-entrance)*70-Math.sin(t*.72)*8}px) rotateX(${mix(12,1,entrance)}deg) rotateY(${mix(-15,-5,entrance)+t*.6}deg) rotateZ(${mix(-6,-1,entrance)}deg) scale(${mix(.86,1,entrance)})`;
  document.querySelector('.hero-copy').style.transform=`translateY(${(1-progress(t,.15,1.13))*38}px)`;
  document.querySelector('.hero-copy').style.opacity=progress(t,.15,.96);
  document.querySelector('.hero-floor').style.opacity=progress(t,.4,1.6)*.85;
  const camera=1+(portrait?.033:.045)*alpha(t,6.8,9.7,14.15,16.25);
  style('demo',{opacity:demoA,transform:`translateY(${(1-progress(t,3.5,4.16))*50-progress(t,20.48,21.3)*35}px) scale(${camera})`});
  let seg=titleSegments.find(s=>t>=s.start&&t<s.end)||titleSegments[0];
  const copyA=alpha(t,seg.start,seg.start+.36,seg.end-.22,seg.end);
  el('step').textContent=seg.step;el('demo-title').textContent=seg.title;el('demo-subtitle').textContent=seg.sub;
  document.querySelector('.demo-copy').style.opacity=copyA;
  document.querySelector('.demo-copy').style.transform=`translateY(${(1-progress(t,seg.start,seg.start+.36))*14}px)`;
  const focus=progress(t,4.58,4.86);
  style('composer',{borderColor:`rgba(143,160,128,${.33+.35*focus})`,boxShadow:`0 23px 45px -18px #40463724,0 0 0 ${2*focus}px #a7b69912`});
  const n=Math.floor(textBase.length*unit(t,4.85,6.43));
  el('base-text').textContent=textBase.slice(0,n);
  el('first-text').textContent=t>=9.73?data.phrases[0].text:'';
  el('second-text').textContent=t>=12.79?data.phrases[1].text:'';
  el('extra-text').textContent=textExtra.slice(0,Math.floor(textExtra.length*unit(t,16.12,17.58)));
  style('first-text',{backgroundColor:`rgba(174,198,151,${.3*alpha(t,9.73,9.85,10.34,11.15)})`});
  style('second-text',{backgroundColor:`rgba(174,198,151,${.3*alpha(t,12.79,12.9,13.42,14.18)})`});
  style('placeholder',{display:n===0?'inline':'none',opacity:1-focus*.28});
  const typing=(t>=4.85&&t<=6.43)||(t>=16.12&&t<=17.58);
  style('caret',{display:t>=4.58?'inline-block':'none',opacity:typing||Math.sin((t-4.58)*Math.PI*2.5)>-.1?1:0});
  style('input-note',{opacity:progress(t,14.9,15.55)});
  const dockA=progress(t,5.9,6.63);style('dock-wrap',{opacity:dockA,transform:`translateY(${(1-dockA)*25}px)`});
  const open=progress(t,7.3,7.57);
  phrases.forEach((node,i)=>{
    const f=progress(t,7.3+i*.022,7.57+i*.022);
    const down=press(t,i===0?9.58:i===1?12.64:-10);
    node.style.opacity=f;
    node.style.transform=`translate(calc(-50% + ${positions[i].x*f}px),calc(-50% + ${positions[i].y*f+down*2}px)) scale(${(.78+.22*f)*(1-.02*down)})`;
    const success=i===0?alpha(t,9.73,9.83,10.12,10.43):i===1?alpha(t,12.79,12.89,13.18,13.49):0;
    node.style.backgroundColor=`rgb(${mix(255,238,success)},${mix(253,244,success)},${mix(247,233,success)})`;
    node.style.borderColor=success>.05?'#a9bba0':'#d3cfc4';
    node.style.boxShadow=`0 ${3-down*2}px 0 #c8c3b8,0 ${5-down*3}px 10px #28261e18`;
  });
  style('hub-vertical',{opacity:1-open,transform:`translate(-50%,-50%) rotate(90deg) scaleX(${1-open})`});
  style('hub-button',{transform:`translateY(${press(t,7.28)*2}px) scale(${1-press(t,7.28)*.03})`});
  style('dock-caption',{opacity:progress(t,7.6,8.1)});
  const cp=cursorPoint(t), clickEvents=[4.62,7.28,9.58,12.64];
  const pressing=Math.max(...clickEvents.map(ev=>press(t,ev)));
  style('cursor',{opacity:alpha(t,3.98,4.2,14.82,15.38)*demoA,transform:`translate(${cp.x}px,${cp.y}px) scale(${1-.12*pressing})`});
  const ev=clickEvents.find(e=>t>=e&&t<e+.58);
  if(ev!==undefined){const k=unit(t,ev,ev+.58),pt=cursorPoint(ev);style('click-ring',{opacity:(1-k)*.62*demoA,transform:`translate(${pt.x-30}px,${pt.y-30}px) scale(${.2+1.3*k})`});}else{style('click-ring',{opacity:0});}
  style('outro',{opacity:outroA,transform:`translateY(${(1-outroA)*45}px)`});
  document.querySelector('.outro-icon').style.transform=`rotateY(${mix(-8,0,progress(t,20.8,23.4))}deg) rotateZ(${mix(-3,0,progress(t,20.8,23.4))}deg)`;
  document.querySelector('.download').style.opacity=progress(t,21.57,22.3);
  // Exposed evidence supports deterministic QA without driving any real application.
  window.frameState={time:t,format:portrait?'portrait':'landscape',base:el('base-text').textContent,appended:[el('first-text').textContent,el('second-text').textContent],extra:el('extra-text').textContent,expanded:open===1};
  return window.frameState;
};
window.renderAt(Number(new URLSearchParams(location.search).get('t')||0));
if(new URLSearchParams(location.search).has('play')){let first;function play(stamp){if(!first)first=stamp;window.renderAt((stamp-first)/1000%25);requestAnimationFrame(play);}requestAnimationFrame(play);}
