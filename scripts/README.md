# Scripts

## generate-og-image.js

Génère l'image de partage Open Graph (`og-image.png`) à partir du favicon et du template SVG.

**Usage :**
```bash
npm run generate:og-image
```

**Fichiers utilisés :**
- `public/favicon.svg` (ou `favicon.svg` à la racine en fallback)
- `public/og-image.svg` (template avec titre et description)

**Fichier généré :**
- `public/og-image.png` (1200x630px)
