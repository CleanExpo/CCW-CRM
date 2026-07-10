import { config } from 'dotenv';
config({ path: '.env' });
config({ path: '.env.local', override: true });

const { getCin7OmniCredentials, cin7OmniGet } = await import('../src/lib/integrations/cin7-omni.ts');
const omni = getCin7OmniCredentials();
if (!omni) {
  console.error('no creds');
  process.exit(1);
}

const paths = [
  '/v1/ProductCategories?page=1&rows=5&order=id asc',
  '/v1/Stock?page=1&rows=5',
  '/v1/SizeRanges',
  '/v1/Products?page=1&rows=2&fields=brand,styleCode,name,productOptions',
];

for (const p of paths) {
  const r = await cin7OmniGet<unknown>(p, omni);
  console.log('\n===', p, 'status', r.status, 'ok', r.ok);
  console.log(JSON.stringify(r.data, null, 2).slice(0, 1500));
}
