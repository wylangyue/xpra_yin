import os,sys,subprocess,time,json,re,ast
from pathlib import Path
os.environ.update(DISPLAY=':100',XDG_RUNTIME_DIR='/run/user/1002')
label=sys.argv[1];q=int(sys.argv[2]);speed=int(sys.argv[3]);refresh=int(sys.argv[4]);wid='4194308'
def run(args):return subprocess.check_output(args,text=True,stderr=subprocess.DEVNULL)
# Profile parameters arrive via a fresh client command line, not live setters.
# Live setters on this installed server accidentally leave fixed=0.
def pid_for(pattern):
 for line in run(['ps','-u','browser','-o','pid=,args=']).splitlines():
  p,_,cmd=line.strip().partition(' ')
  if pattern in cmd:return int(p)
 raise RuntimeError(pattern)
server=pid_for('/usr/bin/xpra start :100');proxy=pid_for('/usr/bin/xpra _proxy 100')
clock=os.sysconf('SC_CLK_TCK')
def cpu(pid):
 s=Path(f'/proc/{pid}/stat').read_text().split(') ',1)[1].split();return (int(s[11])+int(s[12]))/clock

def bytes_io():
 return int(dict(l.split(':',1) for l in Path(f'/proc/{proxy}/io').read_text().splitlines())['wchar'])

def snapshot():
 raw=run(['xpra','info',':100']);info=dict(l.split('=',1) for l in raw.splitlines() if '=' in l)
 p=f'client.0.window.{wid}.'
 keys={'draws':'client.0.connection.output.count.draw','ping_ms':'client.0.connection.client.ping_latency.cur','quality':p+'encoding.quality.cur','speed':p+'encoding.speed.cur','target_latency_ms':p+'damage.target-latency','decode_speed':p+'batch.client-decode-speed.recent','batch_ms':'client.0.batch.delay.cur','ack_pending':p+'damage.ack-pending','encoding_pending':p+'damage.encoding-pending','min_quality':p+'encoding.quality.min-quality','min_speed':p+'encoding.speed.min-speed','refresh_ms':p+'encodings.auto-refresh.delay','refresh_state':p+'encodings.auto-refresh.last-event.message','decode_errors':'client.0.encoding.decode_errors'}
 row={'time':time.monotonic(),'server_cpu':cpu(server),'proxy_io':bytes_io()}
 for k,path in keys.items():
  v=info.get(path)
  try:v=ast.literal_eval(v)
  except (ValueError,TypeError,SyntaxError):pass
  row[k]=v
 return row

# Refuse to reload a personal page: always create a dedicated new tab first.
run(['/usr/bin/google-chrome-stable','--user-data-dir=/home/browser/chrome-profile','--new-tab','file:///tmp/xpra-perf-test.html'])
# Warm caches and shaders before the measured repeat.
time.sleep(5)
run(['xdotool','key','--clearmodifiers','ctrl+r'])
rows=[];start=time.monotonic()
for point in [0,5,10,15,20,25,28,31]:
 remaining=start+point-time.monotonic()
 if remaining>0:time.sleep(remaining)
 rows.append(snapshot())
a,b=rows[0],rows[-1];duration=b['time']-a['time']
result={'label':label,'min_quality':q,'min_speed':speed,'refresh_ms':refresh,'duration_s':round(duration,2),'proxy_io_mib':round((b['proxy_io']-a['proxy_io'])/1048576,2),'proxy_io_mbps':round((b['proxy_io']-a['proxy_io'])*8/duration/1e6,2),'server_cpu_one_core_percent':round((b['server_cpu']-a['server_cpu'])/duration*100,1),'draw_packets':b['draws']-a['draws'],'rows':rows}
Path(f'/tmp/xpra-perf-{label}.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
# Close only this known test tab; preserve the prior user tab.
name=run(['xdotool','getwindowname',wid])
if name.startswith('Xpra 性能对照测试'):run(['xdotool','key','--clearmodifiers','ctrl+w'])
print(json.dumps(result,ensure_ascii=False))
