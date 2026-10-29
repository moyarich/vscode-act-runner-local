// Tipos do domínio de Workflow — GitHub Actions YAML

export type WorkflowTrigger = string | string[] | Record<string, unknown>;

export interface StepDefinition {
  id?: string;
  name?: string;
  uses?: string;
  run?: string;
  with?: Record<string, string>;
  env?: Record<string, string>;
  if?: string;
  'continue-on-error'?: boolean;
  'timeout-minutes'?: number;
}

export interface JobDefinition {
  id: string;
  name?: string;
  /** Presente em jobs normais */
  'runs-on'?: string;
  needs?: string[];
  /** Steps de um job normal */
  steps: StepDefinition[];
  /** Reusable workflow call: uses: ./.github/workflows/foo.yml */
  uses?: string;
  with?: Record<string, unknown>;
  secrets?: 'inherit' | Record<string, string>;
  if?: string;
  environment?: string;
  'timeout-minutes'?: number;
}

export interface WorkflowDefinition {
  name: string;
  filePath: string;
  on: WorkflowTrigger;
  jobs: Record<string, JobDefinition>;
}

export interface WorkflowNode {
  id: string;
  type: 'job' | 'step';
  label: string;
  parentId?: string;
  data: JobDefinition | StepDefinition;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  type: 'needs';
}

export interface WorkflowGraph {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}
