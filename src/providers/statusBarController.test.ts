import * as vscode from 'vscode';
import { eventBus } from '../core/eventBus';
import { StatusBarController } from './statusBarController';

describe('StatusBarController', () => {
  let item: any;

  beforeEach(() => {
    jest.useFakeTimers();
    eventBus.removeAllListeners();
    item = {
      show: jest.fn(),
      dispose: jest.fn(),
      text: '',
      tooltip: '',
      command: '',
      backgroundColor: undefined,
      color: undefined,
    };
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

    eventBus.dispatch({ type: 'execution:start', payload: {} } as any);

    expect(item.text).toContain('$(sync~spin)');
    expect(item.command).toBe('actRunner.stopExecution');
    expect(item.backgroundColor.id).toBe('statusBarItem.warningBackground');

    controller.dispose();
    expect(item.dispose).toHaveBeenCalled();
  });

  it('shows success and returns to idle after execution:end', () => {
    new StatusBarController();

    eventBus.dispatch({ type: 'execution:end', payload: { status: 'success' } } as any);

    expect(item.text).toContain('$(check)');
    expect(item.color.id).toBe('charts.green');

    jest.advanceTimersByTime(5000);
    expect(item.text).toBe('$(run) Act Runner');
  });

  it('shows failure for failed end events and execution errors', () => {
    new StatusBarController();

    eventBus.dispatch({ type: 'execution:end', payload: { status: 'failed' } } as any);
    expect(item.text).toContain('$(error)');
    expect(item.command).toBe('actRunner.viewHistory');

    eventBus.dispatch({ type: 'execution:error', payload: { message: 'boom' } } as any);
    expect(item.backgroundColor.id).toBe('statusBarItem.errorBackground');
  });

  it('returns to idle immediately for cancelled executions before timeout reset', () => {
    new StatusBarController();

    eventBus.dispatch({ type: 'execution:end', payload: { status: 'cancelled' } } as any);

    expect(item.text).toBe('$(run) Act Runner');
    expect(item.command).toBe('actRunner.showMenu');
  });
});
