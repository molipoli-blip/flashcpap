import { spawn, spawnSync } from 'node:child_process';
import {
  access,
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
try {
  await access(webExtPath);
} catch {
  throw new Error(`Binaire web-ext introuvable à l’emplacement indiqué : ${webExtPath}`);
}

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceManifest = JSON.parse(await readFile(path.join(repositoryRoot, 'manifest.json'), 'utf8'));
const unpackedPath = path.join(repositoryRoot, 'dist', 'firefox-unpacked');
const hostHtml = await readFile(new URL('demo_iframe.html', import.meta.url));
const iframeHtml = await readFile(new URL('demo_ppc_3.html', import.meta.url));

let resolveResult;
let rejectResult;
const resultPromise = new Promise((resolve, reject) => {
  resolveResult = resolve;
  rejectResult = reject;
});

const server = createServer((request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1');

  if (url.pathname === '/result') {
    response.writeHead(204, { 'Cache-Control': 'no-store' });
    response.end();
    resolveResult(Object.fromEntries(url.searchParams));
    return;
  }

  if (url.pathname === '/demo_ppc_3.html') {
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    response.end(iframeHtml);
    return;
  }

  response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(hostHtml);
});

await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', resolve);
});

const port = server.address().port;
const hostUrl = `http://127.0.0.1:${port}/demo_iframe.html`;
const resultUrl = `http://127.0.0.1:${port}/result`;
const resultTimeout = setTimeout(() => {
  rejectResult(new Error('Délai dépassé pendant le test iframe Firefox'));
}, 45_000);

function numericField(label, unit, role = '') {
  return {
    type: 'numeric',
    label,
    unit,
    role,
    labels: [{
      text: label,
      range: { start: 1, end: 999 },
      excludeKeywords: [],
      priorityKeywords: [],
      labelExcludeKeywords: [],
      splitSeparators: []
    }]
  };
}

const fields = {
  iah: numericField('IAH Moyen', '/h', 'iah'),
  pressure95: numericField('Pression (95e)', 'hPa'),
  leaks95: numericField('Fuites (95e)', 'L/min', 'fuites')
};
const testSettings = {
  patterns: {
    iframe_demo: {
      urls: [hostUrl],
      fields,
      fieldOrder: Object.keys(fields)
    }
  }
};

const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'flashcpap-iframe-e2e-'));
const extensionPath = path.join(temporaryRoot, 'extension');
await cp(unpackedPath, extensionPath, { recursive: true });

const temporaryManifestPath = path.join(extensionPath, 'manifest.json');
const temporaryManifest = JSON.parse(await readFile(temporaryManifestPath, 'utf8'));
temporaryManifest.host_permissions = Array.from(new Set([
  ...(temporaryManifest.host_permissions || []),
  'http://127.0.0.1/*'
]));
await writeFile(temporaryManifestPath, `${JSON.stringify(temporaryManifest, null, 2)}\n`);

// The harness click is synthetic, so Firefox will reject permissions.request()
// even though the test origin is already granted by the temporary manifest.
// Bypass only that prompt in the disposable extension copy; frame discovery,
// injection, extraction and parsing still run through the production code.
const permissionModulePath = path.join(extensionPath, 'src', 'iframe-permissions.js');
const permissionModuleSource = await readFile(permissionModulePath, 'utf8');
const permissionRequestLine = '  const permissionRequest = api.permissions.request({ origins: access.origins });';
if (!permissionModuleSource.includes(permissionRequestLine)) {
  throw new Error('Impossible de préparer la permission préaccordée du test iframe');
}
await writeFile(
  permissionModulePath,
  permissionModuleSource.replace(
    permissionRequestLine,
    '  const permissionRequest = Promise.resolve(true); // Permission préaccordée par le manifeste E2E temporaire.'
  )
);

