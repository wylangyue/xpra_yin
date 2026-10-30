import json,subprocess,time,sys,re
from pathlib import Path
root=Path(__file__).resolve().parent
pid=int(subprocess.check_output(['/usr/bin/pgrep','-f','^'+re.escape(str(Path.home()/'Applications/Xpra.app/Contents/Frameworks/bin/Python'))+' '+re.escape(str(root/'mac-native-ime-client.py'))+' attach'],text=True).strip())
def cpu():
 value=subprocess.check_output(['/bin/ps','-p',str(pid),'-o','time='],text=True).strip();fields=value.split(':');return sum(float(v)*60**i for i,v in enumerate(reversed(fields)))
a=cpu();start=time.monotonic()
result=subprocess.run(['/usr/bin/ssh','-F',str(root/'ssh_config'),'-o','BatchMode=yes','remote-browser','python3','/tmp/xpra-perf-bench.py',*sys.argv[1:]],capture_output=True,text=True,timeout=55)
duration=time.monotonic()-start
if result.returncode:raise RuntimeError(result.stderr)
data=json.loads(result.stdout);data['mac_measurement_duration_s']=round(duration,2)
data['mac_cpu_one_core_percent']=round((cpu()-a)/duration*100,1)
(root/('perf-'+sys.argv[1]+'.json')).write_text(json.dumps(data,ensure_ascii=False,indent=2))
summary={k:v for k,v in data.items() if k!='rows'}
summary['samples']=[{k:r[k] for k in ['ping_ms','quality','speed','batch_ms','ack_pending','refresh_state','decode_errors']} for r in data['rows']]
print(json.dumps(summary,ensure_ascii=False))
