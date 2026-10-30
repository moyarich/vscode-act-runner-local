import * as fs from 'fs';
import * as path from 'path';
import {
  formatCount,
  formatDate,
  formatNumber,
  getLocale,
  hasTranslation,
  resolveLocale,
  setLocale,
  t,
} from './i18n';
import english from './locales/en.json';
import portuguese from './locales/pt-BR.json';
import europeanPortuguese from './locales/pt-PT.json';
import spanish from './locales/es.json';
import french from './locales/fr.json';
describe('webview localization', () => {
  afterEach(() => setLocale('en'));
  test.each([
    ['en-US', 'en'],
    ['es-MX', 'es'],
    ['fr-CA', 'fr'],
    ['pt-PT', 'pt-PT'],
    ['pt-BR', 'pt-BR'],
    ['de-DE', 'en'],
  ])('%s resolves to %s', (input, expected) => expect(resolveLocale(input)).toBe(expected));
  it('distinguishes European and Brazilian Portuguese', () => {
    setLocale('pt-PT');
    expect(t('nav.settings')).toBe('Definições');
    setLocale('pt-BR');
    expect(t('nav.settings')).toBe('Configurações');
  });
  it('detects missing keys for each locale without confusing fallback with coverage', () => {
    for (const language of ['en', 'es', 'fr', 'pt-BR', 'pt-PT']) {
      expect(hasTranslation('run', language)).toBe(true);
      expect(hasTranslation('missing.key', language)).toBe(false);
    }
    expect(hasTranslation('run', 'de-DE')).toBe(true);
  });
  it('translates and falls back to English', () => {
    setLocale('es');
    expect(getLocale()).toBe('es');
    expect(t('run')).toBe('Ejecutar');
    expect(t('missing.key')).toBe('missing.key');
  });
  it('switches locale without losing translated text', () => {
    setLocale('fr-CA');
    expect(t('run')).toBe('Exécuter');
    setLocale('es-MX');
    expect(t('run')).toBe('Ejecutar');
    setLocale('en');
    expect(t('run')).toBe('Run');
  });
  it('supports named and positional placeholders without replacing unknown values', () => {
    expect(t('Hello {name}', { name: 'Alex' })).toBe('Hello Alex');
    expect(t('Value {0}', 42)).toBe('Value 42');
    expect(t('Unknown {missing}', { name: 'Alex' })).toBe('Unknown {missing}');
    expect(t('Reordered {last} {first}', { first: 'A', last: 'B' })).toBe('Reordered B A');
  });
  it('formats numbers and plural forms in the selected language', () => {
    setLocale('fr');
    expect(formatNumber(1234.5)).toBe(new Intl.NumberFormat('fr').format(1234.5));
    expect(formatCount(1, { one: '{0} élément', other: '{0} éléments' })).toBe('1 élément');
    expect(formatCount(2, { one: '{0} élément', other: '{0} éléments' })).toBe('2 éléments');
  });
  it.each(['en', 'es', 'fr', 'pt-BR', 'pt-PT'])(
    'formats date, number and plural messages using %s',
    (language) => {
      setLocale(language);
      const date = new Date('2026-04-20T12:30:00Z');
      expect(formatDate(date)).toBe(
        new Intl.DateTimeFormat(language, {
          dateStyle: 'medium',
          timeStyle: 'short',
        }).format(date)
      );
      expect(formatNumber(1234567.89)).toBe(new Intl.NumberFormat(language).format(1234567.89));
      const plural = new Intl.PluralRules(language).select(2);
      const forms = { one: '{0} item', other: '{0} items' };
      expect(formatCount(2, forms)).toBe(
        forms[plural === 'one' ? 'one' : 'other'].replace('{0}', formatNumber(2))
      );
    }
  );
  it('preserves placeholders', () => {
    setLocale('fr');
    expect(t('Value {0}', 42)).toBe('Value 42');
  });
});

describe('translation catalog integrity', () => {
  const source: Record<string, string> = english;
  const dictionaries = {
    'pt-BR': portuguese as Record<string, string>,
    'pt-PT': europeanPortuguese as Record<string, string>,
    es: spanish as Record<string, string>,
    fr: french as Record<string, string>,
  };
  const placeholders = (value: string) =>
    Array.from(value.matchAll(/\{(?:\d+|[a-zA-Z_][a-zA-Z0-9_]*)\}/g), (match) => match[0]).sort();
  it.each(Object.entries(dictionaries))(
    '%s has valid translations and placeholders',
    (_locale, entries) => {
      expect(Object.keys(entries).sort()).toEqual(Object.keys(source).sort());
      for (const [key, translation] of Object.entries(entries)) {
        expect(translation.trim()).not.toBe('');
        expect(placeholders(translation)).toEqual(placeholders(source[key]));
      }
    }
  );
  it('resolves semantic identifiers to readable English', () => {
    setLocale('en');
    expect(t('history.empty')).toBe('No workflow runs recorded yet.');
    expect(t('workflow.run')).toBe('Run workflow');
  });
  it('uses exact locale subtags', () => {
    expect(resolveLocale('essay')).toBe('en');
    expect(resolveLocale('FR_ca')).toBe('fr');
    expect(resolveLocale('pt-PT')).toBe('pt-PT');
  });
});

describe('webview translation references', () => {
  const source = english as Record<string, string>;
  const components = path.join(__dirname, 'components');
  it('keeps history navigation and workflow counts catalog-driven', () => {
    const history = fs.readFileSync(path.join(components, 'HistoryPanel.tsx'), 'utf8');
    const sidebar = fs.readFileSync(path.join(components, 'WorkflowLauncherSidebar.tsx'), 'utf8');

    for (const key of ['history.retentionNote', 'history.pageOf', 'previous', 'next']) {
      expect(history).toContain(`t('${key}'`);
    }
    for (const key of ['workflow.jobOne', 'workflow.jobOther']) {
      expect(sidebar).toContain(`'${key}'`);
    }
    expect(history).not.toMatch(/>\s*Previous\s*</);
    expect(history).not.toMatch(/>\s*Next\s*</);
    expect(sidebar).not.toMatch(/\} job\{/);
  });

  it('sets the HTML document language from the supported resolved locale', () => {
    const app = fs.readFileSync(path.resolve(__dirname, 'App.tsx'), 'utf8');
    expect(app).toContain('document.documentElement.lang = getLocale()');
    expect(app).not.toContain('document.documentElement.lang = language');
    for (const [input, expected] of [
      ['pt-PT', 'pt-PT'],
      ['es-MX', 'es'],
      ['de-DE', 'en'],
    ]) {
      setLocale(input);
      expect(getLocale()).toBe(expected);
    }
  });

  it('requires catalog coverage for keys referenced outside components', () => {
    const webview = path.resolve(__dirname);
    for (const file of fs.readdirSync(webview).filter((name) => name.endsWith('.tsx'))) {
      const content = fs.readFileSync(path.join(webview, file), 'utf8');
      for (const match of content.matchAll(/\bt\(\s*['"]([^'"]+)['"]/g)) {
        expect(Object.prototype.hasOwnProperty.call(source, match[1])).toBe(true);
      }
    }
  });

  it('requires every statically referenced translation key in the source catalog', () => {
    for (const file of fs.readdirSync(components).filter((name) => name.endsWith('.tsx'))) {
      const content = fs.readFileSync(path.join(components, file), 'utf8');
      for (const match of content.matchAll(/\bt\(\s*['"]([^'"]+)['"]/g)) {
        expect(Object.prototype.hasOwnProperty.call(source, match[1])).toBe(true);
      }
    }
  });
});
