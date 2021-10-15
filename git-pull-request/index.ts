import path from 'path';
import axios from 'axios';
import * as tl from 'azure-pipelines-task-lib/task';

tl.setResourcePath(path.join(__dirname, 'task.json'));
class Version {
  public major: number = 0;
  public minor: number = 0;
  public build: number = 0;
  public revision: number = 0;
  public name: string = '';

  public static compare(a: Version, b: Version): number {
    if (!a && !b) {
      return 0;
    }
    if (!a) {
      return -1;
    }
    if (!b) {
      return 1;
    }

    if (a.major !== b.major) {
      if (a.major > b.major) {
        return 1;
      }
      return -1;
    }
    if (a.minor !== b.minor) {
      if (a.minor > b.minor) {
        return 1;
      }
      return -1;
    }
    if (a.build !== b.build) {
      if (a.build > b.build) {
        return 1;
      }
      return -1;
    }
    if (a.revision === b.revision) {
      return 0;
    }
    if (a.revision > b.revision) {
      return 1;
    }
    return -1;
  }

  public static parse(value: string, name: string): Version {
    const result: Version = new Version();
    const verPts: string[] = value.split('.,');
    result.major = parseInt(verPts.length >= 1 ? verPts[0] : '0');
    result.minor = parseInt(verPts.length >= 2 ? verPts[1] : '0');
    result.build = parseInt(verPts.length >= 3 ? verPts[2] : '0');
    result.revision = parseInt(verPts.length >= 4 ? verPts[3] : '0');
    result.name = name;
    return result;
  }
}
function cleanBranchName(branchRefName: string): string {
  return branchRefName.replace('refs/', '').replace('heads/', '');
}
async function getTargetBranch(
  baseUri: string,
  tpName: string,
  projectRepo: string,
  accessToken: string
): Promise<string> {
  let targetRefName: string;
  const targetBranchType = (tl.getInput('TargetBranchType', true) as string).toLowerCase();
  if (targetBranchType === 'specific') {
    targetRefName = tl.getInput('TargetBranch', true) as string;
    if (!targetRefName || targetRefName.length === 0) {
      return Promise.reject(tl.loc('NoTargetBranch'));
    } else {
      targetRefName = cleanBranchName(targetRefName);
      tl.debug(`Using provided target branch: '${targetRefName}'`);
      return Promise.resolve(targetRefName);
    }
  } else if (targetBranchType === 'pattern') {
    const targetRefPattern = tl.getInput('TargetBranchPattern', true);
    if (!targetRefPattern || targetRefPattern.length === 0) {
      throw new Error(tl.loc('NoTargetBranch'));
    } else {
      tl.debug(`Using provided target branch pattern: '${targetRefPattern}'`);

      const url = `${baseUri}${tpName}/_apis/git/repositories/${projectRepo}/refs/heads`;
      const response = await axios.get(url, {
        params: { 'api-version': '1.0' },
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
      tl.debug(JSON.stringify(body));
      const isBodyString = typeof body === 'string';
      tl.debug(`Parsing ${typeof body} body: ${body}`);
      const refsHeads = ((isBodyString ? JSON.parse(body) : body) as { value: { name: string }[] }).value;
      tl.debug(`Using repository refs: ${JSON.stringify(refsHeads)}`);
      const refNamePattern = RegExp(targetRefPattern);
      const matches = refsHeads.filter((ref) => refNamePattern.test(ref.name));
      if (!matches || matches.length === 0) {
        throw tl.loc('NoMatchingRefs');
      } else if (matches.length === 1) {
        tl.debug(`Using discovered target branch: ${matches[0].name}`);
        return matches[0].name;
      } else {
        const versions = matches
          .map((ref) => {
            const result = refNamePattern.exec(ref.name);
            const verStr = !!result && result.length >= 2 ? result[1] : ref.name;
            return Version.parse(verStr, ref.name);
          })
          .sort(Version.compare)
          .reverse();
        if (!versions || versions.length === 0) {
          throw tl.loc('NoMatchingRefs');
        } else {
          tl.debug(`Checking discovered branches: ${JSON.stringify(versions)}`);
          tl.debug(`Using discovered target branch: ${versions[0].name}`);
          return versions[0].name;
        }
      }
    }
  } else {
    throw tl.loc('InvalidTargetBranchType');
  }
}
async function getTeamMembers(
  baseUri: string,
  tpName: string,
  projectTeam: string,
  accessToken: string
): Promise<{ id: string }[]> {
  const url = `${baseUri}_apis/projects/${tpName}/teams/${projectTeam}/members`;
  const response = await axios.get(url, {
    params: { 'api-version': '3.0-preview.1' },
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
  tl.debug(JSON.stringify(body));
  const isBodyString = typeof body === 'string';
  tl.debug(`Parsing ${typeof body} body: ${body}`);
  const result = (isBodyString ? JSON.parse(body) : body) as { value: { id: string }[] };
  const teamMembers = result.value;
  tl.debug(`Using team members: ${JSON.stringify(teamMembers)}`);
  return teamMembers;
}
async function makePullRequest(
  baseUri: string,
  tpName: string,
  projectRepo: string,
  accessToken: string,
  sourceRefName: string,
  targetRefName: string,
  pullRequestTitle: string,
  teamMembers: { id: string }[]
): Promise<string> {
  const cleanSourceRefName = cleanBranchName(sourceRefName);
  const cleanTargetRefName = cleanBranchName(targetRefName);
  const pullRequest = {
    sourceRefName: `refs/heads/${cleanSourceRefName}`,
    targetRefName: `refs/heads/${cleanTargetRefName}`,
    title: pullRequestTitle,
    description: `Merges ${cleanSourceRefName} into ${cleanTargetRefName}.`,
    reviewers: teamMembers,
  };
  tl.debug(`Using pull request: ${JSON.stringify(pullRequest)}`);

  const url = `${baseUri}${tpName}/_apis/git/repositories/${projectRepo}/pullrequests`;
  const response = await axios.post<{ url: string }>(url, pullRequest, {
    params: { 'api-version': '3.0' },
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
  tl.debug(JSON.stringify(body));
  console.log(`Created pull request @ ${body.url}`);
  return body.url;
}
(async () => {
  // Init variables
  const projectTeam = tl.getInput('ProjectTeam', true);
  if (!projectTeam || projectTeam.length === 0) {
    tl.setResult(tl.TaskResult.Failed, tl.loc('NoProjectTeam'));
    return;
  } else {
    tl.debug(`Using provided project team: '${projectTeam}'`);
  }

  const pullRequestTitle = tl.getInput('PullRequestTitle', true);
  if (!pullRequestTitle || pullRequestTitle.length === 0) {
    tl.setResult(tl.TaskResult.Failed, tl.loc('NoPullRequestTitle'));
    return;
  } else {
    tl.debug(`Using provided pull request title: '${pullRequestTitle}'`);
  }

  const projectRepo = tl.getInput('ProjectRepo', true);
  if (!projectRepo || projectRepo.length === 0) {
    tl.setResult(tl.TaskResult.Failed, tl.loc('NoProjectRepo'));
    return;
  } else {
    tl.debug(`Using provided project repo: '${projectRepo}'`);
  }

  const accessToken = tl.getVariable('System.AccessToken');
  if (!accessToken || accessToken.length === 0) {
    tl.setResult(tl.TaskResult.Failed, tl.loc('NoAccessToken'));
    return;
  }

  const tpName = tl.getVariable('System.TeamProject') as string;
  const sourceRefName = tl.getVariable('Build.SourceBranch') as string;
  const baseUri = tl.getVariable('System.TeamFoundationCollectionUri') as string;

  try {
    const targetRefName = await getTargetBranch(baseUri, tpName, projectRepo, accessToken);
    tl.debug(`Resolved target branch of: ${targetRefName}`);

    const teamMembers = await getTeamMembers(baseUri, tpName, projectTeam, accessToken);
    const prUrl = await makePullRequest(
      baseUri,
      tpName,
      projectRepo,
      accessToken,
      sourceRefName,
      targetRefName,
      pullRequestTitle,
      teamMembers
    );
    console.log(`Created pull request @ ${prUrl}`);
  } catch (error: any) {
    tl.setResult(tl.TaskResult.Failed, error);
  }
})();
