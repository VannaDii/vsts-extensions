/*
 * Copyright 2017 Amazon.com, Inc. and its affiliates. All Rights Reserved.
 *
 * Licensed under the MIT License. See the LICENSE accompanying this file
 * for the specific language governing permissions and limitations under
 * the License.
 */
import path = require('path');
import tl = require('vsts-task-lib/task');

import Parameters = require('./helpers/AWSCliTaskParameters');
import Operations = require('./helpers/AWSCliTaskOperations');

tl.setResourcePath(path.join(__dirname, 'task.json'));
process.env.AWS_EXECUTION_ENV = 'VSTS-AWSCLI';

function sleep(ms: number): Promise<void> {
  const start = new Date().getTime();
  let elapsed = new Date().getTime() - start;
  do {
    elapsed = new Date().getTime() - start;
  } while (elapsed < ms);
  return;
}

(async () => {
  const taskParameters = new Parameters.TaskParameters();
  if (Operations.TaskOperations.checkIfAwsCliIsInstalled()) {
    let pollCount: number = 0;
    let pollTestResult: boolean = false;
    const sleepMs = taskParameters.pollingIntervalMinutes * 60000;
    do {
      tl.debug(`Polling iteration: ${pollCount}`);
      if (pollCount > 0) {
        tl.debug(`Waiting for ${sleepMs} ms before polling again.`);
        await sleep(sleepMs);
        tl.debug(`Done waiting, polling now.`);
      }

      const stdout: string = await Operations.TaskOperations.executeCommand(taskParameters);

      if (taskParameters.isPollingEnabled) {
        const expression = new RegExp(taskParameters.pollingRegularExpression, 'i');
        pollTestResult = expression.test(stdout);
      }

      if (taskParameters.isOutputParsingEnabled) {
        const expression = new RegExp(taskParameters.regularExpression, 'i');
        const matches = expression.exec(stdout);
        const parsedValue =
          matches != null && matches.length > taskParameters.regExMatchIndex
            ? matches[taskParameters.regExMatchIndex]
            : '';
        tl.setVariable(taskParameters.variableName, parsedValue, false);
      }

      pollCount++;
    } while (
      taskParameters.isPollingEnabled &&
      pollCount < taskParameters.pollingMaxAttempts &&
      pollTestResult === false
    );
  }
})();
