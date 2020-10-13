import path from 'path';
import * as tl from 'azure-pipelines-task-lib/task';

import * as commands from './commands';
import { AnalysisFormats, TaskConfig } from './types';

tl.setResourcePath(path.join(__dirname, 'task.json'));
async function run() {
  const command = (tl.getInput('CcCommand', true) as string).toLowerCase();
  const config: TaskConfig = {
    configFilePath: tl.getPathInput('CcConfigFile', true, true) as string,
    analysisFormat: tl.getInput('CcAnalyzeFormat', true) as AnalysisFormats,
    sourcePath: tl.getPathInput('CcSourcePath', true, true) as string,
    outputPath: tl.getPathInput('CcOutputPath', true) as string,
    debug: tl.getBoolInput('CcDebug', true),
    engineTimeout: parseInt(tl.getInput('CcContainerTimeout', true) as string),
    memLimit: parseInt(tl.getInput('CcContainerMemLimit', true) as string),
  };

  switch (command) {
    case 'install':
      return commands.install(config);
    case 'engines:install':
      return commands.installEngines(config);
    case 'analyze':
      return commands.analyze(config);
    default:
      return tl.setResult(tl.TaskResult.Failed, `Unsupported command '${command}'.`, true);
  }
}
run();
