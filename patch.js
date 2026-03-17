const fs = require('fs');
let code = fs.readFileSync('c:/Github/MetaBooks/Frontend/app/studio/upload/page.tsx', 'utf8');

if (!code.includes('getBookCoverUrl')) {
  code = code.replace('import { searchBooks, StudioBook } from "../../lib/studioApi";', 'import { searchBooks, StudioBook, getBookCoverUrl } from "../../lib/studioApi";\nimport { resolvedThumbnail } from "../../lib/imgUrl";');
} else if (!code.includes('resolvedThumbnail')) {
  code = code.replace('import { searchBooks, StudioBook', 'import { resolvedThumbnail } from "../../lib/imgUrl";\nimport { searchBooks, StudioBook');
}

if (!code.includes('titleAltName?: string;')) {
  code = code.replace('titleName: string;\n  chapterId: string;', 'titleName: string;\n  titleAltName?: string;\n  chapterId: string;');
}

if (!code.includes('const [titleAltName, setTitleAltName]')) {
  code = code.replace('const [titleName, setTitleName] = useState(prefillTitleName);', 'const [titleName, setTitleName] = useState(prefillTitleName);\n  const [titleAltName, setTitleAltName] = useState("");\n  const [titleThumbnail, setTitleThumbnail] = useState(prefillTitleId ? getBookCoverUrl(prefillTitleId) : "");');
}

if (!code.includes('setTitleAltName(data.titleAltName')) {
  code = code.replace('setTitleName(data.titleName);', 'setTitleName(data.titleName);\n        setTitleAltName(data.titleAltName ?? "");\n        if (data.titleId) setTitleThumbnail(getBookCoverUrl(data.titleId));');
}

if (!code.includes('<string | number>(0)')) {
  code = code.replace('const [priceCoins, setPriceCoins] = useState(0);', 'const [priceCoins, setPriceCoins] = useState<string | number>(0);');
  code = code.replace('onChange={(e) => setPriceCoins(Number(e.target.value))}', 'onChange={(e) => setPriceCoins(e.target.value === "" ? "" : Number(e.target.value))}');
}

if (!code.includes('titleAltName,')) {
    code = code.replace(/body: JSON\.stringify\(\{ description, priceCoins \}\),/g, 'body: JSON.stringify({ description, priceCoins: priceCoins === "" ? 0 : Number(priceCoins), titleAltName, chapterTitle, chapterNumber }),');
    code = code.replace('titleName,\n        chapterId,', 'titleName,\n        titleAltName,\n        chapterId: chapterId || crypto.randomUUID(),');
    code = code.replace('[user, versionId, titleId, chapterId, language, titleName, chapterNumber, chapterTitle, description, priceCoins]', '[user, versionId, titleId, chapterId, language, titleName, titleAltName, chapterNumber, chapterTitle, description, priceCoins]');
}

if (!code.includes('setTitleAltName(e.target.value)')) {
  const inputHtml = '            </div>\\n            <div className="space-y-1">\\n              <label className="text-xs text-white/50">เพิ่มชื่อมังงะ(ถ้ามี)</label>\\n              <input\\n                value={titleAltName}\\n                onChange={(e) => setTitleAltName(e.target.value)}\\n                placeholder="อาทิ ชื่อภาษาไทย, ชื่อภาษาอื่น"\\n                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/20 outline-none transition focus:border-white/30"\\n              />\\n            </div>';
  code = code.replace('</div>\n            <div className="space-y-1">\n              <label className="text-xs text-white/50">', inputHtml.replace(/\\\\n/g, '\n') + '\n            <div className="space-y-1">\n              <label className="text-xs text-white/50">');
}

code = code.replace('} catch {', '} catch (e) { console.error("Search failed:", e);');

if (code.includes('src={book.thumbnail}')) {
  code = code.replace('src={book.thumbnail}', 'src={resolvedThumbnail(book as any)}');
}
if (code.includes('setTitleThumbnail(book.thumbnail ?? "");')) {
  code = code.replace('setTitleThumbnail(book.thumbnail ?? "");', 'setTitleThumbnail(book.thumbnail ? resolvedThumbnail(book as any) : "");');
}

if (code.includes('alt={titleName ? \หน้าปก \ : "ปกมังงะ"}') && code.includes('ไม่มีหน้าปก')) {
  code = code.replace('<div className="flex h-full w-full items-center justify-center bg-white/5 text-sm text-white/30">\n                      ไม่มีหน้าปก\n                    </div>', '{titleThumbnail ? (\n                      <Image\n                        src={titleThumbnail}\n                        alt={titleName ? \หน้าปก \\ : "ปกมังงะ"}\n                        fill\n                        unoptimized\n                        className="object-cover transition group-hover:scale-105"\n                      />\n                    ) : (\n                      <div className="flex h-full w-full items-center justify-center bg-white/5 text-sm text-white/30">\n                        ไม่มีหน้าปก\n                      </div>\n                    )}');
}

fs.writeFileSync('c:/Github/MetaBooks/Frontend/app/studio/upload/page.tsx', code, 'utf8');
console.log('Patch complete.');
