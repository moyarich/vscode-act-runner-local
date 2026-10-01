import { ExecutionEngine } from '../core/executionEngine';
import { eventBus } from '../core/eventBus';
import { actRunner } from '../core/actRunner';
import { workflowParser } from '../core/workflowParser';
import { workflowValidator } from '../core/workflowValidator';
import { historyService } from '../core/historyService';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';

jest.mock('../core/actRunner');
jest.mock('../core/workflowParser');
jest.mock('../core/workflowValidator');
jest.mock('../core/historyService');
jest.mock('../core/eventBus', () => ({
  eventBus: { dispatch: jest.fn(), sendSnapshot: jest.fn(), on: jest.fn(), off: jest.fn() },
}));

describe('ExecutionEngine', () => {
  let engine: ExecutionEngine;
  let tempRoot: string;

  beforeEach(() => {
    engine = new ExecutionEngine();
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'act-runner-test-'));
    jest.clearAllMocks();
    (vscode.window.showErrorMessage as jest.Mock).mockReset().mockResolvedValue(undefined);
    (vscode.window.showWarningMessage as jest.Mock).mockReset().mockResolvedValue(undefined);
    (vscode.window.showOpenDialog as jest.Mock).mockReset().mockResolvedValue(undefined);
    (vscode.window.showInputBox as jest.Mock).mockReset().mockResolvedValue(undefined);
    (vscode.window.showInformationMessage as jest.Mock).mockReset();
    (vscode.env.openExternal as jest.Mock).mockReset();

    (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
      get: jest.fn((_key: string, defaultValue: unknown) => defaultValue),
      update: jest.fn().mockResolvedValue(undefined),
    });

    (workflowParser.parse as jest.Mock).mockReturnValue({
      name: 'CI',
      on: { push: {} },
      jobs: { build: { runsOn: 'ubuntu-latest', steps: [] } },
    });

    (workflowValidator.validate as jest.Mock).mockReturnValue({ valid: true, errors: [] });

    (actRunner.isActInstalled as jest.Mock).mockResolvedValue(true);
    (actRunner.run as jest.Mock).mockResolvedValue(undefined);
    (actRunner.getLogs as jest.Mock).mockReturnValue([]);

    (historyService.save as jest.Mock).mockResolvedValue(undefined);
    (historyService.getAll as jest.Mock).mockReturnValue([]);
    (historyService.getAllForWebview as jest.Mock).mockReturnValue([]);
  });

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it('run() deve emitir execution:start', async () => {
    await engine.run({ workflowPath: '.github/workflows/ci.yml', workspaceRoot: tempRoot });
    expect(eventBus.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'execution:start' })
    );
  });

  it('run() deve rejeitar se validação falhar', async () => {
    (workflowValidator.validate as jest.Mock).mockReturnValue({
      valid: false,
      errors: ['runs-on ausente'],
    });

    await expect(
      engine.run({ workflowPath: '.github/workflows/ci.yml', workspaceRoot: tempRoot })
    ).rejects.toThrow(/runs-on/i);
  });

  it('isRunning() deve ser false após execução completar', async () => {
    await engine.run({ workflowPath: '.github/workflows/ci.yml', workspaceRoot: tempRoot });
    expect(engine.isRunning()).toBe(false);
  });

  it('persiste logSummary limitado para permitir Ver log no histórico', async () => {
    (actRunner.getLogs as jest.Mock).mockReturnValue(['linha 1', 'linha 2']);

    await engine.run({ workflowPath: '.github/workflows/ci.yml', workspaceRoot: tempRoot });

    expect(historyService.save).toHaveBeenCalledWith(
      expect.objectContaining({ logSummary: 'linha 1\nlinha 2' })
    );
  });

  it('trunca logSummary grande antes de salvar no histórico', async () => {
    (actRunner.getLogs as jest.Mock).mockReturnValue(Array.from({ length: 1200 }, (_, index) => `linha ${index}`));

    await engine.run({ workflowPath: '.github/workflows/ci.yml', workspaceRoot: tempRoot });

    const savedRecord = (historyService.save as jest.Mock).mock.calls[0][0];
    expect(savedRecord.logSummary).toContain('older log line(s) omitted');
    expect(savedRecord.logSummary).toContain('linha 1199');
    expect(savedRecord.logSummary.length).toBeLessThanOrEqual(80_100);
  });

  it('usa .env como envFile e fallback de varFile quando .vars não existe', async () => {
    const envPath = path.join(tempRoot, '.env');
    fs.writeFileSync(envPath, 'RUNNER=ubuntu-latest\nDEFAULT_RUNNER=ubuntu-latest\n');

    await engine.run({ workflowPath: '.github/workflows/ci.yml', workspaceRoot: tempRoot });

    expect(actRunner.run).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        envFile: envPath,
        varFile: envPath,
      })
    );
  });

  it('prefere .vars como varFile quando .env e .vars existem', async () => {
    const envPath = path.join(tempRoot, '.env');
    const varsPath = path.join(tempRoot, '.vars');
    fs.writeFileSync(envPath, 'RUNNER=ubuntu-latest\n');
    fs.writeFileSync(varsPath, 'RUNNER=ubuntu-latest\n');

    await engine.run({ workflowPath: '.github/workflows/ci.yml', workspaceRoot: tempRoot });

    expect(actRunner.run).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        envFile: envPath,
        varFile: varsPath,
      })
    );
  });

  it('usa arquivo customizado configurado como varFile', async () => {
    (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
      get: jest.fn((key: string, defaultValue: unknown) => key === 'varFile' ? 'my.variables' : defaultValue),
      update: jest.fn().mockResolvedValue(undefined),
    });
    const customVarsPath = path.join(tempRoot, 'my.variables');
    fs.writeFileSync(customVarsPath, 'RUNNER=ubuntu-latest\n');

    await engine.run({ workflowPath: '.github/workflows/ci.yml', workspaceRoot: tempRoot });

    expect(actRunner.run).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        varFile: customVarsPath,
      })
    );
  });

  it('usa .vars do projeto selecionado mesmo quando actCwd é o diretório pai', async () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'act-runner-root-'));
    const apiRoot = path.join(repoRoot, 'Sandbox', 'api');
    fs.mkdirSync(apiRoot, { recursive: true });
    const varsPath = path.join(apiRoot, '.vars');
    fs.writeFileSync(varsPath, 'RUNNER=ubuntu-latest\n');

    try {
      await engine.run({ workflowPath: '.github/workflows/ci.yml', workspaceRoot: apiRoot, actCwd: repoRoot });

      expect(actRunner.run).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          actCwd: repoRoot,
          workspaceRoot: apiRoot,
          varFile: varsPath,
        })
      );
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it('usa arquivo customizado de vars do projeto selecionado quando actCwd é o diretório pai', async () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'act-runner-root-'));
    const apiRoot = path.join(repoRoot, 'Sandbox', 'api');
    fs.mkdirSync(apiRoot, { recursive: true });
    (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
      get: jest.fn((key: string, defaultValue: unknown) => key === 'varFile' ? 'config/local.variables' : defaultValue),
      update: jest.fn().mockResolvedValue(undefined),
    });
    const customVarsPath = path.join(apiRoot, 'config', 'local.variables');
    fs.mkdirSync(path.dirname(customVarsPath), { recursive: true });
    fs.writeFileSync(customVarsPath, 'RUNNER=ubuntu-latest\n');

    try {
      await engine.run({ workflowPath: '.github/workflows/ci.yml', workspaceRoot: apiRoot, actCwd: repoRoot });

      expect(actRunner.run).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          actCwd: repoRoot,
          workspaceRoot: apiRoot,
          varFile: customVarsPath,
        })
      );
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it('usa .secrets do projeto selecionado mesmo quando actCwd é o diretório pai', async () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'act-runner-root-'));
    const apiRoot = path.join(repoRoot, 'Sandbox', 'api');
    fs.mkdirSync(apiRoot, { recursive: true });
    const secretsPath = path.join(apiRoot, '.secrets');
    fs.writeFileSync(secretsPath, 'TOKEN=local-secret\n');

    try {
      await engine.run({ workflowPath: '.github/workflows/ci.yml', workspaceRoot: apiRoot, actCwd: repoRoot });

      expect(actRunner.run).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          actCwd: repoRoot,
          workspaceRoot: apiRoot,
          secretsFile: secretsPath,
        })
      );
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it('usa arquivo customizado configurado como secretsFile', async () => {
    (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
      get: jest.fn((key: string, defaultValue: unknown) => key === 'secretsFile' ? 'config/local.secrets' : defaultValue),
      update: jest.fn().mockResolvedValue(undefined),
    });
    const customSecretsPath = path.join(tempRoot, 'config', 'local.secrets');
    fs.mkdirSync(path.dirname(customSecretsPath), { recursive: true });
    fs.writeFileSync(customSecretsPath, 'TOKEN=local-secret\n');

    await engine.run({ workflowPath: '.github/workflows/ci.yml', workspaceRoot: tempRoot });

    expect(actRunner.run).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        secretsFile: customSecretsPath,
      })
    );
  });


  it('prevents a second execution while one is already running', async () => {
    let resolveRun!: () => void;
    (actRunner.run as jest.Mock).mockImplementation(() => new Promise<void>((resolve) => {
      resolveRun = resolve;
    }));

    const first = engine.run({ workflowPath: '.github/workflows/ci.yml', workspaceRoot: tempRoot });

    await Promise.resolve();

    await expect(
      engine.run({ workflowPath: '.github/workflows/ci.yml', workspaceRoot: tempRoot })
    ).rejects.toThrow(/already in progress/i);

    resolveRun();
    await first;
  });

  it('returns cancelled when act is missing and the prompt is dismissed', async () => {
    (actRunner.isActInstalled as jest.Mock).mockResolvedValue(false);
    (vscode.window.showErrorMessage as jest.Mock).mockResolvedValue(undefined);

    await expect(
      engine.run({ workflowPath: '.github/workflows/ci.yml', workspaceRoot: tempRoot })
    ).resolves.toBe('cancelled');

    expect(actRunner.run).not.toHaveBeenCalled();
  });

  it('opens installation help when act is missing and the user chooses installation', async () => {
    (actRunner.isActInstalled as jest.Mock).mockResolvedValue(false);
    (vscode.window.showErrorMessage as jest.Mock).mockResolvedValue('View installation');

    const result = await engine.run({
      workflowPath: '.github/workflows/ci.yml',
      workspaceRoot: tempRoot,
    });

    expect(result).toBe('cancelled');
    expect(vscode.env.openExternal).toHaveBeenCalled();
  });

  it('cancels when a manually entered act path is invalid', async () => {
    (actRunner.isActInstalled as jest.Mock)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false);
    (vscode.window.showErrorMessage as jest.Mock).mockResolvedValue('Enter path');
    (vscode.window.showInputBox as jest.Mock).mockResolvedValue('/bad/act');

    await expect(
      engine.run({ workflowPath: '.github/workflows/ci.yml', workspaceRoot: tempRoot })
    ).resolves.toBe('cancelled');

    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
      expect.stringContaining('/bad/act')
    );
  });

  it('persists a failed execution and dispatches execution:error for unexpected runner failures', async () => {
    (actRunner.run as jest.Mock).mockRejectedValue(new Error('spawn ENOENT'));

    const id = await engine.run({
      workflowPath: '.github/workflows/ci.yml',
      workspaceRoot: tempRoot,
    });

    expect(id).toEqual(expect.any(String));
    expect(eventBus.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'execution:error',
        payload: expect.objectContaining({ error: 'spawn ENOENT' }),
      })
    );
    expect(historyService.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed' })
    );
    expect(engine.isRunning()).toBe(false);
  });

  it('does not dispatch execution:error for expected act job failures', async () => {
    (actRunner.run as jest.Mock).mockRejectedValue(new Error('act encerrou com código 1'));

    await engine.run({
      workflowPath: '.github/workflows/ci.yml',
      workspaceRoot: tempRoot,
    });

    expect(eventBus.dispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'execution:error' })
    );
    expect(historyService.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed' })
    );
  });

  it('stops an active execution and emits a cancelled execution:end event', async () => {
    let resolveRun!: () => void;
    (actRunner.run as jest.Mock).mockImplementation(() => new Promise<void>((resolve) => {
      resolveRun = resolve;
    }));

    const running = engine.run({
      workflowPath: '.github/workflows/ci.yml',
      workspaceRoot: tempRoot,
    });

    await Promise.resolve();
    expect(engine.isRunning()).toBe(true);

    engine.stop();

    expect(actRunner.stop).toHaveBeenCalled();
    expect(eventBus.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'execution:end',
        payload: expect.objectContaining({ status: 'cancelled' }),
      })
    );
    expect(engine.isRunning()).toBe(false);

    resolveRun();
    await running;
  });

  it('forceReset stops the runner and clears execution state', () => {
    Object.defineProperties(engine, {
      activeExecutionId: { value: 'exec-running', writable: true },
      startTime: { value: 123, writable: true },
    });

    engine.forceReset();

    expect(actRunner.stop).toHaveBeenCalled();
    expect(engine.getActiveExecutionId()).toBeNull();
    expect(engine.isRunning()).toBe(false);
  });

  it('detects a parent directory that contains reusable workflows', async () => {
    const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'act-parent-'));
    const child = path.join(parent, 'app');
    const reusable = path.join(parent, '.github', 'workflows', 'shared.yml');
    fs.mkdirSync(path.dirname(reusable), { recursive: true });
    fs.mkdirSync(child, { recursive: true });
    fs.writeFileSync(reusable, 'name: shared\n', 'utf-8');

    (workflowParser.parse as jest.Mock).mockReturnValue({
      name: 'CI',
      on: { push: {} },
      jobs: {
        shared: {
          id: 'shared',
          uses: './.github/workflows/shared.yml',
        },
      },
    });

    try {
      await engine.run({
        workflowPath: path.join(child, '.github', 'workflows', 'ci.yml'),
        workspaceRoot: child,
      });

      expect(actRunner.run).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ actCwd: parent })
      );
      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        expect.stringContaining(parent)
      );
    } finally {
      fs.rmSync(parent, { recursive: true, force: true });
    }
  });

  it('cancels when reusable workflows are missing and the user declines to run anyway', async () => {
    (workflowParser.parse as jest.Mock).mockReturnValue({
      name: 'CI',
      on: { push: {} },
      jobs: {
        shared: {
          id: 'shared',
          name: 'Shared',
          uses: './.github/workflows/missing.yml',
        },
      },
    });
    (vscode.window.showWarningMessage as jest.Mock).mockResolvedValue('Cancel');

    const result = await engine.run({
      workflowPath: '.github/workflows/ci.yml',
      workspaceRoot: tempRoot,
    });

    expect(result).toBe('cancelled');
    expect(actRunner.run).not.toHaveBeenCalled();
  });


  it('accepts a browsed act executable and persists it before running', async () => {
    const update = jest.fn().mockResolvedValue(undefined);
    (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
      get: jest.fn((_key: string, defaultValue: unknown) => defaultValue),
      update,
    });
    (actRunner.isActInstalled as jest.Mock)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    (vscode.window.showErrorMessage as jest.Mock).mockResolvedValue('Browse for file...');
    (vscode.window.showOpenDialog as jest.Mock).mockResolvedValue([{ fsPath: '/tools/act' }]);

    const result = await engine.run({
      workflowPath: '.github/workflows/ci.yml',
      workspaceRoot: tempRoot,
    });

    expect(result).toEqual(expect.any(String));
    expect(update).toHaveBeenCalledWith('actPath', '/tools/act', vscode.ConfigurationTarget.Global);
    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(expect.stringContaining('/tools/act'));
    expect(actRunner.run).toHaveBeenCalled();
  });

  it('cancels when the browsed act executable cannot be executed', async () => {
    (actRunner.isActInstalled as jest.Mock)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false);
    (vscode.window.showErrorMessage as jest.Mock).mockResolvedValue('Browse for file...');
    (vscode.window.showOpenDialog as jest.Mock).mockResolvedValue([{ fsPath: '/bad/act' }]);

    await expect(engine.run({
      workflowPath: '.github/workflows/ci.yml',
      workspaceRoot: tempRoot,
    })).resolves.toBe('cancelled');

    expect(actRunner.run).not.toHaveBeenCalled();
  });

  it('cancels when browsing for act is dismissed', async () => {
    (actRunner.isActInstalled as jest.Mock).mockResolvedValue(false);
    (vscode.window.showErrorMessage as jest.Mock).mockResolvedValue('Browse for file...');
    (vscode.window.showOpenDialog as jest.Mock).mockResolvedValue(undefined);

    await expect(engine.run({
      workflowPath: '.github/workflows/ci.yml',
      workspaceRoot: tempRoot,
    })).resolves.toBe('cancelled');
  });

  it('accepts a manually entered act executable and trims the configured value', async () => {
    const update = jest.fn().mockResolvedValue(undefined);
    (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
      get: jest.fn((_key: string, defaultValue: unknown) => defaultValue),
      update,
    });
    (actRunner.isActInstalled as jest.Mock)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    (vscode.window.showErrorMessage as jest.Mock).mockResolvedValue('Enter path');
    (vscode.window.showInputBox as jest.Mock).mockResolvedValue('  /tools/act  ');

    const result = await engine.run({
      workflowPath: '.github/workflows/ci.yml',
      workspaceRoot: tempRoot,
    });

    expect(result).toEqual(expect.any(String));
    expect(update).toHaveBeenCalledWith('actPath', '/tools/act', vscode.ConfigurationTarget.Global);
    expect(actRunner.run).toHaveBeenCalled();
  });

  it('truncates an oversized persisted log summary by character count', async () => {
    (actRunner.getLogs as jest.Mock).mockReturnValue(['x'.repeat(90_000)]);

    await engine.run({
      workflowPath: '.github/workflows/ci.yml',
      workspaceRoot: tempRoot,
    });

    const saved = (historyService.save as jest.Mock).mock.calls[0][0];
    expect(saved.logSummary).toContain('...[log summary truncated to keep history lightweight]');
    expect(saved.logSummary.length).toBeLessThan(81_000);
  });

});
