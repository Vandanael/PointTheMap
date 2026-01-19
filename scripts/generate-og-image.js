// Script pour générer og-image.png (FR et EN) à partir des templates SVG
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

// Générer les deux versions (FR et EN)
const publicDir = join(rootDir, 'public');

try {
  // Version française
  await generatePNG(
    join(publicDir, 'og-image-fr.svg'),
    join(publicDir, 'og-image-fr.png')
  );
  console.log('✅ og-image-fr.png créé');

  // Version anglaise
  await generatePNG(
    join(publicDir, 'og-image-en.svg'),
    join(publicDir, 'og-image-en.png')
  );
  console.log('✅ og-image-en.png créé');

  // Version par défaut (FR)
  await generatePNG(
    join(publicDir, 'og-image-fr.svg'),
    join(publicDir, 'og-image.png')
  );
  console.log('✅ og-image.png créé (version FR par défaut)');
} catch (error) {
  console.error('❌ Erreur lors de la génération:', error.message);
  process.exit(1);
}
