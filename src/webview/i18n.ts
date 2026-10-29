import english from './locales/en.json';
import portuguese from './locales/pt-BR.json';
import europeanPortuguese from './locales/pt-PT.json';
import spanish from './locales/es.json';
import french from './locales/fr.json';

export type SupportedLocale = 'en' | 'es' | 'fr' | 'pt-BR' | 'pt-PT';
type Dictionary = Record<string, string>;
const catalogs: Record<SupportedLocale, Dictionary> = {
  en: english,
  es: spanish,
  fr: french,
  'pt-BR': portuguese,
  'pt-PT': europeanPortuguese,
};

/** Match language subtags rather than prefixes (e.g. "essay" is not Spanish). */
export function resolveLocale(language: string | undefined): SupportedLocale {
  const normalized = (language ?? 'en').trim().replace(/_/g, '-').toLowerCase();
  const [primary, region] = normalized.split('-');
  if (primary === 'pt') return region === 'pt' ? 'pt-PT' : 'pt-BR';
  if (primary === 'es' || primary === 'fr') return primary;
  return 'en';
}

let locale: SupportedLocale = 'en';
export function setLocale(language: string): void {
  locale = resolveLocale(language);
}
export function getLocale(): SupportedLocale {
  return locale;
}
export function hasTranslation(message: string, language: string = locale): boolean {
  const resolved = resolveLocale(language);
  return Object.prototype.hasOwnProperty.call(catalogs[resolved], message);
}

export function t(
  message: string,
  ...args: Array<string | number | Record<string, string | number>>
): string {
  const value = catalogs[locale]?.[message] ?? catalogs.en[message] ?? message;
  const named = args.length === 1 && typeof args[0] === 'object' ? args[0] : undefined;
  return value.replace(/\{([a-zA-Z_][a-zA-Z0-9_]*|\d+)\}/g, (placeholder, key: string) => {
    const replacement = named ? named[key] : /^\d+$/.test(key) ? args[Number(key)] : undefined;
    return replacement === undefined ? placeholder : String(replacement);
  });
}
/** Formatting belongs to the active locale, never a hardcoded language. */
export function formatDate(value: string | number | Date): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value)
  );
}
export function formatNumber(value: number): string {
  return new Intl.NumberFormat(locale).format(value);
}
export function formatCount(
  value: number,
  forms: Partial<Record<Intl.LDMLPluralRule, string>>
): string {
  const rule = new Intl.PluralRules(locale).select(value);
  const template = forms[rule] ?? forms.other ?? '';
  return template.replace(/\{0\}/g, formatNumber(value));
}
