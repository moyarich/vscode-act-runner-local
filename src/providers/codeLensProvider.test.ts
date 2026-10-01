import * as vscode from 'vscode';
import { WorkflowCodeLensProvider } from './codeLensProvider';
import { workflowParser } from '../core/workflowParser';

jest.mock('../core/workflowParser', () => ({
  workflowParser: {
    parse: jest.fn(),
  },
}));

describe('WorkflowCodeLensProvider', () => {
  const parse = workflowParser.parse as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
      get: jest.fn((_key: string, defaultValue: unknown) => defaultValue),
    });
  });

  it('returns no lenses when CodeLens is disabled', () => {
    (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
      get: jest.fn(() => false),
    });

    const provider = new WorkflowCodeLensProvider();
    const document = {
      uri: { fsPath: '/repo/.github/workflows/ci.yml' },
      getText: () => 'jobs:\n  build:\n',
    } as unknown as vscode.TextDocument;

    expect(provider.provideCodeLenses(document)).toEqual([]);
    expect(parse).not.toHaveBeenCalled();
  });

  it('returns no lenses for non-workflow files', () => {
    const provider = new WorkflowCodeLensProvider();
    const document = {
      uri: { fsPath: '/repo/src/index.yml' },
      getText: () => '',
    } as unknown as vscode.TextDocument;

    expect(provider.provideCodeLenses(document)).toEqual([]);
  });

  it('adds top-level actions and job-specific lenses for valid workflows', () => {
    parse.mockReturnValue({
      jobs: {
        build: { id: 'build' },
        test: { id: 'test' },
      },
    });

    const provider = new WorkflowCodeLensProvider();
    const document = {
      uri: { fsPath: '/repo/.github/workflows/ci.yaml' },
      getText: () => 'name: CI\njobs:\n  build:\n    runs-on: ubuntu-latest\n  test:\n    runs-on: ubuntu-latest\n',
    } as unknown as vscode.TextDocument;

    const lenses = provider.provideCodeLenses(document);

    expect(lenses).toHaveLength(6);
    expect(lenses[0].command?.command).toBe('actRunner.runWorkflow');
    expect(lenses[4].command?.arguments).toEqual([document.uri.fsPath, 'build']);
    expect(lenses[5].command?.arguments).toEqual([document.uri.fsPath, 'test']);
  });

  it('keeps top-level lenses when workflow parsing fails', () => {
    parse.mockImplementation(() => {
      throw new Error('invalid yaml');
    });

    const provider = new WorkflowCodeLensProvider();
    const document = {
      uri: { fsPath: '/repo/.github/workflows/broken.yml' },
      getText: () => 'not: [valid',
    } as unknown as vscode.TextDocument;

    expect(provider.provideCodeLenses(document)).toHaveLength(4);
  });

  it('does not add a job lens when the parsed job is absent from document text', () => {
    parse.mockReturnValue({
      jobs: {
        generated: { id: 'generated' },
      },
    });

    const provider = new WorkflowCodeLensProvider();
    const document = {
      uri: { fsPath: '/repo/.github/workflows/ci.yml' },
      getText: () => 'name: CI\njobs:\n  build:\n    runs-on: ubuntu-latest\n',
    } as unknown as vscode.TextDocument;

    const lenses = provider.provideCodeLenses(document);

    expect(lenses).toHaveLength(4);
    expect(lenses.some((lens: vscode.CodeLens) => lens.command?.command === 'actRunner.runJob')).toBe(false);
  });

});
