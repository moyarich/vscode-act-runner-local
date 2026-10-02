// Mock do módulo vscode para uso em testes Jest
const vscode = {
  window: {
    showInformationMessage: jest.fn(),
    showWarningMessage: jest.fn(),
    showErrorMessage: jest.fn(),
    showQuickPick: jest.fn(),
    showOpenDialog: jest.fn(),
    showInputBox: jest.fn(),
    createStatusBarItem: jest.fn(() => ({
      show: jest.fn(),
      hide: jest.fn(),
      dispose: jest.fn(),
      text: '',
      tooltip: '',
      command: '',
      backgroundColor: undefined,
      color: undefined,
    })),
    createWebviewPanel: jest.fn(),
    createOutputChannel: jest.fn(() => ({
      appendLine: jest.fn(),
      show: jest.fn(),
      dispose: jest.fn(),
    })),
    createTreeView: jest.fn(),
  },
  workspace: {
    workspaceFolders: undefined,
    getConfiguration: jest.fn(() => ({
      get: jest.fn((key: string, defaultValue: unknown) => defaultValue),
    })),
    createFileSystemWatcher: jest.fn(() => ({
      onDidCreate: jest.fn(),
      onDidDelete: jest.fn(),
      onDidChange: jest.fn(),
      dispose: jest.fn(),
    })),
    openTextDocument: jest.fn(),
  },
  commands: {
    registerCommand: jest.fn(),
    executeCommand: jest.fn(),
  },
  languages: {
    registerCodeLensProvider: jest.fn(),
  },
  env: {
    openExternal: jest.fn(),
  },
  Uri: {
    file: jest.fn((p: string) => ({ fsPath: p })),
    parse: jest.fn((s: string) => ({ toString: () => s })),
    joinPath: jest.fn((...parts: unknown[]) => parts[parts.length - 1]),
  },
  TreeItem: class {
    constructor(public label: string, public collapsibleState?: number) {}
  },
  TreeItemCollapsibleState: { None: 0, Collapsed: 1, Expanded: 2 },
  StatusBarAlignment: { Left: 1, Right: 2 },
  ConfigurationTarget: { Global: 1, Workspace: 2, WorkspaceFolder: 3 },
  ViewColumn: { One: 1, Two: 2, Beside: -2 },
  ThemeIcon: class { constructor(public id: string) {} },
  ThemeColor: class { constructor(public id: string) {} },
  EventEmitter: class {
    event = jest.fn();
    fire = jest.fn();
    dispose = jest.fn();
  },
  CodeLens: class {
    constructor(public range: unknown, public command?: unknown) {}
  },
  Range: class {
    constructor(
      public startLine: number,
      public startChar: number,
      public endLine: number,
      public endChar: number
    ) {}
  },
};

module.exports = vscode;
