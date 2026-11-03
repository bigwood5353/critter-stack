const {chromium}=require('playwright');
const file=process.argv[2];
(async()=>{ const b=await chromium.launch();
 for (const vp of [{width:1032,height:1376},{width:820,height:1180},{width:1180,height:820}]) {
 const p=await b.newPage({viewport:vp,isMobile:true,hasTouch:true}); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{if(m.type()==='error')errs.push('console:'+m.text())});
 await p.addInitScript(()=>{ window.__critterNative=['gameCenter','store','ads','haptics','notify','share','cloud','app']; window.__critterPlatform='ios'; window.__msgs=[]; window.ReactNativeWebView={postMessage:(s)=>window.__msgs.push([Date.now(),s.slice(0,200)])}; });
 await p.goto('file://'+file); await p.evaluate(()=>localStorage.clear()); await p.reload(); await p.waitForTimeout(1500);
 const title=await p.evaluate(()=>document.getElementById('ovTitle').textContent);
 // name prompt -> Next
 await p.evaluate(()=>{ const i=document.getElementById('onbName'); if(i){i.value='Matt';} const n=[...document.querySelectorAll('#overlay button')].find(b=>b.textContent.trim()==='Next'); n&&n.click(); });
 await p.waitForTimeout(800);
 const before=await p.evaluate(()=>window.__msgs.length);
 await p.evaluate(()=>{ const s=[...document.querySelectorAll('#overlay button')].find(b=>/Skip/.test(b.textContent)); s.click(); });
 await p.waitForTimeout(3000);
 const msgs=await p.evaluate(()=>window.__msgs);
 const t2=await p.evaluate(()=>document.getElementById('ovTitle').textContent);
 console.log(JSON.stringify(vp),'first:',title,'after:',t2,'\nall msgs:',msgs.map(m=>m[1]).join('\n  '),'\nafterSkip idx',before,'\nERR',errs);
 await p.close(); }
 await b.close(); })();
