const {chromium}=require('playwright');
(async()=>{ const b=await chromium.launch(); const errs=[]; let fails=0; const ok=(c,m)=>{console.log((c?'  ✓ ':'  ✗ ')+m); if(!c) fails++;};
 for(const plat of ['ios','android']){
  const p=await b.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true}); p.on('pageerror',e=>errs.push(plat+': '+e.message));
  await p.addInitScript(pl=>{ window.__critterNative = pl==='ios'?['gameCenter','store','ads','haptics','notify','share','cloud','app']:['board','store','ads','haptics','notify','share','app'];
    window.__critterPlatform=pl; window.__sent=[]; window.ReactNativeWebView={postMessage:m=>window.__sent.push(JSON.parse(m))}; }, plat);
  await p.route('https://scores.woodinteractive.app/**', r=>r.abort());
  await p.goto('file://'+process.cwd()+'/test-rel.html');
  await p.evaluate(()=>{ localStorage.clear(); localStorage.setItem('critterProgress',JSON.stringify({v:2,onboarded:1,games:3,unlocked:{challenge:1,pen:1},seenPzTour:1,seenPenTour:1,seenChIntro:1})); }); await p.reload(); await p.waitForTimeout(600);
  console.log(plat);
  await p.evaluate(()=>__t.openSettings()); await p.waitForTimeout(500);
  const rate=p.locator('button.rate'); ok(await rate.count()===1 && /Rate Critter Stack/.test(await rate.textContent()), 'Settings has "⭐ Rate Critter Stack"');
  await p.waitForTimeout(400); await rate.click(); await p.waitForTimeout(200);
  const url=await p.evaluate(()=>{ const m=window.__sent.find(m=>m.name==='app'&&m.msg.type==='openURL'); return m&&m.msg.url; });
  ok(plat==='ios' ? url==='https://apps.apple.com/app/id6818896969?action=write-review' : url==='https://play.google.com/store/apps/details?id=com.critterstack.app&showAllReviews=true', 'opens the review page: '+url);
  // notifications blocked
  await p.evaluate(()=>window.critterNotifyResult(false,'denied')); await p.waitForTimeout(500);
  const t=await p.evaluate(()=>document.getElementById('overlay').innerText);
  ok(/Notifications are off/.test(t) && /Open Settings/.test(t) && new RegExp(plat==='ios'?'iPhone':'phone').test(t), 'blocked notifications explain and offer Open Settings');
  await p.waitForTimeout(400); await p.getByText('Open Settings').click(); await p.waitForTimeout(200);
  ok(await p.evaluate(()=>window.__sent.some(m=>m.name==='app'&&m.msg.type==='openSettings')), 'Open Settings asks the app to open the phone Settings');
  await p.evaluate(()=>window.critterNotifyResult(false)); await p.waitForTimeout(300);
  ok(/No problem/.test(await p.evaluate(()=>document.body.innerText)), 'a first-time "no" still just says No problem');
  await p.evaluate(()=>window.critterNotifyResult(true)); await p.waitForTimeout(2600);
  ok(await p.evaluate(()=>JSON.parse(localStorage.getItem('critterProgress')).remind.on===true), 'allowing turns the reminder on');
  await p.close(); }
 const w=await b.newPage(); await w.goto('file://'+process.cwd()+'/test-rel.html'); await w.waitForTimeout(500);
 await w.evaluate(()=>__t.openSettings()); await w.waitForTimeout(400); ok(await w.locator('button.rate').count()===0, 'plain web version has no Rate button (no store to open)');
 console.log(fails?fails+' FAILED':'all passed'); console.log('ERR',errs); await b.close(); })();
