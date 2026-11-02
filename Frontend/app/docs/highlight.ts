// A small syntax highlighter for the docs' code blocks and commands (Monokai Classic colours, set in
// globals.css as --mk-*). Not a parser: a list of regular rules per language, tried in order at each
// position. Good enough to read a snippet by; the one hard rule is that it is lossless, so the tokens
// always join back to exactly the code that was given.

export type TokenType = 'comment' | 'string' | 'number' | 'keyword' | 'storage' | 'literal' | 'function' | 'type' | 'variable' | 'operator' | 'flag' | 'prompt';
export interface Token { type: TokenType | null; text: string }

type Rule = [TokenType, RegExp];

const words = (list: string) => new RegExp(`\\b(?:${list.trim().split(/\s+/).join('|')})\\b`, 'y');
const sticky = (src: string, extra = '') => new RegExp(src, 'y' + extra);

// ── TypeScript / JavaScript ──────────────────────────────────────────────────
const SCRIPT: Rule[] = [
  ['comment', sticky('\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?(?:\\*\\/|$)')],
  ['string', sticky('"(?:[^"\\\\\\n]|\\\\.)*"?|\'(?:[^\'\\\\\\n]|\\\\.)*\'?|`(?:[^`\\\\]|\\\\.)*`?')],
  ['number', sticky('\\b0x[\\da-fA-F_]+\\b|\\b\\d[\\d_]*(?:\\.\\d+)?(?:e[+-]?\\d+)?\\b')],
  ['storage', words('const let var function class interface type enum import export from as extends implements async static public private protected readonly new typeof instanceof void abstract declare namespace keyof')],
  ['keyword', words('if else return for while do switch case break continue throw try catch finally await yield default in of delete')],
  ['literal', words('true false null undefined NaN this super')],
  ['function', sticky('[A-Za-z_$][\\w$]*(?=\\s*\\()')],
  ['type', sticky('\\b[A-Z][\\w$]*\\b')],
  ['operator', sticky('=>|[!=]==?|<=|>=|&&|\\|\\||\\?\\?|\\+\\+|--|[+\\-*%=]')],
];

// ── Shell (bash, sh, zsh, PowerShell, cmd): the commands people copy ─────────
const COMMAND_START = '(?<=(?:^|[|;&]|[$>#%] )[ \\t]*)';
const SHELL: Rule[] = [
  ['comment', sticky('(?<=^|\\s)#[^\\n]*', 'm')],
  ['string', sticky('"(?:[^"\\\\]|\\\\.)*"?|\'[^\']*\'?')],
  ['prompt', sticky('^[ \\t]*[$>%](?= )', 'm')],
  ['variable', sticky('\\$\\{[^}]*\\}|\\$\\(|\\$[A-Za-z_]\\w*|\\$[0-9?!@#*$]')],
  ['flag', sticky('(?<=\\s)--?[A-Za-z][\\w-]*')],
  ['keyword', words('if then else elif fi for do done while until case esac in function return export source alias set unset local')],
  ['function', sticky('\\b[A-Z][a-z]+(?:-[A-Z][A-Za-z]+)+\\b')], // PowerShell cmdlets: Get-ChildItem
  ['function', sticky(`${COMMAND_START}[A-Za-z_./~][\\w./~-]*`, 'm')],
  ['number', sticky('\\b\\d+(?:\\.\\d+)?\\b')],
  ['operator', sticky('\\|\\||&&|[|;&<>]=?|=')],
];

// ── SQL ──────────────────────────────────────────────────────────────────────
const SQL_WORDS = 'select from where join left right inner outer full cross on group by order having limit offset insert into values update set delete create table alter add drop column index unique primary key foreign references not null default and or in as is like between exists case when then else end distinct union all returning with check constraint cascade policy using enable row level security function returns language replace trigger begin commit rollback grant to';
const SQL: Rule[] = [
  ['comment', sticky('--[^\\n]*|\\/\\*[\\s\\S]*?(?:\\*\\/|$)')],
  ['string', sticky('\'(?:[^\']|\'\')*\'?')],
  ['number', sticky('\\b\\d+(?:\\.\\d+)?\\b')],
  ['literal', new RegExp('\\b(?:true|false|null)\\b', 'iy')],
  ['type', new RegExp('\\b(?:int|integer|bigint|smallint|text|uuid|boolean|bool|varchar|char|numeric|decimal|real|jsonb|json|timestamp|timestamptz|date|time|serial|bytea)\\b', 'iy')],
  ['keyword', new RegExp(`\\b(?:${SQL_WORDS.split(' ').join('|')})\\b`, 'iy')],
  ['function', sticky('[A-Za-z_]\\w*(?=\\s*\\()')],
  ['operator', sticky('[=<>!+\\-*/%]+')],
];

