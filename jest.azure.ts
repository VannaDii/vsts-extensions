import fs from 'fs';
import path from 'path';
import * as tmrm from 'azure-pipelines-task-lib/mock-run';

export type NamedValues = { [name: string]: string };

export function setMockRunnerInputs(runner: tmrm.TaskMockRunner, pairs: NamedValues = {}): tmrm.TaskMockRunner {
  const taskFolder = path.dirname(runner._taskPath);
  const taskDefPath = path.join(taskFolder, 'task.json');
  const taskJson = JSON.parse(fs.readFileSync(taskDefPath).toString());
  taskJson.inputs.forEach((input: any) => {
    const override = pairs[input.name];
    if (override) Reflect.deleteProperty(pairs, input.name);
    setVariableInput(runner, input.name, override || input.defaultValue);
  });
  Object.keys(pairs).forEach((name) => setVariableInput(runner, name, pairs[name]));
  return runner;
}

function setVariableInput(runner: tmrm.TaskMockRunner, name: string, value: string) {
  const envVarName = name.replace(/\./g, '_').replace(/ /g, '_').toUpperCase();
  runner.setInput(name, value);
  runner.setVariableName(name, value);
  process.env[envVarName] = value;
}