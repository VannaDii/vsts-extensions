/*
 * Copyright 2017 Amazon.com, Inc. and its affiliates. All Rights Reserved.
 *
 * Licensed under the MIT License. See the LICENSE accompanying this file
 * for the specific language governing permissions and limitations under
 * the License.
 */
import tl = require('vsts-task-lib/task');
import sdkutils = require('./sdkutils');

export class TaskParameters extends sdkutils.AWSTaskParametersBase {
  public awsCliCommand: string;
  public awsCliSubCommand: string;
  public awsCliParameters: string;
  public failOnStandardError: boolean;
  public variableName: string;
  public regularExpression: string;
  public regExMatchIndex: number;
  public isOutputParsingEnabled: boolean;
  public workingDirectory: string;
  public isPollingEnabled: boolean;
  public pollingRegularExpression: string;
  public pollingIntervalMinutes: number;
  public pollingMaxAttempts: number;

  constructor() {
    super();
    try {
      this.awsCliCommand = tl.getInput('awsCommand', true);
      this.awsCliSubCommand = tl.getInput('awsSubCommand', true);
      this.awsCliParameters = tl.getInput('awsArguments', false);
      this.failOnStandardError = tl.getBoolInput('failOnStandardError');
      this.workingDirectory = tl.getPathInput('workingDirectory', true);
      this.variableName = tl.getInput('variableName', false);
      this.regularExpression = tl.getInput('regularExpression', false);
      this.regExMatchIndex = parseInt(tl.getInput('regExMatchIndex', false) || '0');
      this.isOutputParsingEnabled =
        this.variableName != null &&
        this.variableName.length > 0 &&
        this.regularExpression != null &&
        this.regularExpression.length > 0;

      // Polling bits
      this.pollingIntervalMinutes = parseInt(tl.getInput('pollingIntervalMinutes', false) || '0');
      this.pollingMaxAttempts = parseInt(tl.getInput('pollingMaxAttempts', false) || '0');
      this.pollingRegularExpression = tl.getInput('pollingRegularExpression', false);
      this.isPollingEnabled =
        this.pollingIntervalMinutes > 0 &&
        this.pollingMaxAttempts > 0 &&
        this.pollingRegularExpression != null &&
        this.pollingRegularExpression.length > 0;
    } catch (error) {
      throw new Error(error.message);
    }
  }
}
