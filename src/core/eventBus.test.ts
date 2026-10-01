import * as vscode from 'vscode';
import { eventBus } from './eventBus';
import type { ActEvent, ExecutionErrorPayload } from '../types/events.types';

function createPanel(disposeCallbacks: Array<() => void> = []): vscode.WebviewPanel {
  return {
    webview: { postMessage: jest.fn() },
    onDidDispose: jest.fn((cb: () => void) => {
      disposeCallbacks.push(cb);
      return { dispose: jest.fn() };
    }),
  } as unknown as vscode.WebviewPanel;
}

describe('eventBus', () => {
  afterEach(() => {
    eventBus.removeAllListeners();
  });

  it('dispatches events to registered panels and backend listeners', () => {
    const disposeCallbacks: Array<() => void> = [];
    const panel = createPanel(disposeCallbacks);
    const listener = jest.fn((_payload: ExecutionErrorPayload) => undefined);

    eventBus.registerPanel(panel);
    eventBus.on('execution:error', listener);

    const event: ActEvent = {
      type: 'execution:error',
      payload: { executionId: 'exec-1', error: 'boom' },
    };
    eventBus.dispatch(event);

    expect(panel.webview.postMessage).toHaveBeenCalledWith(event);
    expect(listener).toHaveBeenCalledWith({ executionId: 'exec-1', error: 'boom' });

    disposeCallbacks[0]();
    (panel.webview.postMessage as jest.Mock).mockClear();

    eventBus.dispatch(event);
    expect(panel.webview.postMessage).not.toHaveBeenCalled();
  });

  it('sends snapshots to every registered panel', () => {
    const panelA = createPanel();
    const panelB = createPanel();

    eventBus.registerPanel(panelA);
    eventBus.registerPanel(panelB);

    const payload = { workflows: 3 };
    eventBus.sendSnapshot(payload);

    expect(panelA.webview.postMessage).toHaveBeenCalledWith({ type: 'state:snapshot', payload });
    expect(panelB.webview.postMessage).toHaveBeenCalledWith({ type: 'state:snapshot', payload });
  });

  it('supports once and off semantics for backend listeners', () => {
    const onceListener = jest.fn((_payload: ExecutionErrorPayload) => undefined);
    const persistentListener = jest.fn((_payload: ExecutionErrorPayload) => undefined);

    eventBus.once('execution:error', onceListener);
    eventBus.on('execution:error', persistentListener);

    const event: ActEvent = {
      type: 'execution:error',
      payload: { executionId: 'exec-1', error: 'boom' },
    };
    eventBus.dispatch(event);
    eventBus.dispatch(event);

    expect(onceListener).toHaveBeenCalledTimes(1);
    expect(persistentListener).toHaveBeenCalledTimes(2);

    eventBus.off('execution:error', persistentListener);
    eventBus.dispatch(event);
    expect(persistentListener).toHaveBeenCalledTimes(2);
  });
});
