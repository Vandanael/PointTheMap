# 🌍 PointTheMap

**Un jeu de rapidité géographique captivant pour tester vos connaissances des capitales du monde !**

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Platform](https://img.shields.io/badge/platform-Web-orange.svg)

---

## 🎮 Concept

**PointTheMap** est un jeu web interactif qui met au défi votre connaissance géographique. Vous devez localiser 50 capitales mondiales sur une carte sans étiquettes, en cliquant le plus précisément possible. Plus vous êtes proche, plus vous gagnez de points !

### ✨ Points forts
- 🎯 **Système de scoring précis** : Jusqu'à 5000 points par capitale
- 🔍 **"Zoom de la vérité"** : Visualisez votre précision après chaque clic
- 📱 **Mobile-First** : Interface optimisée pour smartphone et desktop
- 🎨 **UI Gaming moderne** : Design sombre élégant avec Tailwind CSS
- 🗺️ **Carte sans labels** : Aucun indice visuel pour un vrai défi !

---

## 📜 Règles du jeu

### Déroulement
1. **10 manches** : Vous devez localiser 10 capitales différentes
2. **Score maximum** : 50 000 points (5000 par capitale)
3. **Une seule tentative** par capitale

### Système de scoring
Le score dépend de la distance entre votre clic et la capitale réelle :

| Distance        | Points        | Qualité      |
|----------------|---------------|--------------|
| < 50 km        | 5000 pts      | 🏆 Parfait   |
| 50-200 km      | 2000-5000 pts | 🎯 Excellent |
| 200-500 km     | 500-2000 pts  | 👍 Bien      |
| 500-1000 km    | 250-500 pts   | 👌 Correct   |
| 1000-2000 km   | 100-250 pts   | 🤔 Moyen     |
| > 2000 km      | 0-100 pts     | 📚 À revoir  |

### Niveaux de performance finale
- **45 000+ pts** : 🏆 Champion du monde !
- **40 000+ pts** : ⭐ Expert en géographie !
- **35 000+ pts** : 🎯 Très bon score !
- **25 000+ pts** : 👍 Bien joué !
- **15 000+ pts** : 👌 Pas mal !
- **< 15 000 pts** : 📚 Continue à t'entraîner !

---

## 🚀 Déploiement sur GitHub Pages

### Méthode rapide

1. **Créer un repository GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit - PointTheMap game"
   git branch -M main
   git remote add origin https://github.com/VOTRE-USERNAME/PointTheMap.git
   git push -u origin main
   ```

2. **Activer GitHub Pages**
   - Allez dans `Settings` > `Pages`
   - Dans **Source**, sélectionnez `main` branch
   - Dans **Folder**, laissez `/ (root)`
   - Cliquez sur **Save**

3. **Accéder au jeu**
   - Votre jeu sera accessible à : `https://VOTRE-USERNAME.github.io/PointTheMap/`
   - Le déploiement prend environ 2-3 minutes

### Structure des fichiers

```
PointTheMap/
├── index.html       # Application principale
├── capitals.js      # Base de données des 50 capitales
└── README.md        # Documentation
```

---

## 🛠️ Technologies utilisées

- **[Tailwind CSS](https://tailwindcss.com/)** (CDN) - Framework CSS utility-first
- **[Leaflet.js](https://leafletjs.com/)** (1.9.4) - Bibliothèque de cartes interactives
- **CartoDB Positron No Labels** - Fond de carte sans étiquettes
- **Vanilla JavaScript (ES6 Modules)** - Logique du jeu

---

## 🎯 Fonctionnalités

### Interface utilisateur
- ✅ Design moderne en **Slate-900** avec accents purple/pink
- ✅ Header avec score et manche en temps réel
- ✅ Modals stylés pour les questions et résultats
- ✅ Animations CSS (pulse, scale, gradients)

### Carte interactive
- ✅ Fond de carte **sans noms de pays ni villes**
- ✅ Zoom automatique sur l'écart après chaque clic
- ✅ Marqueurs colorés (rouge = cible, bleu = votre clic)
- ✅ Ligne pointillée montrant la distance

### Gameplay
- ✅ 50 capitales variées (faciles à difficiles)
- ✅ Calcul de distance précis en km/m
- ✅ Système de scoring intelligent
- ✅ Icônes de performance contextuelles

### Mobile-First
- ✅ Viewport configuré pour empêcher le zoom natif
- ✅ Interface tactile fluide
- ✅ Responsive design (mobile + desktop)
- ✅ Touch actions optimisées

---

## 🌐 Capitales incluses

Le jeu propose **50 capitales mondiales** avec différents niveaux de difficulté :

### Faciles (15)
Paris, Tokyo, Londres, Berlin, Rome, Madrid, Washington D.C., Pékin, Moscou, Le Caire, Brasilia, Canberra, Mexico, Buenos Aires, Ottawa

### Moyennes (20)
Nairobi, Ankara, Bangkok, Lisbonne, Varsovie, Prague, Vienne, Stockholm, Oslo, Dublin, Wellington, Santiago, Lima, Séoul, New Delhi, etc.

### Difficiles (15)
Noursoultan, Apia, Ouagadougou, Thimphou, Bichkek, Douchanbé, Oulan-Bator, Antananarivo, Paramaribo, Suva, Mbabane, Nouakchott, Banjul, Libreville, Malabo, Lomé, Porto-Novo, Moroni, Port-Vila, Nuku'alofa

---

## 📱 Compatibilité

- ✅ Chrome / Edge (recommandé)
- ✅ Firefox
- ✅ Safari (iOS/macOS)
- ✅ Navigateurs mobiles modernes

---

## 🎨 Personnalisation

### Modifier le nombre de manches
Dans `index.html`, ligne 286 :
```javascript
if (currentRound > 10) {  // Changer 10 par le nombre souhaité
```

### Ajouter des capitales
Dans `capitals.js`, ajoutez des entrées au tableau :
```javascript
{ name: "Ville", country: "Pays", lat: XX.XXXX, lng: YY.YYYY }
```

### Changer les couleurs
Dans `index.html`, remplacez les classes Tailwind :
- `slate-900` → Couleur de fond
- `purple-500` / `pink-600` → Accents

---

## 📄 Licence

MIT License - Vous êtes libre d'utiliser, modifier et distribuer ce projet.

---

## 🙏 Crédits

- **Fonds de carte** : [CartoDB](https://carto.com/basemaps/)
- **Bibliothèque de cartes** : [Leaflet.js](https://leafletjs.com/)
- **Framework CSS** : [Tailwind CSS](https://tailwindcss.com/)

---

## 🎮 Prêt à jouer ?

**Testez vos connaissances géographiques maintenant !**

[🚀 Lancer le jeu](https://VOTRE-USERNAME.github.io/PointTheMap/)

---

**Made with 💜 for geography lovers**
