import { getLocale, resolveLocale, setLocale, t } from './i18n';
describe('webview localization', () => {
 afterEach(() => setLocale('en'));
 test.each([['en-US','en'],['es-MX','es'],['fr-CA','fr'],['pt-PT','pt-BR'],['pt-BR','pt-BR'],['de-DE','en']])('%s resolves to %s',(input,expected)=>expect(resolveLocale(input)).toBe(expected));
 it('translates and falls back to English',()=>{setLocale('es');expect(getLocale()).toBe('es');expect(t('Run')).toBe('Ejecutar');expect(t('Nonexistent message')).toBe('Nonexistent message');});
 it('preserves placeholders',()=>{setLocale('fr');expect(t('Value {0}',42)).toBe('Value 42');});
});
