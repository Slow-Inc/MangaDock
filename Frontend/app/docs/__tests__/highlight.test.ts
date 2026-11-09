import { describe, expect, test } from 'bun:test';
import { isHighlighted, isShell, stripPrompts, tokenize } from '../highlight';

const types = (code: string, lang: string) => tokenize(code, lang).filter(t => t.type).map(t => `${t.type}:${t.text}`);
const join = (code: string, lang: string) => tokenize(code, lang).map(t => t.text).join('');

describe('tokenize', () => {
  test('an unknown language is one plain token', () => {
    expect(tokenize('anything at all', 'text')).toEqual([{ type: null, text: 'anything at all' }]);
    expect(isHighlighted('text')).toBe(false);
    expect(isHighlighted('TS')).toBe(true);
  });

  test('TypeScript: storage, function, string, number, type, literal, comment', () => {
    expect(types("const x = await fetchUser(42, 'a'); // hi", 'ts')).toEqual([
      'storage:const', 'operator:=', 'keyword:await', 'function:fetchUser', 'number:42', "string:'a'", 'comment:// hi',
    ]);
    expect(types('let u: User | null = true', 'tsx')).toContain('type:User');
    expect(types('let u: User | null = true', 'tsx')).toContain('literal:null');
  });

  test('a keyword inside a longer word is not a keyword', () => {
    expect(types('reconstruct = constant', 'ts')).toEqual(['operator:=']);
  });

  test('shell: the prompt, the command, a flag, a variable, a string', () => {
    expect(types('$ npm run build --watch "$HOME/x"', 'bash')).toEqual([
      'prompt:$', 'function:npm', 'flag:--watch', 'string:"$HOME/x"',
    ]);
    expect(types('echo $PATH | grep -v foo', 'sh')).toEqual(['function:echo', 'variable:$PATH', 'operator:|', 'function:grep', 'flag:-v']);
  });

  test('shell: a command after && or ; is a command too; a comment is a comment', () => {
    expect(types('cd Backend && npm test # run it', 'bash')).toEqual(['function:cd', 'operator:&&', 'function:npm', 'comment:# run it']);
  });

  test('PowerShell cmdlets are functions', () => {
    expect(types('Get-ChildItem -Recurse', 'powershell')).toEqual(['function:Get-ChildItem', 'flag:-Recurse']);
  });

  test('SQL is case-insensitive and knows types', () => {
    expect(types("select id from users where name = 'a' -- c", 'sql')).toEqual([
      'keyword:select', 'keyword:from', 'keyword:where', 'operator:=', "string:'a'", 'comment:-- c',
    ]);
    expect(types('id UUID NOT NULL', 'sql')).toEqual(['type:UUID', 'keyword:NOT', 'literal:NULL']);
  });

  test('Python and JSON and .env', () => {
    expect(types('def run(self): return None', 'python')).toEqual(['storage:def', 'function:run', 'literal:self', 'keyword:return', 'literal:None']);
    expect(types('{"a": 1, "b": "x"}', 'json')).toEqual(['type:"a"', 'number:1', 'type:"b"', 'string:"x"']);
    expect(types('PORT=4001 # dev', 'env')).toEqual(['keyword:PORT', 'number:4001', 'comment:# dev']);
  });

  test('diff lines', () => {
    expect(types('@@ -1 +1 @@\n-old\n+new', 'diff')).toEqual(['type:@@ -1 +1 @@', 'keyword:-old', 'function:+new']);
  });

  test('lossless: the tokens always join back to the code, whatever it is', () => {
    const samples = [
      'const a = `unterminated ${x',
      "echo 'open string",
      '/* open comment',
      '"""docstring never closed',
      'weird \\ chars ‹› ก ข ค 😀 \n\n\t  ',
      '',
    ];
    for (const lang of ['ts', 'bash', 'sql', 'python', 'json', 'env', 'diff', 'powershell', 'nope']) {
      for (const s of samples) expect(join(s, lang)).toBe(s);
    }
  });
});

describe('shell prompts', () => {
  test('stripPrompts drops the reader-only $ but keeps the command and its indentation', () => {
    expect(stripPrompts('$ npm i\n  $ npm test\nplain $ inside')).toBe('npm i\n  npm test\nplain $ inside');
    expect(isShell('PowerShell')).toBe(true);
    expect(isShell('ts')).toBe(false);
  });
});
