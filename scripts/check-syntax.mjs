import { spawnSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const targets = ['background.js', 'src'];
const files = [];

function collectJsFiles(path) {
  const stats = statSync(path);
  if (stats.isDirectory()) {
    for (const entry of readdirSync(path)) {
      collectJsFiles(join(path, entry));
    }
    return;
  }

  if (path.endsWith('.js')) {
    files.push(path);
  }
}

for (const target of targets) {
  collectJsFiles(join(root, target));
}

files.sort((left, right) => left.localeCompare(right));

let failed = false;
for (const file of files) {
  const displayPath = relative(root, file);
  const result = spawnSync(process.execPath, ['--check', file], {
    encoding: 'utf8'
  });

  if (result.status !== 0) {
    failed = true;
    console.error(`Syntax check failed: ${displayPath}`);
    if (result.stdout) console.error(result.stdout.trim());
    if (result.stderr) console.error(result.stderr.trim());
  }
}

if (failed) {
  process.exit(1);
}

console.log(`Syntax check passed for ${files.length} JavaScript files.`);
