import os = require('os');
import path = require('path');
import http = require('http');
import request = require('request-promise');
import tl = require('vsts-task-lib/task');

tl.setResourcePath(path.join(__dirname, 'task.json'));

class BuildDetails {
    public buildId: number = 0;
    public buildStatus: string = null;
    public downloadUrl: string = null;

    public static create(buildId: number, buildStatus: string) : BuildDetails {
        const retVal = new BuildDetails();
        retVal.buildId = buildId;
        retVal.buildStatus = buildStatus;
        return retVal;
    }

    public update(buildStatus: string, downloadUrl: string) : BuildDetails {
        this.buildStatus = buildStatus;
        this.downloadUrl = downloadUrl;
        return this;
    }
}

function sleep(ms: number) {
    const start = new Date().getTime();
    for (let i = 0; i < 1e7; i++) {
        if ((new Date().getTime() - start) > ms) {
            break;
        }
    }
}

function makeBuildRequest(baseUri: string, apiKey: string, sourceVersion: string): Promise<BuildDetails> {
    const buildRequest = {
        clean: true,
        delay: 0,
        commit: sourceVersion
    };
    tl.debug(`Using build request: ${JSON.stringify(buildRequest)}`);

    const optionsBuildRequest = {
        method: 'POST',
        url: `${baseUri}/builds`,
        headers: {
            'cache-control': 'no-cache',
            'content-type': 'application/json',
            authorization: `Basic ${apiKey}`
        },
        body: buildRequest,
        json: true
    };
    return request(optionsBuildRequest).then(body => {
        tl.debug(JSON.stringify(body));
        if (body.error) {
            throw body.error;
        } else {
            console.log(`Created build with id: ${body.build}`);
            return BuildDetails.create(body.buildId, body.buildStatus);
        }
    }).catch(error => { throw `Failed to make build request: ${error}`; });
}

function getBuildStatus(baseUri: string, apiKey: string, buildDetail: BuildDetails): Promise<BuildDetails> {
    const statusRequest = {
        method: 'GET',
        url: `${baseUri}/builds/${buildDetail.buildId}`,
        headers: {
            'cache-control': 'no-cache',
            'content-type': 'application/json',
            authorization: `Basic ${apiKey}`
        },
        json: true
    };
    return request(statusRequest).then(body => {
        tl.debug(JSON.stringify(body));
        if (body.error) {
            throw body.error;
        } else {
            console.log(`Found status for build with id: ${body.build}`);
            if (body.download_primary) {
                return buildDetail.update(body.buildStatus, body.download_primary.href);
            } else {
                return buildDetail.update(body.buildStatus, null);
            }
        }
    }).catch(error => { throw `Failed to find build status: ${error}`; });
}

(() => {
    // Init variables
    const apiKey = tl.getInput('ApiKey', true);
    if (!apiKey || apiKey.length === 0) {
        tl.setResult(tl.TaskResult.Failed, tl.loc('NoApiKey'));
        return;
    } else { tl.debug(`Using provided API key: '${apiKey}'`); }

    const orgName = tl.getInput('OrgName', true);
    if (!orgName || orgName.length === 0) {
        tl.setResult(tl.TaskResult.Failed, tl.loc('NoOrgName'));
        return;
    } else { tl.debug(`Using provided Org Name: '${orgName}'`); }

    const projName = tl.getInput('ProjName', true);
    if (!projName || projName.length === 0) {
        tl.setResult(tl.TaskResult.Failed, tl.loc('NoProjName'));
        return;
    } else { tl.debug(`Using provided project name: '${projName}'`); }

    const targetName = tl.getInput('TargetName', true);
    if (!targetName || targetName.length === 0) {
        tl.setResult(tl.TaskResult.Failed, tl.loc('NoTargetName'));
        return;
    } else { tl.debug(`Using provided target name: '${targetName}'`); }

    const sourceRefName = tl.getVariable('Build.SourceBranch');
    const sourceVersion = tl.getVariable('Build.SourceVersion');

    const sleepSeconds = 60;
    let unityBuildDetail: BuildDetails = null;
    const unityWaitStatuses = ['success', 'failure', 'canceled'];
    const unityCloudBuildUrl = `https://build-api.cloud.unity3d.com/api/v1/orgs/${orgName}/projects/${projName}/buildtargets/${targetName}`;

    makeBuildRequest(unityCloudBuildUrl, apiKey, sourceVersion).then(detail => {
        unityBuildDetail = detail;
    }).catch(error => { tl.setResult(tl.TaskResult.Failed, error); });

    while (unityBuildDetail == null || unityWaitStatuses.indexOf(unityBuildDetail.buildStatus) < 0) {
        console.log(`Build status is ${unityBuildDetail.buildStatus}, sleeping for ${sleepSeconds} before checking again.`);
        sleep(sleepSeconds * 1000); // Sleep for 1 minute / 60 seconds

        let shouldBreak = false;
        getBuildStatus(unityCloudBuildUrl, apiKey, unityBuildDetail).then(updated => {
            unityBuildDetail = updated;
        }).catch(error => {
            tl.setResult(tl.TaskResult.Failed, error);
            shouldBreak = true;
        });
        if (shouldBreak) { break; }
    }

    tl.setVariable('UnityBuildId', unityBuildDetail.buildId.toString(), false);
    tl.setVariable('UnityDownloadUrl', unityBuildDetail.downloadUrl, false);

    console.log(`The requested Unity Cloud Build with id ${unityBuildDetail.buildId}` +
                ` has a final status of ${unityBuildDetail.buildStatus}`);
    if (unityBuildDetail.downloadUrl) {
        console.log(`The output is available to download at ${unityBuildDetail.downloadUrl}`);
    } else {
        console.log('There is no output available for download for the Unity Cloud Build.');
    }
})();
