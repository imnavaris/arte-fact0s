


import { execFileSync } from 'node:child_process';

const CHROME = 'C:\\Users\\Usuario\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe';
const PORT = process.env.PORT || '8000';

const [piece = 'libro', out = 'shot.png', rx = '', ry = '', p = '0', width = '1440', height = '900'] = process.argv.slice(2);

const params = [`piece=${piece}`, `p=${p}`];
if (rx !== '') params.push(`rx=${rx}`);
if (ry !== '') params.push(`ry=${ry}`);
const url = `http://127.0.0.1:${PORT}/?${params.join('&')}`;

execFileSync(CHROME, [
  '--headless=new', '--disable-gpu', '--no-sandbox',
  `--user-data-dir=${process.env.TEMP}\chromeprofile-${process.pid}`,
  `--window-size=${width},${height}`,
  '--virtual-time-budget=6000',
  `--screenshot=${out}`,
  url,
], { stdio: ['ignore', 'ignore', 'ignore'] });

console.log(out);
