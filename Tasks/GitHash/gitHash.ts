import path = require('path');
import tl = require('vsts-task-lib/task');
import tr = require('vsts-task-lib/toolrunner');

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

  const hashLength = parseInt(tl.getInput('HashLength', true));

  const gitPath = tl.which('git');
  const git: tr.ToolRunner = tl.tool(gitPath).arg(['rev-parse', 'HEAD']);
  const result = git.execSync();
  if (!result || !!result.error || !!result.stdout) {
    const error = result.error || new Error('Unknown error');
    tl.setResult(tl.TaskResult.Failed, `Git rev-parse failed!\n${error.name}: ${error.message}\n${error.stack}`);
  }

  const finalHash = result.stdout.slice(0, hashLength);
  tl.setVariable(variableName, finalHash, false);
})();
