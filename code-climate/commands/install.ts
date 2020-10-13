import { TaskConfig } from '../types';
import { findCodeClimate } from './utils';
import * as tl from 'azure-pipelines-task-lib/task';

export async function install(config: TaskConfig) {
  if (findCodeClimate().exists) {
    return tl.setResult(tl.TaskResult.Succeeded, 'Code Climate is already installed.', true);
  }

  const tarPath = tl.which('tar');
  if (!tarPath || tarPath.length < 0) {
    return tl.setResult(tl.TaskResult.Failed, 'Code Climate install requires `tar`.', true);
  }

  const curlPath = tl.which('curl');
  if (!curlPath || curlPath.length < 0) {
    return tl.setResult(tl.TaskResult.Failed, 'Code Climate install requires `curl`.', true);
  }

  const makePath = tl.which('make');
  if (!makePath || makePath.length < 0) {
    return tl.setResult(tl.TaskResult.Failed, 'Code Climate install requires `make`.', true);
  }

  const curlResult = tl
    .tool(curlPath)
    .arg('-sL')
    .arg('https://github.com/codeclimate/codeclimate/archive/master.tar.gz')
    .pipeExecOutputToTool(tl.tool(tarPath).arg('xvz'))
    .execSync();
  if (curlResult.code !== 0) {
    return tl.setResult(
      tl.TaskResult.Failed,
      `Code: ${curlResult.code}\n\nErrors:\n${curlResult.stderr}\n\nOutput:\n${curlResult.stdout}`,
      true
    );
  }

  const makeResult = tl.tool(makePath).arg('install').execSync();
  if (makeResult.code !== 0) {
    return tl.setResult(
      tl.TaskResult.Failed,
      `Code: ${makeResult.code}\n\nErrors:\n${makeResult.stderr}\n\nOutput:\n${makeResult.stdout}`,
      true
    );
  }
}
