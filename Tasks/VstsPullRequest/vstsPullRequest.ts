import os = require('os');
import path = require('path');
import http = require('http');
import request = require('request-promise');
import tl = require('vsts-task-lib/task');

tl.setResourcePath(path.join(__dirname, 'task.json'));
class Version {
    public major: number = 0;
    public minor: number = 0;
    public build: number = 0;
    public revision: number = 0;
    public name: string = '';

    public static compare(a: Version, b: Version): number {
        if (!a && !b) { return 0; }
        if (!a) { return -1; }
        if (!b) { return 1; }

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
function getTargetBranch(baseUri: string, tpName: string, projectRepo: string, accessToken: string): Promise<string> {
    let targetRefName: string = null;
    const targetBranchType = tl.getInput('TargetBranchType', true).toLowerCase();
    if (targetBranchType === 'specific') {
        targetRefName = tl.getInput('TargetBranch', true);
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
            return Promise.reject(tl.loc('NoTargetBranch'));
        } else {
            tl.debug(`Using provided target branch pattern: '${targetRefPattern}'`);
            const optionsGetRefs = {
                method: 'GET',
                url: `${baseUri}${tpName}/_apis/git/repositories/${projectRepo}/refs/heads`,
                qs: { 'api-version': '1.0' },
                headers: {
                    'cache-control': 'no-cache',
                    'content-type': 'application/json',
                    authorization: `Bearer ${accessToken}`
                },
                json: true
            };
            return request(optionsGetRefs).then(body => {
                tl.debug(JSON.stringify(body));
                const isBodyString = typeof body === 'string';
                tl.debug(`Parsing ${typeof body} body: ${body}`);
                const result = isBodyString ? JSON.parse(body) as { value: { name: string }[] } : body;
                const refsHeads = result.value as { name: string }[];
                tl.debug(`Using repository refs: ${JSON.stringify(refsHeads)}`);
                const refNamePattern = RegExp(targetRefPattern);
                const matches = refsHeads.filter(ref => refNamePattern.test(ref.name));
                if (!matches || matches.length === 0) {
                    throw tl.loc('NoMatchingRefs');
                } else if (matches.length === 1) {
                    tl.debug(`Using discovered target branch: ${matches[0].name}`);
                    return matches[0].name;
                } else {
                    const versions = matches.map(ref => {
                        const result = refNamePattern.exec(ref.name);
                        const verStr = (result != null && result.length >= 2 ? result[1] : null);
                        return Version.parse(verStr, ref.name);
                    }).sort(Version.compare).reverse();
                    if (!versions || versions.length === 0) {
                        throw tl.loc('NoMatchingRefs');
                    } else {
                        tl.debug(`Using discovered target branch: ${versions[0].name}`);
                        return versions[0].name;
                    }
                }
            }).catch(error => { throw `Failed to get repository refs: ${error}`; });
        }
    } else { throw tl.loc('InvalidTargetBranchType'); }
}
function getTeamMembers(baseUri: string, tpName: string, projectTeam: string, accessToken: string): Promise<{ id: string }[]> {
    const optionsGetTeam = {
        method: 'GET',
        url: `${baseUri}_apis/projects/${tpName}/teams/${projectTeam}/members`,
        qs: { 'api-version': '3.0-preview.1' },
        headers: {
            'cache-control': 'no-cache',
            'content-type': 'application/json',
            authorization: `Bearer ${accessToken}`
        },
        json: true
    };
    return request(optionsGetTeam).then(body => {
        tl.debug(JSON.stringify(body));
        const isBodyString = typeof body === 'string';
        tl.debug(`Parsing ${typeof body} body: ${body}`);
        const result = isBodyString ? JSON.parse(body) as { value: { id: string }[] } : body;
        const teamMembers = result.value;
        tl.debug(`Using team members: ${JSON.stringify(teamMembers)}`);
        return teamMembers;
    }).catch(error => { throw `Failed to get team members: ${error}`; });
}
function makePullRequest(baseUri: string, tpName: string, projectRepo: string, accessToken: string,
                         sourceRefName: string, targetRefName: string, pullRequestTitle: string,
                         teamMembers: { id: string }[]): Promise<string> {
    const cleanSourceRefName = cleanBranchName(sourceRefName);
    const cleanTargetRefName = cleanBranchName(targetRefName);
    const pullRequest = {
        sourceRefName: `refs/heads/${cleanSourceRefName}`,
        targetRefName: `refs/heads/${cleanTargetRefName}`,
        title: pullRequestTitle,
        description: `Merges ${cleanSourceRefName} into ${cleanTargetRefName}.`,
        reviewers: teamMembers
    };
    tl.debug(`Using pull request: ${JSON.stringify(pullRequest)}`);

    const optionsPullReq = {
        method: 'POST',
        url: `${baseUri}${tpName}/_apis/git/repositories/${projectRepo}/pullrequests`,
        qs: { 'api-version': '3.0' },
        headers: {
            'cache-control': 'no-cache',
            'content-type': 'application/json',
            authorization: `Bearer ${accessToken}`
        },
        body: pullRequest,
        json: true
    };
    return request(optionsPullReq).then(body => {
        tl.debug(JSON.stringify(body));
        console.log(`Created pull request @ ${body.url}`);
        return body.url;
    }).catch(error => { throw `Failed to make pull request: ${error}`; });
}
(() => {
    // Init variables
    const projectTeam = tl.getInput('ProjectTeam', true);
    if (!projectTeam || projectTeam.length === 0) {
        tl.setResult(tl.TaskResult.Failed, tl.loc('NoProjectTeam'));
        return;
    } else { tl.debug(`Using provided project team: '${projectTeam}'`); }

    const pullRequestTitle = tl.getInput('PullRequestTitle', true);
    if (!pullRequestTitle || pullRequestTitle.length === 0) {
        tl.setResult(tl.TaskResult.Failed, tl.loc('NoPullRequestTitle'));
        return;
    } else { tl.debug(`Using provided pull request title: '${pullRequestTitle}'`); }

    const projectRepo = tl.getInput('ProjectRepo', true);
    if (!projectRepo || projectRepo.length === 0) {
        tl.setResult(tl.TaskResult.Failed, tl.loc('NoProjectRepo'));
        return;
    } else { tl.debug(`Using provided project repo: '${projectRepo}'`); }

    const sourceRefName = tl.getVariable('Build.SourceBranch');
    const accessToken = tl.getVariable('System.AccessToken');
    const tpName = tl.getVariable('System.TeamProject');
    const baseUri = tl.getVariable('System.TeamFoundationCollectionUri');

    getTargetBranch(baseUri, tpName, projectRepo, accessToken).then(targetRefName => {
        tl.debug(`Resolved target branch of: ${targetRefName}`);
        getTeamMembers(baseUri, tpName, projectTeam, accessToken).then(teamMembers => {
            makePullRequest(baseUri, tpName, projectRepo, accessToken, sourceRefName,
                            targetRefName, pullRequestTitle, teamMembers).then(prUrl => {
                console.log(`Created pull request @ ${prUrl}`);
            }).catch(error => { tl.setResult(tl.TaskResult.Failed, error); });
        }).catch(error => { tl.setResult(tl.TaskResult.Failed, error); });
    }).catch(error => { tl.setResult(tl.TaskResult.Failed, error); });
})();
