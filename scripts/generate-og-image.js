// Script pour générer og-image.png à partir de la favicon
// Usage: node scripts/generate-og-image.js

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// Fonction pour convertir SVG en PNG
const generatePNG = async (svgPath, outputPath) => {
  const svgContent = readFileSync(svgPath, 'utf-8');
  const svgBuffer = Buffer.from(svgContent);
  const pngBuffer = await sharp(svgBuffer)
    .resize(1200, 630)
    .png()
    .toBuffer();
  writeFileSync(outputPath, pngBuffer);
};

// Générer l'image de partage
const publicDir = join(rootDir, 'public');

try {
  await generatePNG(
    join(publicDir, 'favicon.svg'),
    join(publicDir, 'og-image.png')
  );
  console.log('✅ og-image.png créé');
} catch (error) {
  console.error('❌ Erreur lors de la génération:', error.message);
  process.exit(1);
}