// ── Python ───────────────────────────────────────────────────────────────────
const PYTHON: Rule[] = [
  ['comment', sticky('#[^\\n]*')],
  ['string', sticky('"""[\\s\\S]*?(?:"""|$)|\'\'\'[\\s\\S]*?(?:\'\'\'|$)|"(?:[^"\\\\\\n]|\\\\.)*"?|\'(?:[^\'\\\\\\n]|\\\\.)*\'?')],
  ['number', sticky('\\b\\d[\\d_]*(?:\\.\\d+)?\\b')],
  ['storage', words('def class import from as lambda global nonlocal')],
  ['keyword', words('if elif else for while in return with try except finally raise yield pass break continue and or not is async await assert del')],
  ['literal', words('True False None self cls')],
  ['function', sticky('@[A-Za-z_][\\w.]*|[A-Za-z_]\\w*(?=\\s*\\()')],
  ['type', sticky('\\b[A-Z][\\w]*\\b')],
  ['operator', sticky('->|[!=]=|<=|>=|\\*\\*|[+\\-*/%=<>]')],
];

// ── JSON ─────────────────────────────────────────────────────────────────────
const JSON_RULES: Rule[] = [
  ['type', sticky('"(?:[^"\\\\\\n]|\\\\.)*"(?=\\s*:)')], // keys
  ['string', sticky('"(?:[^"\\\\\\n]|\\\\.)*"?')],
  ['number', sticky('-?\\b\\d+(?:\\.\\d+)?(?:e[+-]?\\d+)?\\b')],
  ['literal', words('true false null')],
];

// ── .env / ini / yaml / toml ─────────────────────────────────────────────────
const CONFIG: Rule[] = [
  ['comment', sticky('#[^\\n]*|;[^\\n]*', 'm')],
  ['keyword', sticky('^[ \\t]*(?:-[ \\t]+)?[A-Za-z_][\\w.-]*(?=[ \\t]*[=:])', 'm')],
  ['string', sticky('"(?:[^"\\\\\\n]|\\\\.)*"?|\'[^\'\\n]*\'?')],
  ['number', sticky('\\b\\d+(?:\\.\\d+)?\\b')],
  ['literal', words('true false null yes no on off')],
];

// ── diff ─────────────────────────────────────────────────────────────────────
const DIFF: Rule[] = [
  ['type', sticky('^@@[^\\n]*', 'm')],
  ['function', sticky('^\\+[^\\n]*', 'm')],
  ['keyword', sticky('^-[^\\n]*', 'm')],
  ['comment', sticky('^(?:diff|index|---|\\+\\+\\+)[^\\n]*', 'm')],
];

const LANGUAGES: Record<string, Rule[]> = {
  ts: SCRIPT, tsx: SCRIPT, typescript: SCRIPT, js: SCRIPT, jsx: SCRIPT, javascript: SCRIPT, mjs: SCRIPT,
  bash: SHELL, sh: SHELL, shell: SHELL, zsh: SHELL, console: SHELL, powershell: SHELL, ps1: SHELL, pwsh: SHELL, cmd: SHELL, bat: SHELL,
  sql: SQL, pgsql: SQL, postgres: SQL,
  python: PYTHON, py: PYTHON,
  json: JSON_RULES, jsonc: JSON_RULES,
  env: CONFIG, dotenv: CONFIG, ini: CONFIG, yaml: CONFIG, yml: CONFIG, toml: CONFIG,
  diff: DIFF, patch: DIFF,
};

const SHELL_LANGS = new Set(['bash', 'sh', 'shell', 'zsh', 'console', 'powershell', 'ps1', 'pwsh', 'cmd', 'bat']);

/** Commands people copy: a leading `$ ` prompt is for reading, not for pasting. */
export const isShell = (lang: string) => SHELL_LANGS.has(lang.toLowerCase());
export const stripPrompts = (code: string) => code.replace(/^([ \t]*)[$%] /gm, '$1');

export const isHighlighted = (lang: string) => lang.toLowerCase() in LANGUAGES;

/** Splits `code` into coloured runs. Unknown languages come back as one plain token. Lossless. */
export function tokenize(code: string, lang: string): Token[] {
  const rules = LANGUAGES[lang.toLowerCase()];
  if (!rules) return [{ type: null, text: code }];

  const out: Token[] = [];
  let plain = '';
  const flush = () => { if (plain) { out.push({ type: null, text: plain }); plain = ''; } };
  let pos = 0;
  while (pos < code.length) {
    let hit: Token | null = null;
    for (const [type, re] of rules) {
      re.lastIndex = pos;
      const m = re.exec(code);
      if (m && m[0].length > 0) { hit = { type, text: m[0] }; break; }
    }
    if (hit) { flush(); out.push(hit); pos += hit.text.length; } else { plain += code[pos]; pos += 1; }
  }
  flush();
  return out;
}
