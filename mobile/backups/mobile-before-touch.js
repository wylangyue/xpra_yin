(() => {
'use strict';
const bar=document.createElement('div');bar.id='mobile-bar';bar.innerHTML='<button id="m-fit">适屏</button><button id="m-desktop">桌面</button><button id="m-input">输入</button><button id="m-enter">回车</button><button id="m-full">全屏</button>';
document.body.append(bar);
const panel=document.createElement('div');panel.id='mobile-input';panel.hidden=true;panel.innerHTML='<label for="m-text">先点远端输入位置，再在这里输入</label><textarea id="m-text" placeholder="使用手机输入法输入中文…"></textarea><div id="mobile-actions"><button id="m-send">粘贴到远端</button><button id="m-close">关闭</button></div><span id="m-status" role="status"></span>';document.body.append(panel);
const text=panel.querySelector('textarea');
for(const name of ['keydown','keyup','keypress','input','compositionstart','compositionend']) panel.addEventListener(name,e=>e.stopPropagation());
let desktop=false,last='',savedWindow=0,previousCapture=true,frame=0;const patchedClients=new WeakSet();
function main(){if(!window.client?.connected)return null;return Object.values(client.id_to_window).filter(w=>!w.tray&&!w.override_redirect&&w.w>=375).sort((a,b)=>b.w*b.h-a.w*a.h)[0];}
function fit(force=false){
 const viewport=window.visualViewport;
 const vw=document.documentElement.clientWidth;
 const vh=Math.floor(viewport?.height||window.innerHeight);
 const top=Math.round(bar.getBoundingClientRect().height);
 document.documentElement.style.setProperty('--mobile-bar-height',top+'px');
 document.documentElement.style.setProperty('--mobile-visible-height',vh+'px');
 panel.style.bottom=Math.max(4,window.innerHeight-vh-(viewport?.offsetTop||0)+4)+'px';
 bar.querySelector('#m-fit').setAttribute('aria-pressed',String(!desktop));
 bar.querySelector('#m-desktop').setAttribute('aria-pressed',String(desktop));
 if(window.client&&!patchedClients.has(client)){
  const original=client.getMouse;
  client.getMouse=function(event){
   const bounds=this.container.getBoundingClientRect();
   const adjusted={clientX:event.clientX-bounds.left,clientY:event.clientY-bounds.top,movementX:event.movementX,movementY:event.movementY};
   if('which' in event)adjusted.which=event.which;
   else if('button' in event)adjusted.button=event.button;
   return original.call(this,adjusted);
  };
  patchedClients.add(client);
 }
 const w=main();if(!w)return;
 const rw=desktop?Math.max(1280,vw):Math.max(500,vw);
 const scale=rw/vw;
 const height=Math.max(100,Math.round((vh-top)*scale));
 const rh=Math.max(70,height-(w.topoffset||0)-(w.bottomoffset||0));
 const sig=[rw,rh,w.wid,desktop].join(':');if(sig===last&&!force)return;last=sig;
 client.scale=scale;
 const screen=client.container;screen.style.width=rw+'px';screen.style.height=height+'px';screen.style.transform=`scale(${1/scale})`;screen.style.transformOrigin='top left';
 client.desktop_width=rw;client.desktop_height=height;
 client.send(['configure-display',{'desktop-size':[rw,height]}]);
 w.move_resize(0,0,rw-(w.leftoffset||0)-(w.rightoffset||0),rh);w.updateCSSGeometry();
}
function scheduleFit(){if(frame)return;frame=requestAnimationFrame(()=>{frame=0;fit(true);});}
function key(name,val,str='',mods=[]){if(!window.client?.connected)return;const w=savedWindow||client.topwindow||main()?.wid;if(!w)return;client.send(['focus',w,[]]);for(const down of [true,false])client.send(['key-action',w,name,down,mods,val,str,0,0]);}
bar.querySelector('#m-fit').onclick=()=>{desktop=false;fit(true)};
bar.querySelector('#m-desktop').onclick=()=>{desktop=true;fit(true)};
bar.querySelector('#m-enter').onclick=()=>key('Return',65293,'\r');
bar.querySelector('#m-full').onclick=()=>document.documentElement.requestFullscreen?.();
bar.querySelector('#m-input').onclick=()=>{if(!window.client?.connected)return;savedWindow=client.topwindow||main()?.wid;previousCapture=client.capture_keyboard;client.capture_keyboard=false;panel.hidden=false;text.focus();};
function close(){text.blur();panel.hidden=true;if(window.client)client.capture_keyboard=previousCapture;}
panel.querySelector('#m-close').onclick=close;
panel.querySelector('#m-send').onclick=()=>{if(!window.client?.connected){panel.querySelector('#m-status').textContent='连接未就绪，请稍后重试';return;}if(!text.value)return;const value=text.value;client.clipboard_buffer=value;client.send_clipboard_token(Utilities.StringToUint8(value));setTimeout(()=>{key('v',118,'v',['control']);if(text.value===value)text.value='';panel.querySelector('#m-status').textContent='已发出粘贴请求';},250);};
window.addEventListener('resize',scheduleFit);window.visualViewport?.addEventListener('resize',scheduleFit);window.visualViewport?.addEventListener('scroll',scheduleFit);new ResizeObserver(scheduleFit).observe(bar);scheduleFit();setInterval(()=>fit(),500);
})();
