const {chromium}=require('playwright-core');
const fs=require('fs');
const assert=require('node:assert/strict');
(async()=>{
 const password=require('./test-config.cjs').credentials.password;
 const browser=await chromium.launch({executablePath:require('./test-config.cjs').executablePath,args:['--no-sandbox']});
 try {
 const context=await browser.newContext({viewport:{width:360,height:701},isMobile:true,hasTouch:true,ignoreHTTPSErrors:true,httpCredentials:{username:require('./test-config.cjs').credentials.username,password},userAgent:'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36'});
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('https://127.0.0.1:18443/mobile.html?sharing=true&steal=true&sound=false&printing=false&file_transfer=false');
 await page.waitForFunction(()=>window.client?.connected&&window.client.scale>1);
 for(const [width,height] of [[360,701],[412,915],[800,360],[360,330],[360,701]]) {
 await page.setViewportSize({width,height});await page.waitForTimeout(1000);
 const geometry=await page.evaluate(()=>({connected:client.connected,scale:client.scale,bar:document.querySelector('#mobile-bar').getBoundingClientRect().toJSON(),screen:document.querySelector('#screen').getBoundingClientRect().toJSON(),overflow:document.documentElement.scrollWidth>innerWidth,buttons:[...document.querySelectorAll('#mobile-bar button')].map(b=>({width:b.clientWidth,scroll:b.scrollWidth}))}));
 assert(geometry.connected);assert(!geometry.overflow);assert(Math.abs(geometry.screen.width-width)<1);assert(geometry.screen.bottom<=height+1);assert(geometry.buttons.every(b=>b.width>=44&&b.scroll<=b.width));
 const pointer=await page.evaluate(()=>{const r=client.container.getBoundingClientRect();const p=client.getMouse({clientX:r.left+100,clientY:r.top+100,button:0});return {p,expected:Math.round(100*client.scale)};});
 assert.equal(pointer.p.x,pointer.expected);assert.equal(pointer.p.y,pointer.expected);assert.equal(pointer.p.button,1);
 console.log('PASS viewport and pointer',width,height,'scale',geometry.scale);
 await page.screenshot({path:require('node:path').resolve(__dirname,`../validation/android-${width}x${height}.png`)});
 }
 await page.evaluate(()=>{
 const w=Object.values(client.id_to_window).find(w=>!w.tray&&w.canvas);
 const r=w.canvas.getBoundingClientRect(),g=w.get_internal_geometry();
 for(const [fx,fy] of [[0.05,0.05],[0.5,0.5],[0.95,0.95]]){
  const p=client.getMouse({clientX:r.left+r.width*fx,clientY:r.top+r.height*fy,button:0},w);
  if(Math.abs(p.x-(g.x+g.w*fx))>1||Math.abs(p.y-(g.y+g.h*fy))>1)throw Error('Window coordinates drift');
 }
});console.log('PASS window canvas coordinates at corners and center');
 await page.evaluate(()=>{
  const originalDown=client.on_mousedown,originalUp=client.on_mouseup;
  const container=document.createElement('div');container.id='987654321';container.className='undecorated';
  container.style.cssText='position:absolute;left:30px;top:80px;width:100px;height:100px;z-index:999999';
  const canvas=document.createElement('canvas');canvas.width=300;canvas.height=150;canvas.style.cssText='width:100px;height:100px';
  container.append(canvas);client.container.append(container);
  const fake={wid:987654321,canvas,get_internal_geometry:()=>({x:70,y:90,w:200,h:250})};
  client.id_to_window[fake.wid]=fake;
  let clicks=[];client.on_mousedown=(e,w)=>clicks.push({wid:w.wid,...client.getMouse(e,w)});client.on_mouseup=()=>{};
  try{
   const r=canvas.getBoundingClientRect();
   for(const [fx,fy] of [[0,0],[0.999,0],[0,0.999],[0.999,0.999],[1,1]]){
    const x=r.left+r.width*fx,y=r.top+r.height*fy;
    const point=new Touch({identifier:1,target:canvas,clientX:x,clientY:y});
    canvas.dispatchEvent(new TouchEvent('touchstart',{bubbles:true,cancelable:true,touches:[point],changedTouches:[point]}));
    const lifted=new Touch({identifier:1,target:canvas,clientX:x+2,clientY:y+2});
    canvas.dispatchEvent(new TouchEvent('touchend',{bubbles:true,cancelable:true,touches:[],changedTouches:[lifted]}));
    const hit=clicks.at(-1);
    if(!hit||hit.wid!==fake.wid||hit.x!==70+Math.min(199,Math.floor(fx*200))||hit.y!==90+Math.min(249,Math.floor(fy*250)))throw Error('Edge touch mismatch: '+JSON.stringify(hit));
   }
   if(clicks.length!==5)throw Error('Missing or duplicate edge click');
  }finally{client.on_mousedown=originalDown;client.on_mouseup=originalUp;delete client.id_to_window[fake.wid];container.remove();}
 });console.log('PASS touch dispatch on undecorated popup edges, stale canvas size, release jitter');

 const remoteSize=await page.evaluate(()=>{const w=Object.values(client.id_to_window).find(w=>!w.tray&&w.canvas);return [w.w,w.h];});
 await page.locator('#m-input').tap();await page.locator('#m-text').fill('安卓中文输入验证');
 assert.equal(await page.locator('#m-text').inputValue(),'安卓中文输入验证');assert.equal(await page.evaluate(()=>client.capture_keyboard),false);
 await page.setViewportSize({width:360,height:330});await page.waitForTimeout(500);
 assert.deepEqual(await page.evaluate(()=>{const w=Object.values(client.id_to_window).find(w=>!w.tray&&w.canvas);return [w.w,w.h];}),remoteSize);
 const panel=await page.locator('#mobile-input').boundingBox();assert(panel.y>=52&&panel.y+panel.height<=330);
 await page.screenshot({path:require('node:path').resolve(__dirname,'../validation/android-input-keyboard.png')});
 await page.locator('#m-close').tap();assert(await page.locator('#mobile-input').isHidden());
 await page.setViewportSize({width:360,height:701});await page.locator('#m-desktop').tap();await page.waitForTimeout(800);assert.equal(await page.evaluate(()=>client.desktop_width),1280);assert(await page.evaluate(()=>client.desktop_height<=900));
 await page.locator('#m-fit').tap();await page.waitForTimeout(800);assert.equal(await page.evaluate(()=>client.desktop_width),500);
 assert.deepEqual(errors,[]);console.log('PASS input isolation, keyboard-sized viewport, layout switching, no page errors');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
