import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { findMissingLocalReusableJobs } from './reusableWorkflowRefs';
import type { JobDefinition } from '../types/workflow.types';

const job = (id: string, uses: string): JobDefinition => ({ id, uses, steps: [], needs: [] });

describe('findMissingLocalReusableJobs', () => {
  let root: string;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'act-reusable-'));
  });
  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('does not require remote reusable workflows to exist locally', () => {
    const jobs = {
      format: job(
        'format',
        'moyarich/reusable-workflows/.github/workflows/reusable_prettier.yml@main'
      ),
      build: job('build', 'other/repository/.github/workflows/build.yaml@v1'),
    };
    expect(findMissingLocalReusableJobs(jobs, root)).toEqual([]);
  });

  it('accepts existing local reusable workflows and flags missing ones', () => {
    const wf = path.join(root, '.github', 'workflows');
    fs.mkdirSync(wf, { recursive: true });
    fs.writeFileSync(path.join(wf, 'build.yml'), 'name: Build\n');
    const jobs = {
      build: job('build', './.github/workflows/build.yml'),
      missing: job('missing', './.github/workflows/missing.yml'),
      remote: job(
        'remote',
        'moyarich/reusable-workflows/.github/workflows/reusable_prettier.yml@main'
      ),
    };
    expect(findMissingLocalReusableJobs(jobs, root).map(([id]) => id)).toEqual(['missing']);
  });
});
