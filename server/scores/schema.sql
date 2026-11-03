-- one row per phone: a random id the game makes on first launch, plus a secret only that phone knows
CREATE TABLE IF NOT EXISTS players (
  device   TEXT PRIMARY KEY,
  secret   TEXT NOT NULL,
  name     TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT '',
  created  INTEGER NOT NULL,
  last     INTEGER NOT NULL,
  banned   INTEGER NOT NULL DEFAULT 0
);
-- each player's best score on each board period (daily: one day from 00:00 UTC; weekly: Monday 00:00 UTC)
CREATE TABLE IF NOT EXISTS scores (
  board   TEXT NOT NULL,
  period  TEXT NOT NULL,
  device  TEXT NOT NULL,
  score   INTEGER NOT NULL,
  context INTEGER NOT NULL DEFAULT 0,
  tries   INTEGER NOT NULL DEFAULT 1,
  runs    TEXT NOT NULL DEFAULT '',   -- ids of the tries already counted, so a retried send isn't counted twice
  at      INTEGER NOT NULL,
  PRIMARY KEY (board, period, device)
);
CREATE INDEX IF NOT EXISTS scores_rank ON scores (board, period, score DESC, at);
-- request counts per phone per minute (flood protection)
CREATE TABLE IF NOT EXISTS hits (
  device TEXT NOT NULL,
  minute INTEGER NOT NULL,
  n      INTEGER NOT NULL,
  PRIMARY KEY (device, minute)
);
