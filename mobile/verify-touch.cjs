const {chromium}=require('playwright-core');const fs=require('fs');const assert=require('node:assert/strict');const {execFileSync}=require('child_process');
(async()=>{
const password=require('./test-config.cjs').credentials.password;
const browser=await chromium.launch({executablePath:require('./test-config.cjs').executablePath,args:['--no-sandbox']});
try{
const context=await browser.newContext({viewport:{width:360,height:701},isMobile:true,hasTouch:true,ignoreHTTPSErrors:true,httpCredentials:{username:require('./test-config.cjs').credentials.username,password}});const page=await context.newPage();
await page.goto('https://127.0.0.1:18443/mobile.html?sharing=true&steal=true&sound=false');await page.waitForFunction(()=>window.client?.connected&&Object.values(client.id_to_window).some(w=>w.metadata.title?.startsWith('Xpra验证')));await page.waitForTimeout(3000);console.log(execFileSync('runuser',['-u','browser','--','env','XDG_RUNTIME_DIR=/run/user/1002','xpra','info',':100']).toString().split('\n').filter(l=>/^client\.\d+\.(connection\.(type|protocol-type)|uuid|desktop_size)=/.test(l)).join('\n'));
const title=()=>page.evaluate(()=>Object.values(client.id_to_window).find(w=>w.metadata.title?.startsWith('Xpra验证')).metadata.title);
const beforeY=Number((await title()).match(/y=(\d+)/)[1]);
const cdp=await context.newCDPSession(page);
await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:180,y:500}]});
for(let y=480;y>=200;y-=20){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:180,y}]});await page.waitForTimeout(20);}
await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(1000);
const after=await title();console.log(after);assert(Number(after.match(/y=(\d+)/)[1])>beforeY+100);console.log('PASS actual remote page scrolled from touch');
await page.screenshot({path:require('node:path').resolve(__dirname,'../validation/android-touch-scroll.png')});
const original=await page.evaluate(()=>Object.values(client.id_to_window).find(w=>w.metadata.title?.startsWith('Xpra验证')).wid);
await page.close({runBeforeUnload:true});await new Promise(r=>setTimeout(r,3500));
console.log('Post-close geometry',execFileSync('runuser',['-u','browser','--','env','DISPLAY=:100','xdotool','getwindowgeometry','--shell',String(original)]).toString());
}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
