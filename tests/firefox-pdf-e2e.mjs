import { spawn, spawnSync } from 'node:child_process';
import {
  cp,
  mkdtemp,
  readFile,
  rm,
  writeFile
} from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { CURRENT_ONBOARDING_REVISION } from '../src/first-run-onboarding.js';

const webExtPath = process.env.FLASHCPAP_WEB_EXT_PATH;
const firefoxPath = process.env.FLASHCPAP_FIREFOX_PATH || '/Applications/Firefox.app/Contents/MacOS/firefox';
if (!webExtPath) {
  throw new Error('FLASHCPAP_WEB_EXT_PATH doit pointer vers le binaire web-ext installé');
}

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(await readFile(path.join(repositoryRoot, 'manifest.json'), 'utf8'));
const unpackedPath = path.join(repositoryRoot, 'dist', 'firefox-unpacked');
const onboardingRevision = CURRENT_ONBOARDING_REVISION;

function buildPdf() {
  const encoder = new TextEncoder();
  const stream = [
    'BT',
    '/F1 14 Tf',
    '40 120 Td',
    '(FLASHCPAP PDF TEST) Tj',
    '0 -24 Td',
    '(IAH: 4.2 /h) Tj',
    '0 -24 Td',
    '(Observance: 7 h) Tj',
    'ET'
  ].join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 400 180] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${encoder.encode(stream).length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
  ];

  let source = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((body, index) => {
    offsets.push(encoder.encode(source).length);
    source += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefOffset = encoder.encode(source).length;
  source += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach(offset => {
    source += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  source += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return encoder.encode(source);
}

const testSettings = {
  patterns: {
    auditpdf: {
      urls: [],
      pdfKeywords: ['FLASHCPAP PDF TEST'],
      fields: {
        iah: {
          type: 'numeric',
          label: 'IAH',
          unit: '/h',
          role: 'iah',
          labels: [{
            text: 'IAH',
            range: { start: 1, end: 20 },
            excludeKeywords: [],
            priorityKeywords: [],
            labelExcludeKeywords: [],
            splitSeparators: []
          }]
        },
        observance: {
          type: 'numeric',
          label: 'Observance',
          unit: 'h',
          labels: [{
            text: 'Observance',
            range: { start: 1, end: 20 },
            excludeKeywords: [],
            priorityKeywords: [],
            labelExcludeKeywords: [],
            splitSeparators: []
          }]
        }
      },
      fieldOrder: ['iah', 'observance']
    }
  }
};

function waitForResult(server) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Délai dépassé pendant le test PDF Firefox')), 40_000);
    server.on('request', (request, response) => {
      const url = new URL(request.url, 'http://127.0.0.1');
      response.writeHead(204, { 'Cache-Control': 'no-store' });
      response.end();
      if (url.pathname !== '/result') return;
      clearTimeout(timeout);
      resolve(Object.fromEntries(url.searchParams));
    });
  });
}

const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'flashcpap-webext-e2e-'));
const extensionPath = path.join(temporaryRoot, 'extension');
await cp(unpackedPath, extensionPath, { recursive: true });

const server = createServer();
await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', resolve);
});
const port = server.address().port;

const pdfBase64 = Buffer.from(buildPdf()).toString('base64');
const harnessSource = `
const settings = ${JSON.stringify(testSettings)};
const pdfBase64 = ${JSON.stringify(pdfBase64)};
const resultUrl = ${JSON.stringify(`http://127.0.0.1:${port}/result`)};
const onboardingRevision = ${JSON.stringify(onboardingRevision)};
let currentStage = 'initialisation';

function report(status, details = {}) {
  const params = new URLSearchParams({ status, ...details });
  const beacon = new Image();
  beacon.src = resultUrl + '?' + params.toString();
}

function waitFor(predicate, timeout = 20000) {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      try {
        if (predicate()) return resolve();
      } catch {}
      if (Date.now() - startedAt > timeout) return reject(new Error('Délai de vérification dépassé'));
      setTimeout(check, 100);
    };
    check();
  });
}

