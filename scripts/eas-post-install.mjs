// Runs on Expo's build servers right after `npm install` (the "eas-build-post-install" script in package.json).
// Downloads the Fredoka font (SIL Open Font License) from Google's official fonts repository, then rebuilds
// web/game.ts so the shipped game has the font embedded and works fully offline.
import { writeFileSync, existsSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const base = 'https://raw.githubusercontent.com/google/fonts/main/ofl/fredoka/';
const get = async (name, path) => {
  const res = await fetch(base + encodeURIComponent(name).replace(/%2C/g, ','));
  if (!res.ok) throw new Error(`download failed: ${name} (${res.status})`);
  writeFileSync(path, Buffer.from(await res.arrayBuffer()));
};
const font = join(root, 'web/Fredoka.ttf');
if (!existsSync(font) || statSync(font).size < 20000) {
  await get('Fredoka[wdth,wght].ttf', font);
  await get('OFL.txt', join(root, 'web/Fredoka-OFL.txt'));
  console.log(`Fredoka downloaded (${Math.round(statSync(font).size / 1024)} KB)`);
}
execFileSync(process.execPath, [join(root, 'scripts/build-web.mjs'), join(root, 'web/critter-stack.html')], { stdio: 'inherit' });
