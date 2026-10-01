import * as vscode from 'vscode';
import { WorkflowExplorer, WorkflowTreeItem } from './workflowExplorer';
import { workflowParser } from '../core/workflowParser';

jest.mock('../core/workflowParser', () => ({
  workflowParser: {
    discoverWorkflows: jest.fn(),
    parse: jest.fn(),
  },
}));

describe('WorkflowExplorer', () => {
  const discover = workflowParser.discoverWorkflows as jest.Mock;
  const parse = workflowParser.parse as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    (vscode.workspace as any).workspaceFolders = undefined;
  });

  it('shows a project-selection hint when no root is available', () => {
    const explorer = new WorkflowExplorer();

    const children = explorer.getChildren();

    expect(children).toHaveLength(1);
    expect(children[0].itemContext).toBe('empty');
  });

  it('uses the explicit project root and refreshes tree data', () => {
    const explorer = new WorkflowExplorer();
    explorer.setProjectRoot('/repo');

    expect(explorer.getProjectRoot()).toBe('/repo');
  });

  it('discovers valid workflows, skips invalid ones, and exposes jobs', () => {
    discover.mockReturnValue(['/repo/.github/workflows/ci.yml', '/repo/.github/workflows/bad.yml']);
    parse.mockImplementation((file: string) => {
      if (file.endsWith('bad.yml')) throw new Error('bad yaml');
      return {
        name: 'CI',
        filePath: file,
        jobs: {
          build: { id: 'build', name: 'Build' },
          reuse: { id: 'reuse', uses: './.github/workflows/reusable.yml' },
        },
      };
    });

    const explorer = new WorkflowExplorer();
    explorer.setProjectRoot('/repo');

    const roots = explorer.getChildren();
    expect(roots).toHaveLength(2);
    expect(roots[0].itemContext).toBe('folder');
    expect(roots[1].itemContext).toBe('workflow');

    const jobs = explorer.getChildren(roots[1]);
    expect(jobs).toHaveLength(2);
    expect(jobs[0].label).toBe('Build');
    expect(jobs[1].description).toBe('reusable');
    expect((jobs[1].iconPath as any).id).toBe('references');
  });

  it('shows an empty-state item when the project has no workflows', () => {
    discover.mockReturnValue([]);

    const explorer = new WorkflowExplorer();
    explorer.setProjectRoot('/repo/example');

    const children = explorer.getChildren();

    expect(children).toHaveLength(1);
    expect(children[0].itemContext).toBe('empty');
    expect(children[0].label).toContain('Nenhum workflow');
  });

  it('returns the same tree item and no children for unrelated nodes', () => {
    const explorer = new WorkflowExplorer();
    const item = new WorkflowTreeItem('folder', vscode.TreeItemCollapsibleState.None, 'folder');

    expect(explorer.getTreeItem(item)).toBe(item);
    expect(explorer.getChildren(item)).toEqual([]);
  });
});
