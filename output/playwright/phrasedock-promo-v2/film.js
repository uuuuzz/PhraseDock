'use strict';
// All motion is sampled from the licensed soundtrack's 122 BPM grid.
const $=id=>document.getElementById(id),S=(id,values)=>Object.assign($(id).style,values);
const data=window.FILM_DATA,beat=data.timing.beat;
const portrait=new URLSearchParams(location.search).get('format')==='portrait';
document.body.classList.toggle('portrait',portrait);
const W=portrait?1080:1920,H=portrait?1920:1080;
const HERO_SCALE=portrait?6.2:5.8;
const U=x=>Math.max(0,Math.min(1,x));
const u=(b,a,z)=>U((b-a)/(z-a));
const E=x=>x*x*x*(x*(x*6-15)+10);
const e=(b,a,z)=>E(u(b,a,z));
const mix=(a,z,v)=>a+(z-a)*v;
const A=(b,a,z,c,d)=>e(b,a,z)*(1-e(b,c,d));
const spring=x=>x>=1?1:1-Math.exp(-7.2*x)*(Math.cos(10*x)+.45*Math.sin(10*x));
const pulse=(b,at,width=.38)=>b>=at&&b<at+width?Math.sin(Math.PI*u(b,at,at+width)):0;
const baseText='帮我分析这个项目。',moreText='重点看交互体验。';
const main=portrait?{x:84,y:1115,w:840,h:363,s:1,dx:504,dy:694,ds:2.52}:{x:120,y:371,w:1040,h:348,s:1,dx:1560,dy:544,ds:1.9};
const close=portrait?{x:72,y:1024,s:1.035,dx:504,dy:607,ds:1.86}:{x:202,y:398,s:1.12,dx:1680,dy:327,ds:1.12};
const nodes=data.phrases.map((p,i)=>{
  const node=document.createElement('div');node.className='phrase';
  const n=document.createElement('span');n.className='number';n.textContent=String(i+1).padStart(2,'0');
  const l=document.createElement('span');l.className='label';l.textContent=p.label;
  node.append(n,l);$('phrases').append(node);return node;
});
S('composer-pose',{width:main.w+'px'});S('composer-unit',{width:main.w+'px'});S('composer-card',{height:main.h+'px'});
function pose(b){
  const k=A(b,20,22.8,28,29.8),intro=e(b,3.8,7.1),exit=e(b,32,35.35),settle=e(b,35.35,37.05);
  let dx=mix(W/2,mix(main.dx,close.dx,k),intro),dy=mix(H/2,mix(main.dy,close.dy,k),intro),ds=mix(HERO_SCALE,mix(main.ds,close.ds,k),intro);
  dx=mix(dx,W/2,exit);dy=mix(dy,H/2,exit);ds=mix(ds,mix(HERO_SCALE,2.35,settle),exit);
  return {x:mix(main.x,close.x,k)-(portrait?0:1700)*exit,y:mix(main.y,close.y,k)+(portrait?1200:40)*exit,s:mix(main.s,close.s,k),dx,dy,ds,exit,k};
}
function point(b,kind){
  const p=pose(b);
  if(kind==='focus')return{x:p.x+main.w*.23*p.s,y:p.y+main.h*.22*p.s};
  if(kind==='off')return{x:W*.87,y:H*.85};
  if(kind==='hub')return{x:p.dx,y:p.dy};
  const pos=data.layout.positions[kind];return{x:p.dx+pos.x*p.ds,y:p.dy+pos.y*p.ds};
}
const ptrSegments=[
  [4.65,5.93,point(4.65,'off'),point(6,'focus')],
  [5.93,7.18,point(6,'focus'),point(6,'focus')],
  [7.18,7.93,point(6,'focus'),point(8,'hub')],
  [7.93,9.55,point(8,'hub'),point(8,'hub')],
  [9.55,11.86,point(8,'hub'),point(12,0)],
  [11.86,14.5,point(12,0),point(12,0)],
  [14.5,15.85,point(12,0),point(16,1)],
  [15.85,17.72,point(16,1),point(16,1)],
  [17.72,18.65,point(16,1),point(19,'off')],
  [28.2,29.9,point(28.2,'off'),point(30,'hub')],
  [29.9,31.5,point(30,'hub'),point(30,'hub')]
];
function pointer(b){const part=ptrSegments.find(v=>b>=v[0]&&b<=v[1]);if(!part)return point(b,'off');const k=e(b,part[0],part[1]);return{x:mix(part[2].x,part[3].x,k),y:mix(part[2].y,part[3].y,k)};}
window.renderAt=function(time){
  const b=time/beat,p=pose(b);
  // A dot grows into a plus. A circular keycap forms around the same glyph.
  const inkA=1-e(b,2.9,3.55),inkScale=mix(.65,18*HERO_SCALE/88,e(b,0,2.8));
  S('ink-plus',{opacity:inkA,transform:`translate(${W/2-50}px,${H/2-50}px) scale(${inkScale})`});
  document.querySelector('.bar-x').style.width=mix(10,88,e(b,0,.82))+'px';
  document.querySelector('.bar-y').style.width=mix(10,88,e(b,1,1.9))+'px';
  document.querySelector('.bar-y').style.opacity=e(b,1,1.3);
  document.querySelectorAll('.echo-line').forEach((node,i)=>{
    const z=e(b,1.8+i*.17,4.15+i*.17),sg=i%2?-1:1;
    node.style.opacity=A(b,1.8+i*.17,2.45+i*.17,3.7,5)*(i===1?.25:.5);
    node.style.transform=`translate(${(z*440-125)*sg}px,${(i-1)*58}px) scaleX(${.4+z*.7})`;
  });
  const ringSize=mix(140,440,e(b,1.9,4.4));
  S('orbit-ring',{width:ringSize+'px',height:ringSize+'px',transform:`translate(${W/2-ringSize/2}px,${H/2-ringSize/2}px)`,opacity:A(b,1.9,2.55,3.4,4.5)*.34});
  const dockA=e(b,2.08,3.4)*(1-e(b,36.6,37.55));
  S('dock-pose',{opacity:dockA,transform:`translate(${p.dx}px,${p.dy}px) scale(${p.ds})`});
  S('drag-ring',{opacity:e(b,2.08,3.4)});
  S('hub-shadow',{opacity:(1-e(b,3.4,6.2))*.8+e(b,33,35)*(1-e(b,36,37))*.8});
  const hubDown=Math.max(pulse(b,8),pulse(b,30));
  S('hub-button',{transform:`translateY(${2*hubDown}px) scale(${1-.025*hubDown})`});
  S('hub-dot',{background:b<6?'#a6aaa3':'#58a66d'});
  const open=e(b,8,8.42)*(1-e(b,30,30.42));
  S('hub-vertical',{opacity:1-open,transform:`translate(-50%,-50%) rotate(${90+open*90}deg) scaleX(${1-open})`});
  nodes.forEach((node,i)=>{
    const incoming=u(b,8+i*.10,8.64+i*.10),outgoing=e(b,30+i*.055,30.56+i*.055);
    const spread=spring(incoming)*(1-outgoing),pos=data.layout.positions[i];
    const hit=pulse(b,i===0?12:i===1?16:-100,.32);
    const good=i===0?A(b,12.18,12.35,13.0,14.4):i===1?A(b,16.18,16.35,17.0,18.4):0;
    const floatFocus=1-p.k*.16;
    node.style.opacity=U(incoming*2.8)*(1-outgoing)*floatFocus;
    node.style.transform=`translate(calc(-50% + ${pos.x*spread}px),calc(-50% + ${pos.y*spread+hit*2}px)) scale(${(.75+spread*.25)*(1-hit*.02)})`;
    node.style.backgroundColor=`rgb(${mix(255,237,good)},${mix(253,246,good)},${mix(247,224,good)})`;
    node.style.borderColor=good>.05?'#a5ba92':'#d3cfc4';
    node.style.boxShadow=`0 ${3-hit*2}px 0 #c8c3b8,0 ${5-hit*3}px 10px #28261e18`;
  });
  // The input is present before menu interaction, and pastes happen as whole strings.
  const cardIn=e(b,4.05,5.8),cardA=e(b,4.0,4.8)*(1-e(b,33,34.8));
  S('composer-pose',{opacity:cardA,transform:`translate(${p.x}px,${p.y}px) scale(${p.s})`});
  S('composer-unit',{transform:`rotateX(${(1-cardIn)*8}deg)`});
  S('composer-card',{clipPath:`inset(${(1-cardIn)*49.3}% 0 ${ (1-cardIn)*49.3}% 0 round 30px)`,borderColor:b>=6?'#becdaf':'#d0d7c7'});
  document.querySelector('.app-label').style.opacity=e(b,5,6.1);
  const typeN=Math.floor(baseText.length*u(b,6.15,7.55)),moreN=Math.floor(moreText.length*u(b,24,27));
  $('base-text').textContent=baseText.slice(0,typeN);
  $('insert-one').textContent=b>=12.18?data.phrases[0].text:'';
  $('insert-two').textContent=b>=16.18?data.phrases[1].text:'';
  $('more-text').textContent=moreText.slice(0,moreN);
  S('insert-one',{backgroundColor:`rgba(190,217,160,${.36*A(b,12.18,12.25,13.6,15.2)})`});
  S('insert-two',{backgroundColor:`rgba(190,217,160,${.36*A(b,16.18,16.25,17.6,19.2)})`});
  S('placeholder',{display:typeN===0?'inline':'none'});
  const typing=(b>=6.15&&b<=7.55)||(b>=24&&b<=27);
  S('caret',{display:b>=6?'inline-block':'none',opacity:typing||Math.cos(time*Math.PI*2.2)>-.12?1:0});
  const c=pointer(b),ptrA=Math.max(A(b,4.65,5.0,18.0,18.75),A(b,28.2,28.7,30.65,31.45));
  const press=Math.max(...[6,8,12,16,30].map(v=>pulse(b,v,.32)));
  S('cursor',{opacity:ptrA,transform:`translate(${c.x}px,${c.y}px) scale(${1-press*.13})`});
  const click=[6,8,12,16,30].find(v=>b>=v&&b<v+.95);
  if(click!==undefined){const k=u(b,click,click+.95),q=pointer(click);S('click-pulse',{opacity:(1-k)*.55,transform:`translate(${q.x-36}px,${q.y-36}px) scale(${.18+k*1.35})`});}else S('click-pulse',{opacity:0});
  // The original icon's central keycap aligns with the live menu hub for the reveal.
  const end=e(b,39.5,41.7),reveal=e(b,35.9,37.9);
  const ix=mix(W/2,portrait?510:469,end),iy=mix(H/2,portrait?588:522,end),iw=mix(440,portrait?380:390,end);
  S('outro-icon',{opacity:b>=35.9?1:0,transform:`translate(${ix-iw/2}px,${iy-iw/2}px) scale(${iw/440})`,clipPath:b<38?`circle(${mix(.2,76,e(b,35.9,37.8))}% at 50% 50%)`:'none'});
  document.querySelector('#outro-icon img').style.transform=`rotateY(${mix(-7,0,e(b,37,41.7))}deg) rotateZ(${mix(-2,0,e(b,37,41.7))}deg)`;
  document.querySelector('.icon-floor').style.opacity=e(b,37.5,39.2);
  const copyA=e(b,40.15,42.25),copyX=portrait?50:800,copyY=portrait?942:346;
  S('outro-copy',{opacity:copyA,transform:`translate(${copyX+(portrait?0:(1-copyA)*44)}px,${copyY+(portrait?(1-copyA)*37:0)}px)`});
  S('disclosure',{opacity:A(b,6,8,31,33)*.65});
  window.frameState={time,beat:b,format:portrait?'portrait':'landscape',base:$('base-text').textContent,appended:[$('insert-one').textContent,$('insert-two').textContent],more:$('more-text').textContent,expanded:open>.99,composerVisible:cardA>.95,dockOpacity:dockA,pose:p};
  return window.frameState;
};
const params=new URLSearchParams(location.search);window.renderAt(Number(params.get('t')||0));
if(params.has('play')){
  const player=new Audio('soundtrack.wav');player.preload='auto';
  const start=()=>{player.currentTime=0;player.play();};
  document.body.addEventListener('click',start);
  let startStamp;
  const loop=stamp=>{if(!startStamp)startStamp=stamp;const t=!player.paused?player.currentTime:(stamp-startStamp)/1000%data.timing.duration;window.renderAt(t);requestAnimationFrame(loop);};
  requestAnimationFrame(loop);
}
