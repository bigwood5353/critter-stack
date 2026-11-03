// The game as the Android app runs it: services from App.tsx, rankings from the real Worker code (SQLite stand-in for D1).
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const worker = (await import('../server/scores/src/index.js')).default;
const { periodStart } = await import('../server/scores/src/index.js');

const sql = new DatabaseSync(':memory:');
sql.exec(readFileSync('../server/scores/schema.sql', 'utf8'));
const stmt = (q, a = []) => ({ bind: (...x) => stmt(q, x), first: async () => sql.prepare(q).get(...a) ?? null,
  all: async () => ({ results: sql.prepare(q).all(...a) }), run: async () => sql.prepare(q).run(...a) });
const env = { DB: { prepare: q => stmt(q), batch: async l => Promise.all(l.map(s => s.run())) } };
const api = async (method, path, body) => (await worker.fetch(new Request('https://x' + path, { method, body: body && JSON.stringify(body) }), env)).json();

// a test page with a hook into the game's leaderboard code
let html = readFileSync('test-rel.html', 'utf8');
const i = html.lastIndexOf('})();');
html = html.slice(0, i) + `window.__a={recordRun, boardFlush, showBoards, showStart, settleBoards, periodKey, getName, setName, deviceId, restore:()=>restorePurchases(), NATIVE_LB, get PR(){return PR}, get settingsOpen(){return settingsOpen}};\n` + html.slice(i);
writeFileSync('test-android.html', html);

const ymd = ms => new Date(ms).toISOString().slice(0, 10);
const today = ymd(periodStart('day', Date.now())), yesterday = ymd(periodStart('day', Date.now()) - 864e5);
const hex = () => [...Array(32)].map(() => '0123456789abcdef'[Math.random() * 16 | 0]).join('');
for (let k = 0; k < 12; k++) await api('POST', '/v1/score', { device: 'rival' + k + 'xyz', secret: hex(), name: ['Priya','Jonah','Mira','Kai','Ren','Noor','Bea','Gus','Hana','Ollie','Suki','Theo'][k], platform: 'ios', board: 'daily', period: today, score: 2000 + k * 500, context: k });

let fails = 0; const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fails++; };
const b = await chromium.launch(); const errs = [];
const p = await b.newPage({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });
p.on('pageerror', e => errs.push(e.message));
let online = true, scoreHits = 0;
await p.route('https://scores.woodinteractive.app/**', async route => {
  if (!online) return route.abort('internetdisconnected');
  scoreHits++;
  const r = route.request();
  const res = await worker.fetch(new Request(r.url(), { method: r.method(), body: r.method() === 'POST' ? r.postData() : undefined, headers: r.headers() }), env);
  route.fulfill({ status: res.status, headers: Object.fromEntries(res.headers), body: await res.text() });
});
await p.addInitScript(() => {
  window.__critterNative = ['board', 'store', 'ads', 'haptics', 'notify', 'share', 'app'];
  window.__critterPlatform = 'android';
  window.__sent = [];
  window.ReactNativeWebView = { postMessage: m => window.__sent.push(JSON.parse(m)) };
});
await p.goto('file://' + process.cwd() + '/test-android.html');
await p.evaluate(() => { localStorage.clear(); localStorage.setItem('critterName', 'Hazel');
  localStorage.setItem('critterProgress', JSON.stringify({ v: 2, onboarded: 1, games: 12, home: { O: 40, T: 30 }, unlocked: { challenge: 1, pen: 1 }, seenPzTour: 1, seenPenTour: 1, seenChIntro: 1 })); });
await p.reload(); await p.waitForTimeout(800);
const T = (f, a) => p.evaluate(f, a);
const text = () => T(() => document.getElementById('overlay').innerText);

