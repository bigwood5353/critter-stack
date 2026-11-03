// Critter Stack shared rankings (Cloudflare Worker + D1).
//
// One worldwide board per mode and period, shared by iPhone and Android:
//   daily      Daily Stack, one board per UTC day, best of 3 tries
//   classic    Petting Zoo, weekly (Monday 00:00 UTC)
//   challenge  Challenge, weekly
//   puzzle     Critter Pen, weekly
//
// Players have no account. The game makes a random device id and a secret on first launch; the secret proves later
// submissions come from the same phone. Nothing else about the player is stored: just the name they typed and scores.
//
//   POST /v1/score  {device, secret, name, platform, board, period, score, context, run} → {rank, total, best}
//                   (run: a random id per game, so a send retried after a lost connection counts once)
//   GET  /v1/board?board=daily&period=2026-10-22&device=…                            → {total, entries[10], player}
//   GET  /v1/rank?board=daily&period=2026-10-21&device=…                             → {rank, total}   (finished boards)
//   POST /v1/name   {device, secret, name}                                            → {name}
//   GET  /v1/health                                                                   → {ok:true}

export const BOARDS = {
  daily:     { period: 'day',  cap: 300000,  tries: 3 },
  classic:   { period: 'week', cap: 5000000 },
  challenge: { period: 'week', cap: 3000000 },
  puzzle:    { period: 'week', cap: 2000000 },
};
const GRACE_MS = 2 * 3600e3;        // a game that started before the reset may still post to the board it started on
const KEEP_DAYS = 60;               // finished boards are kept this long (for late prize checks), then deleted
const PER_MINUTE = 30;              // score and name posts per phone per minute
const DAY = 864e5;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};
const json = (body, status = 200, extra = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS, ...extra } });
const fail = (status, error) => json({ error }, status);

// ---------- periods (must match periodStart() in the game) ----------
export function periodStart(kind, now) {
  const d = new Date(now);
  let s = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  if (kind === 'week') s -= ((new Date(s).getUTCDay() + 6) % 7) * DAY;
  return s;
}
export const periodEnd = (kind, start) => start + (kind === 'week' ? 7 : 1) * DAY;
const ymd = ms => new Date(ms).toISOString().slice(0, 10);
const parseYmd = s => (/^\d{4}-\d{2}-\d{2}$/.test(s || '') ? Date.parse(s + 'T00:00:00Z') : NaN);

/** Is this a real period for the board (a day, or a Monday for weekly boards)? */
export function validPeriod(board, period) {
  const cfg = BOARDS[board], start = parseYmd(period);
  if (!cfg || !Number.isFinite(start)) return null;
  if (periodStart(cfg.period, start) !== start) return null;
  return { cfg, start, end: periodEnd(cfg.period, start) };
}

// ---------- friendly names (same filter as the game) ----------
const RUDE=(()=>{ try{ const [a,b]=atob('ZnVjayBzaGl0IGJpdGNoIGN1bnQgd2hvcmUgc2x1dCBiYXN0YXJkIGFzc2hvbGUgZmFnZ290IG5pZ2dlciBuaWdnYSByZXRhcmQgcG9ybiBwZW5pcyB2YWdpbmEgdHdhdCBqaXp6IGRpbGRvIGhpdGxlciBuYXppIGtpa2Ugd2V0YmFjayB0cmFubnkgY29ja3N1Y2tlciBtb3RoZXJmIGJsb3dqb2IgaGFuZGpvYiBwZWRvIG1vbGVzdCBjdW1zaG90IG51dHNhY2sgc2Nyb3R1bSBjbGl0IGJvbGxvY2sgd2Fua2VyIHNoaXRoZWFkIGRpcHNoaXQgamFja2FzcyBkdW1iYXNzIHNrYW5rfGFzcyBhc3NlcyBjdW0gY29vbiBjb29ucyBob2UgaG9lcyB0aXQgdGl0cyB0aXR0eSBzZXggc2V4eSBzcGljIHNwaWNzIGNoaW5rIGdvb2sgZmFnIGZhZ3MgZGljayBkaWNrcyBjb2NrIGNvY2tzIHJhcGUgcmFwZWQgYW5hbCBhbnVzIHdhbmsgYm9vYiBib29icyBwaXNzIGtrayBkeWtlIGhvbW8gamFwIG5lZ3JvIG5hemlzIHNsYWcgcHJpY2sgcHViZSBwdWJlcyBzZW1lbiBzcGVybSByYXBpc3QgcmFwaXN0cw==').split('|'); return {sub:a.split(' '), tok:new Set(b.split(' '))}; }catch(e){ return {sub:[],tok:new Set()}; } })();
export function isRude(n){
  if(!n) return false;
  const leet=x=>x.replace(/[0@4]/g,m=>m==='0'?'o':'a').replace(/[1!|]/g,'i').replace(/3/g,'e').replace(/[5$]/g,'s').replace(/7/g,'t').replace(/8/g,'b').replace(/9/g,'g');
  const squash=x=>x.replace(/(.)\1{2,}/g,'$1');   // fuuuck → fuck (3+ repeats only, so shiitake stays fine)
  const low=leet(n.replace(/([a-z])([A-Z])/g,'$1 $2').toLowerCase());
  const toks=low.split(/[^a-z]+/).filter(Boolean);
  // spaced-out letters (f u c k) are joined back up; ordinary words are checked one at a time (so "Pen Island" is fine)
  const parts=toks.every(t=>t.length<=2)&&toks.length>2 ? [toks.join('')] : toks.concat(toks.length>1?[toks.join('')].filter(j=>toks.some(t=>t.length<=2)):[]);
  if(parts.some(p=>RUDE.sub.some(w=>p.includes(w)||squash(p).includes(w)))) return true;
  return toks.some(t=>RUDE.tok.has(t)||RUDE.tok.has(squash(t)));
}

