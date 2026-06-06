# FlashCPAP [![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/H2H81VJXO5)

**FlashCPAP** is an open-source Firefox & Chromium browser extension designed to analyze **CPAP/PPC reports** (web pages or PDFs from providers), extract key data, and generate a **structured clinical summary** ready to be copied into medical records.

<p align="center">
  <a href="https://www.flashcpap.com">Website</a> •
  <a href="#main-features">Features</a> •
  <a href="#installation">Installation</a> •
  <a href="#quick-start">Quick start</a> •
  <a href="#privacy--data">Privacy</a>
</p>

---

## What FlashCPAP is for

FlashCPAP is designed for clinicians and sleep practitioners who need to:

- review CPAP/PPC reports faster  
- standardize repetitive extraction values (e.g. AHI, leaks rate, Adherence etc..)
- generate a clear, structured summary  
- keep full control over local data processing  

> [!NOTE]
> **FlashCPAP is a workflow support tool.**  
> It does not provide medical advice, diagnosis, or treatment recommendations.  
> Clinical review of all extracted data is mandatory.

---

## Main features

- One-click analysis and extraction from the active page based on field keywords  
- Advanced provider-specific settings (fields, keywords, units, order)  
- Interactive highlighting of extracted values in the source text for easier configuration and verification  
- Custom checkboxes with families, favorites, and combined phrases for adding personalized text  
- Optional analysis and extraction from PDF files  
- Automatic provider detection (**Auto mode**)  
- Editable summary generation with readable preview  
- Quick copy of the generated summary to the clipboard  
- JSON import/export for providers and checkboxes  

---

## Installation

<details>
<summary><strong>Firefox, Chrome, Edge Webstores</strong></summary>

FlashCPAP is available on:

- <a href="https://addons.mozilla.org/en-US/firefox/addon/flashcpap/">Firefox Add-ons</a>  
- <a href="https://chromewebstore.google.com/detail/pedibchhakipflddbcfckhgojjagoiim">Chrome Web Store</a>  
- <a href="https://microsoftedge.microsoft.com/addons/detail/flashcpap/poakfgkhfiamihmcbihhajkjbdndgilf">Edge Add-ons</a>  

</details>

<details>
<summary><strong>Local build (developer mode)</strong></summary>

**Option 1 (Linux/macOS/Git Bash):** `bash`, `python3`, `zip`

```bash
bash build.sh firefox    # -> dist/firefox-x.x.x.zip
bash build.sh chromium   # -> dist/chromium-x.x.x.zip
bash build.sh edge       # -> dist/edge-x.x.x.zip
```

**Option 2 (Windows PowerShell):**

```powershell
# Firefox package
$manifest = Get-Content -Raw manifest.json | ConvertFrom-Json
$version = $manifest.version
Compress-Archive -Path @('manifest.json','background.js','popup.html','_locales','icons','lib','src','styles') -DestinationPath "dist/firefox-$version.zip" -CompressionLevel Optimal
```

```powershell
# Chromium package (service_worker + no gecko settings)
$manifest = Get-Content -Raw manifest.json | ConvertFrom-Json
$version = $manifest.version
$tempRoot = Join-Path $env:TEMP ("flashcpap-build-" + [guid]::NewGuid())
New-Item -ItemType Directory -Path $tempRoot | Out-Null
foreach ($p in @('background.js','popup.html','_locales','icons','lib','src','styles')) { Copy-Item -Path $p -Destination (Join-Path $tempRoot $p) -Recurse -Force }
$manifest.background = @{ service_worker = 'background.js' }
$manifest.PSObject.Properties.Remove('browser_specific_settings')
$manifest | ConvertTo-Json -Depth 100 | Set-Content -Path (Join-Path $tempRoot 'manifest.json') -Encoding UTF8
Compress-Archive -Path (Join-Path $tempRoot '*') -DestinationPath "dist/chromium-$version.zip" -CompressionLevel Optimal
Remove-Item -Path $tempRoot -Recurse -Force
```

**Firefox**
Load the generated package or use Firefox developer tools for temporary installation.

**Chrome / Edge**
1. Open the extensions page
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the extension folder

</details>

---

## Quick start
<summary><strong>Basic workflow</strong></summary>

1. Open a CPAP/PPC report page or select a PDF
2. Click the extension icon to open the popup
3. Click **Analyze page**
4. Configure fields and keywords based on the values you want to extact
5. Run **Analyze page** again
6. Review and adjust the generated summary
7. Add custom options / checkboxes if needed
8. Click **Copy summary**
> [!NOTE]
>  For further informations or details go to <a href="https://www.flashcpap.com/docs">Manual Guide </a>
---

## Cross-browser support

FlashCPAP shares the same source code across all supported targets.
The `build.sh` script adapts the manifest depending on the browser target.

| Target   | Background                      | Notes                             |
| -------- | ------------------------------- | --------------------------------- |
| Firefox  | `scripts: [background.js]`      | `browser_specific_settings.gecko` |
| Chromium | `service_worker: background.js` | —                                 |
| Edge     | `service_worker: background.js` | —                                 |

`background.js` uses a browser compatibility shim:

```javascript
const _browser = (typeof globalThis.browser !== 'undefined')
  ? globalThis.browser
  : globalThis.chrome;
```

`src/platform/` contains browser-specific adapters used by the popup.

---

## Permissions used

<details>
<summary><strong>Why these permissions are needed</strong></summary>

* `activeTab`, `tabs`, `windows` — access the active tab and context
* `scripting` — extract text from the page
* `storage` — save local settings
* `clipboardWrite` — copy the generated summary
* `optional_host_permissions` — granted on demand by the user

Permissions are used strictly for extension functionality.

</details>

---

## Project architecture

<details>
<summary><strong>Main files and folders</strong></summary>

```text
background.js          Browser background logic / compatibility layer
popup.html             Main popup interface
src/main.js            Popup entry point
src/extraction.js      Page/PDF text extraction
src/parsing.js         CPAP data parsing
src/summary.js         Summary generation
src/platform/          Browser-specific adapters
lib/                   Vendored PDF.js
build.sh               Multi-target build script
```

</details>

---

## Privacy & data

FlashCPAP follows a **local-first** approach:

* All processing happens locally in the browser
* No data is sent to any server
* Settings are stored locally via `browser.storage.local`
* Import/export is performed in JSON only at the user’s request

This project is intended for privacy-conscious clinical workflows.

---

## Limitations

* Extraction depends on report structure and wording
* Results may vary across providers
* PDF extraction depends on text quality
* Manual verification is always required
* FlashCPAP does **not** provide diagnosis or treatment recommendations

**Clinical review remains mandatory.**

---

## Development

<details>
<summary><strong>Technical stack</strong></summary>

* Manifest V3
* Modular JavaScript (ES modules)
* No bundler
* Vendored PDF.js

</details>

---

## License

Distributed under the **Apache License 2.0**.

---

## Contact

* Website: [https://www.flashcpap.com](https://www.flashcpap.com)
* GitHub: [https://github.com/molipoli-blip/flashcpap](https://github.com/molipoli-blip/flashcpap)

