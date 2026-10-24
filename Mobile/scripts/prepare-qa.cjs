// Public client values only. Output stays under ignored build/.
const {readFileSync, mkdirSync, writeFileSync} = require('node:fs');
const {resolve} = require('node:path');
const source = process.argv[2];
if (!source) throw new Error('Usage: node scripts/prepare-qa.cjs <existing-mobile-env> [frontend-url]');
const env = Object.fromEntries(readFileSync(source, 'utf8').split(/\r?\n/).flatMap(line => {
  const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  return match ? [[match[1], match[2].replace(/^(['"])(.*)\1$/, '$2')]] : [];
}));
const url = env.EXPO_PUBLIC_SUPABASE_URL;
const key = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const frontend = process.argv[3] || 'https://hayateotsu.space';
if (!url || new URL(url).protocol !== 'https:' || !key || /[\r\n]/.test(key)) throw new Error('Missing public Supabase client configuration');
if (key.startsWith('sb_secret_')) throw new Error('Secret keys must never enter a Mobile build');
if (key.split('.').length === 3 && JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role !== 'anon') throw new Error('Mobile requires the anon public key');
if (!['https:', 'http:'].includes(new URL(frontend).protocol)) throw new Error('Invalid frontend URL');
const output = resolve(__dirname, '../build/local-native-auth.properties');
mkdirSync(resolve(__dirname, '../build'), {recursive: true});
writeFileSync(output, `MANGADOCK_SUPABASE_URL=${url}\nMANGADOCK_SUPABASE_PUBLIC_KEY=${key}\nMANGADOCK_FRONTEND_URL=${frontend}\n`);
console.log('Public QA build configuration prepared under Mobile/build/. No credential values printed.');