export function cleanName(raw) {
  let n = String(raw || '').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 20);
  if (!n || isRude(n)) n = 'Player';
  return n;
}

const DEVICE_RE = /^[a-z0-9]{8,64}$/;
const SECRET_RE = /^[a-f0-9]{32,64}$/;

// ---------- request handling ----------
export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    const url = new URL(req.url);
    try {
      if (url.pathname === '/v1/health') return json({ ok: true });
      if (url.pathname === '/v1/score' && req.method === 'POST') return await postScore(req, env);
      if (url.pathname === '/v1/board' && req.method === 'GET') return await getBoard(url, env);
      if (url.pathname === '/v1/rank' && req.method === 'GET') return await getRank(url, env);
      if (url.pathname === '/v1/name' && req.method === 'POST') return await postName(req, env);
      return fail(404, 'not found');
    } catch (e) {
      return fail(500, 'server error');
    }
  },
  async scheduled(_event, env) {
    const cutoff = ymd(Date.now() - KEEP_DAYS * DAY);
    await env.DB.batch([
      env.DB.prepare('DELETE FROM scores WHERE period < ?').bind(cutoff),
      env.DB.prepare('DELETE FROM hits WHERE minute < ?').bind(Math.floor(Date.now() / 6e4) - 60 * 24),
    ]);
  },
};

async function readBody(req) {
  const text = await req.text();
  if (text.length > 4000) throw new Error('too big');
  return JSON.parse(text || '{}');
}

