import path from 'path';
import axios, { pushResponse } from '../../__mocks__/axios';
import { setMockRunnerInputs } from '../../jest.azure';
import * as tmrm from 'azure-pipelines-task-lib/mock-run';

const taskPath = path.join(__dirname, '../index.ts');
const tmr = new tmrm.TaskMockRunner(taskPath);

pushResponse({ status: 200 });
tmr.registerMock('axios', axios);

setMockRunnerInputs(tmr, {
  'Release.EnvironmentName': 'test',
  'Agent.JobStatus': 'succeeded',
  'Build.SourceVersion': '2ec09c17ba0a863c1f814619a95285d573c21245',
  DiscordChannelId: 'test_channel_id',
  DiscordWebhookKey: 'test_webhook_key',
  DiscordCustomMessage:
    '{ "content": "test discord message $(GitShaShort) $(DiscordJobStatus) $(DiscordTimeStamp) $(DiscordStatusColor)" }',
}).run();
