(() => {
'use strict';
const bar=document.createElement('div');bar.id='mobile-bar';bar.innerHTML='<button id="m-fit">适屏</button><button id="m-desktop">桌面</button><button id="m-input">输入</button><button id="m-enter">回车</button><button id="m-full">全屏</button>';
document.body.append(bar);
const panel=document.createElement('div');panel.id='mobile-input';panel.hidden=true;panel.innerHTML='<label for="m-text">先点远端输入位置，再在这里输入</label><textarea id="m-text" placeholder="使用手机输入法输入中文…"></textarea><div id="mobile-actions"><button id="m-send">粘贴到远端</button><button id="m-send-enter">发送并回车</button><button id="m-close">关闭</button></div><span id="m-status" role="status"></span>';document.body.append(panel);
const text=panel.querySelector('textarea');
for(const name of ['keydown','keyup','keypress','input','compositionstart','compositionend']) panel.addEventListener(name,e=>e.stopPropagation());
let desktop=false,last='',savedWindow=0,previousCapture=true,frame=0;const patchedClients=new WeakSet(),originalGeometry=new Map();let suspended=false;
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
  client.getMouse=function(event,win){
   const element=event.target?.closest?.('.window');
   win=win||(element&&this.id_to_window[element.id]);
   const canvas=win?.canvas;
   const rect=canvas?.getBoundingClientRect();
   if(rect?.width>0&&rect.height>0){
    const pos=win.get_internal_geometry();
    const x=Math.round(pos.x+(event.clientX-rect.left)*canvas.width/rect.width);
    const y=Math.round(pos.y+(event.clientY-rect.top)*canvas.height/rect.height);
    this.last_mouse_x=x;this.last_mouse_y=y;
    return {x,y,button:'which' in event?Math.max(0,event.which):'button' in event?Math.max(0,event.button)+1:0};
   }
   const bounds=this.container.getBoundingClientRect();
   const adjusted={clientX:event.clientX-bounds.left,clientY:event.clientY-bounds.top,movementX:event.movementX,movementY:event.movementY};
   if('which' in event)adjusted.which=event.which;
   else if('button' in event)adjusted.button=event.button;
   return original.call(this,adjusted);
  };
  patchedClients.add(client);
 }
 if(suspended||document.hidden||!panel.hidden)return;
 const w=main();if(!w)return;
 if(!originalGeometry.has(w.wid))originalGeometry.set(w.wid,{x:w.x,y:w.y,w:w.w,h:w.h});
 const rw=desktop?Math.max(1280,vw):Math.max(500,vw);
 const scale=rw/vw;
 const height=Math.max(100,Math.min(desktop?900:1400,Math.round((vh-top)*scale)));
 const rh=Math.max(70,height-(w.topoffset||0)-(w.bottomoffset||0));
 const sig=[rw,rh,w.wid,desktop].join(':');
 client.scale=scale;
 const screen=client.container;screen.style.width=rw+'px';screen.style.height=height+'px';screen.style.transform=`scale(${1/scale})`;screen.style.transformOrigin='top left';
 client.desktop_width=rw;client.desktop_height=height;
 if(sig===last)return;last=sig;
 // Keep the shared server display unchanged; only resize the Chrome window.

 w.move_resize(0,0,rw-(w.leftoffset||0)-(w.rightoffset||0),rh);w.updateCSSGeometry();
}
function scheduleFit(){if(frame)return;frame=requestAnimationFrame(()=>{frame=0;fit(true);});}
function key(name,val,str='',mods=[]){if(!window.client?.connected)return;const w=savedWindow||client.topwindow||main()?.wid;if(!w)return;client.send(['focus',w,[]]);for(const down of [true,false])client.send(['key-action',w,name,down,mods,val,str,0,0]);}
bar.querySelector('#m-fit').onclick=()=>{desktop=false;fit(true)};
bar.querySelector('#m-desktop').onclick=()=>{desktop=true;fit(true)};
bar.querySelector('#m-enter').onclick=()=>key('Return',65293,'\r');
bar.querySelector('#m-full').onclick=()=>document.documentElement.requestFullscreen?.();
bar.querySelector('#m-input').onclick=()=>{if(!window.client?.connected||!panel.hidden)return;savedWindow=client.topwindow||main()?.wid;previousCapture=client.capture_keyboard;client.capture_keyboard=false;panel.hidden=false;panel.querySelector('#m-status').textContent='';text.focus({preventScroll:true});};
function close(){text.blur();panel.hidden=true;if(window.client)client.capture_keyboard=previousCapture;last='';scheduleFit();}
panel.querySelector('#m-close').onclick=close;
let sending=false,composing=false;
text.addEventListener('compositionstart',()=>{composing=true;});
text.addEventListener('compositionend',()=>{composing=false;});
function sendText(enter=false){
 if(sending||composing)return;
 const status=panel.querySelector('#m-status');
 if(!window.client?.connected){status.textContent='连接未就绪，请稍后重试';return;}
 if(!text.value)return;
 if(!client.clipboard_enabled){status.textContent='远端剪贴板未启用，请重新连接';return;}
 const value=text.value;const target=savedWindow;
 sending=true;
 panel.querySelectorAll('#m-send,#m-send-enter').forEach(b=>b.disabled=true);
 client.clipboard_buffer=value;client.send_clipboard_token(Utilities.StringToUint8(value));
 setTimeout(()=>{
  if(client.connected&&client.id_to_window[target]){
   key('v',118,'v',['control']);
   if(enter)setTimeout(()=>{if(client.connected)key('Return',65293,'\r');},150);
   if(text.value===value)text.value='';
   close();
  }else status.textContent='连接已断开，文字已保留';
  sending=false;panel.querySelectorAll('#m-send,#m-send-enter').forEach(b=>b.disabled=false);
 },250);
}
panel.querySelector('#m-send').onclick=()=>sendText();
panel.querySelector('#m-send-enter').onclick=()=>sendText(true);
text.addEventListener('keydown',e=>{if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)&&!e.isComposing){e.preventDefault();sendText();}});

