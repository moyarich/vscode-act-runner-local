import english from './locales/en.json';
import portuguese from './locales/pt-BR.json';
import spanish from './locales/es.json';
import french from './locales/fr.json';

export type SupportedLocale = 'en' | 'es' | 'fr' | 'pt-BR';
type Dictionary = Record<string, string>;
const catalogs: Record<SupportedLocale, Dictionary> = {
  en: english,
  es: spanish,
  fr: french,
  'pt-BR': portuguese,
};

/** Match language subtags rather than prefixes (e.g. "essay" is not Spanish). */
export function resolveLocale(language: string | undefined): SupportedLocale {
  const primary = (language ?? 'en').trim().replace(/_/g, '-').split('-')[0].toLowerCase();
  if (primary === 'pt') return 'pt-BR';
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
export function t(message: string, ...args: Array<string | number>): string {
  const value = catalogs[locale]?.[message] ?? catalogs.en[message] ?? message;
  return value.replace(/\{(\d+)\}/g, (_match, index: string) =>
    String(args[Number(index)] ?? '{' + index + '}')
  );
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
  return (forms[rule] ?? forms.other ?? '').replace(/\{0\}/g, formatNumber(value));
}
