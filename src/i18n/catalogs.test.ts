import * as fs from 'fs';
import * as path from 'path';

const root = path.resolve(__dirname, '../..');
const languages = ['es', 'fr', 'pt-br', 'pt-pt'] as const;
const tokens = (text: string): string[] =>
  Array.from(text.matchAll(/\{(?:\d+|[a-zA-Z_][a-zA-Z0-9_]*)\}/g), (match) => match[0]).sort();
const read = (file: string): Record<string, string> =>
  JSON.parse(fs.readFileSync(path.join(root, file), 'utf8')) as Record<string, string>;

describe.each([
  ['manifest', 'package.nls'],
  ['extension host', 'l10n/bundle.l10n'],
])('%s translation catalogs', (_name, stem) => {
  const english = read(`${stem}.json`);
  test.each(languages)('%s matches English keys and interpolation tokens', (locale) => {
    const localized = read(`${stem}.${locale}.json`);
    expect(Object.keys(localized).sort()).toEqual(Object.keys(english).sort());
    for (const [key, source] of Object.entries(english)) {
      expect(localized[key].trim()).not.toBe('');
      expect(tokens(localized[key])).toEqual(tokens(source));
    }
  });
});
