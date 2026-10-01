import { eventBus } from './eventBus';

describe('eventBus', () => {
  afterEach(() => {
    eventBus.removeAllListeners();
  });

  it('dispatches events to registered panels and backend listeners', () => {
    const disposeCallbacks: Array<() => void> = [];
    const panel = {
      webview: { postMessage: jest.fn() },
      onDidDispose: jest.fn((cb: () => void) => disposeCallbacks.push(cb)),
    } as any;

    const listener = jest.fn();
    eventBus.registerPanel(panel);
    eventBus.on('execution:error' as any, listener as any);

    const event = { type: 'execution:error', payload: { message: 'boom' } } as any;
    eventBus.dispatch(event);

    expect(panel.webview.postMessage).toHaveBeenCalledWith(event);
    expect(listener).toHaveBeenCalledWith({ message: 'boom' });

    disposeCallbacks[0]();
    panel.webview.postMessage.mockClear();

    eventBus.dispatch(event);
    expect(panel.webview.postMessage).not.toHaveBeenCalled();
  });

  it('sends snapshots to every registered panel', () => {
    const panelA = { webview: { postMessage: jest.fn() }, onDidDispose: jest.fn() } as any;
    const panelB = { webview: { postMessage: jest.fn() }, onDidDispose: jest.fn() } as any;

    eventBus.registerPanel(panelA);
    eventBus.registerPanel(panelB);

    const payload = { workflows: 3 };
    eventBus.sendSnapshot(payload);

    expect(panelA.webview.postMessage).toHaveBeenCalledWith({ type: 'state:snapshot', payload });
    expect(panelB.webview.postMessage).toHaveBeenCalledWith({ type: 'state:snapshot', payload });
  });

  it('supports once and off semantics for backend listeners', () => {
    const onceListener = jest.fn();
    const persistentListener = jest.fn();

    eventBus.once('execution:error' as any, onceListener as any);
    eventBus.on('execution:error' as any, persistentListener as any);

    const event = { type: 'execution:error', payload: { message: 'boom' } } as any;
    eventBus.dispatch(event);
    eventBus.dispatch(event);

    expect(onceListener).toHaveBeenCalledTimes(1);
    expect(persistentListener).toHaveBeenCalledTimes(2);

    eventBus.off('execution:error' as any, persistentListener as any);
    eventBus.dispatch(event);
    expect(persistentListener).toHaveBeenCalledTimes(2);
  });
});
