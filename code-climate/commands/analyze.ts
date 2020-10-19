import fs from 'fs';
import path from 'path';
import { TaskConfig } from '../types';
import { findCodeClimate } from './utils';
import * as lineReader from 'line-reader';
import * as tl from 'azure-pipelines-task-lib/task';
import { IExecSyncOptions } from 'azure-pipelines-task-lib/toolrunner';

export async function analyze(config: TaskConfig) {
  const codeClimate = findCodeClimate();
  if (!codeClimate.exists) {
    return tl.setResult(tl.TaskResult.Failed, 'Code Climate is not installed.', true);
  }
  tl.mkdirP(path.dirname(config.outputPath));

  const tempFilePath = `${config.outputPath}.tmp`;

  const defaultTimeout = 900;
  const defaultMemory = 1024000000;
  const outputStream = fs.createWriteStream(tempFilePath, { encoding: 'utf8', autoClose: true });
  const relativeSourcePath = path.join('.', path.relative(config.configFilePath, config.sourcePath));
  const execOptions: IExecSyncOptions = {
    cwd: config.configFilePath,
    outStream: outputStream,
    env: {
      CODECLIMATE_DEBUG: config.debug ? '1' : undefined,
      CONTAINER_TIMEOUT_SECONDS: config.engineTimeout !== defaultTimeout ? config.engineTimeout.toString() : undefined,
      ENGINE_MEMORY_LIMIT_BYTES: config.memLimit !== defaultMemory ? config.memLimit.toString() : undefined,
    },
  };
  const result = tl
    .tool(codeClimate.path)
    .arg('analyze')
    .arg('-f')
    .arg(config.analysisFormat)
    .arg(relativeSourcePath)
    .execSync(execOptions);

  let lineIndex = 0;
  const tempFileStream = fs.createReadStream(tempFilePath, { encoding: 'utf8' });
  const finalStream = fs.createWriteStream(config.outputPath, { encoding: 'utf8', autoClose: true });
  lineReader.eachLine(tempFileStream, (line) => {
    if (lineIndex === 0) return;
    finalStream.write(`${line}\n`);
    lineIndex++;
  });
  finalStream.close();
  tempFileStream.close();
  fs.unlinkSync(tempFilePath);

  if (result.code !== 0) {
    return tl.setResult(
      tl.TaskResult.Failed,
      `Code: ${result.code}\n\nErrors:\n${result.stderr}\n\nOutput:\n${result.stdout}`,
      true
    );
  }
}
