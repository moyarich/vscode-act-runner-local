import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { actRunner } from './actRunner';
import { eventBus } from './eventBus';
import { workflowParser } from './workflowParser';
import { workflowValidator } from './workflowValidator';
import { historyService } from './historyService';
import { envManager } from './envManager';
import type { ExecutionOptions, ExecutionRecord, ExecutionStatus } from '../types/execution.types';
import { t } from '../i18n/messages';

const MAX_PERSISTED_LOG_LINES = 1000;
const MAX_PERSISTED_LOG_SUMMARY_CHARS = 80_000;

export class ExecutionEngine {
  private activeExecutionId: string | null = null;
  private startTime = 0;

  async run(options: ExecutionOptions): Promise<string | 'cancelled'> {
    if (this.activeExecutionId) {
      throw new Error(t('An execution is already in progress. Stop it before starting another.'));
    }

    const actPath = vscode.workspace.getConfiguration('actRunner').get<string>('actPath', 'act');
    if (!await actRunner.isActInstalled(actPath)) {
      const choice = await vscode.window.showErrorMessage(
        t('❌ The "act" executable was not found. Tell us where it is installed.'),
        t('Browse for file...'),
        t('Enter path'),
        t('View installation')
      );

      if (choice === t('Browse for file...')) {
        const uris = await vscode.window.showOpenDialog({
          canSelectFolders: false,
          canSelectFiles: true,
          canSelectMany: false,
          openLabel: t('Select the act executable'),
          title: t('Locate the act binary'),
          filters: { [t('Executable')]: ['*'] },
        });
        if (uris && uris.length > 0) {
          const selected = uris[0].fsPath;
          const ok = await actRunner.isActInstalled(selected);
          if (ok) {
            await vscode.workspace.getConfiguration('actRunner')
              .update('actPath', selected, vscode.ConfigurationTarget.Global);
            vscode.window.showInformationMessage(`✅ act configurado: ${selected}`);
            // Retry with new path — fall through (don't return)
          } else {
            vscode.window.showErrorMessage(t('❌ Could not execute: {0}', selected));
            return 'cancelled';
          }
        } else {
          return 'cancelled';
        }
      } else if (choice === t('Enter path')) {
        const typed = await vscode.window.showInputBox({
          prompt: t('Paste or enter the full path to the act binary'),
          placeHolder: '/home/user/.act/act  ou  /usr/local/bin/act',
          ignoreFocusOut: true,
        });
        if (!typed || typed.trim() === '') return 'cancelled';
        const ok = await actRunner.isActInstalled(typed.trim());
        if (ok) {
          await vscode.workspace.getConfiguration('actRunner')
            .update('actPath', typed.trim(), vscode.ConfigurationTarget.Global);
          vscode.window.showInformationMessage(`✅ act configurado: ${typed.trim()}`);
          // Fall through to run with new path
        } else {
          vscode.window.showErrorMessage(t('❌ Could not execute: {0}', typed.trim()));
          return 'cancelled';
        }
      } else if (choice === t('View installation')) {
        vscode.env.openExternal(vscode.Uri.parse('https://github.com/nektos/act#installation'));
        return 'cancelled';
      } else {
        return 'cancelled';
      }
    }
    const workflow = workflowParser.parse(options.workflowPath);
    const validation = workflowValidator.validate(workflow);
    if (!validation.valid) {
      throw new Error(t('Invalid workflow:\n{0}', validation.errors.join('\n')));
    }

    // GitHub resolves remote reusable workflows (owner/repo/.github/workflows/file.yml@ref).
    // Only ./... references are local to the selected repository.
    const workspaceRoot = options.workspaceRoot ?? path.resolve(path.dirname(options.workflowPath), '../..');
    const actCwd = options.actCwd ?? workspaceRoot;
    const missingLocalJobs = Object.entries(workflow.jobs).filter(([, job]) => {
      if (!job.uses?.startsWith('./')) return false;
      const relativePath = job.uses.slice(2);
      return !fs.existsSync(path.join(workspaceRoot, relativePath));
    });

    if (missingLocalJobs.length > 0) {
      const msg = [
        t('⚠️ {0} local reusable workflow(s) not found:', missingLocalJobs.length),
        '',
        missingLocalJobs.map(([id, job]) => `• ${job.name ?? id} → ${job.uses}`).join('\n'),
        '',
        t('Repository directory checked: {0}', workspaceRoot),
        t('Local reusable workflows must exist in the current repository.'),
      ].join('\n');

      const choice = await vscode.window.showWarningMessage(
        msg, { modal: true }, t('Run anyway'), t('Cancel')
      );
      if (choice !== t('Run anyway')) return 'cancelled';
    }

    const executionId = randomUUID();
    this.activeExecutionId = executionId;
    this.startTime = Date.now();
    const startedAt = new Date().toISOString();

    eventBus.dispatch({
      type: 'execution:start',
      payload: {
        executionId,
        workflowPath: options.workflowPath,
        workflowName: workflow.name,
        jobs: Object.values(workflow.jobs),
        triggeredAt: startedAt,
      },
    });

    let finalStatus: ExecutionStatus = 'failed';

    try {
      await actRunner.run(executionId, {
        ...options,
        actCwd,
        workspaceRoot,
        workflowName: workflow.name,
        envFile: options.envFile ?? findConfiguredOrExistingFile(workspaceRoot, envManager.getEnvFilePath(workspaceRoot), ['.env']),
        varFile: options.varFile ?? findConfiguredOrExistingFile(workspaceRoot, envManager.getVarFilePath(workspaceRoot), ['.vars', '.env']),
        secretsFile: options.secretsFile ?? findConfiguredOrExistingFile(workspaceRoot, envManager.getSecretsFilePath(workspaceRoot), ['.secrets']),
      });
      finalStatus = 'success';
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      finalStatus = 'failed';
      // "act encerrou com código N" = job falhou — fluxo esperado, já sinalizado via
      // job:update + execution:end com status 'failed'. Não mostrar como "Erro Crítico".
      // Erros genuínos (falha ao spawnar o processo, ENOENT, etc.) são propagados normalmente.
      const isJobFailure = /^act encerrou com código \d+$/.test(message);
      if (!isJobFailure) {
        eventBus.dispatch({ type: 'execution:error', payload: { executionId, error: message } });
      }
    } finally {
      this.activeExecutionId = null;
      const duration = Date.now() - this.startTime;
      const logSummary = buildPersistedLogSummary(actRunner.getLogs());
      const record: ExecutionRecord = {
        id: executionId,
        workflowPath: options.workflowPath,
        workflowName: workflow.name,
        workflowRef: options.workflowRef,
        jobId: options.jobId,
        trigger: options.trigger ?? 'manual',
        status: finalStatus,
        startedAt,
        completedAt: new Date().toISOString(),
        duration,
        dryRun: options.dryRun ?? false,
        actArgs: [],
        jobs: [],
        logSummary,
      };
      await historyService.save(record);
    }

    return executionId;
  }

