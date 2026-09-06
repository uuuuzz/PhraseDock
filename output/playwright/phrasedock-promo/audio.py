"""Original, deterministic soundtrack. No samples, TTS, or downloaded music."""
from pathlib import Path
import wave
import numpy as np

RATE = 48000
DURATION = 25
rng = np.random.default_rng(7609)
audio = np.zeros((RATE * DURATION, 2), dtype=np.float64)

def add(signal, start, gain=1.0, pan=0.0):
    offset = round(start * RATE)
    if offset < 0:
        signal = signal[-offset:]
        offset = 0
    count = min(len(signal), len(audio) - offset)
    if count <= 0:
        return
    angle = (np.clip(pan, -1, 1) + 1) * np.pi / 4
    audio[offset:offset+count, 0] += signal[:count] * gain * np.cos(angle)
    audio[offset:offset+count, 1] += signal[:count] * gain * np.sin(angle)

def hz(note):
    return 440 * 2 ** ((note - 69) / 12)

def pad(note, length=7.5, phase=0):
    t = np.arange(round(length * RATE)) / RATE
    f = hz(note)
    envelope = np.minimum(t / 1.15, 1) * np.minimum((length-t) / 2.0, 1)
    return envelope * (np.sin(2*np.pi*f*t+phase) * .66 + np.sin(2*np.pi*f*1.002*t+phase+.3) * .20 + np.sin(2*np.pi*f*2*t+phase) * .10)

def pluck(note, length=2.4):
    t = np.arange(round(length * RATE)) / RATE
    f = hz(note)
    attack = 1 - np.exp(-t*130)
    return attack * (np.sin(2*np.pi*f*t)*np.exp(-t*2.4) + .22*np.sin(2*np.pi*f*2*t)*np.exp(-t*4.8) + .065*np.sin(2*np.pi*f*3*t)*np.exp(-t*9))

# A spacious D major / B minor / G major / A suspended progression.
chords = [(0.0, [50,57,61,64]), (6.25, [47,54,57,62]), (12.5, [43,50,57,59]), (18.75, [45,52,57,62])]
for start, notes in chords:
    for i, note in enumerate(notes):
        add(pad(note, phase=i*.43), start, .025, (i-1.5)/2.3)

melody = [(1.25,74),(2.5,69),(4.375,73),(6.875,74),(8.125,78),(10.625,76),(11.875,74),(13.75,71),(15.0,74),(16.875,78),(19.375,76),(21.25,74),(22.5,69)]
for i,(start,note) in enumerate(melody):
    sig=pluck(note)
    pan=(-.35 if i%2==0 else .35)
    add(sig,start,.048,pan)
    add(sig,start+.235,.012,-pan)
    add(sig,start+.48,.005,pan)

# Quiet, rounded pulse; no aggressive dance beat.
for start in np.arange(3.75, 21.1, 1.25):
    t=np.arange(round(.32*RATE))/RATE
    kick=np.sin(2*np.pi*(49*t+2.5*(1-np.exp(-t*28))))*np.exp(-t*18)*(1-np.exp(-t*250))
    add(kick,float(start),.045)

def tap(start, pan=0, strength=1.0):
    t=np.arange(round(.16*RATE))/RATE
    n=rng.normal(0,1,len(t))
    # Very short filtered noise transient followed by a warm keycap body.
    filtered=(n+np.roll(n,1)+np.roll(n,2))/3
    body=np.sin(2*np.pi*580*t)*np.exp(-t*75)
    tick=filtered*np.exp(-t*200)*.25+body*.75
    add(tick,start,.19*strength,pan)

tap(4.62,-.3,.6)
tap(7.28,.25,1)
tap(9.58,.15,1)
tap(12.64,.4,1)
for start in [5.01,5.23,5.48,5.8,6.1,6.3,16.28,16.6,16.95,17.22,17.46]:
    tap(start,-.35,.16)
for start,note in [(9.73,86),(12.79,90)]:
    add(pluck(note,length=.8),start,.027,.1)

# Soft transitions and a small resolving chord under the closing identity.
for start in [3.48,20.6]:
    t=np.arange(round(.68*RATE))/RATE
    n=rng.normal(0,1,len(t));smooth=np.convolve(n,np.ones(90)/90,mode='same')
    add(smooth*np.sin(np.pi*t/.68)**2,start,.14)
for note in [62,69,73,78]:
    add(pluck(note,length=3.6),21.03,.025,(note-70)/16)

timeline=np.arange(len(audio))/RATE
fade_in=np.clip(timeline/1.1,0,1)
fade_out=np.clip((DURATION-timeline)/1.65,0,1)
audio*=np.minimum(fade_in,fade_out)[:,None]
# Fixed target headroom; gentle peak preservation instead of heavy compression.
audio*=.48/max(np.max(np.abs(audio)),.001)
pcm=np.round(np.clip(audio,-1,1)*32767).astype('<i2')
target=Path(__file__).with_name('soundtrack.wav')
with wave.open(str(target),'wb') as f:
    f.setnchannels(2);f.setsampwidth(2);f.setframerate(RATE);f.writeframes(pcm.tobytes())
print(f'{target.name}: {DURATION}s, stereo 48kHz, peak {20*np.log10(np.max(np.abs(audio))):.1f} dBFS, RMS {20*np.log10(np.sqrt(np.mean(audio**2))):.1f} dBFS')
