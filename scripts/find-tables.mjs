import fs from 'node:fs';
import path from 'node:path';

const tables = new Map();
function search(dir) {
  for (const item of fs.readdirSync(dir)) {
    if (['node_modules', '.git', 'dist', '.vercel', '.test-build'].includes(item)) continue;
    const full = path.join(dir, item);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) search(full);
    else {
      const txt = fs.readFileSync(full, 'utf8');
      const re = /\.from\(['"]([a-zA-Z0-9_]+)['"]\)/g;
      let m;
      while ((m = re.exec(txt)) !== null) {
        const tbl = m[1];
        if (!tables.has(tbl)) tables.set(tbl, new Set());
        tables.get(tbl).add(full);
      }
    }
  }
}

search('.');
for (const [tbl, files] of tables.entries()) {
  console.log(`Table: ${tbl}`);
  for (const f of files) console.log(`  - ${f}`);
}