/** Checks the phone's id and secret, registering the phone the first time it posts. Returns the player row or a Response. */
async function authPlayer(env, b, now) {
  const device = String(b.device || ''), secret = String(b.secret || '');
  if (!DEVICE_RE.test(device) || !SECRET_RE.test(secret)) return fail(400, 'bad device');
  // flood protection
  const minute = Math.floor(now / 6e4);
  const hit = await env.DB.prepare(
    'INSERT INTO hits (device, minute, n) VALUES (?, ?, 1) ON CONFLICT(device, minute) DO UPDATE SET n = n + 1 RETURNING n'
  ).bind(device, minute).first();
  if (hit && hit.n > PER_MINUTE) return fail(429, 'slow down');

  const name = cleanName(b.name);
  const platform = ['ios', 'android', 'web'].includes(b.platform) ? b.platform : '';
  let p = await env.DB.prepare('SELECT * FROM players WHERE device = ?').bind(device).first();
  if (!p) {
    await env.DB.prepare('INSERT INTO players (device, secret, name, platform, created, last) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(device, secret, name, platform, now, now).run();
    p = { device, secret, name, platform, banned: 0 };
  } else if (p.secret !== secret) {
    return fail(403, 'wrong secret');
  }
  if (p.banned) return fail(403, 'blocked');
  return { ...p, name };
}

async function postScore(req, env) {
  const now = Date.now();
  const b = await readBody(req);
  const v = validPeriod(String(b.board || ''), String(b.period || ''));
  if (!v) return fail(400, 'bad board');
  if (now < v.start - 5 * 60e3 || now > v.end + GRACE_MS) return fail(409, 'board closed');
  const score = Number(b.score), context = Number(b.context) || 0;
  if (!Number.isInteger(score) || score < 1 || score > v.cfg.cap) return fail(400, 'bad score');
  if (!Number.isInteger(context) || context < 0 || context > 2 ** 31) return fail(400, 'bad context');

  const p = await authPlayer(env, b, now);
  if (p instanceof Response) return p;
  await env.DB.prepare('UPDATE players SET name = ?, platform = COALESCE(NULLIF(?, \'\'), platform), last = ? WHERE device = ?')
    .bind(p.name, p.platform || '', now, p.device).run();

  const board = String(b.board), period = String(b.period);
  const run = /^[a-z0-9]{6,40}$/.test(String(b.run || '')) ? String(b.run) : '';
  const cur = await env.DB.prepare('SELECT score, tries, runs FROM scores WHERE board = ? AND period = ? AND device = ?')
    .bind(board, period, p.device).first();
  const seen = cur && run && cur.runs.split(',').includes(run);
  if (!seen) {
    if (v.cfg.tries && cur && cur.tries >= v.cfg.tries) return fail(409, 'no tries left');
    const runs = run ? (cur ? cur.runs.split(',').filter(Boolean).slice(-9).concat(run) : [run]).join(',') : (cur ? cur.runs : '');
    if (!cur) {
      await env.DB.prepare('INSERT INTO scores (board, period, device, score, context, tries, runs, at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)')
        .bind(board, period, p.device, score, context, runs, now).run();
    } else if (score > cur.score) {
      await env.DB.prepare('UPDATE scores SET score = ?, context = ?, tries = tries + 1, runs = ?, at = ? WHERE board = ? AND period = ? AND device = ?')
        .bind(score, context, runs, now, board, period, p.device).run();
    } else {
      await env.DB.prepare('UPDATE scores SET tries = tries + 1, runs = ?, context = ? WHERE board = ? AND period = ? AND device = ?')
        .bind(runs, context, board, period, p.device).run();
    }
  }
  const best = Math.max(score, cur ? cur.score : 0);
  const st = await standing(env, board, period, p.device);
  return json({ best, rank: st.rank, total: st.total });
}

/** Rank = 1 + players with a higher score; ties share a rank. */
async function standing(env, board, period, device) {
  const row = await env.DB.prepare(
    `SELECT s.score, s.at,
       (SELECT COUNT(*) FROM scores o WHERE o.board = s.board AND o.period = s.period AND o.score > s.score) + 1 AS rank,
       (SELECT COUNT(*) FROM scores t WHERE t.board = s.board AND t.period = s.period) AS total
     FROM scores s WHERE s.board = ? AND s.period = ? AND s.device = ?`
  ).bind(board, period, device).first();
  if (row) return { rank: row.rank, total: row.total, score: row.score };
  const t = await env.DB.prepare('SELECT COUNT(*) AS total FROM scores WHERE board = ? AND period = ?').bind(board, period).first();
  return { rank: null, total: t ? t.total : 0, score: 0 };
}

async function getBoard(url, env) {
  const board = url.searchParams.get('board') || '', period = url.searchParams.get('period') || '';
  const device = url.searchParams.get('device') || '';
  if (!validPeriod(board, period)) return fail(400, 'bad board');
  const top = await env.DB.prepare(
    `SELECT s.device, s.score, s.context, p.name FROM scores s JOIN players p ON p.device = s.device
     WHERE s.board = ? AND s.period = ? AND p.banned = 0 ORDER BY s.score DESC, s.at ASC LIMIT 10`
  ).bind(board, period).all();
  const rows = top.results || [];
  const entries = [];
  let prevScore = null, prevRank = 0;
  rows.forEach((r, i) => {
    const rank = r.score === prevScore ? prevRank : i + 1;
    prevScore = r.score; prevRank = rank;
    entries.push({ rank, name: r.name, score: r.score, context: r.context, me: r.device === device });
  });
  const st = DEVICE_RE.test(device) ? await standing(env, board, period, device) : await standing(env, board, period, '-');
  let player = null;
  if (st.rank) {
    player = { rank: st.rank, score: st.score };
    if (!entries.some(e => e.me)) {
      const me = await env.DB.prepare('SELECT s.context, p.name FROM scores s JOIN players p ON p.device = s.device WHERE s.board = ? AND s.period = ? AND s.device = ?')
        .bind(board, period, device).first();
      entries.push({ rank: st.rank, name: me ? me.name : 'Player', score: st.score, context: me ? me.context : 0, me: true });
    }
  }
  return json({ total: st.total, entries, player }, 200, { 'Cache-Control': 'no-store' });
}

async function getRank(url, env) {
  const board = url.searchParams.get('board') || '', period = url.searchParams.get('period') || '';
  const device = url.searchParams.get('device') || '';
  if (!validPeriod(board, period) || !DEVICE_RE.test(device)) return fail(400, 'bad request');
  const st = await standing(env, board, period, device);
  return json({ rank: st.rank, total: st.total }, 200, { 'Cache-Control': 'no-store' });
}

async function postName(req, env) {
  const now = Date.now();
  const b = await readBody(req);
  const p = await authPlayer(env, b, now);
  if (p instanceof Response) return p;
  await env.DB.prepare('UPDATE players SET name = ?, last = ? WHERE device = ?').bind(p.name, now, p.device).run();
  return json({ name: p.name });
}