async function run() {
  const marker = 'flashcpap_pdf_e2e_ready';
  if (sessionStorage.getItem(marker) !== '1') {
    currentStage = 'configuration locale';
    localStorage.setItem('ppc_analyzer_settings', JSON.stringify(settings));
    // Simulate an existing installation which had completed the legacy guide.
    localStorage.setItem('flashcpap:onboarding-completed', '1');
    localStorage.removeItem('flashcpap:onboarding-seen-revision');
    sessionStorage.setItem(marker, '1');
    location.reload();
    return;
  }

  const onboardingVerifiedMarker = 'flashcpap_onboarding_e2e_verified';
  if (sessionStorage.getItem(onboardingVerifiedMarker) !== '1') {
    currentStage = 'guide sur installation existante';
    await waitFor(() => document.querySelector('#first-run-onboarding'));
    document.querySelector('#first-run-onboarding .onboarding-close').click();
    await waitFor(() => !document.querySelector('#first-run-onboarding'));
    if (localStorage.getItem('flashcpap:onboarding-seen-revision') !== onboardingRevision) {
      throw new Error('La révision du guide n’a pas été mémorisée');
    }
    sessionStorage.setItem(onboardingVerifiedMarker, '1');
    location.reload();
    return;
  }

  currentStage = 'non-répétition du guide';
  await new Promise(resolve => setTimeout(resolve, 750));
  if (document.querySelector('#first-run-onboarding')) throw new Error('Le guide réapparaît après fermeture');

  currentStage = 'chargement du prestataire';
  await waitFor(() => document.querySelector('#prestataire-select')?.options.length === 1);
  const bytes = Uint8Array.from(atob(pdfBase64), character => character.charCodeAt(0));
  const file = new File([bytes], 'rapport-test.pdf', { type: 'application/pdf' });
  const transfer = new DataTransfer();
  transfer.items.add(file);
  const input = document.querySelector('#pdf-file-input');
  input.files = transfer.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));

  currentStage = 'activation du mode PDF';
  await waitFor(() => document.querySelector('#pdf-mode-status')?.textContent?.toLowerCase().includes('pdf'));
  currentStage = 'analyse du PDF';
  document.querySelector('#btn-analyse').click();
  await waitFor(() => {
    const summary = document.querySelector('#résumé')?.value || '';
    return summary.includes('4.2') && summary.includes('7');
  });

  const summary = document.querySelector('#résumé')?.value || '';
  const source = document.querySelector('#source-wrapper')?.textContent || '';
  const provider = document.querySelector('#prestataire-select')?.value || '';
  const alert = document.querySelector('#analyse-alert');
  if (!source.includes('FLASHCPAP PDF TEST')) throw new Error('Texte source PDF absent');
  if (getComputedStyle(alert).display !== 'none') throw new Error(alert.textContent?.trim() || 'Alerte visible');
  currentStage = 'retour au mode page web';
  document.querySelector('#pdf-clear-btn').click();
  await waitFor(() => {
    const status = document.querySelector('#pdf-mode-status')?.textContent?.toLowerCase() || '';
    return !document.querySelector('#pdf-file-input')?.files?.length && status.includes('web');
  });
  currentStage = 'vérifications finales';
  report('pass', {
    provider,
    summary,
    source,
    clearMode: document.querySelector('#pdf-mode-status')?.textContent?.trim() || '',
    onboardingRevision: localStorage.getItem('flashcpap:onboarding-seen-revision') || ''
  });
}

window.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => run().catch(error => report('fail', {
    stage: currentStage,
    message: error.message || String(error),
    error: error.stack || '',
    provider: document.querySelector('#prestataire-select')?.value || '',
    summary: document.querySelector('#résumé')?.value || '',
    source: document.querySelector('#source-wrapper')?.textContent || '',
    alert: document.querySelector('#analyse-alert')?.textContent?.trim() || '',
    alertDisplay: getComputedStyle(document.querySelector('#analyse-alert')).display
  })), 250);
});
`;

await writeFile(path.join(extensionPath, 'e2e-pdf-harness.js'), harnessSource);
const popupPath = path.join(extensionPath, 'popup.html');
const popupSource = await readFile(popupPath, 'utf8');
await writeFile(
  popupPath,
  popupSource.replace('</body>', '  <script type="module" src="e2e-pdf-harness.js"></script>\n</body>')
);
const backgroundPath = path.join(extensionPath, 'background.js');
const backgroundSource = await readFile(backgroundPath, 'utf8');
await writeFile(backgroundPath, `${backgroundSource}\nsetTimeout(() => {\n  browser.windows.create({ url: browser.runtime.getURL('popup.html?e2e=1'), type: 'popup', width: 900, height: 800 });\n}, 750);\n`);

const firefoxVersion = spawnSync(firefoxPath, ['--version'], { encoding: 'utf8' }).stdout.trim();
const webExtOutput = [];
let webExtProcess;

try {
  const resultPromise = waitForResult(server);
  webExtProcess = spawn(webExtPath, [
    'run',
    '--source-dir', extensionPath,
    '--firefox', firefoxPath,
    '--no-reload',
    '--no-input',
    '--arg=-headless',
    '--start-url', 'about:blank'
  ], {
    cwd: repositoryRoot,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  webExtProcess.stdout.on('data', chunk => webExtOutput.push(chunk.toString()));
  webExtProcess.stderr.on('data', chunk => webExtOutput.push(chunk.toString()));

  const result = await Promise.race([
    resultPromise,
    new Promise((_, reject) => webExtProcess.once('exit', code => {
      reject(new Error(`web-ext s’est arrêté avant le résultat (code ${code})`));
    }))
  ]);
  if (result.status !== 'pass') {
    throw new Error(`Étape ${result.stage || '?'} : ${result.message || result.error || 'Le test PDF Firefox a échoué'}\nAlerte: ${result.alert || '(aucune)'}\nRésumé: ${result.summary || '(vide)'}\nSource: ${result.source || '(vide)'}`);
  }

  console.log(JSON.stringify({
    firefoxVersion,
    extensionVersion: manifest.version,
    pdfFile: 'rapport-test.pdf',
    provider: result.provider,
    summary: result.summary,
    source: result.source,
    clearMode: result.clearMode,
    onboardingRevision: result.onboardingRevision
  }, null, 2));
} catch (error) {
  console.error(webExtOutput.join('').slice(-8_000));
  throw error;
} finally {
  webExtProcess?.kill('SIGINT');
  await new Promise(resolve => setTimeout(resolve, 750));
  if (webExtProcess && webExtProcess.exitCode === null) webExtProcess.kill('SIGKILL');
  await new Promise(resolve => server.close(resolve));
  await rm(temporaryRoot, { recursive: true, force: true });
}
