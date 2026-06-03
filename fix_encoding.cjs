/**
 * Fix mojibake in source files.
 * Mojibake happens when UTF-8 bytes are misread as Latin-1:
 *   e.g. 'á' (UTF-8: 0xC3 0xA1) stored as two Latin-1 chars: U+00C3 + U+00A1
 *
 * Algorithm: scan each character; if it's a UTF-8 lead byte (0xC2-0xFF)
 * and followed by valid continuation bytes (0x80-0xBF), decode and replace.
 * This is safe: correct single Unicode chars (like Ã in "NÃO") are NOT
 * followed by continuation-range chars, so they are left unchanged.
 */
const fs = require('fs');
const path = require('path');

const files = [
  'src/components/LotePage.jsx',
  'src/components/CronogramaTimeline.jsx',
  'src/data/culturas.js',
  'src/data/culturas.backup.js',
];

function fixMojibake(content) {
  let result = '';
  let i = 0;
  let fixed = 0;

  while (i < content.length) {
    const c = content.charCodeAt(i);

    // Check 4-byte sequence (emojis, supplementary chars): 0xF0-0xF7
    if (c >= 0xF0 && c <= 0xF7 && i + 3 < content.length) {
      const n1 = content.charCodeAt(i + 1);
      const n2 = content.charCodeAt(i + 2);
      const n3 = content.charCodeAt(i + 3);
      if (n1 >= 0x80 && n1 <= 0xBF && n2 >= 0x80 && n2 <= 0xBF && n3 >= 0x80 && n3 <= 0xBF) {
        const cp = ((c & 0x07) << 18) | ((n1 & 0x3F) << 12) | ((n2 & 0x3F) << 6) | (n3 & 0x3F);
        result += String.fromCodePoint(cp);
        i += 4;
        fixed++;
        continue;
      }
    }

    // Check 3-byte sequence: 0xE0-0xEF
    if (c >= 0xE0 && c <= 0xEF && i + 2 < content.length) {
      const n1 = content.charCodeAt(i + 1);
      const n2 = content.charCodeAt(i + 2);
      if (n1 >= 0x80 && n1 <= 0xBF && n2 >= 0x80 && n2 <= 0xBF) {
        const cp = ((c & 0x0F) << 12) | ((n1 & 0x3F) << 6) | (n2 & 0x3F);
        result += String.fromCodePoint(cp);
        i += 3;
        fixed++;
        continue;
      }
    }

    // Check 2-byte sequence: 0xC2-0xDF
    if (c >= 0xC2 && c <= 0xDF && i + 1 < content.length) {
      const n1 = content.charCodeAt(i + 1);
      if (n1 >= 0x80 && n1 <= 0xBF) {
        const cp = ((c & 0x1F) << 6) | (n1 & 0x3F);
        result += String.fromCodePoint(cp);
        i += 2;
        fixed++;
        continue;
      }
    }

    result += content[i];
    i++;
  }

  return { result, fixed };
}

const root = path.resolve(__dirname);

for (const relPath of files) {
  const fullPath = path.join(root, relPath);
  if (!fs.existsSync(fullPath)) {
    console.log(`Skipped (not found): ${relPath}`);
    continue;
  }

  const original = fs.readFileSync(fullPath, 'utf8');
  const { result, fixed } = fixMojibake(original);

  if (result !== original) {
    fs.writeFileSync(fullPath, result, 'utf8');
    console.log(`Fixed ${fixed} sequences in: ${relPath}`);
  } else {
    console.log(`Clean (no mojibake): ${relPath}`);
  }
}
console.log('Done.');
