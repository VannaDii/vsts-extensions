import { TaskConfig } from '../types';
import { findCodeClimate } from '../utils';
import * as tl from 'azure-pipelines-task-lib/task';

export async function installEngines(config: TaskConfig) {
  const codeClimate = findCodeClimate();
  if (!codeClimate.exists) {
    return tl.setResult(tl.TaskResult.Failed, 'Code Climate is not installed.', true);
  }
  const result = tl.tool(codeClimate.path).arg('engines:install').execSync();
  if (result.code !== 0) {
    return tl.setResult(
      tl.TaskResult.Failed,
      `Code: ${result.code}\n\nErrors:\n${result.stderr}\n\nOutput:\n${result.stdout}`,
      true
    );
  }
}
