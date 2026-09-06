from pathlib import Path
import json, wave
import numpy as np

base=Path(__file__).parent
for name in ['tech-house-analysis','groove-analysis']:
    with wave.open(str(base/'assets'/f'{name}.wav'),'rb') as f:
        sr=f.getframerate();x=np.frombuffer(f.readframes(f.getnframes()),dtype='<i2').astype(float)/32768
    hop=220; size=1024
    frames=np.lib.stride_tricks.sliding_window_view(x,size)[::hop]
    spect=np.abs(np.fft.rfft(frames*np.hanning(size),axis=1))
    hz=np.fft.rfftfreq(size,1/sr)
    flux=np.maximum(np.diff(spect,axis=0,prepend=spect[:1]),0)
    bands=[flux[:,(hz>40)&(hz<180)].sum(1),flux[:,(hz>180)&(hz<2000)].sum(1),flux[:,hz>2000].sum(1)]
    low=bands[0]/max(np.percentile(bands[0],97),.001)
    mid=bands[1]/max(np.percentile(bands[1],97),.001)
    onset=np.minimum(low,2)*.7+np.minimum(mid,2)*.3
    times=np.arange(len(onset))*hop/sr+size/2/sr
    options=[]
    for bpm in np.arange(90,136,.1):
        period=60/bpm
        for phase in np.arange(0,period,.012):
            grid=np.arange(phase,39,period)
            grid=grid[(grid>4)&(grid<39)]
            val=np.interp(grid,times,onset)+.5*np.interp(grid+.015,times,onset)+.5*np.interp(grid-.015,times,onset)
            options.append((float(np.mean(val)),float(bpm),float(phase)))
    options.sort(reverse=True)
    best=options[0]
    print(name,'best grid',best,'rms',round(float(20*np.log10(np.sqrt(np.mean(x*x)))),1))
    strong=[(round(float(times[i]),3),round(float(onset[i]),3)) for i in range(1,len(onset)-1) if onset[i]>max(onset[i-1],onset[i+1],.8)]
    print('first 20s strong onsets',strong[:45])
    (base/'assets'/f'{name}-beats.json').write_text(json.dumps({'grid_score':best[0],'bpm':best[1],'phase':best[2],'hop':hop/sr,'onset':onset.tolist(),'time':times.tolist(),'strong':strong}),encoding='utf8')
