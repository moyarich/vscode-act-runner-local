import * as fs from 'fs';
import * as os from 'os';
import path from 'path';
import { workflowParser } from '../core/workflowParser';

const FIXTURES = path.resolve(__dirname, '../__fixtures__');

describe('WorkflowParser', () => {
  describe('parse()', () => {
    it('deve parsear um workflow simples', async () => {
      const wf = await workflowParser.parse(path.join(FIXTURES, 'workflow-simple.yml'));

      expect(wf.name).toBe('CI Node.js');
      expect(wf.jobs).toBeDefined();
      expect(Object.keys(wf.jobs)).toContain('build');
      expect(wf.jobs['build']['runs-on']).toBe('ubuntu-latest');
    });

    it('deve parsear um workflow multi-job', async () => {
      const wf = await workflowParser.parse(path.join(FIXTURES, 'workflow-multi-job.yml'));

      expect(Object.keys(wf.jobs)).toEqual(['lint', 'test', 'build']);
      expect(wf.jobs['test'].needs).toContain('lint');
      expect(wf.jobs['build'].needs).toContain('lint');
      expect(wf.jobs['build'].needs).toContain('test');
    });

    it('deve lançar erro para arquivo inexistente', async () => {
      expect(() => workflowParser.parse('/nao/existe.yml')).toThrow();
    });

    it('uses the file name when workflow name is omitted and supports scalar needs', () => {
      const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workflow-parser-'));
      const file = path.join(root, 'release.yml');
      fs.writeFileSync(file, [
        'on: push',
        'jobs:',
        '  build:',
        '    runs-on: ubuntu-latest',
        '    steps: []',
        '  deploy:',
        '    needs: build',
        '    runs-on: ubuntu-latest',
      ].join('\n'));

      try {
        const wf = workflowParser.parse(file);
        expect(wf.name).toBe('release');
        expect(wf.jobs.deploy.needs).toEqual(['build']);
      } finally {
        fs.rmSync(root, { recursive: true, force: true });
      }
    });

    it('rejects YAML documents that are not objects', () => {
      const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workflow-parser-'));
      const file = path.join(root, 'invalid.yml');
      fs.writeFileSync(file, 'plain scalar document\n');

      try {
        expect(() => workflowParser.parse(file)).toThrow(/Invalid YAML/i);
      } finally {
        fs.rmSync(root, { recursive: true, force: true });
      }
    });

    it('parses optional step metadata and ignores non-array steps', () => {
      expect(workflowParser.parseSteps(undefined as any)).toEqual([]);

      const [step] = workflowParser.parseSteps([{
        name: 'Deploy',
        uses: 'actions/example@v1',
        with: { target: 'prod' },
        env: { TOKEN: 'value' },
        if: 'success()',
        'continue-on-error': true,
        'timeout-minutes': 10,
      }]);

      expect(step).toEqual(expect.objectContaining({
        id: 'step-0',
        name: 'Deploy',
        uses: 'actions/example@v1',
        with: { target: 'prod' },
        env: { TOKEN: 'value' },
        if: 'success()',
        'continue-on-error': true,
        'timeout-minutes': 10,
      }));
    });

    it('discovers only yml and yaml workflow files', () => {
      const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workflow-discovery-'));
      const dir = path.join(root, '.github', 'workflows');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'ci.yml'), 'name: ci');
      fs.writeFileSync(path.join(dir, 'release.yaml'), 'name: release');
      fs.writeFileSync(path.join(dir, 'notes.txt'), 'ignore');

      try {
        expect(workflowParser.discoverWorkflows(root).map((p) => path.basename(p)).sort())
          .toEqual(['ci.yml', 'release.yaml']);
      } finally {
        fs.rmSync(root, { recursive: true, force: true });
      }
    });

    it('returns no workflows when the workflow directory does not exist', () => {
      const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workflow-discovery-'));
      try {
        expect(workflowParser.discoverWorkflows(root)).toEqual([]);
      } finally {
        fs.rmSync(root, { recursive: true, force: true });
      }
    });

  });

  describe('buildGraph()', () => {
    it('deve construir nós e arestas a partir do workflow', async () => {
      const wf = await workflowParser.parse(path.join(FIXTURES, 'workflow-multi-job.yml'));
      const graph = workflowParser.buildGraph(wf);

      // 3 job nodes + step nodes
      const jobNodes = graph.nodes.filter((n) => n.type === 'job');
      expect(jobNodes).toHaveLength(3);

      // lint → test, lint → build, test → build
      expect(graph.edges.length).toBeGreaterThanOrEqual(3);
      expect(graph.edges.some((e) => e.source === 'lint' && e.target === 'test')).toBe(true);
      expect(graph.edges.some((e) => e.source === 'test' && e.target === 'build')).toBe(true);
    });

    it('chooses meaningful step labels from name, uses, run, then id', () => {
      const workflow = {
        name: 'Labels',
        filePath: '/repo/.github/workflows/labels.yml',
        on: {},
        jobs: {
          build: {
            id: 'build',
            name: undefined,
            needs: [],
            steps: [
              { id: 'named', name: 'Named step' },
              { id: 'uses', uses: 'actions/checkout@v4' },
              { id: 'run', run: 'npm test\necho done' },
              { id: 'fallback' },
            ],
          },
        },
      } as any;

      const graph = workflowParser.buildGraph(workflow);
      const labels = graph.nodes.filter((n) => n.type === 'step').map((n) => n.label);

      expect(labels).toEqual(['Named step', 'actions/checkout@v4', 'npm test', 'fallback']);
    });

  });
});
