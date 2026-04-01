#!/usr/bin/env node
// scripts/ci/scan-secrets.js — scans for hardcoded credentials
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '../..');
const PATTERNS = [
  { name: 'AWS Key',        re: /AKIA[0-9A-Z]{16}/ },
  { name: 'Supabase JWT',   re: /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_\-]{50,}/ },
  { name: 'API Key',        re: /api[_\-]?key\s*[:=]\s*['"][A-Za-z0-9_\-]{20,}['"]/i },
  { name: 'Secret',         re: /secret\s*[:=]\s*['"][A-Za-z0-9_\-]{16,}['"]/i },
  { name: 'Private Key',    re: /-----BEGIN\s+(RSA\s+)?PRIVATE KEY-----/ },
  { name: 'Stripe Live Key',re: /sk_live_[A-Za-z0-9]{24,}/ },
  { name: 'OpenAI Key',     re: /sk-[A-Za-z0-9]{48,}/ },
];
const SKIP = ['node_modules','.git','dist','.next','backup','pnpm-lock.yaml','package-lock.json'];
const EXTS = ['.js','.ts','.tsx','.py','.yml','.yaml','.sh'];
let findings = 0;

function scan(dir) {
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir, { withFileTypes: true }).forEach(e => {
    const full = path.join(dir, e.name);
    const rel = path.relative(ROOT, full);
    if (SKIP.some(s => rel.includes(s))) return;
    if (e.isDirectory()) { scan(full); return; }
    if (!EXTS.includes(path.extname(e.name))) return;
    const lines = fs.readFileSync(full,'utf8').split('\n');
    lines.forEach((line,i) => {
      if (/process\.env\.|example|placeholder|<.*>|xxx/i.test(line)) return;
      PATTERNS.forEach(({name,re}) => {
        if (re.test(line)) { console.error(`  ❌ ${name}: ${rel}:${i+1}`); findings++; }
      });
    });
  });
}

console.log('\n🔍 Scanning for hardcoded secrets...\n');
scan(ROOT);
findings ? (console.error(`\n❌ ${findings} secret(s) found\n`), process.exit(1))
         : (console.log('✅ No hardcoded secrets found\n'), process.exit(0));
