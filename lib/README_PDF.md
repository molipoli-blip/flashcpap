# Instructions pour télécharger pdf.js

Pour que l'extraction PDF fonctionne, vous devez télécharger pdf.js (bibliothèque officielle Mozilla) :

## Étapes :

1. **Télécharger pdf.js** depuis le CDN officiel ou GitHub :
   - Option 1 (CDN) : Télécharger depuis https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/
     - `pdf.mjs` (ou `pdf.min.mjs`)
     - `pdf.worker.mjs` (ou `pdf.worker.min.mjs`)
   
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

## Alternative rapide (PowerShell)

Exécuter dans le dossier `lib/` :

```powershell
# Télécharger pdf.mjs
Invoke-WebRequest -Uri "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.mjs" -OutFile "pdf.mjs"

# Télécharger pdf.worker.mjs
Invoke-WebRequest -Uri "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.mjs" -OutFile "pdf.worker.mjs"
```
