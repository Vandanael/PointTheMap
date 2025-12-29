# PointTheMap

PointTheMap est une application web de cartographie interactive conçue pour tester la rapidité et la précision géographique des utilisateurs. Le projet repose sur une interface épurée sans étiquettes pour offrir un défi authentique.

## Concept et Fonctionnement

L'utilisateur doit localiser une série de capitales mondiales sur une carte muette. Le système évalue la précision du placement et la vitesse d'exécution pour attribuer un score.

* **Format de session** : 5 manches par partie.
* **Contrainte de temps** : 5 secondes par capitale pour valider un choix.
* **Feedback instantané** : Visualisation de l'écart via le "Zoom de vérité" et tracé de distance.
* **Interface** : Design sombre optimisé pour une utilisation mobile et desktop.

## Spécifications Techniques

L'application est développée en architecture statique pour une performance maximale et une compatibilité avec l'hébergement GitHub Pages.

* **Moteur cartographique** : Leaflet.js (v1.9.4).
* **Fond de carte** : CartoDB Positron No Labels (serveur de tuiles sans données textuelles).
* **Design** : Tailwind CSS (modèle utilitaire pour une UI réactive).
* **Logique** : Vanilla JavaScript (ES6+).

## Installation et Déploiement

Le projet ne nécessite aucune étape de compilation. Pour déployer sur GitHub Pages :

1. Initialisez un dépôt Git et poussez les fichiers sur la branche principale.
2. Accédez aux **Settings** du dépôt sur GitHub.
3. Dans la section **Pages**, sélectionnez la branche `main` comme source.
4. Enregistrez pour générer l'URL publique.

### Structure du projet

```text
PointTheMap/
├── index.html       # Structure, UI et logique moteur
├── capitals.js      # Base de données géographique (JSON)
└── README.md        # Documentation technique
