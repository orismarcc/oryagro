// Gera ícones PWA a partir de public/pwa-icon-source.png (1024x1024).
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

// Tamanhos exigidos pelo PWA + Apple Touch Icon
const SIZES = [
  { size: 192, name: 'icon-192.png' },
  { size: 512, name: 'icon-512.png' },
  { size: 180, name: 'apple-touch-icon.png' }, // iOS home-screen
  { size: 32,  name: 'favicon-32.png' },
  { size: 16,  name: 'favicon-16.png' },
];

// Versão "maskable" — padding extra (safe-zone 20%) para o Android cortar em círculo/squircle
// Sem isso o Android pode cortar partes do logo. Usamos cor de fundo da marca.
const BG_COLOR = { r: 22, g: 163, b: 74, alpha: 1 }; // hsl(160 84% 27%) ≈ #16a34a

async function makeRegular({ size, name }) {
  await sharp(SRC)
    .resize(size, size, { fit: 'cover' })
    .png({ quality: 90 })
    .toFile(path.join(OUT_DIR, name));
  console.log(`  ✓ ${name} (${size}×${size})`);
}

async function makeMaskable({ size, name }) {
  // Padding de 20% para safe zone do maskable
  const inner = Math.round(size * 0.8);
  const padding = Math.round((size - inner) / 2);
  const innerBuf = await sharp(SRC).resize(inner, inner, { fit: 'cover' }).png().toBuffer();
  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: BG_COLOR,
    },
  })
    .composite([{ input: innerBuf, top: padding, left: padding }])
    .png({ quality: 90 })
    .toFile(path.join(OUT_DIR, name));
  console.log(`  ✓ ${name} (${size}×${size}, maskable)`);
}

console.log('→ Gerando ícones PWA…');
for (const s of SIZES) await makeRegular(s);

console.log('→ Gerando maskables…');
await makeMaskable({ size: 192, name: 'icon-192-maskable.png' });
await makeMaskable({ size: 512, name: 'icon-512-maskable.png' });

console.log('✓ Pronto. Ícones em public/icons/');
