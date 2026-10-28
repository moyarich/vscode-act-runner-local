import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { t } from '../i18n/messages';

export interface EnvEntry {
  key: string;
  value: string;
  isSecret: boolean;
}

type FileConfigKey = 'envFile' | 'varFile' | 'secretsFile';
export type EnvFileConfigKey = FileConfigKey;

export class EnvManager {
  private context?: vscode.ExtensionContext;
  private fileOverrides = new Map<string, Partial<Record<FileConfigKey, string>>>();

  initialize(context: vscode.ExtensionContext): void {
    this.context = context;
  }

  read(filePath: string): Map<string, string> {
    const map = new Map<string, string>();
    if (!fs.existsSync(filePath)) return map;

    parseEnvFileContent(fs.readFileSync(filePath, 'utf-8')).forEach(({ key, value }) => {
      map.set(key, value);
    });

    return map;
  }

  write(filePath: string, vars: Map<string, string>): void {
    const lines = Array.from(vars.entries())
      .map(([key, value]) => `${key}=${formatEnvValue(value)}`)
      .join('\n');
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, lines + '\n', 'utf-8');
  }

  getEnvFilePath(workspaceRoot: string): string {
    return this.getConfiguredFilePath(workspaceRoot, 'envFile', '.env');
  }

  getSelectedEnvFilePath(workspaceRoot: string): string | undefined {
    return this.getSelectedFilePath(workspaceRoot, 'envFile');
  }

  getVarFilePath(workspaceRoot: string): string {
    return this.getConfiguredFilePath(workspaceRoot, 'varFile', '.vars');
  }

  getSelectedVarFilePath(workspaceRoot: string): string | undefined {
    return this.getSelectedFilePath(workspaceRoot, 'varFile');
  }

  getSecretsFilePath(workspaceRoot: string): string {
    return this.getConfiguredFilePath(workspaceRoot, 'secretsFile', '.secrets');
  }

  getSelectedSecretsFilePath(workspaceRoot: string): string | undefined {
    return this.getSelectedFilePath(workspaceRoot, 'secretsFile');
  }

  getActrcFilePath(workspaceRoot: string): string {
    return path.join(workspaceRoot, '.actrc');
  }

  toWorkspaceRelative(workspaceRoot: string, filePath: string): string {
    const resolved = this.resolveWorkspacePath(workspaceRoot, filePath);
    const relative = path.relative(workspaceRoot, resolved);
    return relative && !relative.startsWith('..') && !path.isAbsolute(relative)
      ? relative
      : resolved;
  }

  async rememberFilePath(
    workspaceRoot: string,
    key: FileConfigKey,
    filePath: string
  ): Promise<void> {
    const relativeOrAbsolute = this.toWorkspaceRelative(workspaceRoot, filePath);
    const current = this.fileOverrides.get(workspaceRoot) ?? {};
    current[key] = relativeOrAbsolute;
    this.fileOverrides.set(workspaceRoot, current);

    await this.context?.workspaceState.update(
      this.workspaceStateKey(workspaceRoot, key),
      relativeOrAbsolute
    );

    try {
      await vscode.workspace
        .getConfiguration('actRunner')
        .update(key, relativeOrAbsolute, vscode.ConfigurationTarget.Workspace);
    } catch {
      // Sessions started before the setting is registered can reject this update.
      // The in-memory override and workspaceState keep the selection functional.
    }
  }

  resolveFilePath(workspaceRoot: string, filePath: string): string {
    return this.resolveWorkspacePath(workspaceRoot, filePath);
  }

  getDefaultFilePath(workspaceRoot: string, key: FileConfigKey): string {
    const defaults: Record<FileConfigKey, string> = {
      envFile: '.env',
      varFile: '.vars',
      secretsFile: '.secrets',
    };
    return this.resolveWorkspacePath(workspaceRoot, defaults[key]);
  }

  private getSelectedFilePath(workspaceRoot: string, key: FileConfigKey): string | undefined {
    const override = this.fileOverrides.get(workspaceRoot)?.[key];
    const stored = this.context?.workspaceState.get<string>(
      this.workspaceStateKey(workspaceRoot, key)
    );
    return (override ?? stored)
      ? this.resolveWorkspacePath(workspaceRoot, override ?? stored!)
      : undefined;
  }

  private getConfiguredFilePath(
    workspaceRoot: string,
    key: FileConfigKey,
    defaultFile: string
  ): string {
    const override = this.fileOverrides.get(workspaceRoot)?.[key];
    const stored = this.context?.workspaceState.get<string>(
      this.workspaceStateKey(workspaceRoot, key)
    );
    const config = vscode.workspace.getConfiguration('actRunner');
    const configured = config.get<string>(key) ?? defaultFile;
    return this.resolveWorkspacePath(workspaceRoot, override ?? stored ?? configured);
  }

  private workspaceStateKey(workspaceRoot: string, key: FileConfigKey): string {
    return `actRunner.${key}.${workspaceRoot}`;
  }

  private resolveWorkspacePath(workspaceRoot: string, filePath: string): string {
    return path.isAbsolute(filePath) ? filePath : path.join(workspaceRoot, filePath);
  }

  async ensureSecretsIgnored(workspaceRoot: string): Promise<void> {
    const gitignorePath = path.join(workspaceRoot, '.gitignore');
    const entries = ['.secrets', '.env.local', '.env.production'];

    let content = fs.existsSync(gitignorePath) ? fs.readFileSync(gitignorePath, 'utf-8') : '';

    const missing = entries.filter((entry) => !content.includes(entry));
    if (missing.length === 0) return;

    const choice = await vscode.window.showWarningMessage(
      t('⚠️ "{0}" is not in .gitignore. Secrets may be committed!', missing.join(', ')),
      t('Add to .gitignore'),
      t('Ignore')
    );

    if (choice === t('Add to .gitignore')) {
      content += `\n# Act Runner — secrets locais\n${missing.join('\n')}\n`;
      fs.writeFileSync(gitignorePath, content, 'utf-8');
      vscode.window.showInformationMessage(t('✅ .gitignore updated successfully.'));
    }
  }
}

