import * as vscode from 'vscode';

export function t(message: string, ...args: Array<string | number>): string {
  const localize = (
    vscode as typeof vscode & {
      l10n?: { t: (message: string, ...args: Array<string | number>) => string };
    }
  ).l10n;
  return localize ? localize.t(message, ...args) : format(message, args);
}

function format(message: string, args: Array<string | number>): string {
  return message.replace(/\{(\d+)\}/g, (_, index: string) =>
    String(args[Number(index)] ?? `{${index}}`)
  );
}
