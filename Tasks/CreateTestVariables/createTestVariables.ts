import os = require('os');
import path = require('path');
import http = require('http');
import request = require('request');
import tl = require('vsts-task-lib/task');

tl.setResourcePath(path.join(__dirname, 'task.json'));
(() => {
    // Init variables
    const userName = tl.getInput('Username', true);
    if (!userName || userName.length === 0) {
        tl.setResult(tl.TaskResult.Failed, tl.loc('NoUsernameProvided'));
        return;
    } else {
        tl.debug(`Using provided username: '${userName}'`);
    }

    const password = tl.getInput('Password', true);
    if (!password || password.length === 0) {
        tl.setResult(tl.TaskResult.Failed, tl.loc('NoPasswordProvided'));
        return;
    } else {
        tl.debug(`Using provided password: '********'`);
    }

    const varPrefix = tl.getInput('VariablePrefix', true);
    if (!password || password.length === 0) {
        tl.debug(`No variable prefix was provided.`);
    } else {
        tl.debug(`Using provided variable prefix: '${varPrefix}'`);
    }

    const basicAuthToken = new Buffer(`${userName}:${password}`).toString('base64');
    const collectionUri = tl.getVariable('System.TeamFoundationCollectionUri');
    const projectName = tl.getVariable('System.TeamProject');
    const releaseUri = tl.getVariable('Release.ReleaseUri');
    const buildUri = tl.getVariable('Build.BuildURI');

    const testRunQueryUri = `${collectionUri}${projectName}/_apis/test/runs?api-version=1.0&automated=true&includeRunDetails=true` +
                            `&buildUri=${buildUri}`;

    const queryOptions = {
        method: 'GET',
        headers: { 'Authorization': `Basic ${basicAuthToken}` },
        url: testRunQueryUri
    };
    request(queryOptions, function (error: any, response: http.IncomingMessage, body: any) {
        if (error) {
            tl.setResult(tl.TaskResult.Failed, `${response.statusMessage} : ${JSON.stringify(body)}`);
        } else {
            const json = JSON.parse(body);
            const buildRuns = json.value as { id: number, releaseUri: string }[];
            const releaseRuns = buildRuns.filter((e) => { return e.releaseUri === releaseUri; });
            if (releaseRuns && releaseRuns.length > 0) {
                tl.debug(JSON.stringify(releaseRuns));
                const testRunId = releaseRuns[releaseRuns.length - 1].id;
                const testRunStatsUri = `${collectionUri}${projectName}/_apis/test/runs/${testRunId}/statistics?api-version=1.0`;
                const queryOptions = {
                    method: 'GET',
                    headers: { 'Authorization': `Basic ${basicAuthToken}` },
                    url: testRunStatsUri
                };
                request(queryOptions, function (error: any, response: http.IncomingMessage, body: any) {
                    if (error) {
                        tl.setResult(tl.TaskResult.Failed, `${response.statusMessage} : ${JSON.stringify(body)}`);
                    } else {
                        const json = JSON.parse(body);
                        const buildRunStats = json as { run: { id: number, name: string, url: string },
                                                        runStatistics: { state: string, outcome: string, count: number}[] };

                        let passedCount = 0;
                        let failedCount = 0;

                        tl.setVariable(`${varPrefix}TestRunId`, buildRunStats.run.id.toString());
                        tl.setVariable(`${varPrefix}TestRunName`, buildRunStats.run.name);
                        tl.setVariable(`${varPrefix}TestRunUrl`, buildRunStats.run.url);
                        tl.setVariable(`${varPrefix}PassedCount`, '0');
                        tl.setVariable(`${varPrefix}FailedCount`, '0');

                        buildRunStats.runStatistics.forEach(stat => {
                            if (stat.outcome === 'Passed') {
                                passedCount += stat.count;
                                tl.setVariable(`${varPrefix}${stat.outcome}Count`, passedCount.toString());
                            } else if (stat.outcome === 'Failed') {
                                failedCount += stat.count;
                                tl.setVariable(`${varPrefix}${stat.outcome}Count`, failedCount.toString());
                            }
                        });

                        if (failedCount > passedCount) {
                            tl.setVariable(`${varPrefix}TestRunColor`, 'failed');
                        } else if (failedCount > 0 || passedCount === 0) {
                            tl.setVariable(`${varPrefix}TestRunColor`, 'warning');
                        } else {
                            tl.setVariable(`${varPrefix}TestRunColor`, 'good');
                        }
                    }
                    tl.debug(JSON.stringify(body));
                });
            }
        }
        tl.debug(JSON.stringify(body));
    });
})();
