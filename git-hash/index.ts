import fs from 'fs';
import path from 'path';
import * as tl from 'azure-pipelines-task-lib/task';
import * as tr from 'azure-pipelines-task-lib/toolrunner';

function readFallbackFromFile(size: number) {
  const filePath = tl.getPathInput('FallbackFile', true, true) as string;
  const wanted = size * 3; // Reading N*3 bytes accounts for character size
  const buffer = Buffer.alloc(wanted);
  const handle = fs.openSync(filePath, 'r');
  const count = fs.readSync(handle, buffer, 0, wanted, 0);
  const data = buffer.slice(0, Math.max(wanted, count)).toString();
  fs.closeSync(handle);
  return data.slice(0, size + 1);
}

tl.setResourcePath(path.join(__dirname, 'task.json'));
(() => {
  const isGitInstalled = !!tl.which('git', true);
  if (!isGitInstalled) {
    tl.setResult(tl.TaskResult.Failed, tl.loc('NoGit'));
  }

  const variableName = tl.getInput('VariableName', true);
  if (!variableName || variableName.length === 0) {
    tl.setResult(tl.TaskResult.Failed, tl.loc('NoVariableName'));
    return;
  } else {
    tl.debug(`Using provided variable name: '${variableName}'`);
  }

  const useFallback = tl.getBoolInput('UseFallback', true);
  const fallbackType = tl.getInput('FallbackType', true);
  const fallbackValue = tl.getInput('FallbackValue', false);
  const hashLength = parseInt(tl.getInput('HashLength', true) as string);

  let fullHash!: string;
  const gitPath = tl.which('git');
  const git: tr.ToolRunner = tl.tool(gitPath).arg(['rev-parse', 'HEAD']);
  const result = git.execSync();

  const hasGitError = !result || !!result.error || !result.stdout;
  if (!hasGitError) {
    fullHash = result.stdout;
  } else if (useFallback) {
    const useValue = 'Value' === fallbackType;
    fullHash = useValue && !!fallbackValue  ? fallbackValue : readFallbackFromFile(hashLength);
  } else {
    const error = result.error || new Error('Unknown error');
    tl.setResult(tl.TaskResult.Failed, `Git rev-parse failed!\n${error.name}: ${error.message}\n${error.stack}`);
    return;
  }

  const finalHash = fullHash.slice(0, hashLength);
  tl.setVariable(variableName, finalHash, false);
})();
