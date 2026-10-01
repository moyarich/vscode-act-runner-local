import * as vscode from 'vscode';
import { eventBus } from '../core/eventBus';
import { StatusBarController } from './statusBarController';

describe('StatusBarController', () => {
  let item: vscode.StatusBarItem;

  beforeEach(() => {
    jest.useFakeTimers();
    eventBus.removeAllListeners();
    item = {
      show: jest.fn(),
      hide: jest.fn(),
      dispose: jest.fn(),
      text: '',
      tooltip: '',
      command: '',
      backgroundColor: undefined,
      color: undefined,
      alignment: vscode.StatusBarAlignment.Left,
      priority: 100,
      name: 'Act Runner',
      accessibilityInformation: undefined,
    } as unknown as vscode.StatusBarItem;
    (vscode.window.createStatusBarItem as jest.Mock).mockReturnValue(item);
  });

  afterEach(() => {
    eventBus.removeAllListeners();
    jest.useRealTimers();
  });

  it('starts idle and becomes running on execution:start', () => {
    const controller = new StatusBarController();

    expect(item.text).toBe('$(run) Act Runner');
    expect(item.command).toBe('actRunner.showMenu');
    expect(item.show).toHaveBeenCalled();

    eventBus.dispatch({
      type: 'execution:start',
      payload: {
        executionId: 'exec-1',
        workflowPath: '.github/workflows/ci.yml',
        workflowName: 'CI',
        jobs: [],
        triggeredAt: '2026-01-01T00:00:00Z',
      },
    });

    expect(item.text).toContain('$(sync~spin)');
    expect(item.command).toBe('actRunner.stopExecution');
    expect(item.backgroundColor.id).toBe('statusBarItem.warningBackground');

    controller.dispose();
    expect(item.dispose).toHaveBeenCalled();
  });

  it('shows success and returns to idle after execution:end', () => {
    new StatusBarController();

    eventBus.dispatch({
      type: 'execution:end',
      payload: {
        executionId: 'exec-1',
        status: 'success',
        duration: 1000,
        completedAt: '2026-01-01T00:00:01Z',
      },
    });

    expect(item.text).toContain('$(check)');
    expect(item.color.id).toBe('charts.green');

    jest.advanceTimersByTime(5000);
    expect(item.text).toBe('$(run) Act Runner');
  });

  it('shows failure for failed end events and execution errors', () => {
    new StatusBarController();

    eventBus.dispatch({
      type: 'execution:end',
      payload: {
        executionId: 'exec-1',
        status: 'failed',
        duration: 1000,
        completedAt: '2026-01-01T00:00:01Z',
      },
    });
    expect(item.text).toContain('$(error)');
    expect(item.command).toBe('actRunner.viewHistory');

    eventBus.dispatch({
      type: 'execution:error',
      payload: { executionId: 'exec-1', error: 'boom' },
    });
    expect(item.backgroundColor.id).toBe('statusBarItem.errorBackground');
  });

  it('returns to idle immediately for cancelled executions before timeout reset', () => {
    new StatusBarController();

    eventBus.dispatch({
      type: 'execution:end',
      payload: {
        executionId: 'exec-1',
        status: 'cancelled',
        duration: 1000,
        completedAt: '2026-01-01T00:00:01Z',
      },
    });

    expect(item.text).toBe('$(run) Act Runner');
    expect(item.command).toBe('actRunner.showMenu');
  });
});
