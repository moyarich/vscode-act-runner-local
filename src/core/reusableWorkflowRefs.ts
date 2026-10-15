import * as fs from 'fs';
import * as path from 'path';
import type { JobDefinition } from '../types/workflow.types';

/**
 * Remote reusable workflows are resolved by act, not from the caller's filesystem.
 * Only "./..." references are relative to the calling repository.
 */
export function findMissingLocalReusableJobs(
  jobs: Record<string, JobDefinition>,
  workspaceRoot: string
): Array<[string, JobDefinition]> {
  return Object.entries(jobs).filter(([, job]) => {
    if (!job.uses?.startsWith('./')) return false;
    return !fs.existsSync(path.join(workspaceRoot, job.uses.slice(2)));
  });
}
