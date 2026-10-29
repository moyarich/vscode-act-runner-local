import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
const archives = readdirSync('.').filter((file) => file.endsWith('.vsix'));
assert.equal(archives.length, 1, 'Expected exactly one VSIX in repository root');
const files = new Set(execFileSync('unzip', ['-Z1', archives[0]], { encoding: 'utf8' }).trim().split('\n'));
const required = [
  'package.nls.json',
  ...['es','fr','pt-br','pt-pt'].map((locale) => `package.nls.${locale}.json`),
  'l10n/bundle.l10n.json',
  ...['es','fr','pt-br','pt-pt'].map((locale) => `l10n/bundle.l10n.${locale}.json`),
];
for (const asset of required) {
  assert(files.has(`extension/${asset}`), `VSIX missing locale asset: ${asset}`);
}
assert([...files].some((file) => file.startsWith('extension/dist/') && file.endsWith('.js')), 'VSIX missing compiled JavaScript');
console.log(`Verified ${required.length} localization files and compiled JavaScript in ${archives[0]}`);