function restoreGeometry(){
 if(!window.client?.connected)return;
 for(const [wid,g] of originalGeometry){const w=client.id_to_window[wid];if(w){w.move_resize(g.x,g.y,g.w,g.h);w.updateCSSGeometry();}}
 last='';
}
function suspend(){if(suspended)return;suspended=true;restoreGeometry();if(window.client?.connected)client.send(['suspend',true,Object.keys(client.id_to_window).map(Number)]);}
function resume(){if(!suspended)return;suspended=false;if(window.client?.connected)client.send(['resume',true,Object.keys(client.id_to_window).map(Number)]);last='';scheduleFit();}
window.addEventListener('pagehide',()=>{suspend();if(window.client){client.reconnect=false;client.close_protocol();}});
window.addEventListener('pageshow',e=>{if(e.persisted)location.reload();});
document.addEventListener('visibilitychange',()=>document.hidden?suspend():resume());

// A tap remains a click; a one-finger swipe sends wheel events instead of dragging.
let gesture=null;
const screen=document.querySelector('#screen');
screen.addEventListener('touchstart',e=>{
 if(e.touches.length!==1){gesture=null;return;}
 const target=e.target.closest('.window');const w=target&&window.client?.id_to_window[target.id];
 if(!w)return;
 const t=e.touches[0];gesture={id:t.identifier,x:t.clientX,y:t.clientY,lastX:t.clientX,lastY:t.clientY,w,moved:false};
 e.preventDefault();e.stopImmediatePropagation();
},{capture:true,passive:false});
screen.addEventListener('touchmove',e=>{
 if(!gesture)return;e.preventDefault();e.stopImmediatePropagation();
 const t=[...e.touches].find(t=>t.identifier===gesture.id);if(!t)return;
 if(!gesture.moved&&Math.hypot(t.clientX-gesture.x,t.clientY-gesture.y)<8)return;
 gesture.moved=true;
 client.on_mousescroll({target:gesture.w.canvas,clientX:gesture.x,clientY:gesture.y,deltaX:gesture.lastX-t.clientX,deltaY:gesture.lastY-t.clientY,deltaMode:0,preventDefault(){},ctrlKey:false,shiftKey:false,altKey:false,metaKey:false},gesture.w);
 gesture.lastX=t.clientX;gesture.lastY=t.clientY;
},{capture:true,passive:false});
screen.addEventListener('touchend',e=>{
 if(!gesture)return;e.preventDefault();e.stopImmediatePropagation();
 if(!gesture.moved&&e.touches.length===0&&window.client?.connected){const t=[...e.changedTouches].find(t=>t.identifier===gesture.id);const ev={target:gesture.w.canvas,clientX:t?.clientX??gesture.x,clientY:t?.clientY??gesture.y,which:1,button:0,ctrlKey:false,shiftKey:false,altKey:false,metaKey:false,preventDefault(){}};client.on_mousedown(ev,gesture.w);client.on_mouseup(ev,gesture.w);}
 gesture=null;
},{capture:true,passive:false});
for(const name of ['mousedown','mouseup','click'])screen.addEventListener(name,e=>{if(e.sourceCapabilities?.firesTouchEvents){e.preventDefault();e.stopImmediatePropagation();}},true);
screen.addEventListener('touchcancel',()=>{gesture=null;},{capture:true});
window.addEventListener('resize',scheduleFit);window.visualViewport?.addEventListener('resize',scheduleFit);window.visualViewport?.addEventListener('scroll',scheduleFit);new ResizeObserver(scheduleFit).observe(bar);scheduleFit();setInterval(()=>fit(),500);
})();
