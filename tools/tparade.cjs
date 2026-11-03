const {chromium}=require('playwright');
const file=process.argv[2];
(async()=>{ const b=await chromium.launch(); const p=await b.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true}); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.addInitScript(()=>{ window.__critterNative=['gameCenter','store','ads','haptics','notify','share','cloud','app']; window.__critterPlatform='ios'; window.ReactNativeWebView={postMessage:()=>{}}; });
 await p.goto('file://'+file); await p.evaluate(()=>{ localStorage.clear(); localStorage.setItem('critterProgress',JSON.stringify({v:2,onboarded:1,games:3,unlocked:{challenge:1,pen:1},seenPzTour:1,seenPenTour:1,seenChIntro:1})); }); await p.reload(); await p.waitForTimeout(800);
 const moving=async()=>p.evaluate(async()=>{ const cv=document.querySelector('#overlay canvas.parade'); if(!cv) return 'no parade'; const a=cv.toDataURL(); await new Promise(r=>setTimeout(r,700)); return cv.toDataURL()!==a; });
 const out={};
 out.start=await moving();
 // Settings, stay 12 s, Done
 await p.evaluate(()=>{ const g=[...document.querySelectorAll('.homegear')].find(x=>x.offsetParent); g?g.click():__t.openSettings(); }); await p.waitForTimeout(500); await p.waitForTimeout(12000); 
 await p.evaluate(()=>{ [...document.querySelectorAll('button')].filter(b=>b.textContent.trim()==='Done'&&b.offsetParent).pop().click(); }); await p.waitForTimeout(600);
 out.afterSettings12s=await moving();
 // Settings, quick
 await p.evaluate(()=>{ const g=[...document.querySelectorAll('.homegear')].find(x=>x.offsetParent); g?g.click():__t.openSettings(); }); await p.waitForTimeout(500); await p.waitForTimeout(1500);
 await p.evaluate(()=>{ [...document.querySelectorAll('button')].filter(b=>b.textContent.trim()==='Done'&&b.offsetParent).pop().click(); }); await p.waitForTimeout(600);
 out.afterSettingsQuick=await moving();
 // Store via menu, 12 s, back
 await p.evaluate(()=>__t.openStore(null)); await p.waitForTimeout(12000);
 await p.evaluate(()=>{ const b=document.getElementById('ovBack'); if(b&&b.onclick) b.onclick(); else { const d=[...document.querySelectorAll('#overlay button')].find(b=>/Back|Close|Done/.test(b.textContent)); d&&d.click(); } }); await p.waitForTimeout(600);
 out.afterStore12s=await moving();
 // play a game 15 s then menu
 await p.evaluate(()=>__t.newGame('classic')); await p.waitForTimeout(15000);
 await p.evaluate(()=>__t.showStart()); await p.waitForTimeout(600);
 out.afterGame=await moving(); out.gameScreen=await p.evaluate(()=>({hidden:document.getElementById('overlay').hidden,title:document.getElementById('ovTitle').textContent,eyebrow:document.getElementById('ovEyebrow').textContent}));
 // background the app 15 s (page hidden) then return
 await p.evaluate(()=>window.critterAppState&&window.critterAppState('background')); await p.waitForTimeout(15000); await p.evaluate(()=>window.critterAppState&&window.critterAppState('active')); await p.waitForTimeout(600);
 out.afterBackground=await moving(); out.bgScreen=await p.evaluate(()=>({hidden:document.getElementById('overlay').hidden,title:document.getElementById('ovTitle').textContent,eyebrow:document.getElementById('ovEyebrow').textContent}));
 console.log(JSON.stringify(out),'ERR',errs); await b.close(); })();
