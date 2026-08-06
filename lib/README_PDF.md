# Instructions pour télécharger pdf.js

Pour que l'extraction PDF fonctionne, vous devez télécharger pdf.js (bibliothèque officielle Mozilla) :

## Étapes :

1. **Télécharger PDF.js** depuis le paquet officiel Mozilla ou GitHub :
   - Option 1 (npm) : `npm pack pdfjs-dist@6.1.200`
     - Copier `package/build/pdf.mjs`
     - Copier `package/build/pdf.worker.mjs`

   - Option 2 (GitHub) : https://github.com/mozilla/pdf.js/releases/latest
     - Télécharger `pdfjs-*-dist.zip`
     - Extraire `build/pdf.mjs` et `build/pdf.worker.mjs`

2. **Placer les fichiers** dans le dossier `lib/` de l'extension :
   ```
   nouveau test/
   ├── lib/
   │   ├── pdf.mjs           ← À télécharger
   │   ├── pdf.worker.mjs    ← À télécharger
   │   └── pdf-parser.js     ← Déjà créé
   ```

3. **Mise à jour du manifest** : Les fichiers seront automatiquement déclarés dans manifest.json.

## Licence

pdf.js est sous licence Apache 2.0 - utilisation commerciale autorisée.

La version actuellement embarquée est PDF.js 6.1.200. Après chaque mise à jour,
conserver `isEvalSupported: false` dans `lib/pdf-parser.js` et refaire les tests
sur Firefox, Chromium et Edge.
