import { EventEmitter } from 'events';
import * as vscode from 'vscode';
import type { ActEvent, ActEventType, PayloadOf } from '../types/events.types';

class EventBus extends EventEmitter {
  private panels: Set<vscode.WebviewPanel> = new Set();

  registerPanel(panel: vscode.WebviewPanel): void {
    this.panels.add(panel);
    panel.onDidDispose(() => this.panels.delete(panel));
  }

  dispatch(event: ActEvent): void {
    // Propaga para todos os painéis Webview registrados (visíveis ou não)
    this.panels.forEach((panel) => {
      panel.webview.postMessage(event);
    });
    // Emite localmente para subscribers do backend
    super.emit(event.type, event.payload);
  }

  /** Envia um state:snapshot para todos os painéis registrados */
  sendSnapshot(payload: Record<string, unknown>): void {
    this.panels.forEach((panel) => {
      panel.webview.postMessage({ type: 'state:snapshot', payload });
    });
  }

  on<T extends ActEventType>(event: T, listener: (payload: PayloadOf<T>) => void): this {
    return super.on(event, listener);
  }

  once<T extends ActEventType>(event: T, listener: (payload: PayloadOf<T>) => void): this {
    return super.once(event, listener);
  }

  off<T extends ActEventType>(event: T, listener: (payload: PayloadOf<T>) => void): this {
    return super.off(event, listener);
  }
}

export const eventBus = new EventBus();
