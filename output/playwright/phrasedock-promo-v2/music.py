"""Edit a licensed music bed and generate frame-locked tactile sound accents."""
from pathlib import Path
import json, subprocess, wave, urllib.request
import numpy as np

BASE=Path(__file__).parent
FFMPEG='D:/APP/JianyingPro/11.3.0.14362/ffmpeg.exe'
RATE=48000
BPM=122
BEAT=60/BPM
FPS=60
FRAMES=round(48*BEAT*FPS)
DURATION=FRAMES/FPS
SOURCE_START=32*BEAT+.026
SOURCE=BASE/'assets'/'tech-house-vibes.mp3'
SOURCE.parent.mkdir(exist_ok=True)
if not SOURCE.exists():
    urllib.request.urlretrieve('https://assets.mixkit.co/music/130/130.mp3',SOURCE)
TIMING={'bpm':BPM,'beat':BEAT,'fps':FPS,'frames':FRAMES,'duration':DURATION,'sourceStart':SOURCE_START,'source':'Tech House vibes — Alejandro Magaña (A. M.) / Mixkit','events':{'focus':6,'open':8,'firstClick':12,'firstPaste':12.18,'secondClick':16,'secondPaste':16.18,'typeStart':24,'typeEnd':27,'close':30,'identity':36,'endCard':40}}
(BASE/'timing.json').write_text(json.dumps(TIMING,indent=2),encoding='utf8')
subprocess.run([FFMPEG,'-hide_banner','-loglevel','error','-y','-ss',str(SOURCE_START),'-i',str(SOURCE),'-t',str(DURATION),'-ar',str(RATE),'-ac','2','-c:a','pcm_s16le',str(BASE/'assets'/'music-cut.wav')],check=True)
with wave.open(str(BASE/'assets'/'music-cut.wav'),'rb') as f:
    bed=np.frombuffer(f.readframes(f.getnframes()),dtype='<i2').astype(np.float64).reshape(-1,2)/32768
N=round(DURATION*RATE)
audio=np.zeros((N,2));audio[:min(N,len(bed))]=bed[:N]*.39
t=np.arange(N)/RATE
beat_time=t/BEAT
fade_in=np.clip(t/.045,0,1)
fade_out=np.clip((DURATION-t)/(BEAT*2.5),0,1)**1.5
audio*=np.minimum(fade_in,fade_out)[:,None]
for b in [12,16,30]:
    duck=1-.24*np.exp(-np.maximum(t-b*BEAT,0)*13)*(t>=b*BEAT)
    audio*=duck[:,None]
# A half-beat breath draws attention to the cursor before typing resumes.
breath=np.clip((beat_time-23.5)/.22,0,1)*np.clip((24.1-beat_time)/.16,0,1)
audio*=1-.47*breath[:,None]
rng=np.random.default_rng(12248)
def add(signal, at, gain=1, pan=0):
    offset=round(at*RATE);count=min(len(signal),N-offset)
    if count<=0:return
    theta=(pan+1)*np.pi/4
    audio[offset:offset+count,0]+=signal[:count]*gain*np.cos(theta)
    audio[offset:offset+count,1]+=signal[:count]*gain*np.sin(theta)
def key(at, strength=1, pan=0):
    q=np.arange(int(RATE*.13))/RATE
    n=rng.normal(0,1,len(q));n=(n+np.roll(n,1))*.5
    sig=.35*n*np.exp(-q*300)+np.sin(2*np.pi*660*q)*np.exp(-q*90)*.3+np.sin(2*np.pi*185*q)*np.exp(-q*43)*.4
    add(sig,at,.27*strength,pan)
def air(at,length=.38,gain=.09,pan=0):
    q=np.arange(int(RATE*length))/RATE
    n=rng.normal(0,1,len(q))
    soft=np.convolve(n,np.ones(32)/32,mode='same')
    add(soft*np.sin(np.pi*q/length)**2,at,gain,pan)
for b,strength,pan in [(6,.7,-.2),(8,1,.1),(12,1,.2),(16,1,.32),(30,.9,.1)]:key(b*BEAT,strength,pan)
for i in range(6):key((8.1+i*.11)*BEAT,.18,(i-2.5)*.12)
for b in np.arange(6.4,7.55,.16):key(float(b)*BEAT,.12,-.2)
for b in np.arange(24.2,27,.29):key(float(b)*BEAT,.13,-.15)
for b in [3.1,20.1,32.2,36.1,40.1]:air(b*BEAT,.42,.16)
air(1.0*BEAT,.4,.06)
audio=np.tanh(audio*1.08)/1.08
pcm=np.round(np.clip(audio,-1,1)*32767).astype('<i2')
with wave.open(str(BASE/'mix-pre.wav'),'wb') as f:
    f.setnchannels(2);f.setsampwidth(2);f.setframerate(RATE);f.writeframes(pcm.tobytes())
subprocess.run([FFMPEG,'-hide_banner','-loglevel','error','-y','-i',str(BASE/'mix-pre.wav'),'-af','loudnorm=I=-16:TP=-1.5:LRA=8','-ar',str(RATE),'-c:a','pcm_s16le',str(BASE/'soundtrack.wav')],check=True)
print(json.dumps(TIMING,ensure_ascii=True,indent=2))
