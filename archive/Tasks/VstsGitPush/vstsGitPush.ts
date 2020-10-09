import fs = require('fs');
import path = require('path');
import request = require('request-promise');
import tl = require('vsts-task-lib/task');

tl.setResourcePath(path.join(__dirname, 'task.json'));

function getLastCommit(repoName: string, branchName: string): Promise<string> {
    const tpName = tl.getVariable('System.TeamProject');
    const accessToken = tl.getVariable('System.AccessToken');
    const baseUri = tl.getVariable('System.TeamFoundationCollectionUri');

    branchName = branchName.replace('refs/heads/', '');

    const optionsGetCommit = {
        method: 'GET',
        url: `${baseUri}${tpName}/_apis/git/repositories/${repoName}/commits`,
        qs: {
            'branch': branchName,
            'top': 1,
            'api-version': '3.0-preview'
        },
        headers: {
            'cache-control': 'no-cache',
            'content-type': 'application/json',
            authorization: `Bearer ${accessToken}`
        },
        json: true
    };
    return request(optionsGetCommit).then(body => {
        tl.debug(`Got commits: ${JSON.stringify(body)}`);
        const isBodyString = typeof body === 'string';
        const result = isBodyString ? JSON.parse(body) as { value: { commitId: string }[] } : body;
        const commitIds = result.value.map(i => i.commitId) as string[];
        tl.debug(`Using parsed commit IDs: ${JSON.stringify(commitIds)}`);
        return commitIds[0];
    }).catch(error => { throw `Failed to get commits: ${error}`; });
}

function getRemoteItemsMeta(repoName: string, remotePath: string, branchName: string): Promise<{ path: string, commitId: string }[]> {
    const tpName = tl.getVariable('System.TeamProject');
    const accessToken = tl.getVariable('System.AccessToken');
    const baseUri = tl.getVariable('System.TeamFoundationCollectionUri');

    branchName = branchName.replace('refs/heads/', '');

    const optionsGetRemoteItemsMeta = {
        method: 'GET',
        url: `${baseUri}${tpName}/_apis/git/repositories/${repoName}/items`,
        qs: {
            'version': branchName,
            'scopePath': remotePath,
            'includeContentMetadata': 'true',
            'recursionLevel': 'Full',
            'api-version': '1.0'
        },
        headers: {
            'cache-control': 'no-cache',
            'content-type': 'application/json',
            authorization: `Bearer ${accessToken}`
        },
        json: true
    };
    return request(optionsGetRemoteItemsMeta).then(body => {
        tl.debug(`Got remote paths: ${JSON.stringify(body)}`);
        const isBodyString = typeof body === 'string';
        const result = isBodyString ? JSON.parse(body) as { value: { path: string }[] } : body;
        const remotePaths = result.value.map(i => {
            return {
                path: i.path,
                commitId: i.commitId
            };
        }) as { path: string, commitId: string }[];
        tl.debug(`Using parsed remote paths: ${JSON.stringify(remotePaths)}`);
        return remotePaths;
    }).catch(error => {
        tl.debug(`Failed to get remote paths: ${error}`);
        return [];
    });
}

function makePushRequest(targetBranch: string, message: string, filesToPush: string[],
    baseLocalPath: string, baseRemotePath: string, repoName: string): Promise<any> {

    baseRemotePath = baseRemotePath.indexOf('/') === 0 ? baseRemotePath : `/${baseRemotePath}`;
    targetBranch = targetBranch.indexOf('refs/heads/') === 0 ? targetBranch : `refs/heads/${targetBranch}`;

    return getLastCommit(repoName, targetBranch).then(lastCommitId => {
        return getRemoteItemsMeta(repoName, baseRemotePath, targetBranch).then(remoteFiles => {

            // Remove the folder
            const remoteFolder = remoteFiles.filter(rp => rp.path.toLowerCase() === baseRemotePath.toLowerCase())[0];
            if (remoteFolder) {
                remoteFiles = remoteFiles.filter(rp => rp !== remoteFolder);
            }

            const files = filesToPush.map(filePath => {
                const cleanItemPath = filePath.replace(baseLocalPath, '');
                const remotePath = `${baseRemotePath}${cleanItemPath}`.replace(/\/{2,}|\\{1,}/ig, '/');
                const remoteFile = remoteFiles.filter(rp => rp.path.toLowerCase() === remotePath.toLowerCase())[0];
                tl.debug(`Looking for remote path match '${remotePath}' yielded ${remoteFile ? JSON.stringify(remoteFile) : 'null'}`);
                return {
                    path: remotePath,
                    method: remoteFile ? 'edit' : 'add',
                    content: new Buffer(fs.readFileSync(filePath)).toString('base64')
                };
            });

            tl.debug(`Mapped remote paths to: ${JSON.stringify(files.map(f => {
                return {
                    path: f.path,
                    method: f.method,
                    content: 'base64encoded'
                };
            }))}`);

            return {
                refUpdates: [
                    {
                        name: targetBranch,
                        oldObjectId: lastCommitId
                    }
                ],
                commits: [
                    {
                        comment: message,
                        changes: files.map(f => {
                            return {
                                changeType: f.method,
                                item: {
                                    path: f.path
                                },
                                newContent: {
                                    content: f.content,
                                    contentType: 'base64encoded'
                                }
                            };
                        })
                    }
                ]
            };
        }).catch(error => { throw `Failed to build push request: ${error}`; });
    }).catch(error => { throw `Failed to get last commit: ${error}`; });
}

