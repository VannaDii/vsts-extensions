import path from 'path';
import { execSync } from 'child_process';
import { setMockRunnerInputs } from '../../jest.azure';
import * as tmrm from 'azure-pipelines-task-lib/mock-run';

const gitPath = execSync(`which git`).toString().trim();

const taskPath = path.join(__dirname, '../index.ts');
const tmr = new tmrm.TaskMockRunner(taskPath);
setMockRunnerInputs(tmr).setAnswers({
  which: { git: gitPath },
  checkPath: { [gitPath]: true },
  exec: {
    [`${gitPath} rev-parse HEAD`]: {
      code: 0,
      stdout: '3e607e73b918617896ac4adccf1ef2c298fa5f69\n',
      stderr: ''
    },
  },
});
tmr.run();
