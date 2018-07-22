/*
  * Copyright 2017 Amazon.com, Inc. and its affiliates. All Rights Reserved.
  *
  * Licensed under the MIT License. See the LICENSE accompanying this file
  * for the specific language governing permissions and limitations under
  * the License.
  */

import tl = require('vsts-task-lib/task');
import path = require('path');

import Parameters = require('./helpers/AWSCliTaskParameters');
import Operations = require('./helpers/AWSCliTaskOperations');

tl.setResourcePath(path.join(__dirname, 'task.json'));
process.env.AWS_EXECUTION_ENV = 'VSTS-AWSCLI';

function sleep(ms: number): Promise<void> {
  const start = new Date().getTime();
  let elapsed = (new Date().getTime() - start);
  do {
    elapsed = (new Date().getTime() - start);
  } while (elapsed < ms);
  return;
}

(async () => {
  const taskParameters = new Parameters.TaskParameters();
  if (Operations.TaskOperations.checkIfAwsCliIsInstalled()) {

    const stdout: string = await Operations.TaskOperations.executeCommand(taskParameters);
    const expression = new RegExp(taskParameters.regularExpression, 'igm');
    const matchIndex = taskParameters.regExMatchIndex;
    const allMatches = [];

    do {
      const matches = expression.exec(stdout);
      if (!matches || matches.length === 0) {
        break;
      }
      if (matches.length > matchIndex) {
        const values = matchIndex > 0 ? matches.slice(matchIndex) : matches;
        for (const value of values) {
          if (allMatches.indexOf(value) < 0) {
            allMatches.push(value);
            await Operations.TaskOperations.executeCommand(taskParameters.fromLoopCommand(value));
          }
        }
      }
    } while (true);
  }
})();
