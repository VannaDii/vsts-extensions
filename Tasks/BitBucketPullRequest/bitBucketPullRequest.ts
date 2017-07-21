import os = require('os');
import path = require('path');
import http = require('http');
import request = require('request');
import tl = require('vsts-task-lib/task');

tl.setResourcePath(path.join(__dirname, 'task.json'));
(() => {
    // Init variables
    const bitbucketUsername = tl.getInput('BitBucketUsername', true);
    if (!bitbucketUsername || bitbucketUsername.length === 0) {
        tl.setResult(tl.TaskResult.Failed, tl.loc('NoUsername'));
        return;
    } else { tl.debug(`Using provided repository username: '${bitbucketUsername}'`); }

    const bitbucketPassword = tl.getInput('BitBucketPassword', true);
    if (!bitbucketPassword || bitbucketPassword.length === 0) {
        tl.setResult(tl.TaskResult.Failed, tl.loc('NoPassword'));
        return;
    } else { tl.debug(`Using provided repository password: '********'`); }

    const repositoryOwner = tl.getInput('RepositoryOwner', true);
    if (!repositoryOwner || repositoryOwner.length === 0) {
        tl.setResult(tl.TaskResult.Failed, tl.loc('NoRepoOwner'));
        return;
    } else { tl.debug(`Using provided repository owner: '${repositoryOwner}'`); }

    const repositoryName = tl.getInput('RepositoryName', true);
    if (!repositoryName || repositoryName.length === 0) {
        tl.setResult(tl.TaskResult.Failed, tl.loc('NoRepoName'));
        return;
    } else { tl.debug(`Using provided repository name: '${repositoryName}'`); }

    let sourceBranchName = tl.getInput('SourceBranchName', true);
    if (!sourceBranchName || sourceBranchName.length === 0) {
        tl.setResult(tl.TaskResult.Failed, tl.loc('NoSourceBranch'));
        return;
    } else {
        sourceBranchName = sourceBranchName.replace('refs/heads/', '');
        tl.debug(`Using provided source branch: '${sourceBranchName}'`);
    }

    const targetBranchName = tl.getInput('TargetBranchName', true);
    if (!targetBranchName || targetBranchName.length === 0) {
        tl.setResult(tl.TaskResult.Failed, tl.loc('NoTargetBranch'));
        return;
    } else { tl.debug(`Using provided target branch: '${targetBranchName}'`); }

    const pullRequestTitle = tl.getInput('PullRequestTitle', true);
    if (!pullRequestTitle || pullRequestTitle.length === 0) {
        tl.setResult(tl.TaskResult.Failed, tl.loc('NoPullRequestTitle'));
        return;
    } else { tl.debug(`Using pull request title: '${pullRequestTitle}'`); }

    const reviewerUsers: object[] = [];
    const reviewerUserNamesString = tl.getInput('ReviewerNames', false);
    if (reviewerUserNamesString && reviewerUserNamesString.length > 0) {
        reviewerUserNamesString.split(',').forEach((v) => {
            reviewerUsers.push({ 'username': v.trim() });
        });
        tl.debug(`Using reviewers: '${JSON.stringify(reviewerUsers)}'`);
    }

    const closeSourceBranch = tl.getBoolInput('IsCloseSourceBranchEnabled', false);
    tl.debug(`Source branch will${(closeSourceBranch ? '' : ' not')} be closed after it's merged.`);

    const showRawResponse = tl.getBoolInput('IsShowRawResponseEnabled', false);
    tl.debug(`Raw response will${(closeSourceBranch ? '' : ' not')} be shown in output.`);

    // Setup the pull request object
    const pullRequest = {
        destination: {
            branch: {
                name: targetBranchName
            }
        },
        source: {
            branch: {
                name: sourceBranchName
            }
        },
        title: pullRequestTitle,
        close_source_branch: closeSourceBranch,
        reviewers: reviewerUsers
    };

    // Make HTTP POST request to create pull request.
    const basicAuthToken = new Buffer(`${bitbucketUsername}:${bitbucketPassword}`).toString('base64');
    const options = {
        method: 'POST',
        url: `https://api.bitbucket.org/2.0/repositories/${repositoryOwner}/${repositoryName}/pullrequests/`,
        headers: {
            'cache-control': 'no-cache',
            authorization: `Basic ${basicAuthToken}`,
            'content-type': 'application/json'
        },
        body: pullRequest,
        json: true
    };

    request(options, function (error: any, response: http.IncomingMessage, body: any) {
        if (showRawResponse) {
            console.log(JSON.stringify(response));
        }
        if (error) {
            tl.setResult(tl.TaskResult.Failed, response.statusMessage);
        } else if (body && body.type && body.type === 'error' && body.error && body.error.message) {
            tl.setResult(tl.TaskResult.Failed, `Pull Request failed: ${body.error.message}`);
        }
        tl.debug(JSON.stringify(body));
    });
})();
