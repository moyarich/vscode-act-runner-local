# Internationalization and localization

Act/Run supports English (`en`), Spanish (`es`), French (`fr`), and Brazilian Portuguese (`pt-BR`), and European Portuguese (`pt-PT`). Unrecognized locales fall back to English.

## Choosing a language

By default, `actRunner.language` is `auto`, which follows the VS Code display language. To override runtime and React webview labels, configure:

```json
{ "actRunner.language": "fr" }
```

Supported values: `auto`, `en`, `es`, `fr`, `pt-BR`, `pt-PT`. Changing the setting updates an open React webview without reinitializing its execution state.

VS Code command titles, view names, and configuration descriptions are controlled by VS Code's display language and **not** by `actRunner.language`; use **Configure Display Language** to switch those.

## Translating the extension

- `package.nls.json` and `package.nls.<locale>.json` contain manifest contributions.
- `l10n/bundle.l10n.json` and `l10n/bundle.l10n.<locale>.json` contain extension-host messages consumed through `vscode.l10n`.
- `src/webview/locales/{en,es,fr,pt-BR,pt-PT}.json` stores the webview translations, while `src/webview/i18n.ts` implements locale resolution, fallback and `Intl` formatting. Use short semantic IDs such as `t('run')`, `t('history.empty')`, or `t('workflow.run')` for React labels. The canonical `src/webview/locales/en.json` maps IDs to English source messages. Keep identical keys in `es.json`, `fr.json`, and `pt-BR.json`, and `pt-PT.json`.

Preserve interpolation placeholders such as `{0}`; do not translate workflow names, action output, user content or logs. Use locale-aware date and number formatting for presentation.

## Testing

Run `npm run checks`, `npm run build`, and `npm run build:vite`. The localization tests cover language matching, runtime switching, English fallback and placeholders. Human review remains necessary for translated UI strings and any untranslated text.
