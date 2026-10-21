// Resumable publishing of the already-approved bilingual migration plan.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const repo = "Slow-Inc/MangaDock";
const gh = process.env.MANGADOCK_GH ?? "C:/Program Files/GitHub CLI/gh.exe";
const docs = fileURLToPath(new URL("../docs/", import.meta.url));
const plan = JSON.parse(
  readFileSync(
    join(docs, "2026-10-02-native-mobile-migration-plan.json"),
    "utf8",
  ),
);
const output = join(docs, "native-migration-publish");
mkdirSync(output, { recursive: true });
const statePath = join(output, "published.json");
const state = existsSync(statePath)
  ? JSON.parse(readFileSync(statePath, "utf8"))
  : { parent: null, slices: [] };
const publish = process.argv.includes("--publish");
const call = (...args) =>
  execFileSync(gh, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
const save = () =>
  writeFileSync(statePath, JSON.stringify(state, null, 2) + "\n");
function create(title, bodyFile, label) {
  const existing = JSON.parse(
    call(
      "issue",
      "list",
      "--repo",
      repo,
      "--state",
      "all",
      "--search",
      `"${title}" in:title`,
      "--limit",
      "100",
      "--json",
      "title,url",
    ),
  ).filter((issue) => issue.title === title);
  if (existing.length > 1)
    throw new Error(`Duplicate title; inspect GitHub: ${title}`);
  if (existing.length === 1) return existing[0].url;
  const url = call(
    "issue",
    "create",
    "--repo",
    repo,
    "--title",
    title,
    "--body-file",
    bodyFile,
    "--label",
    label,
  );
  if (!/^https:\/\/github\.com\/Slow-Inc\/MangaDock\/issues\/\d+$/.test(url))
    throw new Error(
      "Ambiguous publication result; inspect GitHub before retrying.",
    );
  return url;
}
const seen = new Set();
for (const slice of plan.slices) {
  if (slice.deps.some((dep) => !seen.has(dep)))
    throw new Error(`Dependency order invalid for S${slice.n}`);
  seen.add(slice.n);
}
let parent = readFileSync(
  join(docs, "2026-10-02-native-mobile-migration-prd.md"),
  "utf8",
);
parent = parent.replace(
  /^Status:.*$/m,
  "Status: Approved for phased TDD implementation; Phase 1 acceptance remains open; Phase 2 starts with native discovery and existing mobile navigation.",
);
parent = parent.replace(
  /^สถานะ:.*$/m,
  "สถานะ: อนุมัติให้ implement ด้วย TDD ตาม phase; ยังไม่ผ่าน acceptance Phase 1; เริ่ม Phase 2 ที่ discovery และ navigation mobile เดิม",
);
// These new documents are local/uncommitted; do not publish misleading blob links.
parent = parent.replace(
  /\[([^\]]+)\]\((?!https?:)[^)]+\)/g,
  "$1 (repository reference / เอกสารอ้างอิงใน repo)",
);
const parentPath = join(output, "parent.md");
writeFileSync(parentPath, parent);
if (publish && !state.parent) {
  state.parent = create(plan.prdTitle, parentPath, "ready-for-agent");
  save();
  console.log(`PRD: ${state.parent}`);
}
for (const slice of plan.slices) {
  if (publish && state.slices.some((item) => item.slice === slice.n)) continue;
  const blockers = slice.deps.map((dep) => {
    const existing = state.slices.find((item) => item.slice === dep);
    if (publish && !existing)
      throw new Error(`Missing published blocker S${dep}`);
    return existing?.url ?? `S${dep} (preview)`;
  });
  const sections = [0, 1].map((language) => {
    const headers =
      language === 0
        ? ["EN", "Parent", "What to build", "Acceptance criteria", "Blocked by"]
        : [
            "TH",
            "Parent / งานหลัก",
            "สิ่งที่จะสร้าง",
            "เกณฑ์รับงาน",
            "ติดบล็อกโดย",
          ];
    const scope =
      language === 0
        ? "Scope: Mobile only; reuse existing APIs, business rules and data. Preserve Frontend/Backend/MIT and the shared bridge."
        : "Scope: Mobile เท่านั้น ใช้ APIs กฎธุรกิจและข้อมูลเดิม รักษา Frontend/Backend/MIT และ shared bridge";
    const method =
      language === 0
        ? "TDD: One observable behavior through public interfaces at a time, using real Mobile code with external-boundary mocks. Record RED → GREEN; refactor only while GREEN. Release-only work verifies device evidence."
        : "TDD: พฤติกรรมที่สังเกตได้ผ่าน public interfaces ทีละข้อ ใช้ Mobile code จริงและ mock ขอบภายนอก บันทึก RED → GREEN; refactor เฉพาะขณะ GREEN งาน release อย่างเดียวตรวจหลักฐานอุปกรณ์";
    const visual =
      language === 0
        ? "Port the existing Frontend responsive mobile design and navigation using DESIGN.md tokens and original artwork; compare corresponding native/web mobile screens."
        : "Port design responsive mobile และ navigation เดิมจาก Frontend ใช้ tokens จาก DESIGN.md และ artwork เดิม; เทียบหน้าจอ native/web mobile ที่ตรงกัน";
    const criteria = [...slice.ac.map((item) => item[language]), visual]
      .map((item) => `- [ ] ${item}`)
      .join("\n");
    const deps = blockers.length
      ? blockers.map((url) => `- ${url}`).join("\n")
      : language === 0
        ? "None - can start immediately"
        : "ไม่มี - เริ่มได้ทันที";
    return `## ${headers[0]}\n\n## ${headers[1]}\n\n${state.parent ?? "Native migration PRD (preview)"}\n\nPhase: ${slice.phase} | Type: ${slice.type} | User stories: ${slice.stories.join(", ")}\n\n## ${headers[2]}\n\n${slice.desc[language]}\n\n${scope}\n\n${method}\n\n## ${headers[3]}\n\n${criteria}\n\n## ${headers[4]}\n\n${deps}\n`;
  });
  const bodyPath = join(output, `S${String(slice.n).padStart(2, "0")}.md`);
  writeFileSync(bodyPath, sections.join("\n---\n\n"));
  if (publish) {
    const url = create(
      slice.title,
      bodyPath,
      slice.type === "AFK" ? "ready-for-agent" : "ready-for-human",
    );
    state.slices.push({
      slice: slice.n,
      url,
      type: slice.type,
      phase: slice.phase,
    });
    save();
    console.log(`S${slice.n}: ${url}`);
  }
}
if (!publish)
  console.log(
    `Prepared parent + ${plan.slices.length} bilingual issues; dependency order validated. Use --publish to create issues.`,
  );
