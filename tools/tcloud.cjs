const {chromium}=require('playwright');
const file=process.argv[2];
(async()=>{ const b=await chromium.launch(); const p=await b.newPage({viewport:{width:820,height:1180},isMobile:true,hasTouch:true}); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.addInitScript(()=>{ window.__critterNative=['gameCenter','store','ads','haptics','notify','share','cloud','app']; window.__critterPlatform='ios'; window.__msgs=[]; window.ReactNativeWebView={postMessage:(s)=>window.__msgs.push(s.slice(0,120))}; });
 let navs=0; p.on('framenavigated',()=>navs++);
 await p.goto('file://'+file); await p.evaluate(()=>localStorage.clear()); await p.reload(); await p.waitForTimeout(1200); navs=0;
 // an old install's backup arrives from iCloud
 await p.evaluate(()=>{ const snap={v:2,device:'old-phone',at:Date.now()-864e5,name:'Matt',summary:{home:12,medals:3},data:{critterProgress:JSON.stringify({v:2,onboarded:1,games:9})}}; window.critterCloudBackup(JSON.stringify(snap)); });
 await p.waitForTimeout(800);
 const r=await p.evaluate(()=>({msgs:window.__msgs.filter(m=>m.includes('"app"')), restored:localStorage.getItem('critterCloudRestored'), prog:localStorage.getItem('critterProgress')}));
 console.log(JSON.stringify(r),'pageNavigations:',navs,'ERR',errs);
 // without the app service (old shell / browser) it still reloads itself
 await b.close(); })();
