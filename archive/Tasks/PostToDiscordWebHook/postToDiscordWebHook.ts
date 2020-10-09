import path = require('path');
import http = require('http');
import request = require('request');
import tl = require('vsts-task-lib/task');

function coalesce(...values: string[]): string {
  values = values || [];
  return values.find((v) => !!v && typeof v === 'string' && !!v.trim && v.trim().length > 0).trim();
}

tl.setResourcePath(path.join(__dirname, 'task.json'));
(() => {
  try {
    // Init variables
    const timeStamp = new Date().toISOString();
    const releaseEnv = tl.getVariable('Release.EnvironmentName');
    const agentStatus = tl.getVariable('Agent.JobStatus');
    const gitShaShort = tl.getVariable('Build.SourceVersion').slice(0, 8);
    const releaseStatus = tl.getVariable(`Release.Environments.${releaseEnv}.status`);
    const usableStatus = coalesce(releaseStatus, agentStatus, 'unknown').toLowerCase();
    const defaultStatus = { color: 10181046, status: usableStatus };
    const colorStatuses: { [key: string]: { color: number; status: string } } = {
      canceled: { color: 9807270, status: 'was canceled' },
      failed: { color: 15158332, status: 'failed' },
      succeeded: { color: 3066993, status: 'succeeded' },
      succeededwithissues: { color: 15105570, status: 'succeeded with issues' },
      unknown: { color: 3447003, status: 'was weird' },
    };
    const { color, status } = colorStatuses[usableStatus] || defaultStatus;

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
      tl.debug(`Using provided webhook key`);
    }

    const webhookUrl = `https://discordapp.com/api/webhooks/${channelId}/${webhookKey}`;

    let customMessage = tl.getInput('DiscordCustomMessage', true);
    if (!customMessage || customMessage.length === 0) {
      tl.setResult(tl.TaskResult.Failed, tl.loc('NoCustomMessage'));
      return;
    } else {
      try {
        customMessage = customMessage
          .replace(/\s{2,}/g, '')
          .replace(/\r|\n/g, '')
          .replace(/\$\(GitShaShort\)/gi, gitShaShort)
          .replace(/\$\(DiscordJobStatus\)/gi, status)
          .replace(/\$\(DiscordTimeStamp\)/gi, timeStamp)
          .replace(/\$\(DiscordStatusColor\)/gi, color.toString());
        JSON.parse(customMessage);
        tl.debug(`Using provided custom message: '${customMessage}'`);
      } catch (error) {
        tl.error(error);
        tl.error(customMessage);
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
  } catch (error) {
    tl.error(error);
    tl.setResult(
      tl.TaskResult.Failed,
      `Posting failed! ${error.name || 'Error'}: ${error.message || 'No message available'}\n${error.stack}`
    );
  }
})();
