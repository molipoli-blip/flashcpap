Vendored third-party libraries (MV3 CSP — cannot be loaded from CDN):

  pdf.mjs          Mozilla pdf.js — Apache 2.0  — https://github.com/mozilla/pdf.js
  pdf.worker.mjs   Mozilla pdf.js worker         (même source)
  pdf-parser.js    Wrapper local d'extraction    (code FlashCPAP)

Licence complète : voir THIRD_PARTY_NOTICES.txt à la racine du projet.

Pour mettre à jour pdf.js :
  Invoke-WebRequest -Uri "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.mjs"        -OutFile "pdf.mjs"
  Invoke-WebRequest -Uri "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.mjs" -OutFile "pdf.worker.mjs"