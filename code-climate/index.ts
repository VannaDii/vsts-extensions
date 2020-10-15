import path from 'path';
import * as tl from 'azure-pipelines-task-lib/task';

import * as commands from './commands';
import { AnalysisFormats, TaskConfig } from './types';

tl.setResourcePath(path.join(__dirname, 'task.json'));
async function run() {
  const command = (tl.getInput('Command', true) as string).toLowerCase();
  const config: TaskConfig = {
    configFilePath: tl.getPathInput('ConfigPath', true, true) as string,
    analysisFormat: tl.getInput('AnalyzeFormat', true) as AnalysisFormats,
    sourcePath: tl.getPathInput('SourcePath', true, true) as string,
    outputPath: tl.getPathInput('OutputPath', true) as string,
    debug: tl.getBoolInput('Debug', true),
    engineTimeout: parseInt(tl.getInput('EngineTimeout', true) as string),
    memLimit: parseInt(tl.getInput('EngineMemLimit', true) as string),
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
