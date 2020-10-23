import fs from 'fs';
import * as tl from 'azure-pipelines-task-lib/task';

import { WorkItemClient } from '../workItems';
import { AllSupportedOperations, AnalysisIssue, AnalysisItem, TaskConfig, WorkItem, WorkItemField } from '../types';

const FieldNamespace = 'CodeClimate';
const FieldNameFingerprint = 'Fingerprint';
const FieldNameFullyQualified = `${FieldNamespace}.${FieldNameFingerprint}`;

function fieldFactory(fieldName: string): WorkItemField {
  return {
    name: `${FieldNamespace} ${fieldName}`,
    referenceName: `${FieldNameFullyQualified}`,
    description: `Stores a ${FieldNamespace} ${fieldName}`,
    type: 'string',
    usage: 'workItem',
    readOnly: false,
    canSortBy: true,
    isQueryable: true,
    supportedOperations: AllSupportedOperations,
    isDeleted: false,
    isIdentity: true,
    isPicklist: false,
    isPicklistSuggested: false,
  };
}

function loadAnalysisIssues(analysisPath: string): { [key: string]: AnalysisIssue } {
  const data = JSON.parse(fs.readFileSync(analysisPath).toString());
  return (data as AnalysisItem[])
    .filter((i) => i.type === 'issue')
    .map((v) => v as AnalysisIssue)
    .reduce((p, c) => ({ ...p, [c.fingerprint]: c }), {});
}

async function getIssueWorkItems(workItemClient: WorkItemClient, ...fingerprints: string[]) {
  const result: WorkItem[] = [];
  do {
    const batchIds = fingerprints.splice(0, 200);
    const queryResult = await workItemClient.query(
      ['System.Id', FieldNameFullyQualified],
      [
        {
          fieldName: FieldNameFullyQualified,
          operator: 'IN',
          value: `(${batchIds.map((v) => `'${v}'`).join(', ')})`,
        },
      ]
    );
    const workItemIds = queryResult?.workItems.map((w) => w.id);
    if (!!workItemIds) {
      const workItemBatch = await workItemClient.get(['System.Id', FieldNameFullyQualified], ...workItemIds);
      if (!!workItemBatch) result.push(...workItemBatch.value);
    }
  } while (fingerprints.length > 0);

  return result;
}

export async function trackIssues(config: TaskConfig) {
  if (!config || config.trackIssues !== true) {
    console.info('Issue Tracking Is Disabled. Skipping.');
    return;
  }

  const result = tl.exist(config.outputPath);
  if (!result) {
    return tl.setResult(tl.TaskResult.Failed, 'Analysis file not found.', true);
  }

  const buildId = parseInt(tl.getVariable('Build.BuildId') as string);
  const buildLabel = tl.getVariable('Build.BuildNumber') as string;
  const buildDefName = tl.getVariable('Build.DefinitionName') as string;

  const projName = tl.getVariable('System.TeamProject');
  if (!projName || projName.length === 0) {
    tl.setResult(tl.TaskResult.Failed, tl.loc('NoProjectName'));
    return;
  }

  const collectionUrl = tl.getVariable('System.TeamFoundationCollectionUri');
  if (!collectionUrl || collectionUrl.length === 0) {
    tl.setResult(tl.TaskResult.Failed, tl.loc('NoCollectionUrl'));
    return;
  }

  const accessToken = tl.getVariable('System.AccessToken');
  if (!accessToken || accessToken.length === 0) {
    tl.setResult(tl.TaskResult.Failed, tl.loc('NoAccessToken'));
    return;
  }

  const analysisItems = loadAnalysisIssues(config.outputPath);
  const fingerprints = Object.keys(analysisItems);
  const workItemClient = new WorkItemClient(collectionUrl, projName, accessToken);
  await workItemClient.fieldEnsure(FieldNameFullyQualified, fieldFactory);

  // Get all fingerprinted work items and setup for awaiting
  const workItems = await getIssueWorkItems(workItemClient, ...fingerprints);
  const pendingOps: Promise<any>[] = [];

  // Create new ones
  const createItems = fingerprints.filter((f) => !workItems.find((w) => w.fields[FieldNameFullyQualified] === f));
  for (const fingerprint of createItems) {
    pendingOps.push(
      workItemClient.create({
        type: 'bug',
        issue: analysisItems[fingerprint],
        buildDefName,
        buildLabel,
        buildId,
        fingerprintFieldName: FieldNameFullyQualified,
        areaPath: config.issueAreaPath,
        iterationPath: config.issueIterationPath
      })
    );
  }

  // Update existing ones
  const updateItems = workItems.filter(
    (w) =>
      !!w.fields[FieldNameFullyQualified] &&
      typeof w.fields[FieldNameFullyQualified] === 'string' &&
      (w.fields[FieldNameFullyQualified] as string).length > 0
  );
  for (const workItem of updateItems) {
    pendingOps.push(
      workItemClient.update({
        id: workItem.id,
        buildDefName,
        buildLabel,
        buildId,
        type: 'bug',
        issue: analysisItems[workItem.fields[FieldNameFullyQualified] as string],
        fingerprintFieldName: FieldNameFullyQualified,
        areaPath: config.issueAreaPath,
        iterationPath: config.issueIterationPath,
      })
    );
  }

  await Promise.all(pendingOps);
}
