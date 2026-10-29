import { getLocale, resolveLocale, setLocale, t } from './i18n';
describe('webview localization', () => {
  afterEach(() => setLocale('en'));
  test.each([
    ['en-US', 'en'],
    ['es-MX', 'es'],
    ['fr-CA', 'fr'],
    ['pt-PT', 'pt-BR'],
    ['pt-BR', 'pt-BR'],
    ['de-DE', 'en'],
  ])('%s resolves to %s', (input, expected) => expect(resolveLocale(input)).toBe(expected));
  it('translates and falls back to English', () => {
    setLocale('es');
    expect(getLocale()).toBe('es');
    expect(t('Run')).toBe('Ejecutar');
    expect(t('Nonexistent message')).toBe('Nonexistent message');
  });
  it('switches locale without losing translated text', () => {
    setLocale('fr-CA');
    expect(t('Run')).toBe('Exécuter');
    setLocale('es-MX');
    expect(t('Run')).toBe('Ejecutar');
    setLocale('en');
    expect(t('Run')).toBe('Run');
  });
  it('preserves placeholders', () => {
    setLocale('fr');
    expect(t('Value {0}', 42)).toBe('Value 42');
  });
});

describe('translation catalog integrity', () => {
 const dictionaries = {
   'pt-BR': require('./locales/pt-BR.json') as Record<string,string>,
   es: require('./locales/es.json') as Record<string,string>,
   fr: require('./locales/fr.json') as Record<string,string>,
 };
 const placeholders = (value: string) => Array.from(value.matchAll(/\{\d+\}/g), match => match[0]).sort();
 it.each(Object.entries(dictionaries))('%s has valid translations and placeholders', (_locale, entries) => {
   for (const [source, translation] of Object.entries(entries)) {
     expect(translation.trim()).not.toBe('');
     expect(placeholders(translation)).toEqual(placeholders(source));
   }
 });
 it('uses exact locale subtags', () => {
   expect(resolveLocale('essay')).toBe('en');
   expect(resolveLocale('FR_ca')).toBe('fr');
   expect(resolveLocale('pt-PT')).toBe('pt-BR');
 });
});
