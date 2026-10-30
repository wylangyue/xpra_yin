#!/usr/bin/python3
"""Restore native window sizes after the last web client disconnects."""
import ast
import json
import os
import re
import subprocess
import time
from pathlib import Path
os.environ.update(DISPLAY=':100', XDG_RUNTIME_DIR='/run/user/1002')
state=Path.home()/'.local/state/xpra-mobile-geometry.json'
state.parent.mkdir(parents=True,exist_ok=True)
try: saved=json.loads(state.read_text())
except (OSError,ValueError): saved={}
had_web=False
pending=False
while True:
    try:
        result=subprocess.run(['xpra','info',':100'],capture_output=True,text=True,timeout=8)
        if result.returncode:
            time.sleep(2);continue
        info=dict(line.split('=',1) for line in result.stdout.splitlines() if '=' in line)
        kinds=[value for key,value in info.items() if re.fullmatch(r'client\.\d+\.connection\.type',key)]
        web=any(kind in ('ws','wss') for kind in kinds)
        native=any(kind=='socket' for kind in kinds)
        windows={}
        for key,value in info.items():
            match=re.fullmatch(r'windows\.(\d+)\.class-instance',key)
            if match and 'Google-chrome' in value:
                wid=match[1]
                geometry=ast.literal_eval(info.get(f'windows.{wid}.client-geometry','()'))
                if len(geometry)==4: windows[wid]=geometry
        if had_web and not web: pending=True
        if pending and not web and native:
            for wid,geometry in saved.items():
                if wid not in windows: continue
                x,y,w,h=geometry
                subprocess.run(['xdotool','windowsize',wid,str(w),str(h),'windowmove',wid,str(x),str(y)],timeout=4,check=True)
                subprocess.run(['xpra','control',':100','moveresize',wid,*map(str,geometry)],timeout=8,check=True)
            print('Restored native Chrome geometry after web disconnect',flush=True)
            pending=False
        elif not web and native and not pending and windows:
            saved=windows
            state.write_text(json.dumps(saved))
        had_web=web
    except (OSError,ValueError,subprocess.SubprocessError) as error:
        print(type(error).__name__,str(error),flush=True)
    time.sleep(2)