const harnessSource = `
const settings = ${JSON.stringify(testSettings)};
const resultUrl = ${JSON.stringify(resultUrl)};
const onboardingRevision = ${JSON.stringify(CURRENT_ONBOARDING_REVISION)};
let currentStage = 'initialisation';

function report(status, details = {}) {
  const params = new URLSearchParams({ status, ...details });
  const beacon = new Image();
  beacon.src = resultUrl + '?' + params.toString();
}

function waitFor(predicate, timeout = 25000) {
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
  const marker = 'flashcpap_iframe_e2e_ready';
  if (sessionStorage.getItem(marker) !== '1') {
    currentStage = 'configuration locale';
    localStorage.setItem('ppc_analyzer_settings', JSON.stringify(settings));
    localStorage.setItem('flashcpap:onboarding-completed', '1');
    localStorage.setItem('flashcpap:onboarding-seen-revision', onboardingRevision);
    sessionStorage.setItem(marker, '1');
    location.reload();
    return;
  }

  currentStage = 'chargement du prestataire';
  await waitFor(() => {
    const providerReady = document.querySelector('#prestataire-select')?.value === 'Iframe_demo';
    const analysisButtonReady = typeof document.querySelector('#btn-analyse')?.onclick === 'function';
    return providerReady && analysisButtonReady;
  });

  currentStage = 'analyse de la page et de son iframe';
  document.querySelector('#btn-analyse').click();
  await waitFor(() => {
    const source = document.querySelector('#source-wrapper')?.textContent || '';
    return source.includes('=== SOUS-FRAME #')
      && source.includes('IAH MOYEN')
      && source.includes('2.1')
      && source.includes('11.5')
      && source.includes('18 L/min');
  });

  const summary = document.querySelector('#résumé')?.value || '';
  const source = document.querySelector('#source-wrapper')?.textContent || '';
  const sourceLower = source.toLowerCase();
  const provider = document.querySelector('#prestataire-select')?.value || '';
  const alert = document.querySelector('#analyse-alert');

  if (!source.includes('=== FRAME PRINCIPALE ===')) throw new Error('Frame principale absente du texte source');
  if (!source.includes('Portail de télésuivi - conteneur principal')) throw new Error('Texte de la page hôte absent');
  if (!source.includes('=== SOUS-FRAME #')) throw new Error('En-tête de sous-frame absent');
  if (!sourceLower.includes('rapport patient')) throw new Error('Texte du rapport iframe absent');
  if (!sourceLower.includes('iah moyen')) throw new Error('Champ IAH de l’iframe absent');
  if (!source.includes('2.1')) throw new Error('Valeur IAH de l’iframe absente');
  if (!source.includes('11.5')) throw new Error('Pression de l’iframe absente');
  if (!source.includes('18 L/min')) throw new Error('Valeur de fuites de l’iframe absente');
  if (getComputedStyle(alert).display !== 'none') throw new Error(alert.textContent?.trim() || 'Alerte visible');

  report('pass', {
    provider,
    summary,
    source,
    iframeDetected: 'true'
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
    alertDisplay: getComputedStyle(document.querySelector('#analyse-alert')).display,
    inlineAlert: document.querySelector('.mini-alert-overlay')?.textContent?.trim() || ''
  })), 300);
});
`;

await writeFile(path.join(extensionPath, 'e2e-iframe-harness.js'), harnessSource);
const popupPath = path.join(extensionPath, 'popup.html');
const popupSource = await readFile(popupPath, 'utf8');
await writeFile(
  popupPath,
  popupSource.replace('</body>', '  <script type="module" src="e2e-iframe-harness.js"></script>\n</body>')
);

const backgroundPath = path.join(extensionPath, 'background.js');
const backgroundSource = await readFile(backgroundPath, 'utf8');
await writeFile(backgroundPath, `${backgroundSource}\nsetTimeout(() => {\n  browser.windows.create({ url: browser.runtime.getURL('popup.html?iframe-e2e=1'), type: 'popup', width: 900, height: 800 });\n}, 1250);\n`);

const firefoxVersion = spawnSync(firefoxPath, ['--version'], { encoding: 'utf8' }).stdout.trim();
const webExtOutput = [];
let webExtProcess;

try {
  webExtProcess = spawn(webExtPath, [
    'run',
    '--source-dir', extensionPath,
    '--firefox', firefoxPath,
    '--no-reload',
    '--no-input',
    '--arg=-headless',
    '--start-url', hostUrl
  ], {
    cwd: repositoryRoot,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  webExtProcess.stdout.on('data', chunk => webExtOutput.push(chunk.toString()));
  webExtProcess.stderr.on('data', chunk => webExtOutput.push(chunk.toString()));

  const result = await Promise.race([
    resultPromise,
    new Promise((_, reject) => {
      webExtProcess.once('error', error => {
        reject(new Error(`Impossible de lancer web-ext (${webExtPath}) : ${error.message}`));
      });
      webExtProcess.once('exit', code => {
        reject(new Error(`web-ext s’est arrêté avant le résultat (code ${code})`));
      });
    })
  ]);
  clearTimeout(resultTimeout);

  if (result.status !== 'pass') {
    throw new Error(`Étape ${result.stage || '?'} : ${result.message || result.error || 'Le test iframe Firefox a échoué'}\nAlerte: ${result.alert || '(aucune)'} (display: ${result.alertDisplay || '?'})\nDialogue: ${result.inlineAlert || '(aucun)'}\nRésumé: ${result.summary || '(vide)'}\nSource: ${result.source || '(vide)'}`);
  }

  console.log(JSON.stringify({
    firefoxVersion,
    extensionVersion: sourceManifest.version,
    hostUrl,
    provider: result.provider,
    iframeDetected: result.iframeDetected,
    summary: result.summary,
    source: result.source
  }, null, 2));
} catch (error) {
  console.error(webExtOutput.join('').slice(-8_000));
  throw error;
} finally {
  clearTimeout(resultTimeout);
  webExtProcess?.kill('SIGINT');
  await new Promise(resolve => setTimeout(resolve, 750));
  if (webExtProcess && webExtProcess.exitCode === null) webExtProcess.kill('SIGKILL');
  await new Promise(resolve => server.close(resolve));
  await rm(temporaryRoot, { recursive: true, force: true });
}
