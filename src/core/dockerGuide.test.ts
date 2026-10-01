import * as vscode from 'vscode';
import { execSync } from 'child_process';
import { DockerGuide } from './dockerGuide';

jest.mock('child_process', () => ({
  execSync: jest.fn(),
}));

describe('DockerGuide', () => {
  const exec = execSync as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the first available container runtime in priority order', () => {
    exec.mockImplementation((command: string) => {
      if (command === 'docker info') throw new Error('missing');
      if (command === 'podman info') return Buffer.from('');
      throw new Error('should not reach nerdctl');
    });

    const guide = new DockerGuide();

    expect(guide.detectRuntime()).toBe('podman');
    expect(exec).toHaveBeenNthCalledWith(1, 'docker info', { stdio: 'ignore' });
    expect(exec).toHaveBeenNthCalledWith(2, 'podman info', { stdio: 'ignore' });
  });

  it('returns null when no supported runtime is available', () => {
    exec.mockImplementation(() => {
      throw new Error('missing');
    });

    expect(new DockerGuide().detectRuntime()).toBeNull();
    expect(exec).toHaveBeenCalledTimes(3);
  });

  it('does not warn when a runtime is available', async () => {
    exec.mockReturnValue(Buffer.from(''));
    const warning = vscode.window.showWarningMessage as jest.Mock;

    await new DockerGuide().warnIfMissing();

    expect(warning).not.toHaveBeenCalled();
  });

  it('opens the alternatives guide when the user chooses it', async () => {
    exec.mockImplementation(() => {
      throw new Error('missing');
    });
    (vscode.window.showWarningMessage as jest.Mock).mockResolvedValue('View alternatives guide');

    const panel = { webview: { html: '' } };
    (vscode.window.createWebviewPanel as jest.Mock).mockReturnValue(panel);

    await new DockerGuide().warnIfMissing();

    expect(vscode.window.createWebviewPanel).toHaveBeenCalled();
    expect(panel.webview.html).toContain('Docker Desktop Alternatives');
    expect(panel.webview.html).toContain('Podman Desktop');
  });

  it('leaves the guide closed when the warning is dismissed', async () => {
    exec.mockImplementation(() => {
      throw new Error('missing');
    });
    (vscode.window.showWarningMessage as jest.Mock).mockResolvedValue(undefined);

    await new DockerGuide().warnIfMissing();

    expect(vscode.window.createWebviewPanel).not.toHaveBeenCalled();
  });
});
