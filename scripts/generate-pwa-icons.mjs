// Gera ícones PWA a partir de public/pwa-icon-source.png.
// - Faz trim automático das margens brancas (a logo já vem como rounded-square)
// - "any" icons: usa a logo trimmed (preserva rounded corners do design)
// - "maskable" icons: composita sobre fundo verde-escuro do próprio logo (#0e4b1c)
//   com safe zone de ~10% para que masks circulares/squircle do Android não cortem nada.
//
// Rode: npm run pwa:icons
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, '..');
const SRC       = path.join(ROOT, 'public/pwa-icon-source.png');
const OUT_DIR   = path.join(ROOT, 'public/icons');

if (!existsSync(SRC)) {
  console.error(`✗ Source não encontrado: ${SRC}`);
  process.exit(1);
}

await mkdir(OUT_DIR, { recursive: true });

// Cor de fundo da identidade visual da logo (verde-escuro do quadrado arredondado)
const BRAND_DARK = { r: 14, g: 75, b: 28, alpha: 1 }; // #0e4b1c

// Faz o trim das margens brancas e PREENCHE o resto da bounding box com a cor da marca,
// criando uma versão "sólida" (square) usada nas variantes maskable.
// Para "any" preservamos o PNG original (com cantos arredondados visíveis).
const trimmed = await sharp(SRC)
  .trim({ background: 'white', threshold: 10 })
  .toBuffer({ resolveWithObject: true });

const trimmedSize = Math.max(trimmed.info.width, trimmed.info.height);
console.log(`→ Logo trimmed: ${trimmed.info.width}×${trimmed.info.height}`);

const SIZES_REGULAR = [
  { size: 192, name: 'icon-192.png' },
  { size: 512, name: 'icon-512.png' },
  { size: 180, name: 'apple-touch-icon.png' },
  { size: 32,  name: 'favicon-32.png' },
  { size: 16,  name: 'favicon-16.png' },
];

async function makeRegular({ size, name }) {
  // Para "any": usa a logo trimmed centralizada num quadrado transparente
  // (browsers respeitam a transparência ou aplicam fundo automático).
  // Para o apple-touch-icon, iOS NÃO suporta transparência — usa fundo dark.
  const isAppleTouch = name === 'apple-touch-icon.png';
  const bg = isAppleTouch
    ? BRAND_DARK
    : { r: 0, g: 0, b: 0, alpha: 0 };

  // Resize mantendo proporção, com cantos arredondados naturais do design original.
  const innerBuf = await sharp(trimmed.data)
    .resize(size, size, { fit: 'contain', background: bg })
    .png({ quality: 95 })
    .toBuffer();

  await sharp(innerBuf).toFile(path.join(OUT_DIR, name));
  console.log(`  ✓ ${name} (${size}×${size}${isAppleTouch ? ', solid bg' : ''})`);
}

async function makeMaskable({ size, name }) {
  // Maskable: precisa ser um QUADRADO totalmente preenchido com a cor da marca,
  // logo centralizada com safe zone de ~10% (Android pode aplicar mask circular/squircle).
  const inner = Math.round(size * 0.80);
  const padding = Math.round((size - inner) / 2);

  const innerBuf = await sharp(trimmed.data)
    .resize(inner, inner, { fit: 'contain', background: BRAND_DARK })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: BRAND_DARK,
    },
  })
    .composite([{ input: innerBuf, top: padding, left: padding }])
    .png({ quality: 95 })
    .toFile(path.join(OUT_DIR, name));
  console.log(`  ✓ ${name} (${size}×${size}, maskable, brand bg)`);
}

console.log('→ Gerando ícones "any"…');
for (const s of SIZES_REGULAR) await makeRegular(s);

console.log('→ Gerando "maskable"…');
await makeMaskable({ size: 192, name: 'icon-192-maskable.png' });
await makeMaskable({ size: 512, name: 'icon-512-maskable.png' });

console.log('✓ Pronto. (favicon usa /icons/favicon-32.png — mesma logo)');