function parseEnvFileContent(content: string): { key: string; value: string }[] {
  const entries: { key: string; value: string }[] = [];
  const lines = content.split(/\r?\n/);

  for (let index = 0; index < lines.length; index++) {
    const rawLine = lines[index];
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eqIdx = rawLine.indexOf('=');
    if (eqIdx < 0) continue;

    const key = rawLine.slice(0, eqIdx).trim();
    if (!key) continue;

    const rawValue = rawLine.slice(eqIdx + 1).trim();
    if (startsQuotedValue(rawValue)) {
      const quote = rawValue[0];
      const firstChunk = rawValue.slice(1);
      const valueLines: string[] = [];
      let current = firstChunk;

      while (true) {
        const closingIndex = findClosingQuote(current, quote);
        if (closingIndex >= 0) {
          valueLines.push(current.slice(0, closingIndex));
          break;
        }

        valueLines.push(current);
        index += 1;
        if (index >= lines.length) break;
        current = lines[index];
      }

      entries.push({ key, value: normalizeQuotedValue(valueLines, quote) });
      continue;
    }

    entries.push({ key, value: rawValue });
  }

  return entries;
}

function startsQuotedValue(value: string): boolean {
  return value.startsWith('"') || value.startsWith("'");
}

function findClosingQuote(value: string, quote: string): number {
  for (let index = 0; index < value.length; index++) {
    if (value[index] === quote && value[index - 1] !== '\\') return index;
  }
  return -1;
}

function normalizeQuotedValue(valueLines: string[], quote: string): string {
  const normalized = [...valueLines];
  if (normalized[0] === '') normalized.shift();
  if (normalized[normalized.length - 1] === '') normalized.pop();
  return normalized
    .join('\n')
    .replace(new RegExp(`\\\\${escapeRegExp(quote)}`, 'g'), quote)
    .replace(/\\\\/g, '\\');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function formatEnvValue(value: string): string {
  if (!value.includes('\n')) return value;
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

export const envManager = new EnvManager();
