import os = require('os');
import path = require('path');
import tl = require('vsts-task-lib/task');
import trm = require('vsts-task-lib/toolrunner');

tl.setResourcePath(path.join(__dirname, 'task.json'));
(() => {
    // Init variables
    let gitAuth: tl.EndpointAuthorization = null;
    const gitServiceName: string = tl.getInput('GitServiceName', true);
    if (!gitServiceName || gitServiceName.length === 0) {
        tl.setResult(tl.TaskResult.Failed, tl.loc('NoGitServiceNameProvided'));
        return;
    } else {
        tl.debug(`Using provided git service: '${gitServiceName}'`);
        gitAuth = tl.getEndpointAuthorization(gitServiceName, false);
        tl.debug(`Git Auth: ${JSON.stringify(gitAuth)}`);
    }

    let primaryBranchName: string = tl.getInput('PrimaryBranch', true);
    if (!primaryBranchName || primaryBranchName.length === 0) {
        tl.setResult(tl.TaskResult.Failed, tl.loc('NoPrimaryBranchProvided'));
        return;
    } else {
        primaryBranchName = primaryBranchName.replace('refs/', '').replace('heads/', '');
        tl.debug(`Using provided primary branch: '${primaryBranchName}'`);
    }

    let secondaryBranchName: string = tl.getInput('SecondaryBranch', true);
    if (!secondaryBranchName || secondaryBranchName.length === 0) {
        tl.setResult(tl.TaskResult.Failed, tl.loc('NoSecondaryBranchProvided'));
        return;
    } else {
        secondaryBranchName = secondaryBranchName.replace('refs/', '').replace('heads/', '');
        tl.debug(`Using provided secondary branch: '${secondaryBranchName}'`);
    }

    const isIgnoreMergesEnabled: boolean = tl.getBoolInput('IsIgnoreMergesEnabled', true);
    tl.debug(`Merge commits will${(isIgnoreMergesEnabled ? '' : ' not')} be ignored.`);

    const actionOnDiff: string = tl.getInput('ActionOnDiff', true).toLocaleLowerCase();
    tl.debug(`Build will ${actionOnDiff} if ${primaryBranchName}` +
        ` contains commits not found on ${secondaryBranchName}.`);

    // Need options for what to do with differences
    // Log differences?
    // Fail if differences exist?
    // Create variables?
    // Something else?

    const gitExe = tl.which('git', false);
    const gitLog: trm.ToolRunner = tl.tool(gitExe);
    const gitArgs: string[] = ['log', `${secondaryBranchName}..${primaryBranchName}`, '--format=oneline', '--abbrev-commit'];
    if (isIgnoreMergesEnabled === true) {
        gitArgs.push('--no-merges');
    }
    gitLog.arg(gitArgs);

    const differences: { hash: string, description: string }[] = [];
    const result = gitLog.execSync();
    const stdOutLines = result.stdout.split('\n');

    stdOutLines.forEach(line => {
        line = !!line ? line.trim() : '';
        if (line.length > 0) {
            const parts = line.split(' ');
            const hash = parts.shift();
            const desc = parts.join(' ');
            differences.push({ hash: hash, description: desc });
        }
    });

    if (differences && differences.length > 0) {
        const result: tl.TaskResult = actionOnDiff === 'warn' ? tl.TaskResult.SucceededWithIssues : tl.TaskResult.Failed;
        tl.setResult(result, `The '${primaryBranchName}' branch contains changes` +
            ` which are not present on '${secondaryBranchName}' branch.`);
    }
})();
