/* eslint-disable @typescript-eslint/no-explicit-any */
import { ActRunner } from '../core/actRunner';
import { eventBus } from '../core/eventBus';
import * as fs from 'fs';
import * as vscode from 'vscode';

// Mockar child_process para não executar o CLI de verdade
jest.mock('child_process', () => ({
  spawn: jest.fn(),
}));

import { spawn } from 'child_process';
import { EventEmitter } from 'events';

function createMockProcess(stdoutLines: string[], stderrLines: string[] = [], exitCode = 0) {
  const proc = new EventEmitter() as any;
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  proc.kill = jest.fn();
  proc.pid = 12345;

  // Emitir linhas async
  setImmediate(() => {
    for (const line of stdoutLines) {
      proc.stdout.emit('data', Buffer.from(line + '\n'));
    }
    for (const line of stderrLines) {
      proc.stderr.emit('data', Buffer.from(line + '\n'));
    }
    proc.emit('close', exitCode);
  });

  return proc;
}

describe('ActRunner', () => {
  let runner: ActRunner;
  let dispatchSpy: jest.SpyInstance;

  beforeEach(() => {
    runner = new ActRunner();
    (spawn as jest.Mock).mockReset();
    dispatchSpy = jest.spyOn(eventBus, 'dispatch').mockImplementation(() => undefined);
  });

  afterEach(() => {
    dispatchSpy.mockRestore();
  });

  it('isActInstalled() deve retornar true quando act está disponível', async () => {
    (spawn as jest.Mock).mockReturnValueOnce(createMockProcess(['act version 0.2.60']));
    const result = await runner.isActInstalled('act');
    expect(result).toBe(true);
  });

  it('isActInstalled() deve retornar false quando act não está disponível', async () => {
    (spawn as jest.Mock).mockReturnValueOnce(createMockProcess([], [], 127));
    const result = await runner.isActInstalled('act-nao-existe');
    expect(result).toBe(false);
  });

  it('buildArgs() deve incluir varFile quando informado', () => {
    const args = (runner as any).buildArgs(
      {
        workflowPath: '.github/workflows/ci.yml',
        workspaceRoot: '/repo',
        envFile: '/repo/.env',
        varFile: '/repo/.vars',
      },
      'catthehacker/ubuntu:act-latest',
      '/repo'
    );

    expect(args).toEqual(expect.arrayContaining([
      '--env-file', '/repo/.env',
      '--var-file', '/repo/.vars',
    ]));
  });

  it('run() deve resolver ao finalizar com sucesso', async () => {
    const mockProc = createMockProcess([
      '[build] ⭐ Run actions/checkout@v4',
      '[build]   ✅ Success - actions/checkout@v4',
    ]);
    (runner as any).cleanupActContainers = jest.fn().mockResolvedValue(undefined);
    (runner as any).cleanupDanglingImages = jest.fn().mockResolvedValue(undefined);
    (spawn as jest.Mock).mockReturnValueOnce(mockProc);

    await expect(runner.run('exec-001', {
      workflowPath: '.github/workflows/ci.yml',
      workspaceRoot: '/repo',
    })).resolves.toBeUndefined();

    expect(spawn).toHaveBeenNthCalledWith(
      1,
      'act',
      expect.arrayContaining(['-W', '.github/workflows/ci.yml']),
      expect.objectContaining({ cwd: '/repo' })
    );
  });

  it('processLine() deve mapear ::notice:: para level notice removendo o comando', () => {
    (runner as any).processLine('exec-001', '[build/Test] | ::notice:: deploy em andamento');

    const logEvent = dispatchSpy.mock.calls
      .map((args) => args[0])
      .find((event) => event.type === 'log');

    expect(logEvent).toBeDefined();
    expect(logEvent.payload.level).toBe('notice');
    expect(logEvent.payload.line).toBe('deploy em andamento');
  });

  it('processLine() deve mapear ::notice:: mesmo com prefixo visual do act', () => {
    (runner as any).processLine('exec-001', '[build/Test] | ❓ ::notice title=AWS Setup::Running in SIMULATION MODE');

    const logEvent = dispatchSpy.mock.calls
      .map((args) => args[0])
      .find((event) => event.type === 'log');

    expect(logEvent).toBeDefined();
    expect(logEvent.payload.level).toBe('notice');
    expect(logEvent.payload.line).toBe('Running in SIMULATION MODE');
  });

  it('processLine() deve mapear anotacao notice com separador de um colon', () => {
    (runner as any).processLine('exec-001', '[build/Test] | ?::notice title=AWS Setup:Running in SIMULATION MODE');

    const logEvent = dispatchSpy.mock.calls
      .map((args) => args[0])
      .find((event) => event.type === 'log');

    expect(logEvent).toBeDefined();
    expect(logEvent.payload.level).toBe('notice');
    expect(logEvent.payload.line).toBe('Running in SIMULATION MODE');
  });

  it('processLine() deve mapear ::error:: para level error removendo o comando', () => {
    (runner as any).processLine('exec-001', '[build/Test] | ::error:: falhou o build');

    const logEvent = dispatchSpy.mock.calls
      .map((args) => args[0])
      .find((event) => event.type === 'log');

    expect(logEvent).toBeDefined();
    expect(logEvent.payload.level).toBe('error');
    expect(logEvent.payload.line).toBe('falhou o build');
  });

  it('processLine() deve mapear [INFO] para level notice', () => {
    (runner as any).processLine('exec-001', '[build/Test] | [INFO] mensagem azul');

    const logEvent = dispatchSpy.mock.calls
      .map((args) => args[0])
      .find((event) => event.type === 'log');

    expect(logEvent).toBeDefined();
    expect(logEvent.payload.level).toBe('notice');
    expect(logEvent.payload.line).toBe('mensagem azul');
  });

  it('processLine() deve mapear [DEBUG] para level debug', () => {
    (runner as any).processLine('exec-001', '[build/Test] | [DEBUG] detalhe técnico');

    const logEvent = dispatchSpy.mock.calls
      .map((args) => args[0])
      .find((event) => event.type === 'log');

    expect(logEvent).toBeDefined();
    expect(logEvent.payload.level).toBe('debug');
    expect(logEvent.payload.line).toBe('detalhe técnico');
  });

  it('processLine() deve preservar ANSI na linha enviada ao evento de log', () => {
    const ansiLine = '[build/Test] | \u001b[31mfalha colorida\u001b[0m';
    (runner as any).processLine('exec-001', ansiLine);

    const logEvent = dispatchSpy.mock.calls
      .map((args) => args[0])
      .find((event) => event.type === 'log');

    expect(logEvent).toBeDefined();
    expect(logEvent.payload.level).toBe('info');
    expect(logEvent.payload.line).toContain('\u001b[31m');
    expect(logEvent.payload.line).toContain('falha colorida');
  });

  it('isActInstalled() returns false when spawning the executable errors', async () => {
    const proc = new EventEmitter() as any;
    proc.on = proc.on.bind(proc);
    (spawn as jest.Mock).mockReturnValueOnce(proc);
    setImmediate(() => proc.emit('error', new Error('ENOENT')));

    await expect(runner.isActInstalled('/missing/act')).resolves.toBe(false);
  });

  it('autoDetect() keeps a configured act executable when it works', async () => {
    const update = jest.fn();
    (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
      get: jest.fn(() => '/configured/act'),
      update,
    });
    jest.spyOn(runner, 'isActInstalled').mockResolvedValue(true);

    await expect(runner.autoDetect()).resolves.toBe('/configured/act');
    expect(update).not.toHaveBeenCalled();
  });

  it('autoDetect() persists a path resolved through the interactive shell fallback', async () => {
    const update = jest.fn().mockResolvedValue(undefined);
    (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
      get: jest.fn(() => '/missing/configured'),
      update,
    });
    jest.spyOn(runner, 'isActInstalled').mockResolvedValue(false);
    jest.spyOn(runner as any, 'resolveViaShell').mockResolvedValue('/shell/act');

    await expect(runner.autoDetect()).resolves.toBe('/shell/act');
    expect(update).toHaveBeenCalledWith('actPath', '/shell/act', vscode.ConfigurationTarget.Global);
  });

  it('run() rejects when no project root can be resolved', async () => {
    (vscode.workspace as any).workspaceFolders = undefined;

    await expect(runner.run('exec-no-root', {} as any)).rejects.toThrow(/No project selected/i);
  });

  it('run() captures stderr and reports a failed process exit', async () => {
    const mockProc = createMockProcess([], ['::error:: compiler failed'], 2);
    (runner as any).cleanupActContainers = jest.fn().mockResolvedValue(undefined);
    (spawn as jest.Mock).mockReturnValueOnce(mockProc);

    await expect(runner.run('exec-failed', {
      workflowPath: '.github/workflows/ci.yml',
      workspaceRoot: '/repo',
    })).rejects.toThrow(/code 2/i);

    expect(runner.getLogs()).toContain('compiler failed');
    expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({
      type: 'execution:end',
      payload: expect.objectContaining({ status: 'failed' }),
    }));
  });

  it('run() propagates child-process spawn errors as execution errors', async () => {
    const proc = new EventEmitter() as any;
    proc.stdout = new EventEmitter();
    proc.stderr = new EventEmitter();
    proc.kill = jest.fn();
    (runner as any).cleanupActContainers = jest.fn().mockResolvedValue(undefined);
    (spawn as jest.Mock).mockReturnValueOnce(proc);
    setImmediate(() => proc.emit('error', new Error('spawn ENOENT')));

    await expect(runner.run('exec-error', {
      workflowPath: '.github/workflows/ci.yml',
      workspaceRoot: '/repo',
    })).rejects.toThrow('spawn ENOENT');

    expect(dispatchSpy).toHaveBeenCalledWith({
      type: 'execution:error',
      payload: { executionId: 'exec-error', error: 'spawn ENOENT' },
    });
  });

  it('stop() terminates an active process and clears accumulated execution state', () => {
    const proc = { kill: jest.fn() } as any;
    (runner as any).activeProcess = proc;
    (runner as any).pendingJobStatus.set('build', { status: 'success', completedAt: 'now' });
    (runner as any).runningJobs.add('build');
    (runner as any).currentStep.set('build', 'Test');
    (runner as any).summaryLines = ['summary'];
    (runner as any).cleanupActContainers = jest.fn().mockResolvedValue(undefined);

    runner.stop();

    expect(proc.kill).toHaveBeenCalledWith('SIGTERM');
    expect((runner as any).activeProcess).toBeNull();
    expect((runner as any).pendingJobStatus.size).toBe(0);
    expect((runner as any).runningJobs.size).toBe(0);
    expect((runner as any).currentStep.size).toBe(0);
  });

  it('clearLogs() removes logs accumulated from parsed output', () => {
    (runner as any).processLine('exec-001', '[build/Test] | hello');
    expect(runner.getLogs()).toContain('hello');

    runner.clearLogs();

    expect(runner.getLogs()).toEqual([]);
  });

  it('buildArgs() includes optional execution inputs and sanitizes unsafe argument characters', () => {
    const root = fs.mkdtempSync('/tmp/act-runner-args-');

    try {
      const workflowPath = `${root}/.github/workflows/ci.yml`;
      const args = (runner as any).buildArgs({
        workflowPath,
        workspaceRoot: root,
        jobId: 'build;rm',
        dryRun: true,
        eventType: 'workflow_dispatch',
        eventPayloadPath: `${root}/event.json`,
        envFile: `${root}/.env`,
        varFile: `${root}/.vars`,
        secretsFile: `${root}/.secrets`,
      }, 'test/image:latest', root);

      expect(args).toEqual(expect.arrayContaining([
        '-j', 'buildrm',
        '-n',
        'workflow_dispatch',
        '-e', `${root}/event.json`,
        '--env-file', `${root}/.env`,
        '--var-file', `${root}/.vars`,
        '--secret-file', `${root}/.secrets`,
        '--rm',
        '-P', 'ubuntu-latest=test/image:latest',
      ]));
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('buildArgs() respects a project .actrc platform mapping', () => {
    const root = fs.mkdtempSync('/tmp/act-runner-actrc-');
    fs.writeFileSync(`${root}/.actrc`, '-P ubuntu-latest=custom/image\n', 'utf-8');

    try {
      const args = (runner as any).buildArgs({
        workflowPath: '.github/workflows/ci.yml',
        workspaceRoot: root,
      }, 'fallback/image', root);

      expect(args).not.toContain('-P');
      expect(args).toContain('--rm');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('processLine() emits step lifecycle events including timing cleanup', () => {
    (runner as any).processLine('exec-steps', '[build/Test] ⭐ Run npm test');
    (runner as any).processLine('exec-steps', '[build/Test] ✅ Success - npm test [52.5ms]');
    (runner as any).processLine('exec-steps', '[build/Test] ❌ Failure - lint [1.2s]');
    (runner as any).processLine('exec-steps', '[build/Test] ⏭️ Skipping deploy [5ms]');

    const events = dispatchSpy.mock.calls.map((args) => args[0]);
    expect(events).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'step:update', payload: expect.objectContaining({ stepId: 'npm test', status: 'running' }) }),
      expect.objectContaining({ type: 'step:update', payload: expect.objectContaining({ stepId: 'npm test', status: 'success' }) }),
      expect.objectContaining({ type: 'step:update', payload: expect.objectContaining({ stepId: 'lint', status: 'failed' }) }),
      expect.objectContaining({ type: 'step:update', payload: expect.objectContaining({ stepId: 'deploy', status: 'skipped' }) }),
    ]));
  });

  it('processLine() tracks reusable inner jobs separately from their outer job', () => {
    (runner as any).processLine('exec-reuse', '[caller/shared/inner] 🚀 Start image');
    (runner as any).processLine('exec-reuse', '[caller/shared/inner] 🏁 Job succeeded');

    const events = dispatchSpy.mock.calls.map((args) => args[0]);
    expect(events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'job:update',
        payload: expect.objectContaining({ jobId: 'inner', outerJobId: 'caller', status: 'running' }),
      }),
      expect.objectContaining({
        type: 'job:update',
        payload: expect.objectContaining({ jobId: 'inner', outerJobId: 'caller', status: 'success' }),
      }),
    ]));
  });

  it('processLine() captures and flushes step summaries', () => {
    (runner as any).processLine('exec-summary', '[build] ◎ Summary - first line');
    (runner as any).processLine('exec-summary', 'second line');
    (runner as any).processLine('exec-summary', '[build] unrelated output');

    expect(dispatchSpy).toHaveBeenCalledWith({
      type: 'summary:update',
      payload: {
        executionId: 'exec-summary',
        content: 'first line\nsecond line',
      },
    });
  });

  it('processLine() strips the configured workflow display-name prefix', () => {
    (runner as any).workflowDisplayName = 'CI/CD Pipeline';

    (runner as any).processLine(
      'exec-prefix',
      '[CI/CD Pipeline/build/Test] | workflow-prefixed log'
    );

    expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({
      type: 'log',
      payload: expect.objectContaining({
        jobId: 'build',
        line: 'workflow-prefixed log',
      }),
    }));
  });

  it('truncates oversized persisted and UI log lines', () => {
    const longLine = 'x'.repeat(5000);
    (runner as any).processLine('exec-long', `[build/Test] | ${longLine}`);

    const stored = runner.getLogs()[0];
    const logEvent = dispatchSpy.mock.calls.map((args) => args[0]).find((event) => event.type === 'log');

    expect(stored.length).toBeLessThan(longLine.length);
    expect(stored).toContain('[truncated]');
    expect(logEvent.payload.line.length).toBeLessThan(stored.length);
  });


  it('resolveViaShell() returns the discovered executable path from shell output', async () => {
    jest.useFakeTimers();
    const proc = new EventEmitter() as any;
    proc.stdout = new EventEmitter();
    proc.kill = jest.fn();
    (spawn as jest.Mock).mockReturnValueOnce(proc);

    const resolved = (runner as any).resolveViaShell();
    proc.stdout.emit('data', Buffer.from('/opt/homebrew/bin/act\n'));
    proc.emit('close', 0);

    await expect(resolved).resolves.toBe('/opt/homebrew/bin/act');
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('resolveViaShell() rejects ambiguous shell output and handles spawn errors', async () => {
    jest.useFakeTimers();

    const ambiguous = new EventEmitter() as any;
    ambiguous.stdout = new EventEmitter();
    ambiguous.kill = jest.fn();
    (spawn as jest.Mock).mockReturnValueOnce(ambiguous);

    const ambiguousResult = (runner as any).resolveViaShell();
    ambiguous.stdout.emit('data', Buffer.from('alias act=act --container-architecture linux/amd64\n'));
    ambiguous.emit('close', 0);

    await expect(ambiguousResult).resolves.toBeUndefined();

    const failed = new EventEmitter() as any;
    failed.stdout = new EventEmitter();
    failed.kill = jest.fn();
    (spawn as jest.Mock).mockReturnValueOnce(failed);

    const failedResult = (runner as any).resolveViaShell();
    failed.emit('error', new Error('shell failed'));

    await expect(failedResult).resolves.toBeUndefined();

    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('run() flushes pending job status when the process closes', async () => {
    const mockProc = createMockProcess([
      '[build] 🏁 Job succeeded',
    ]);
    (runner as any).cleanupActContainers = jest.fn().mockResolvedValue(undefined);
    (spawn as jest.Mock).mockReturnValueOnce(mockProc);

    await runner.run('exec-pending-close', {
      workflowPath: '.github/workflows/ci.yml',
      workspaceRoot: '/repo',
    });

    expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({
      type: 'job:update',
      payload: expect.objectContaining({
        executionId: 'exec-pending-close',
        jobId: 'build',
        status: 'success',
      }),
    }));
  });

  it('cleanupActContainers() resolves cleanly when docker is unavailable', async () => {
    const find = new EventEmitter() as any;
    find.stdout = new EventEmitter();
    (spawn as jest.Mock).mockReturnValueOnce(find);

    const cleanup = (runner as any).cleanupActContainers();
    find.emit('error', new Error('docker missing'));

    await expect(cleanup).resolves.toBeUndefined();
  });

  it('cleanupActContainers() removes discovered act containers', async () => {
    const find = new EventEmitter() as any;
    find.stdout = new EventEmitter();
    const rm = new EventEmitter() as any;
    (spawn as jest.Mock)
      .mockReturnValueOnce(find)
      .mockReturnValueOnce(rm);

    const cleanup = (runner as any).cleanupActContainers();
    find.stdout.emit('data', Buffer.from('abc123\ndef456\n'));
    find.emit('close', 0);
    rm.emit('close', 0);

    await expect(cleanup).resolves.toBeUndefined();
    expect(spawn).toHaveBeenNthCalledWith(
      2,
      'docker',
      ['rm', '-f', 'abc123', 'def456'],
      { stdio: 'ignore' }
    );
  });

  it('cleanupActContainers() skips removal when no act containers are found', async () => {
    const find = new EventEmitter() as any;
    find.stdout = new EventEmitter();
    (spawn as jest.Mock).mockReturnValueOnce(find);

    const cleanup = (runner as any).cleanupActContainers();
    find.emit('close', 0);

    await expect(cleanup).resolves.toBeUndefined();
    expect(spawn).toHaveBeenCalledTimes(1);
  });

  it('stripWorkflowPrefix() leaves unrelated lines unchanged', () => {
    (runner as any).workflowDisplayName = 'CI/CD Pipeline';

    expect((runner as any).stripWorkflowPrefix('[build] | hello')).toBe('[build] | hello');
  });

  it('processLine() infers successful outer reusable job completion when the next outer job starts', () => {
    (runner as any).processLine('exec-transition', '[caller/shared/inner] | hello');
    dispatchSpy.mockClear();

    (runner as any).processLine('exec-transition', '[next] | world');

    expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({
      type: 'job:update',
      payload: expect.objectContaining({
        jobId: 'caller',
        status: 'success',
      }),
    }));
  });

  it('processLine() infers failed outer reusable job completion after an inner failure', () => {
    (runner as any).processLine('exec-transition-fail', '[caller/shared/inner] 🏁 Job failed');
    dispatchSpy.mockClear();

    (runner as any).processLine('exec-transition-fail', '[next] | world');

    expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({
      type: 'job:update',
      payload: expect.objectContaining({
        jobId: 'caller',
        status: 'failed',
      }),
    }));
  });

  it('processLine() confirms pending status when output moves to another outer job', () => {
    (runner as any).processLine('exec-pending', '[build] 🏁 Job succeeded');
    dispatchSpy.mockClear();

    (runner as any).processLine('exec-pending', '[test] | starting');

    expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({
      type: 'job:update',
      payload: expect.objectContaining({
        jobId: 'build',
        status: 'success',
      }),
    }));
  });

  it('processLine() cancels pending status when the same outer job emits more work', () => {
    (runner as any).processLine('exec-pending-same', '[build] 🏁 Job succeeded');
    expect((runner as any).pendingJobStatus.has('build')).toBe(true);

    (runner as any).processLine('exec-pending-same', '[build] | more work');

    expect((runner as any).pendingJobStatus.has('build')).toBe(false);
  });

  it('processLine() stores regular job success and failure as pending statuses', () => {
    (runner as any).processLine('exec-jobs', '[build] 🏁 Job succeeded');
    expect((runner as any).pendingJobStatus.get('build')?.status).toBe('success');

    (runner as any).processLine('exec-jobs', '[test] 🏁 Job failed');
    expect((runner as any).pendingJobStatus.get('test')?.status).toBe('failed');
  });

  it('processLine() dispatches reusable inner job failure and records outer failure', () => {
    (runner as any).processLine('exec-inner-fail', '[caller/shared/inner] 🏁 Job failed');

    expect((runner as any).failedInnerByOuter.has('caller')).toBe(true);
    expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({
      type: 'job:update',
      payload: expect.objectContaining({
        jobId: 'inner',
        outerJobId: 'caller',
        status: 'failed',
      }),
    }));
  });

  it('flushDroppedLogNotice() reports and resets dropped UI log events', () => {
    (runner as any).uiLogEventsDropped = 3;

    (runner as any).flushDroppedLogNotice('exec-dropped');

    expect(dispatchSpy).toHaveBeenCalledWith({
      type: 'log',
      payload: expect.objectContaining({
        executionId: 'exec-dropped',
        level: 'warn',
        line: expect.stringContaining('3 log lines omitted'),
      }),
    });
    expect((runner as any).uiLogEventsDropped).toBe(0);
  });

  it('dispatchLog() starts dropping UI events after the configured limit', () => {
    (runner as any).uiLogEventsSent = 1500;

    (runner as any).dispatchLog({
      executionId: 'exec-limit',
      line: 'hidden',
      level: 'info',
      timestamp: new Date().toISOString(),
    });

    expect((runner as any).uiLogEventsDropped).toBe(1);
    expect(dispatchSpy).not.toHaveBeenCalled();
  });

  it('pushSummaryLine() truncates long lines and marks overflowed summaries', () => {
    (runner as any).pushSummaryLine('x'.repeat(2500));
    expect((runner as any).summaryLines[0]).toContain('[truncated]');

    (runner as any).summaryLines = Array.from({ length: 1200 }, () => 'line');
    (runner as any).pushSummaryLine('overflow');

    expect((runner as any).summaryTruncated).toBe(true);
    expect((runner as any).summaryLines).toHaveLength(1200);
  });

  it('dispatchSummary() includes the summary truncated marker when needed', () => {
    (runner as any).summaryLines = ['first'];
    (runner as any).summaryTruncated = true;

    (runner as any).dispatchSummary('exec-summary-truncated');

    expect(dispatchSpy).toHaveBeenCalledWith({
      type: 'summary:update',
      payload: {
        executionId: 'exec-summary-truncated',
        content: 'first\n...[summary truncated]',
      },
    });
  });

});
