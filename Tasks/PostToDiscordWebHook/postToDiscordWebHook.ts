import os = require('os');
import path = require('path');
import http = require('http');
import request = require('request');
import tl = require('vsts-task-lib/task');

tl.setResourcePath(path.join(__dirname, 'task.json'));
(() => {
  // Init variables
  const timeStamp = new Date().toISOString();

  const channelId = tl.getInput('DiscordChannelId', true);
  if (!channelId || channelId.length === 0) {
    tl.setResult(tl.TaskResult.Failed, tl.loc('NoChannelId'));
    return;
  } else {
    tl.debug(`Using provided channel ID: '${channelId}'`);
  }

  const webhookKey = tl.getInput('DiscordWebhookKey', true);
  if (!webhookKey || webhookKey.length === 0) {
    tl.setResult(tl.TaskResult.Failed, tl.loc('NoWebhookKey'));
    return;
  } else {
    tl.debug(`Using provided webhook key: '${webhookKey.slice(webhookKey.length / 2).padEnd(webhookKey.length, '*')}'`);
  }

  const webhookUrl = `https://discordapp.com/api/webhooks/${channelId}/${webhookKey}`;

  let customMessage = tl.getInput('DiscordCustomMessage', true);
  if (!customMessage || customMessage.length === 0) {
    tl.setResult(tl.TaskResult.Failed, tl.loc('NoCustomMessage'));
    return;
  } else {
    try {
      JSON.parse(customMessage);
      tl.debug(`Using provided custom message: '${customMessage}'`);
      customMessage = customMessage.replace(/\s{2,}/g, '').replace(/\r|\n/g, '');
      customMessage = customMessage.replace(/\$\(DiscordTimeStamp\)/gi, timeStamp);
    } catch (error) {
      tl.error(error);
      tl.setResult(tl.TaskResult.Failed, tl.loc('CustomMessageNotJson'));
      return;
    }
  }

  // Make HTTP POST request to create pull request.
  const options = {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    url: webhookUrl,
    body: customMessage,
  };

  request(options, function (error: any, response: http.IncomingMessage, body: any) {
    tl.debug(JSON.stringify(body));
    if (error || response.statusCode >= 300) {
      tl.setResult(tl.TaskResult.Failed, `${response.statusCode}: ${response.statusMessage}`);
      return;
    }
    tl.setResult(tl.TaskResult.Succeeded, `Posted to Discord channel #${channelId}`);
  });
})();
