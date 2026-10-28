import { z } from 'zod';
import type { WorkflowDefinition } from '../types/workflow.types';

const StepSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  uses: z.string().optional(),
  run: z.string().optional(),
  with: z.record(z.unknown()).optional(),
  env: z.record(z.string()).optional(),
  if: z.string().optional(),
  'continue-on-error': z.boolean().optional(),
  'timeout-minutes': z.number().optional(),
});

/** Job normal com steps */
const JobWithStepsSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  'runs-on': z.string(),
  needs: z.array(z.string()).optional(),
  steps: z.array(StepSchema).min(1, 'Job precisa ter ao menos um step'),
  uses: z.undefined().optional(),
  if: z.string().optional(),
  environment: z.string().optional(),
  'timeout-minutes': z.number().optional(),
});

/** Reusable workflow call job (sem steps, com uses no nível do job) */
const ReusableJobSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  'runs-on': z.string().optional(),
  needs: z.array(z.string()).optional(),
  steps: z.array(z.unknown()).optional(),
  uses: z.string().min(1),
  with: z.record(z.unknown()).optional(),
  secrets: z.union([z.literal('inherit'), z.record(z.string())]).optional(),
  if: z.string().optional(),
  environment: z.string().optional(),
  'timeout-minutes': z.number().optional(),
});

const JobSchema = z.union([ReusableJobSchema, JobWithStepsSchema]);

const WorkflowSchema = z.object({
  name: z.string(),
  filePath: z.string(),
  on: z.union([z.string(), z.array(z.string()), z.record(z.unknown())]),
  jobs: z
    .record(JobSchema)
    .refine((jobs: Record<string, unknown>) => Object.keys(jobs).length > 0, {
      message: 'Workflow precisa ter ao menos um job',
    }),
});

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export class WorkflowValidator {
  validate(workflow: WorkflowDefinition): ValidationResult {
    const errors: string[] = [];

    const result = WorkflowSchema.safeParse(workflow);
    if (!result.success) {
      result.error.errors.forEach((e: { path: (string | number)[]; message: string }) => {
        errors.push(`${e.path.join('.')}: ${e.message}`);
      });
    }

    // Validar referências de needs
    const jobIds = new Set(Object.keys(workflow.jobs));
    Object.values(workflow.jobs).forEach((job) => {
      if (!job.uses && !job['runs-on']) {
        errors.push(`Job "${job.id}" precisa declarar runs-on`);
      }

      (job.needs ?? []).forEach((dep) => {
        if (!jobIds.has(dep)) {
          errors.push(`Job "${job.id}" referencia needs "${dep}" que não existe`);
        }
      });
    });

    // Detectar ciclos de dependência
    this.detectCycles(workflow).forEach((cycle) => {
      errors.push(`Dependência circular detectada: ${cycle.join(' → ')}`);
    });

    return { valid: errors.length === 0, errors };
  }

  private detectCycles(workflow: WorkflowDefinition): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const stack = new Set<string>();

    const dfs = (jobId: string, currentPath: string[]): void => {
      if (stack.has(jobId)) {
        const start = currentPath.indexOf(jobId);
        cycles.push([...currentPath.slice(start), jobId]);
        return;
      }
      if (visited.has(jobId)) return;

      visited.add(jobId);
      stack.add(jobId);
      (workflow.jobs[jobId]?.needs ?? []).forEach((dep) => dfs(dep, [...currentPath, jobId]));
      stack.delete(jobId);
    };

    Object.keys(workflow.jobs).forEach((id) => dfs(id, []));
    return cycles;
  }
}

export const workflowValidator = new WorkflowValidator();
