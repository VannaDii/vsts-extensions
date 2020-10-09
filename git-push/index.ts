import fs from 'fs';
import path from 'path';
import axios from 'axios';
import * as tl from 'azure-pipelines-task-lib/task';

tl.setResourcePath(path.join(__dirname, 'task.json'));

async function getLastCommit(repoName: string, branchName: string): Promise<string> {
  const tpName = tl.getVariable('System.TeamProject');
  const accessToken = tl.getVariable('System.AccessToken');
  const baseUri = tl.getVariable('System.TeamFoundationCollectionUri');

  branchName = branchName.replace('refs/heads/', '');

  const url = `${baseUri}${tpName}/_apis/git/repositories/${repoName}/commits`;
  const response = await axios.get(url, {
    params: {
      branch: branchName,
      top: 1,
      'api-version': '3.0-preview',
    },
    headers: {
      'cache-control': 'no-cache',
      'content-type': 'application/json',
      authorization: `Bearer ${accessToken}`,
    },
  });
  if (response.status >= 300) {
    tl.error(`Failed to get commits. Response: ${JSON.stringify(response.data)}`);
    throw new Error(`Failed to get commits: ${response.statusText}`);
  }

  const body = response.data;
  tl.debug(`Got commits: ${JSON.stringify(body)}`);
  const isBodyString = typeof body === 'string';
  const result = isBodyString ? (JSON.parse(body) as { value: { commitId: string }[] }) : body;
  const commitIds = result.value.map((i: any) => i.commitId) as string[];
  tl.debug(`Using parsed commit IDs: ${JSON.stringify(commitIds)}`);
  return commitIds[0];
}

async function getRemoteItemsMeta(
  repoName: string,
  remotePath: string,
  branchName: string
): Promise<{ path: string; commitId: string }[]> {
  const tpName = tl.getVariable('System.TeamProject');
  const accessToken = tl.getVariable('System.AccessToken');
  const baseUri = tl.getVariable('System.TeamFoundationCollectionUri');

  branchName = branchName.replace('refs/heads/', '');

  const url = `${baseUri}${tpName}/_apis/git/repositories/${repoName}/items`;
  const response = await axios.get(url, {
    params: {
      version: branchName,
      scopePath: remotePath,
      includeContentMetadata: 'true',
      recursionLevel: 'Full',
      'api-version': '1.0',
    },
    headers: {
      'cache-control': 'no-cache',
      'content-type': 'application/json',
      authorization: `Bearer ${accessToken}`,
    },
  });

  if (response.status >= 300) {
    tl.error(`Failed to get remote paths. Response: ${JSON.stringify(response.data)}`);
    throw new Error(`Failed to get remote  paths: ${response.statusText}`);
  }

  const body = response.data;
  tl.debug(`Got remote paths: ${JSON.stringify(body)}`);
  const isBodyString = typeof body === 'string';
  const result = isBodyString ? (JSON.parse(body) as { value: { path: string }[] }) : body;
  const remotePaths = result.value.map((i: any) => {
    return {
      path: i.path,
      commitId: i.commitId,
    };
  }) as { path: string; commitId: string }[];
  tl.debug(`Using parsed remote paths: ${JSON.stringify(remotePaths)}`);
  return remotePaths;
}

async function makePushRequest(
  targetBranch: string,
  message: string,
  filesToPush: string[],
  baseLocalPath: string,
  baseRemotePath: string,
  repoName: string
): Promise<any> {
  baseRemotePath = baseRemotePath.indexOf('/') === 0 ? baseRemotePath : `/${baseRemotePath}`;
  targetBranch = targetBranch.indexOf('refs/heads/') === 0 ? targetBranch : `refs/heads/${targetBranch}`;

  const lastCommitId = await getLastCommit(repoName, targetBranch);
  const remoteFilesMeta = await getRemoteItemsMeta(repoName, baseRemotePath, targetBranch);
  const remoteFolder = remoteFilesMeta.filter((rp) => rp.path.toLowerCase() === baseRemotePath.toLowerCase())[0];
  const remoteFiles = !remoteFolder ? remoteFilesMeta : remoteFilesMeta.filter((rp) => rp !== remoteFolder);

  const files = filesToPush.map((filePath) => {
    const cleanItemPath = filePath.replace(baseLocalPath, '');
    const remotePath = `${baseRemotePath}${cleanItemPath}`.replace(/\/{2,}|\\{1,}/gi, '/');
    const remoteFile = remoteFiles.filter((rp) => rp.path.toLowerCase() === remotePath.toLowerCase())[0];
    tl.debug(
      `Looking for remote path match '${remotePath}' yielded ${remoteFile ? JSON.stringify(remoteFile) : 'null'}`
    );
    return {
      path: remotePath,
      method: remoteFile ? 'edit' : 'add',
      content: fs.readFileSync(filePath).toString('base64'),
    };
  });

  tl.debug(
    `Mapped remote paths to: ${JSON.stringify(
      files.map((f) => {
        return {
          path: f.path,
          method: f.method,
          content: 'base64encoded',
        };
      })
    )}`
  );

  return {
    refUpdates: [
      {
        name: targetBranch,
        oldObjectId: lastCommitId,
      },
    ],
    commits: [
      {
        comment: message,
        changes: files.map((f) => {
          return {
            changeType: f.method,
            item: {
              path: f.path,
            },
            newContent: {
              content: f.content,
              contentType: 'base64encoded',
            },
          };
        }),
      },
    ],
  };
}

