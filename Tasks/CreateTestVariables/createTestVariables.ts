import path = require('path');
import http = require('http');
import request = require('request');
import tl = require('vsts-task-lib/task');

tl.setResourcePath(path.join(__dirname, 'task.json'));
(() => {
    const accessToken = tl.getVariable('System.AccessToken');
    if (!accessToken || accessToken.length === 0) {
        tl.setResult(tl.TaskResult.Failed, tl.loc('NoAccessToken'));
        return;
    }

    const testTitle = tl.getInput('TestTitle');
    if (!testTitle || testTitle.length === 0) {
        tl.warning(tl.loc('NoTestTitle'));
    }

    const varPrefix = tl.getInput('VariablePrefix', true);
    if (!varPrefix || varPrefix.length === 0) {
        tl.warning(`No variable prefix was provided.`);
    } else {
        tl.debug(`Using provided variable prefix: '${varPrefix}'`);
    }

    const collectionUri = tl.getVariable('System.TeamFoundationCollectionUri');
    const projectName = tl.getVariable('System.TeamProject');
    const releaseUri = tl.getVariable('Release.ReleaseUri');
    const buildUri = tl.getVariable('Build.BuildURI');

    const testRunQueryUri = `${collectionUri}${projectName}/_apis/test/runs?api-version=1.0&automated=true&includeRunDetails=true` +
        `&buildUri=${buildUri}`;

    const queryOptions = {
        method: 'GET',
        headers: { authorization: `Bearer ${accessToken}` },
        url: testRunQueryUri
    };
    request(queryOptions, function (error: any, response: http.IncomingMessage, body: any) {
        if (error) {
            tl.setResult(tl.TaskResult.Failed, `${response.statusMessage} : ${JSON.stringify(body)}`);
        } else {
            const json = JSON.parse(body);
            const buildRuns = json.value as { id: number, name: string, releaseUri: string }[];
            const releaseRuns = buildRuns.filter((e) => {
                return e.name.toLowerCase().indexOf(testTitle.toLowerCase()) >= 0; // It matches the test run title
            });
            if (releaseRuns && releaseRuns.length > 0) {
                tl.debug(JSON.stringify(releaseRuns));
                const testRunId = releaseRuns[releaseRuns.length - 1].id;
                const testRunStatsUri = `${collectionUri}${projectName}/_apis/test/runs/${testRunId}/statistics?api-version=1.0`;
                const queryOptions = {
                    method: 'GET',
                    headers: { authorization: `Bearer ${accessToken}` },
                    url: testRunStatsUri
                };
                request(queryOptions, function (error: any, response: http.IncomingMessage, body: any) {
                    if (error) {
                        tl.setResult(tl.TaskResult.Failed, `${response.statusMessage} : ${JSON.stringify(body)}`);
                    } else {
                        const json = JSON.parse(body);
                        const buildRunStats = json as {
                            run: { id: number, name: string, url: string },
                            runStatistics: { state: string, outcome: string, count: number }[]
                        };

                        // Initialize for all known possible outcomes
                        const outcomeKeyPassed = 'Passed';
                        const outcomeKeyFailed = 'Failed';
                        const testOutcomeCounts: { [key: string]: number; } = {};
                        const testOutcomes = ['None', outcomeKeyPassed, outcomeKeyFailed, 'Inconclusive', 'Timeout', 'Aborted', 'Blocked',
                            'NotExecuted', 'Warning', 'Error', 'NotApplicable', 'Paused', 'InProgress'];
                        testOutcomes.forEach(outcome => {
                            testOutcomeCounts[outcome] = 0;
                            tl.setVariable(`${varPrefix}${outcome}Count`, '0');
                        });

                        tl.setVariable(`${varPrefix}TestRunId`, buildRunStats.run.id.toString());
                        tl.setVariable(`${varPrefix}TestRunName`, buildRunStats.run.name);
                        tl.setVariable(`${varPrefix}TestRunUrl`, buildRunStats.run.url);

                        buildRunStats.runStatistics.forEach(stat => {
                            testOutcomeCounts[stat.outcome] += stat.count;
                            tl.setVariable(`${varPrefix}${stat.outcome}Count`, testOutcomeCounts[stat.outcome].toString());
                        });

                        const passedCount = testOutcomeCounts[outcomeKeyPassed];
                        const failedCount = testOutcomeCounts[outcomeKeyFailed];

                        if (failedCount > passedCount) {
                            tl.setVariable(`${varPrefix}TestRunColor`, 'danger');
                        } else if (failedCount > 0 || passedCount === 0) {
                            tl.setVariable(`${varPrefix}TestRunColor`, 'warning');
                        } else {
                            tl.setVariable(`${varPrefix}TestRunColor`, 'good');
                        }
                    }
                    tl.debug(JSON.stringify(body));
                });
            } else {
                tl.warning(`Failed to find a matching test run for this release (${releaseUri}) with '${testTitle}' in the title.`);
            }
        }
        tl.debug(JSON.stringify(body));
    });
})();
