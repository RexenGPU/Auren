import fs from 'node:fs';
import path from 'node:path';

const files = [];
function walk(d) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    const s = fs.statSync(p);
    if (s.isDirectory()) walk(p);
    else if (p.endsWith('.tsx')) files.push(p);
  }
}
walk('src');
const set = new Set();
for (const f of files) {
  const t = fs.readFileSync(f, 'utf8');
  const re = /className=(?:\{`([^`]*)`\}|"([^"]*)")/g;
  let m;
  while ((m = re.exec(t))) {
    const v = (m[1] || m[2] || '').replace(/\$\{[^}]*\}/g, ' ');
    for (const c of v.split(/\s+/)) if (c) set.add(c);
  }
}
console.log([...set].sort().join('\n'));