(async () => {
  // Init variables
  const projectRepo = tl.getInput('ProjectRepo', true);
  if (!projectRepo || projectRepo.length === 0) {
    tl.setResult(tl.TaskResult.Failed, tl.loc('NoProjectRepo'));
    return;
  } else {
    tl.debug(`Using provided project repo: '${projectRepo}'`);
  }

  const targetBranch = tl.getInput('TargetBranch', true);
  if (!targetBranch || targetBranch.length === 0) {
    tl.setResult(tl.TaskResult.Failed, tl.loc('NoTargetBranch'));
    return;
  } else {
    tl.debug(`Using provided project repo: '${projectRepo}'`);
  }

  const commitMessage = tl.getInput('CommitMessage', true);
  if (!commitMessage || commitMessage.length === 0) {
    tl.setResult(tl.TaskResult.Failed, tl.loc('NoCommitMessage'));
    return;
  } else {
    tl.debug(`Using provided commit message: '${commitMessage}'`);
  }

  const fileMatchPattern = (tl.getInput('FileMatchPattern', true) as string).split('\n');
  if (!commitMessage || commitMessage.length === 0) {
    tl.setResult(tl.TaskResult.Failed, tl.loc('NoFileMatchPattern'));
    return;
  } else {
    tl.debug(`Using provided file match patterns: '${fileMatchPattern}'`);
  }

  const targetPath = tl.getInput('TargetPath', true);
  if (!targetPath || targetPath.length === 0) {
    tl.setResult(tl.TaskResult.Failed, tl.loc('NoTargetPath'));
    return;
  } else {
    tl.debug(`Using provided target path: '${targetPath}'`);
  }

  const sourcePath = tl.getInput('SourcePath', true);
  if (!sourcePath || sourcePath.length === 0) {
    tl.setResult(tl.TaskResult.Failed, tl.loc('NoSourcePath'));
    return;
  } else {
    tl.debug(`Using provided source path: '${commitMessage}'`);
  }

  const accessToken = tl.getVariable('System.AccessToken');
  if (!accessToken || accessToken.length === 0) {
    tl.setResult(tl.TaskResult.Failed, tl.loc('NoAccessToken'));
    return;
  }

  const tpName = tl.getVariable('System.TeamProject');
  const baseUri = tl.getVariable('System.TeamFoundationCollectionUri');

  const matchedFiles = tl.findMatch(sourcePath, fileMatchPattern);
  const pushRequest = await makePushRequest(
    targetBranch,
    commitMessage,
    matchedFiles,
    sourcePath,
    targetPath,
    projectRepo
  );

  tl.debug(`Sending push request: ${JSON.stringify(pushRequest)}`);

  const url = `${baseUri}${tpName}/_apis/git/repositories/${projectRepo}/pushes`;
  const response = await axios.post(url, pushRequest, {
    params: { 'api-version': '2.0-preview' },
    headers: {
      'cache-control': 'no-cache',
      'content-type': 'application/json',
      authorization: `Bearer ${accessToken}`,
    },
  });

  if (response.status >= 300) {
    tl.error(`Failed to push commit. Response: ${JSON.stringify(response.data)}`);
    throw new Error(`Failed to push commit: ${response.statusText}`);
  }

  const body = response.data;
  tl.debug(JSON.stringify(body));
})();