(() => {
    // Init variables
    const projectRepo = tl.getInput('ProjectRepo', true);
    if (!projectRepo || projectRepo.length === 0) {
        tl.setResult(tl.TaskResult.Failed, tl.loc('NoProjectRepo'));
        return;
    } else { tl.debug(`Using provided project repo: '${projectRepo}'`); }

    const targetBranch = tl.getInput('TargetBranch', true);
    if (!targetBranch || targetBranch.length === 0) {
        tl.setResult(tl.TaskResult.Failed, tl.loc('NoTargetBranch'));
        return;
    } else { tl.debug(`Using provided project repo: '${projectRepo}'`); }

    const commitMessage = tl.getInput('CommitMessage', true);
    if (!commitMessage || commitMessage.length === 0) {
        tl.setResult(tl.TaskResult.Failed, tl.loc('NoCommitMessage'));
        return;
    } else { tl.debug(`Using provided commit message: '${commitMessage}'`); }

    const fileMatchPattern = tl.getInput('FileMatchPattern', true).split('\n');
    if (!commitMessage || commitMessage.length === 0) {
        tl.setResult(tl.TaskResult.Failed, tl.loc('NoFileMatchPattern'));
        return;
    } else { tl.debug(`Using provided file match patterns: '${fileMatchPattern}'`); }

    const targetPath = tl.getInput('TargetPath', true);
    if (!targetPath || targetPath.length === 0) {
        tl.setResult(tl.TaskResult.Failed, tl.loc('NoTargetPath'));
        return;
    } else { tl.debug(`Using provided target path: '${targetPath}'`); }

    const sourcePath = tl.getInput('SourcePath', true);
    if (!sourcePath || sourcePath.length === 0) {
        tl.setResult(tl.TaskResult.Failed, tl.loc('NoSourcePath'));
        return;
    } else { tl.debug(`Using provided source path: '${commitMessage}'`); }

    const accessToken = tl.getVariable('System.AccessToken');
    if (!accessToken || accessToken.length === 0) {
        tl.setResult(tl.TaskResult.Failed, tl.loc('NoAccessToken'));
        return;
    }

    const tpName = tl.getVariable('System.TeamProject');
    const baseUri = tl.getVariable('System.TeamFoundationCollectionUri');

    const matchedFiles = tl.findMatch(sourcePath, fileMatchPattern);
    makePushRequest(targetBranch, commitMessage, matchedFiles, sourcePath, targetPath, projectRepo)
        .then(pushRequest => {
            tl.debug(`Sending push request: ${JSON.stringify(pushRequest)}`);
            const optionsPushFiles = {
                method: 'POST',
                url: `${baseUri}${tpName}/_apis/git/repositories/${projectRepo}/pushes`,
                qs: { 'api-version': '2.0-preview' },
                headers: {
                    'cache-control': 'no-cache',
                    'content-type': 'application/json',
                    authorization: `Bearer ${accessToken}`
                },
                body: pushRequest,
                json: true
            };
            return request(optionsPushFiles).then(body => {
                tl.debug(JSON.stringify(body));
            }).catch(error => { throw `Failed to push the commit: ${error}`; });
        }).catch(error => { throw `Failed to make push request: ${error}`; });
})();
