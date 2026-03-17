# FlashCPAP [![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/H2H81VJXO5)

Extension Firefox & Chromium open source pour **analyser des rapports PPC/CPAP** (pages web ou PDF), extraire les données importantes et générer un **résumé prêt à copier**.

## ✨ Fonctionnalités principales

- Analyse et extraction des données de la page active en 1 clic
- Analyse et extraction des données d'un fichier PDF (optionnel)
- Détection automatique du prestataire (mode Auto)
- Génération de résumé éditable + aperçu lisible
- Copie rapide du résumé dans le presse-papiers
- Surlignage interactif des données extraites dans le texte source pour une meilleure visibilité lors du paramètrage.
- Paramètres avancés par prestataire (champs, mots clés, unités, ordre)
- Checkboxes personnalisées avec familles, favoris et phrases combinées pour ajout de texte personnalisé
- Interprétation configurable des données (seuils + textes)
- Import / Export JSON (prestataires et checkboxes)

## 🚀 Installation

### Firefox (AMO)

Disponible sur [addons.mozilla.org](https://addons.mozilla.org/fr/firefox/addon/flashcpap/).

### Chargement local (mode développeur)

**Prérequis** : bash, python3

```bash
bash build.sh firefox    # → dist/firefox-x.x.x.zip
bash build.sh chromium   # → dist/chromium-x.x.x.zip
bash build.sh edge       # → dist/edge-x.x.x.zip
```

<details>
<summary>Firefox</summary>

1. `bash build.sh firefox`
2. Ouvrir `about:debugging#/runtime/this-firefox`
3. Cliquer sur **Charger un module temporaire**
4. Sélectionner le fichier `dist/firefox-x.x.x.zip`

</details>

<details>
<summary>Chrome / Chromium</summary>

1. `bash build.sh chromium`
2. Décompresser `dist/chromium-x.x.x.zip` dans un dossier
3. Ouvrir `chrome://extensions`
4. Activer le **Mode développeur**
5. Cliquer sur **Charger l'extension non empaquetée**
6. Sélectionner le dossier décompressé

</details>

<details>
<summary>Edge</summary>

1. `bash build.sh edge`
2. Décompresser `dist/edge-x.x.x.zip` dans un dossier
3. Ouvrir `edge://extensions`
4. Activer le **Mode développeur**
5. Cliquer sur **Charger l'extension non empaquetée**
6. Sélectionner le dossier décompressé

</details>

## 🧭 Utilisation rapide

1. Ouvrir une page de rapport CPAP (ou sélectionner un PDF dans l'extension)
2. Cliquer sur l'icône de l'extension — une fenêtre popup s'ouvre
3. Cliquer sur **Analyser la page**
4. Vérifier/ajuster le résumé généré
5. Ajouter si besoin les options/checks personnalisés
6. Cliquer sur **Copier le résumé**

## 🌐 Portabilité navigateurs

Le code source est partagé entre toutes les cibles. Le script `build.sh` adapte le manifest selon la cible :

| Cible | `background` | Spécificités |
|---|---|---|
| Firefox | `scripts: [background.js]` | `browser_specific_settings.gecko` |
| Chromium | `service_worker: background.js` | — |
| Edge | `service_worker: background.js` | — |

`background.js` utilise un shim de compatibilité :
```js
const _browser = (typeof globalThis.browser !== 'undefined') ? globalThis.browser : globalThis.chrome;
```

`src/platform/` contient les adaptateurs spécifiques à chaque navigateur utilisés par le popup.

## ⚙️ Permissions utilisées

- `activeTab`, `tabs`, `windows` : lecture du contexte onglet/fenêtre active
- `scripting` : extraction du texte dans la page active
- `storage` : sauvegarde des paramètres locaux
- `clipboardWrite` : copie du résumé
- `optional_host_permissions` : accès hôtes accordés à la demande de l'utilisateur

## 🧱 Architecture du projet

```
background.js          Service worker (compat Firefox + Chromium)
popup.html             Interface principale
src/main.js            Point d'entrée du popup
src/extraction.js      Extraction du texte page/PDF
src/parsing.js         Parsing des données CPAP
src/summary.js         Génération du résumé
src/platform/          Adaptateurs navigateur
lib/                   PDF.js (vendored)
build.sh               Script de build multi-cibles
```

## 🔒 Données & confidentialité

- Tout le traitement est effectué **localement dans le navigateur** — aucune donnée n'est envoyée à un serveur.
- Les paramètres sont stockés localement via `browser.storage.local`.
- Les exports/imports se font en JSON à la demande de l'utilisateur.

## 🛠 Développement

- Manifest V3
- JavaScript modulaire (ES modules), aucun bundler
- PDF.js vendored dans `lib/`

## 📄 Licence

Projet distribué sous **Apache License 2.0**.