console.log('Daily Stack score → shared board');
await T(() => { __a.PR.daily = { day: __a.periodKey('daily').split(':')[1], tries: 1 }; __a.recordRun('daily', 4321); });
await p.waitForTimeout(800);
let row = sql.prepare("SELECT s.score, s.tries, p.name, p.platform FROM scores s JOIN players p USING(device) WHERE p.name='Hazel'").get();
ok(row && row.score === 4321 && row.platform === 'android', 'score reached the service from the Android app (4,321)');
await T(() => __a.showBoards('daily')); await p.waitForTimeout(800);
let t = await text();
ok(/#8/.test(t) && /of 13/.test(t), 'Rankings card shows my rank: #8 of 13 (7 players scored more)');
ok(t.includes('Theo') && t.includes('7,500') && t.includes('Hazel') && t.includes('4,321'), 'top 10 shows other players (Theo 7,500) and me');
ok(!/Game Center/.test(t), 'no Game Center button or wording on Android');
await p.screenshot({ path: 'and-rankings.png' });

console.log('Offline');
online = false;
await T(() => __a.recordRun('classic', 9100)); await p.waitForTimeout(600);
ok((await T(() => JSON.parse(localStorage.getItem('critterBoardQueue') || '[]').length)) === 1, 'offline score waits in the queue');
await T(() => { delete __a.NATIVE_LB.classic; __a.showBoards('classic'); }); await p.waitForTimeout(600);
ok(/internet connection/.test(await text()), 'Rankings explains it needs the internet');
online = true;
await T(() => __a.boardFlush()); await p.waitForTimeout(800);
ok((await T(() => localStorage.getItem('critterBoardQueue'))) === null, 'queue is sent once back online');
ok(sql.prepare("SELECT score FROM scores WHERE board='classic'").get()?.score === 9100, 'the offline weekly score arrived (9,100)');

console.log('Prizes from a finished board');
const dev = await T(() => __a.deviceId()), sec = await T(() => localStorage.getItem('critterBoardSecret'));
sql.prepare('INSERT INTO scores VALUES (?,?,?,?,?,?,?,?)').run('daily', yesterday, 'rivalAxyz', 9999, 0, 1, '', 1);
sql.prepare('INSERT INTO players (device,secret,name,created,last) VALUES (?,?,?,?,?)').run('rivalAxyz', hex(), 'Winner', 1, 1);
sql.prepare('INSERT INTO scores VALUES (?,?,?,?,?,?,?,?)').run('daily', yesterday, dev, 8000, 0, 1, '', 2);
const before = await T(() => ({ skips: __a.PR.skips ?? 3, silver: (__a.PR.medals || {}).silver || 0 }));
await T(y => { __a.PR.lb = __a.PR.lb || {}; __a.PR.lb['daily:' + y] = 8000; __a.settleBoards(); }, yesterday);
await p.waitForTimeout(1200);
const after = await T(() => ({ skips: __a.PR.skips, silver: (__a.PR.medals || {}).silver || 0 }));
ok(after.silver === before.silver + 1 && after.skips === before.skips + 6, `2nd place yesterday → silver medal and +6 skips (${before.skips}→${after.skips})`);

console.log('Name');
await T(() => { __a.setName('Zed'); __a.boardFlush(); }); await p.waitForTimeout(600);
ok(sql.prepare('SELECT name FROM players WHERE device=?').get(dev)?.name === 'Zed', 'renaming in the game renames me on the board');
ok(sec && sql.prepare('SELECT secret FROM players WHERE device=?').get(dev)?.secret === sec, 'phone is identified by its own id and secret');

console.log('Back button');
await T(() => __a.showStart()); await p.waitForTimeout(500);
await T(() => window.critterBack()); await p.waitForTimeout(200);
ok(/Press Back again/.test(await T(() => document.body.innerText)), 'first Back on the menu warns');
await T(() => window.critterBack());
ok((await T(() => window.__sent.some(m => m.name === 'app' && m.msg.type === 'exit'))), 'second Back leaves the app');
await T(() => __a.showBoards('daily')); await p.waitForTimeout(400);
await T(() => window.critterBack()); await p.waitForTimeout(400);
ok((await T(() => document.getElementById('ovEyebrow').classList.contains('welcome'))), 'Back on Rankings returns to the menu');
await T(() => __t.newGame('classic')); await p.waitForTimeout(500);
await T(() => window.critterBack()); await p.waitForTimeout(400);
ok(/Leave this game\?/.test(await text()), 'Back in a game opens "Leave this game?"');
await T(() => window.critterBack()); await p.waitForTimeout(400);
ok((await T(() => document.getElementById('overlay').hidden)), 'Back again resumes the game');

console.log('Android wording');
const sees = re => p.waitForFunction(r => new RegExp(r).test(document.body.innerText), re.source, { timeout: 8000 }).then(() => true, () => false);   // messages queue, so wait for each
await T(() => __a.restore());
ok(await sees(/Google Play purchases/), 'Restore says Google Play');
await T(() => window.critterRestored([]));
ok(await sees(/Google account/), '"No purchases to restore on this Google account"');
ok((await T(() => window.__sent.some(m => m.name === 'store' && m.msg.type === 'restore'))), 'restore request goes to the native store');

// the iPhone app must behave exactly as before: no shared board calls at all
console.log('iPhone unchanged');
const p2 = await b.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
p2.on('pageerror', e => errs.push('ios: ' + e.message));
let iosHits = 0;
await p2.route('https://scores.woodinteractive.app/**', r => { iosHits++; r.abort(); });
await p2.addInitScript(() => { window.__critterNative = ['gameCenter', 'store', 'ads', 'haptics', 'notify', 'share', 'cloud']; window.__critterPlatform = 'ios'; window.__sent = []; window.ReactNativeWebView = { postMessage: m => window.__sent.push(JSON.parse(m)) }; });
await p2.goto('file://' + process.cwd() + '/test-android.html'); await p2.waitForTimeout(500);
await p2.evaluate(() => { __a.recordRun('daily', 1234); __a.showBoards('daily'); }); await p2.waitForTimeout(3500);
const gc = await p2.evaluate(() => window.__sent.filter(m => m.name === 'gameCenter').map(m => m.msg.type));
ok(iosHits === 0, 'iPhone never calls the shared board');
ok(gc.includes('submitScore') && gc.includes('loadBoard'), 'iPhone still sends scores to Game Center');
ok(/Game Center/.test(await p2.evaluate(() => document.getElementById('overlay').innerText)), 'iPhone Rankings still has the Game Center button');

console.log(fails ? `\n${fails} FAILED` : '\nall passed');
console.log('ERR', errs);
await b.close(); process.exit(fails ? 1 : 0);
