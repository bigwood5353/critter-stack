// Local test of the rankings Worker against Node's built-in SQLite (stands in for Cloudflare D1).
//   node test/run.mjs
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import worker, { periodStart } from '../src/index.js';

const sql = new DatabaseSync(':memory:');
sql.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
const stmt = (q, args = []) => ({
  bind: (...a) => stmt(q, a),
  first: async () => sql.prepare(q).get(...args) ?? null,
  all: async () => ({ results: sql.prepare(q).all(...args) }),
  run: async () => sql.prepare(q).run(...args),
});
const env = { DB: { prepare: q => stmt(q), batch: async list => Promise.all(list.map(s => s.run())) } };

let fails = 0;
const ok = (cond, msg) => { console.log((cond ? '  ✓ ' : '  ✗ ') + msg); if (!cond) fails++; };
const call = async (method, path, body) => {
  const res = await worker.fetch(new Request('https://scores.test' + path, { method, body: body ? JSON.stringify(body) : undefined }), env);
  return { status: res.status, body: await res.json().catch(() => null), headers: res.headers };
};
const ymd = ms => new Date(ms).toISOString().slice(0, 10);
const today = ymd(periodStart('day', Date.now())), week = ymd(periodStart('week', Date.now()));
const hex = n => [...Array(n)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
const players = Array.from({ length: 14 }, (_, i) => ({ device: 'dev' + i + 'abcdef', secret: hex(32), name: 'Player ' + i }));

console.log('Daily board');
for (const [i, p] of players.entries()) {
  const r = await call('POST', '/v1/score', { ...p, platform: i % 2 ? 'ios' : 'android', board: 'daily', period: today, score: 1000 + i * 100, context: i });
  if (i === 0) ok(r.status === 200 && r.body.rank === 1 && r.body.total === 1, 'first score is #1 of 1');
}
let b = await call('GET', `/v1/board?board=daily&period=${today}&device=${players[0].device}`);
ok(b.status === 200 && b.body.total === 14, 'total counts every player (14)');
ok(b.body.entries.length === 11 && b.body.entries[0].name === 'Player 13' && b.body.entries[0].rank === 1, 'top 10 in order, plus my own row');
ok(b.body.entries[10].me && b.body.entries[10].rank === 14 && b.body.player.rank === 14, 'my row is added when I am outside the top 10');
ok(b.headers.get('Access-Control-Allow-Origin') === '*', 'CORS header present');

console.log('Daily tries');
const p0 = players[0];
let r = await call('POST', '/v1/score', { ...p0, board: 'daily', period: today, score: 900 });
ok(r.status === 200 && r.body.best === 1000, 'lower second try keeps the best (1000)');
r = await call('POST', '/v1/score', { ...p0, board: 'daily', period: today, score: 5000 });
ok(r.status === 200 && r.body.best === 5000 && r.body.rank === 1, 'higher third try counts and ranks #1');
r = await call('POST', '/v1/score', { ...p0, board: 'daily', period: today, score: 9000 });
ok(r.status === 409, 'a 4th Daily Stack try is refused');

r = await call('POST', '/v1/score', { ...players[8], board: 'daily', period: today, score: 3000, run: 'abc123run' });
r = await call('POST', '/v1/score', { ...players[8], board: 'daily', period: today, score: 3000, run: 'abc123run' });
r = await call('POST', '/v1/score', { ...players[8], board: 'daily', period: today, score: 3100, run: 'def456run' });
ok(r.status === 200 && sql.prepare('SELECT tries FROM scores WHERE board=? AND period=? AND device=?').get('daily', today, players[8].device).tries === 3,
  'a retried send of the same game counts once (3 tries = 2 games + earlier one)');

console.log('Weekly board and ties');
await call('POST', '/v1/score', { ...players[1], board: 'classic', period: week, score: 7000 });
await call('POST', '/v1/score', { ...players[2], board: 'classic', period: week, score: 7000 });
await call('POST', '/v1/score', { ...players[3], board: 'classic', period: week, score: 6000 });
b = await call('GET', `/v1/board?board=classic&period=${week}&device=${players[3].device}`);
ok(b.body.entries.map(e => e.rank).join(',') === '1,1,3', 'tied scores share a rank (1,1,3)');
r = await call('POST', '/v1/score', { ...players[4], board: 'classic', period: week, score: 8000 });
r = await call('POST', '/v1/score', { ...players[4], board: 'classic', period: week, score: 8500 });
ok(r.status === 200 && r.body.best === 8500, 'weekly boards have no try limit');

console.log('Safety checks');
r = await call('POST', '/v1/score', { ...players[5], secret: hex(32), board: 'daily', period: today, score: 99 });
ok(r.status === 403, 'someone else\'s device id with the wrong secret is refused');
r = await call('POST', '/v1/score', { ...players[6], board: 'daily', period: today, score: 999999999 });
ok(r.status === 400, 'impossible score is refused');
r = await call('POST', '/v1/score', { ...players[6], board: 'classic', period: today === week ? ymd(Date.parse(week) + 864e5) : today, score: 10 });
ok(r.status === 400, 'a weekly board must start on a Monday');
r = await call('POST', '/v1/score', { ...players[6], board: 'daily', period: '2020-01-01', score: 10 });
ok(r.status === 409, 'a long-finished board is closed');
r = await call('POST', '/v1/score', { device: 'newphone12345', secret: hex(32), name: 'fuuuck', board: 'daily', period: today, score: 50 });
b = await call('GET', `/v1/board?board=daily&period=${today}&device=newphone12345`);
ok(b.body.entries.find(e => e.me).name === 'Player', 'a rude name shows as "Player"');
r = await call('POST', '/v1/name', { ...players[1], name: 'Hazel' });
b = await call('GET', `/v1/board?board=classic&period=${week}&device=x`);
ok(r.body.name === 'Hazel' && b.body.entries.some(e => e.name === 'Hazel'), 'renaming updates the boards');
let last;
for (let i = 0; i < 35; i++) last = await call('POST', '/v1/name', { ...players[7], name: 'Spam' });
ok(last.status === 429, 'more than 30 posts a minute from one phone are slowed down');

console.log('Final ranks');
r = await call('GET', `/v1/rank?board=daily&period=${today}&device=${p0.device}`);
ok(r.body.rank === 1 && r.body.total === 15, 'final rank lookup (#1 of 15)');
r = await call('GET', `/v1/rank?board=daily&period=${today}&device=nobodyhere1`);
ok(r.body.rank === null, 'a player who never posted has no rank');

console.log('Clean-up');
sql.prepare('INSERT INTO scores VALUES (?,?,?,?,?,?,?,?)').run('daily', '2020-01-01', p0.device, 5, 0, 1, '', 0);
await worker.scheduled({}, env);
ok(sql.prepare("SELECT COUNT(*) n FROM scores WHERE period='2020-01-01'").get().n === 0, 'boards older than 60 days are deleted');
ok(sql.prepare('SELECT COUNT(*) n FROM scores WHERE period = ?').get(today).n > 0, 'current boards are kept');

console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
