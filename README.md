# FlashCPAP [![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/H2H81VJXO5) 

Extension Chrome open source pour **analyser des rapports PPC/CPAP** (pages web ou PDF), extraire les données importantes et générer un **résumé prêt à copier**.

## ✨ Fonctionnalités principales

- Analyse de la page active en 1 clic
- Analyse optionnelle d’un fichier PDF
- Détection automatique du prestataire (mode Auto)
- Génération de résumé éditable + aperçu lisible
- Copie rapide du résumé dans le presse-papiers
- Surlignage interactif des données extraites dans le texte source
- Paramètres avancés par prestataire (champs, labels, unités, ordre)
- Checkboxes personnalisées avec familles, favoris et phrases combinées
- Interprétation configurable (seuils + textes)
- Import / Export JSON (prestataires et checkboxes)

## 🚀 Installation (mode développeur)

1. Ouvrir PowerShell dans le dossier du projet
2. Exécuter `powershell -ExecutionPolicy Bypass -File .\build\build.ps1 chromium`
3. Ouvrir Chrome et aller sur `chrome://extensions`
4. Activer le **Mode développeur**
5. Cliquer sur **Charger l’extension non empaquetée**
6. Sélectionner le dossier `dist/chromium`

Ensuite, cliquer sur l’icône de l’extension pour ouvrir FlashCPAP.

## 🧭 Utilisation rapide

1. Ouvrir une page de rapport (ou sélectionner un PDF dans l’extension)
2. Cliquer sur **Analyser la page**
3. Vérifier/ajuster le résumé généré
4. Ajouter si besoin les options/checks personnalisés
5. Cliquer sur **Copier le résumé**

## ⚙️ Permissions Chrome utilisées

Le manifeste demande notamment :

- `activeTab`, `tabs`, `windows` : lecture du contexte onglet/fenêtre active
- `scripting` : extraction du texte dans la page active
- `storage` : sauvegarde des paramètres locaux
- `clipboardWrite` : copie du résumé

Accès hôtes :

- L’extension fonctionne par défaut en accès minimal (analyse sur l’onglet actif via action utilisateur)
- L’utilisateur peut ajouter explicitement des racines de site (ex: `https://www.site.com/*`) depuis les paramètres prestataire
- L’accès se fait en mode site-par-site selon les autorisations accordées par l’utilisateur

## 🧱 Architecture du projet

- **Interface** : `popup.html`
- **Entrée principale** : `src/main.js`
- **Extraction** : `src/extraction.js`, `lib/pdf-parser.js`
- **Parsing** : `src/parsing.js`
- **Résumé** : `src/summary.js`, `src/events.js`
- **UI avancée** : `src/highlighting.js`, `src/dock.js`, modules `src/checkbox-*`
- **Gestion prestataires/champs** : `src/provider-management.js`, `src/field-management.js`, `src/organization.js`

## 🌐 Portabilité navigateurs

- `src/` contient désormais le code partagé entre Chromium et Firefox.
- `src/platform/` contient la façade navigateur commune et les adaptateurs spécifiques.
- `targets/chromium/` contient la cible Chromium générique.
- la cible Edge est générée explicitement, mais réutilise les sources de `targets/chromium/`.
- `targets/firefox/` contient le manifeste et le background pour Firefox.
- `build/build.ps1` est le script officiel de build et génère un dossier `dist/` par cible à partir des ressources partagées.

Scripts disponibles :

- `powershell -ExecutionPolicy Bypass -File .\build\build.ps1 chromium`
- `powershell -ExecutionPolicy Bypass -File .\build\build.ps1 edge`
- `powershell -ExecutionPolicy Bypass -File .\build\build.ps1 firefox`
- `powershell -ExecutionPolicy Bypass -File .\build\build.ps1 all`

Note : la source officielle de packaging est désormais `targets/`. Le dossier `dist/` est seulement un résultat généré de build.

### Cibles navigateur

<details>
<summary>Chromium</summary>

Utiliser pour :

- Google Chrome
- Chromium

Source officielle :

- `targets/chromium/manifest.json`
- `targets/chromium/background.js`

Sortie de build :

- `dist/chromium/`

</details>

<details>
<summary>Edge</summary>

Utiliser pour :

- Microsoft Edge

Source officielle :

- Edge réutilise les sources de `targets/chromium/` au build.

Sortie de build :

- `dist/edge/`

</details>

<details>
<summary>Firefox</summary>

Utiliser pour :

- Mozilla Firefox

Source officielle :

- `targets/firefox/manifest.json`
- `targets/firefox/background.js`

Sortie de build :

- `dist/firefox/`

Important :

- Firefox ouvre l'interface dans une fenetre flottante (type popup), comme Chromium.
- La fenetre popup est reutilisee et remise au premier plan si elle existe deja.
- Les identifiants de l'onglet et de la fenetre source sont passes a `popup.html` pour continuer a analyser la page d'origine.

</details>

### Chargement local

<details>
<summary>Chrome / Chromium</summary>

1. Exécuter `powershell -ExecutionPolicy Bypass -File .\build\build.ps1 chromium`
2. Ouvrir `chrome://extensions`
3. Activer le mode développeur
4. Charger le dossier `dist/chromium/`

</details>

<details>
<summary>Edge</summary>

1. Exécuter `powershell -ExecutionPolicy Bypass -File .\build\build.ps1 edge`
2. Ouvrir `edge://extensions`
3. Activer le mode développeur
4. Charger le dossier `dist/edge/`

</details>

<details>
<summary>Firefox</summary>

1. Exécuter `powershell -ExecutionPolicy Bypass -File .\build\build.ps1 firefox`
2. Ouvrir `about:debugging#/runtime/this-firefox`
3. Cliquer sur `Load Temporary Add-on...`
4. Sélectionner `dist/firefox/manifest.json`

</details>

### Verification rapide

1. Ouvrir une page prise en charge.
2. Lancer l'extension.
3. Verifier l'analyse, le resume, la copie et la persistance des parametres.
4. Verifier l'import PDF et la langue de l'interface.
5. Sous Firefox, verifier que la fenetre popup flottante continue a cibler la page source.

Documentation interne détaillée :
- `FONCTIONNALITES.md`
- `GUIDE_FICHIERS.md`

## 🔒 Données & confidentialité

- Les paramètres sont stockés localement (navigateur).
- Les exports/imports se font en JSON à la demande de l’utilisateur.
- Certaines fonctionnalités optionnelles (ex: partage template, feedback) peuvent effectuer des requêtes réseau explicites.

## 🛠 Développement

- Manifest V3
- Code JavaScript modulaire (ES modules)
- Bibliothèque PDF.js vendored dans `lib/`

## 📄 Licence

Projet distribué sous **Apache License 2.0**.
Voir le fichier `LICENSE`.

## 🙌 Contribution

Les contributions (issues, idées, correctifs) sont bienvenues.
Pour les changements importants, ouvrir d’abord une discussion/issue pour aligner le périmètre.

