import * as fs from 'fs';
import * as path from 'path';
import { getLocale, resolveLocale, setLocale, t } from './i18n';
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
    Array.from(value.matchAll(/\{\d+\}/g), (match) => match[0]).sort();
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
  it('requires every statically referenced translation key in the source catalog', () => {
    for (const file of fs.readdirSync(components).filter(name => name.endsWith('.tsx'))) {
      const content = fs.readFileSync(path.join(components, file), 'utf8');
      for (const match of content.matchAll(/\\bt\\(\\s*['"]([^'"]+)['"]/g)) {
        expect(source).toHaveProperty(match[1]);
      }
    }
  });
});
