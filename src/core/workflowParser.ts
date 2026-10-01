import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import type {
  WorkflowDefinition,
  JobDefinition,
  StepDefinition,
  WorkflowGraph,
  WorkflowNode,
  WorkflowEdge,
} from '../types/workflow.types';
import { t } from '../i18n/messages';

export class WorkflowParser {
  parse(filePath: string): WorkflowDefinition {
    const content = fs.readFileSync(filePath, 'utf-8');
    const raw = yaml.load(content) as Record<string, unknown>;

    if (!raw || typeof raw !== 'object') {
      throw new Error(t('Invalid YAML in: {0}', filePath));
    }

    const rawJobs = (raw.jobs ?? {}) as Record<string, unknown>;
    const jobs: Record<string, JobDefinition> = {};

    Object.entries(rawJobs).forEach(([jobId, rawJob]) => {
      const job = (rawJob ?? {}) as Record<string, unknown>;
      const rawNeeds = job.needs;
      const needs = Array.isArray(rawNeeds)
        ? (rawNeeds as string[])
        : rawNeeds
        ? [rawNeeds as string]
        : [];

      jobs[jobId] = {
        id: jobId,
        name: job.name as string | undefined,
        'runs-on': job['runs-on'] as string | undefined,
        needs,
        steps: this.parseSteps(job.steps as unknown[]),
        uses: job.uses as string | undefined,
        with: job.with as Record<string, unknown> | undefined,
        secrets: job.secrets as JobDefinition['secrets'],
        if: job.if as string | undefined,
        environment: job.environment as string | undefined,
        'timeout-minutes': job['timeout-minutes'] as number | undefined,
      };
    });

    return {
      name: (raw.name as string) ?? path.basename(filePath, path.extname(filePath)),
      filePath,
      on: raw.on as WorkflowDefinition['on'],
      jobs,
    };
  }

  parseSteps(rawSteps: unknown): StepDefinition[] {
    if (!Array.isArray(rawSteps)) return [];
    return rawSteps.map((s, index) => {
      const step = (s ?? {}) as Record<string, unknown>;
      return {
        id: (step.id as string) ?? `step-${index}`,
        name: step.name as string | undefined,
        uses: step.uses as string | undefined,
        run: step.run as string | undefined,
        with: step.with as Record<string, string> | undefined,
        env: step.env as Record<string, string> | undefined,
        if: step.if as string | undefined,
        'continue-on-error': step['continue-on-error'] as boolean | undefined,
        'timeout-minutes': step['timeout-minutes'] as number | undefined,
      };
    });
  }

  buildGraph(workflow: WorkflowDefinition): WorkflowGraph {
    const nodes: WorkflowNode[] = [];
    const edges: WorkflowEdge[] = [];

    Object.values(workflow.jobs).forEach((job) => {
      nodes.push({ id: job.id, type: 'job', label: job.name ?? job.id, data: job });

      job.steps.forEach((step, index) => {
        const stepId = step.id ?? `step-${index}`;
        nodes.push({
          id: `${job.id}/${stepId}`,
          type: 'step',
          label: step.name ?? step.uses ?? step.run?.split('\n')[0] ?? stepId,
          parentId: job.id,
          data: step,
        });
      });

      (job.needs ?? []).forEach((dep) => {
        edges.push({ id: `${dep}->${job.id}`, source: dep, target: job.id, type: 'needs' });
      });
    });

    return { nodes, edges };
  }

  discoverWorkflows(workspaceRoot: string): string[] {
    const workflowsDir = path.join(workspaceRoot, '.github', 'workflows');
    if (!fs.existsSync(workflowsDir)) return [];
    return fs
      .readdirSync(workflowsDir)
      .filter((f: string) => f.endsWith('.yml') || f.endsWith('.yaml'))
      .map((f: string) => path.join(workflowsDir, f));
  }
}

export const workflowParser = new WorkflowParser();