  stop(): void {
    if (!this.activeExecutionId) return;
    actRunner.stop();
    eventBus.dispatch({
      type: 'execution:end',
      payload: {
        executionId: this.activeExecutionId,
        status: 'cancelled',
        duration: Date.now() - this.startTime,
        completedAt: new Date().toISOString(),
      },
    });
    this.activeExecutionId = null;
  }

  /** Força reset do estado em caso de trava (processo encerrou sem limpar) */
  forceReset(): void {
    actRunner.stop();
    this.activeExecutionId = null;
    this.startTime = 0;
  }

  isRunning(): boolean {
    return this.activeExecutionId !== null;
  }

  getActiveExecutionId(): string | null {
    return this.activeExecutionId;
  }
}

function findConfiguredOrExistingFile(root: string, configuredFilePath: string, fallbackCandidates: string[]): string | undefined {
  if (fs.existsSync(configuredFilePath)) return configuredFilePath;
  return findExistingFile(root, fallbackCandidates);
}

function findExistingFile(root: string, candidates: string[]): string | undefined {
  for (const candidate of candidates) {
    const filePath = path.join(root, candidate);
    if (fs.existsSync(filePath)) return filePath;
  }
  return undefined;
}

function buildPersistedLogSummary(logs: string[]): string {
  const omittedLines = Math.max(0, logs.length - MAX_PERSISTED_LOG_LINES);
  const selectedLogs = logs.slice(-MAX_PERSISTED_LOG_LINES);
  const prefix = omittedLines > 0
    ? [`[act-runner] ${omittedLines} older log line(s) omitted to keep history lightweight.`]
    : [];
  const summary = [...prefix, ...selectedLogs].join('\n');
  if (summary.length <= MAX_PERSISTED_LOG_SUMMARY_CHARS) return summary;
  return `${summary.slice(-MAX_PERSISTED_LOG_SUMMARY_CHARS)}\n...[log summary truncated to keep history lightweight]`;
}

export const executionEngine = new ExecutionEngine();
