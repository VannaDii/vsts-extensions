import os = require('os');
import path = require('path');
import http = require('http');
import request = require('request');
import tl = require('vsts-task-lib/task');

tl.setResourcePath(path.join(__dirname, 'task.json'));
(() => {
    // Init variables
    const slackWebHookUrl = tl.getInput('SlackWebHookUrl', true);
    if (!slackWebHookUrl || slackWebHookUrl.length === 0) {
        tl.setResult(tl.TaskResult.Failed, tl.loc('NoWebHookUrl'));
        return;
    } else { tl.debug(`Using provided web hook URL: '${slackWebHookUrl}'`); }

    let slackCustomMessage = tl.getInput('SlackCustomMessage', true);
    if (!slackCustomMessage || slackCustomMessage.length === 0) {
        tl.setResult(tl.TaskResult.Failed, tl.loc('NoCustomMessage'));
        return;
    } else {
        tl.debug(`Using provided custom message: '${slackCustomMessage}'`);
        slackCustomMessage = slackCustomMessage.replace(/\s{2,}/g, '').replace(/\r|\n/g, '');
    }

    // Make HTTP POST request to create pull request.
    const options = {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        url: slackWebHookUrl,
        body: slackCustomMessage
    };

    request(options, function (error: any, response: http.IncomingMessage, body: any) {
        tl.debug(JSON.stringify(body));
        if (error) {
            tl.setResult(tl.TaskResult.Failed, response.statusMessage);
        } else if (body && body.type && body.type === 'error' && body.error && body.error.message) {
            tl.setResult(tl.TaskResult.Failed, `Failed to post slack message: ${body.error.message}`);
        }
    });
})();
