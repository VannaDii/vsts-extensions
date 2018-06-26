import os = require('os');
import fs = require('fs');
import path = require('path');
import request = require('request-promise');
import tl = require('vsts-task-lib/task');

tl.setResourcePath(path.join(__dirname, 'task.json'));

class BuildDetails {
    public buildId: number = 0;
    public buildStatus: string = null;
    public downloadUrl: string = null;

    public static create(buildId: number, buildStatus: string): BuildDetails {
        const retVal = new BuildDetails();
        retVal.buildId = buildId;
        retVal.buildStatus = buildStatus;
        return retVal;
    }

    public update(buildStatus: string, downloadUrl: string): BuildDetails {
        this.buildStatus = buildStatus;
        this.downloadUrl = downloadUrl;
        return this;
    }
}

function sleep(ms: number) {
    const start = new Date().getTime();
    while (true) {
        if ((new Date().getTime() - start) >= ms) {
            break;
        }
    }
}

function makeBuildRequest(baseUri: string, apiKey: string, sourceVersion: string, useClean: boolean): Promise<BuildDetails> {
    const buildRequest = {
        clean: useClean,
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
        const build = body[0];
        tl.debug(JSON.stringify(build));
        if (build.error) {
            throw build.error;
        } else {
            console.log(`Created build with id: ${build.build}`);
            return BuildDetails.create(build.build, build.buildStatus);
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
    tl.debug(`Requesting status from ${statusRequest.url}`);
    return request(statusRequest).then(body => {
        tl.debug(JSON.stringify(body));
        if (body.error) {
            throw body.error;
        } else {
            tl.debug(`Found status for build with id: ${body.build}`);
            if (body.links != null && body.links.download_primary != null) {
                return buildDetail.update(body.buildStatus, body.links.download_primary.href);
            } else {
                return buildDetail.update(body.buildStatus, null);
            }
        }
    }).catch(error => { console.log(`Failed to find build status: ${error}`); });
}

function getBuildLog(baseUri: string, apiKey: string, buildDetail: BuildDetails, offsetLines: number): Promise<string[]> {
    const logsRequest = {
        method: 'GET',
        url: `${baseUri}/builds/${buildDetail.buildId}/log?offsetLines=${offsetLines}`,
        headers: {
            'cache-control': 'no-cache',
            'content-type': 'application/json',
            authorization: `Basic ${apiKey}`
        }
    };
    tl.debug(`Requesting log from ${logsRequest.url}`);
    return request(logsRequest).then(body => {
        const lines: string[] = body.split('\n');
        lines.forEach((line) => line.trim());
        return lines;
    }).catch(error => { console.log(`Failed to find build log: ${error}`); });
}

function getBuildLogCompact(baseUri: string, apiKey: string, buildDetail: BuildDetails): Promise<string[]> {
    const logsRequest = {
        method: 'GET',
        url: `${baseUri}/builds/${buildDetail.buildId}/log?compact=true`,
        headers: {
            'cache-control': 'no-cache',
            'content-type': 'application/json',
            authorization: `Basic ${apiKey}`
        }
    };
    tl.debug(`Requesting log from ${logsRequest.url}`);
    return request(logsRequest).then(body => {
        const lines: string[] = body.split('\n');
        lines.forEach((line) => line.trim());
        return lines;
    }).catch(error => { console.log(`Failed to find build log: ${error}`); });
}

function getBuildStartTime(): Promise<Date> {
    const buildId = tl.getVariable('Build.BuildId');
    const accessToken = tl.getVariable('System.AccessToken');
    const teamProject = tl.getVariable('System.TeamProject');
    const teamCollectionUri = tl.getVariable('System.TeamFoundationCollectionUri');

    const buildDataRequest = {
        method: 'GET',
        url: `${teamCollectionUri}${teamProject}/_apis/build/builds/${buildId}?api-version=4.1`,
        headers: {
            'cache-control': 'no-cache',
            'authorization': `Bearer ${accessToken}`
        },
        json: true
    };
    tl.debug(`Requesting build details from ${buildDataRequest.url}`);
    return request(buildDataRequest).then(body => {
        tl.debug(JSON.stringify(body));
        return new Date(body.startTime);
    }).catch(error => { console.log(`Failed to get build details: ${error}`); });
}

function chainBuildForUnity(unityBuildId: number, offsetLines: number): Promise<number> {
    const buildId = tl.getVariable('Build.BuildId');
    const buildDefId = tl.getVariable('System.DefinitionId');
    const accessToken = tl.getVariable('System.AccessToken');
    const teamProject = tl.getVariable('System.TeamProject');
    const teamCollectionUri = tl.getVariable('System.TeamFoundationCollectionUri');
    const sourceRefName = tl.getVariable('Build.SourceBranch');
    const sourceVersion = tl.getVariable('Build.SourceVersion');
    const buildRequest = {
        parameters: JSON.stringify({ LastUnityBuildId: unityBuildId, CallingBuildId: buildId, UnityOffsetLines: offsetLines }),
        definition: { id: buildDefId },
        sourceBranch: sourceRefName,
        sourceVersion: sourceVersion
    };
    const buildDataRequest = {
        method: 'POST',
        url: `${teamCollectionUri}${teamProject}/_apis/build/builds?api-version=4.1`,
        headers: {
            'cache-control': 'no-cache',
            'content-type': 'application/json',
            'authorization': `Bearer ${accessToken}`
        },
        body: buildRequest,
        json: true
    };
    tl.debug(`Queueing new build at ${buildDataRequest.url}`);
    return request(buildDataRequest).then(body => {
        tl.debug(JSON.stringify(body));
        return parseInt(body.id);
    }).catch(error => { console.log(`Failed to queue new build: ${error}`); });
}

function getDurationString(date: Date): string {
    const totalSeconds: number = date.getTime() / 1000; // don't forget the second param
    const hours: number = Math.floor(totalSeconds / 3600);
    const minutes: number = Math.floor((totalSeconds - (hours * 3600)) / 60);
    const seconds: number = Math.floor(totalSeconds - (hours * 3600) - (minutes * 60));

    const padHours: string = (hours < 10 ? '0' : '') + hours;
    const padMinutes: string = (minutes < 10 ? '0' : '') + minutes;
    const padSeconds: string = (seconds < 10 ? '0' : '') + seconds;

    return `${padHours}:${padMinutes}:${padSeconds}`;
}

(async () => {
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

    let targetName = tl.getInput('TargetName', true);
    if (!targetName || targetName.length === 0) {
        tl.setResult(tl.TaskResult.Failed, tl.loc('NoTargetName'));
        return;
    } else {
        targetName = targetName.toLowerCase();
        tl.debug(`Using provided target name: '${targetName}'`);
    }

    const useCleanBuild = tl.getBoolInput('CleanBuild', true);
    const sourceRefName = tl.getVariable('Build.SourceBranch');
    tl.debug(`Using source branch: '${sourceRefName}'`);

    const sourceVersion = tl.getVariable('Build.SourceVersion');
    tl.debug(`Using source version: '${sourceVersion}'`);
    tl.setVariable('Build.SourceVersion8', sourceVersion.substr(0, 8), false);

    tl.setVariable('UnityBuildColor', 'warning', false);
    tl.setVariable('UnitySourceBranch', sourceRefName.replace('refs/', '').replace('heads/', '').replace('pull/', ''), false);
    tl.setVariable('UnityBuildId', '0', false);
    tl.setVariable('UnityDownloadUrl', `https://developer.cloud.unity3d.com/build/orgs/${orgName}/projects/${projName}/?page=1`, false);
    tl.setVariable('UnityBuildDuration', '00:00:00', false);

    const binariesDir = path.join(tl.getVariable('Build.BinariesDirectory'), 'UnityCloudBuild');
    fs.exists(binariesDir, (exists) => {
        if (exists === false) {
            fs.mkdir(binariesDir, (err) => {
                if (err) {
                    tl.error(`Failed to create the output directory "${binariesDir}": ${err}`);
                } else {
                    tl.debug(`Created the output directory "${binariesDir}"`);
                }
            });
        }
    });

    const sleepSeconds = parseInt(tl.getInput('PollingDelaySeconds', true));
    let unityBuildDetail: BuildDetails = null;
    const unityFinalStatuses = ['success', 'failure', 'canceled'];
    const unityCloudBuildUrl = `https://build-api.cloud.unity3d.com/api/v1/orgs/${orgName}/projects/${projName}/buildtargets/${targetName}`;
    tl.debug(`Using base URL: '${unityCloudBuildUrl}'`);

    const callingBuildId = parseInt(tl.getVariable('CallingBuildId') || '0');
    const lastCloudBuildId = parseInt(tl.getVariable('LastUnityBuildId') || '0');
    if (lastCloudBuildId > 0) {
        console.log(`Resuming Unity Cloud Build from build #${callingBuildId}.`);
        unityBuildDetail = BuildDetails.create(lastCloudBuildId, 'unknown');
        unityBuildDetail = await getBuildStatus(unityCloudBuildUrl, apiKey, unityBuildDetail);
    } else {
        try {
            unityBuildDetail = await makeBuildRequest(unityCloudBuildUrl, apiKey, sourceVersion, useCleanBuild);
        } catch (e) {
            const unityError: string = e.message.split(':').pop();
            if (unityError != null && unityError.length > 0) {
                tl.setResult(tl.TaskResult.Failed, `Unity Cloud Build: ${unityError}`);
                return;
            }
        }
    }

    let lastUnityStatus: string = null;
    const buildStartTime: Date = await getBuildStartTime();
    let offsetLines: number = parseInt(tl.getVariable('UnityOffsetLines') || '1');
    const maxBuildMinutes: number = parseInt(tl.getInput('MaxBuildMinutes', true));
    const buildMaxTime: Date = new Date(buildStartTime.getTime() + (maxBuildMinutes * 60000));
    while (true) {
        tl.debug(`Using build detail: ${JSON.stringify(unityBuildDetail)}`);
        if (unityFinalStatuses.indexOf(unityBuildDetail.buildStatus) >= 0) {
            const buildDuration = new Date(Date.now() - buildStartTime.getTime());

            tl.setVariable('UnityBuildDuration', getDurationString(buildDuration), false);
            tl.setVariable('UnityBuildId', unityBuildDetail.buildId.toString(), false);
            tl.setVariable('UnityDownloadUrl', unityBuildDetail.downloadUrl, false);
            if (unityBuildDetail.buildStatus === 'failure') {
                tl.setVariable('UnityBuildColor', 'danger');
                tl.setResult(tl.TaskResult.Failed, 'The requested Unity Cloud Build failed.');
            } else if (unityBuildDetail.buildStatus === 'canceled') {
                tl.setVariable('UnityBuildColor', 'warning');
                tl.setResult(tl.TaskResult.SucceededWithIssues, 'The requested Unity Cloud Build was canceled.');
            } else if (unityBuildDetail.buildStatus === 'success') {
                tl.setVariable('UnityBuildColor', 'good');
                tl.setResult(tl.TaskResult.Succeeded, 'The requested Unity Cloud Build succeeded.');
            }

            console.log(`The requested Unity Cloud Build with id ${unityBuildDetail.buildId}` +
                ` has a final status of ${unityBuildDetail.buildStatus}`);
            if (unityBuildDetail.downloadUrl) {
                console.log(`The output is available to download at ${unityBuildDetail.downloadUrl}`);
                const fileName = path.basename(unityBuildDetail.downloadUrl).split('?').reverse().pop();
                const fullFilePath = path.join(binariesDir, fileName);
                const downloadOptions = {
                    uri: unityBuildDetail.downloadUrl,
                    method: 'GET',
                    encoding: 'binary'
                };
                request(downloadOptions).then((body, data) => {
                    const writeStream = fs.createWriteStream(fullFilePath);
                    writeStream.write(body, 'binary');
                    writeStream.end();
                });
            } else {
                console.log('There is no output available for download for the Unity Cloud Build.');
            }

            const unityBuildLog = await getBuildLogCompact(unityCloudBuildUrl, apiKey, unityBuildDetail);
            console.log('================ UNITY CLOUD BUILD LOG (COMPACT) ================');
            unityBuildLog.forEach((line) => console.log(line));
            console.log(`Full Log: https://developer.cloud.unity3d.com/build/orgs/${orgName}/projects/${projName}/buildtargets/` +
                `${targetName}/builds/${unityBuildDetail.buildId}/log/`);
            console.log('================ UNITY CLOUD BUILD LOG (COMPACT) ================');
            break;
        } else {
            const statusChanged = (lastUnityStatus !== unityBuildDetail.buildStatus);
            if (statusChanged) {
                console.log(`Build status is ${unityBuildDetail.buildStatus}.`);
                lastUnityStatus = unityBuildDetail.buildStatus;
            }
            if (new Date().getTime() + (sleepSeconds * 1000) < buildMaxTime.getTime()) {
                const unityBuildLog = await getBuildLog(unityCloudBuildUrl, apiKey, unityBuildDetail, offsetLines);
                offsetLines += unityBuildLog.length;
                unityBuildLog.forEach((line) => console.log(line));
                sleep(sleepSeconds * 1000); // Sleep for 1 minute / 60 seconds
                try {
                    const newUnityBuildDetail = await getBuildStatus(unityCloudBuildUrl, apiKey, unityBuildDetail);
                    if (newUnityBuildDetail != null) { unityBuildDetail = newUnityBuildDetail; }
                } catch (e) { tl.debug(e); }
            } else {
                const nextBuildId: number = await chainBuildForUnity(unityBuildDetail.buildId, offsetLines);
                tl.setVariable('ChainedBuildId', nextBuildId.toString(), false);
                tl.setVariable('UnityCloudBuildHandedOff', 'true', false);
                console.log(`Cannot wait for Unity any longer. Handing off to next build with ID ${nextBuildId}.`);
                tl.setResult(tl.TaskResult.SucceededWithIssues, `Unity Cloud Build took longer than allowed to complete the build.` +
                    `Monitoring handed off to build with ID ${nextBuildId}`);
                return;
            }
        }
    }
})();
