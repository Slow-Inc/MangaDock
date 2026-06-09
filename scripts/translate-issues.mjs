/**
 * translate-issues.mjs — MangaDock GitHub Issue Translator
 * แปล issue body + comments ทั้งหมดจาก EN → TH ผ่าน Gemini CLI (stdin pipe)
 * Run: bun run scripts/translate-issues.mjs
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CACHE_FILE = join(__dirname, '.translate-cache.json');
const GEMINI_CMD = 'C:\\Users\\gamin\\AppData\\Roaming\\npm\\gemini.CMD';
const OWNER = 'Slow-Inc', REPO = 'MangaDock';

// ─── Env ──────────────────────────────────────────────────────────────────────

function readEnvKey(file, key) {
  try {
    const line = readFileSync(file, 'utf-8').split('\n').find(l => l.startsWith(key + '='));
    return line ? line.slice(key.length + 1).trim() : null;
  } catch { return null; }
}

const GITHUB_TOKEN = readEnvKey(join(ROOT, 'Frontend', '.env'), 'GITHUB_TOKEN');
if (!GITHUB_TOKEN) { console.error('❌ GITHUB_TOKEN not found'); process.exit(1); }

// ─── GitHub ───────────────────────────────────────────────────────────────────

const GH_HEADERS = {
  Authorization: `Bearer ${GITHUB_TOKEN}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'Content-Type': 'application/json',
};

async function ghGet(path) {
  const r = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}${path}`, { headers: GH_HEADERS });
  if (!r.ok) throw new Error(`GET ${path} → ${r.status}: ${await r.text()}`);
  return r.json();
}

async function ghPatch(path, body) {
  const r = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}${path}`, {
    method: 'PATCH', headers: GH_HEADERS, body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`PATCH ${path} → ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
const hasFlag = t => t && t.includes('🇹🇭');
const SEP = '\n\n---\n🇹🇭 **ภาษาไทย**\n\n';

// ─── Gemini CLI translation ───────────────────────────────────────────────────

function geminiTranslate(text) {
  return new Promise((resolve, reject) => {
    if (!text || text.trim().length < 20) return resolve(null);

    const prompt =
      `Translate the following GitHub issue/comment text from English to Thai.\n` +
      `Rules:\n` +
      `- Keep ALL code spans (\`like this\`), code blocks (\`\`\`), issue/PR refs (#N), file paths, variable/method/class names EXACTLY as-is\n` +
      `- Keep all markdown formatting (##, ###, -, *, **bold**, _italic_, - [ ] checkboxes, > blockquotes) exactly as-is\n` +
      `- Translate ONLY natural language English text to Thai\n` +
      `- Output ONLY the Thai translation, no preamble or explanation\n\n` +
      `TEXT:\n${text}`;

    const proc = spawn(GEMINI_CMD, ['-o', 'json', '--yolo'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: false,
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', d => stdout += d.toString());
    proc.stderr.on('data', d => stderr += d.toString());

    proc.on('close', code => {
      try {
        const json = JSON.parse(stdout);
        const thai = json?.response?.trim();
        if (thai) resolve(thai);
        else reject(new Error(`No response field. Exit ${code}. stderr: ${stderr.slice(0, 200)}`));
      } catch (e) {
        reject(new Error(`JSON parse failed: ${e.message}. stdout: ${stdout.slice(0, 200)}`));
      }
    });

    proc.on('error', reject);

    proc.stdin.write(prompt, 'utf-8');
    proc.stdin.end();
  });
}

// ─── Cache ────────────────────────────────────────────────────────────────────

function loadCache() {
  if (existsSync(CACHE_FILE)) {
    try { return JSON.parse(readFileSync(CACHE_FILE, 'utf-8')); } catch {}
  }
  return { done: new Set() };
}

function saveCache(cache) {
  writeFileSync(CACHE_FILE, JSON.stringify({ done: [...cache.done] }, null, 2));
}

// ─── Per-issue processing ─────────────────────────────────────────────────────

async function processIssue(issue, cache) {
  const num = issue.number;

  // Body
  const bodyKey = `body-${num}`;
  if (cache.done.has(bodyKey)) {
    process.stdout.write(`  ⏭️  body cached\n`);
  } else if (issue.body && !hasFlag(issue.body)) {
    process.stdout.write(`  🔤 body (${issue.body.length}ch)... `);
    try {
      const thai = await geminiTranslate(issue.body);
      if (thai) {
        await ghPatch(`/issues/${num}`, { body: issue.body + SEP + thai });
        process.stdout.write(`✅\n`);
      } else {
        process.stdout.write(`⏭️ (too short)\n`);
      }
    } catch (e) {
      process.stdout.write(`❌ ${e.message.slice(0, 80)}\n`);
    }
    cache.done.add(bodyKey);
    saveCache(cache);
    await sleep(600);
  } else {
    process.stdout.write(`  ⏭️  body (has Thai or empty)\n`);
    cache.done.add(bodyKey);
    saveCache(cache);
  }

  // Comments
  let comments = [];
  try {
    comments = await ghGet(`/issues/${num}/comments`);
    await sleep(250);
  } catch (e) {
    console.error(`  ❌ fetch comments: ${e.message}`);
    return;
  }

  for (const c of comments) {
    const cKey = `comment-${c.id}`;
    if (cache.done.has(cKey)) {
      process.stdout.write(`    ⏭️  comment ${c.id} cached\n`);
      continue;
    }
    if (!c.body || hasFlag(c.body)) {
      process.stdout.write(`    ⏭️  comment ${c.id} (has Thai or empty)\n`);
      cache.done.add(cKey);
      saveCache(cache);
      continue;
    }
    process.stdout.write(`    💬 comment ${c.id} (${c.body.length}ch)... `);
    try {
      const thai = await geminiTranslate(c.body);
      if (thai) {
        await ghPatch(`/issues/comments/${c.id}`, { body: c.body + SEP + thai });
        process.stdout.write(`✅\n`);
      } else {
        process.stdout.write(`⏭️ (too short)\n`);
      }
    } catch (e) {
      process.stdout.write(`❌ ${e.message.slice(0, 80)}\n`);
    }
    cache.done.add(cKey);
    saveCache(cache);
    await sleep(600);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function getAllIssues() {
  const all = [];
  for (let page = 1; page <= 5; page++) {
    const batch = await ghGet(`/issues?state=all&per_page=100&page=${page}`);
    if (!Array.isArray(batch) || !batch.length) break;
    all.push(...batch);
    if (batch.length < 100) break;
    await sleep(300);
  }
  return all;
}

async function main() {
  console.log('\n🚀 MangaDock Issue Translator — Gemini CLI\n');
  const cache = loadCache();
  cache.done = new Set(cache.done);
  console.log(`📋 Cache: ${cache.done.size} items already done\n`);

  const all = await getAllIssues();
  console.log(`📊 ${all.length} total items\n`);

  for (let i = 0; i < all.length; i++) {
    const issue = all[i];
    console.log(`\n[${i + 1}/${all.length}] #${issue.number} ${issue.title.slice(0, 55)}`);
    await processIssue(issue, cache);
    await sleep(200);
  }

  console.log(`\n\n🎉 Done! Cache: ${cache.done.size} items.`);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
