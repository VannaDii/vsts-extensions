import path from 'path';
import { TaskMockRunner } from 'azure-pipelines-task-lib/mock-run';

const taskPath = path.join(__dirname, '../index.ts');
const tmr = new TaskMockRunner(taskPath);
tmr.setAnswers({
  which: { git: (undefined as unknown) as string },
});
tmr.run();
