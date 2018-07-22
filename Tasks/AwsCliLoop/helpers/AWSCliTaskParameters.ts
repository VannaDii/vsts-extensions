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
    public regularExpression: string;
    public regExMatchIndex: number;

    public awsCliLoopCommand: string;
    public awsCliLoopSubCommand: string;
    public awsCliLoopParameters: string;

    public failOnStandardError: boolean;
    public workingDirectory: string;

    constructor() {
        super();
        try {
            // Primary command
            this.awsCliCommand = tl.getInput('awsCommand', true);
            this.awsCliSubCommand = tl.getInput('awsSubCommand', true);
            this.awsCliParameters = tl.getInput('awsArguments', false);
            this.regularExpression = tl.getInput('regularExpression', true);
            this.regExMatchIndex = parseInt(tl.getInput('regExMatchIndex', true));

            // Loop command
            this.awsCliLoopCommand = tl.getInput('awsLoopCommand', true);
            this.awsCliLoopSubCommand = tl.getInput('awsLoopSubCommand', true);
            this.awsCliLoopParameters = tl.getInput('awsLoopArguments', false);

            this.failOnStandardError = tl.getBoolInput('failOnStandardError');
            this.workingDirectory = tl.getPathInput('workingDirectory', true);
        } catch (error) {
            throw new Error(error.message);
        }
    }

    public fromLoopCommand(loopValue: string) : TaskParameters {
        const retVal = new TaskParameters();
        retVal.awsCliCommand = this.awsCliLoopCommand;
        retVal.awsCliSubCommand = this.awsCliLoopSubCommand;
        retVal.awsCliParameters = `${this.awsCliLoopParameters} ${loopValue}`;
        retVal.failOnStandardError = this.failOnStandardError;
        retVal.workingDirectory = this.workingDirectory;

        return retVal;
    }
}