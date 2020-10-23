import fs from 'fs';
import path from 'path';
import * as tl from 'azure-pipelines-task-lib/task';

import { WorkItemClient } from '../workItems';
import { AllSupportedOperations, AnalysisIssue, AnalysisItem, TaskConfig, WorkItem, WorkItemField } from '../types';

const OpThreshold = 20;
const FieldNamespace = 'CodeClimate';
const FieldNameCategory = 'Category';
const FieldNameCategoryQualified = `${FieldNamespace}.${FieldNameCategory}`;
const FieldNameFingerprint = 'Fingerprint';
const FieldNameFingerprintQualified = `${FieldNamespace}.${FieldNameFingerprint}`;

function fieldFactory(fieldName: string, isIdentity: boolean): WorkItemField {
  const displayName = fieldName.replace('.', ' ');
  return {
    name: displayName,
    referenceName: fieldName,
    description: `Stores a ${displayName}`,
    type: 'string',
    usage: 'workItem',
    readOnly: false,
    canSortBy: true,
    isQueryable: true,
    supportedOperations: AllSupportedOperations,
    isDeleted: false,
    isIdentity,
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
      ['System.Id', FieldNameFingerprintQualified],
      [
        {
          fieldName: FieldNameFingerprintQualified,
          operator: 'IN',
          value: `(${batchIds.map((v) => `'${v}'`).join(', ')})`,
        },
      ]
    );
    const workItemIds = queryResult?.workItems.map((w) => w.id);
    if (!!workItemIds) {
      const workItemBatch = await workItemClient.get(['System.Id', FieldNameFingerprintQualified], ...workItemIds);
      if (!!workItemBatch) result.push(...workItemBatch.value);
    }
  } while (fingerprints.length > 0);

  return result;
}

async function waitAtThreshold<T>(ops: Promise<T>[]): Promise<Promise<T>[]> {
  if (ops.length >= OpThreshold) {
    await Promise.all(ops);
    return [];
  }
  return ops;
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

  const sourceRoot = path.basename(config.configFilePath);
  const buildId = parseInt(tl.getVariable('Build.BuildId') as string);
  const buildLabel = tl.getVariable('Build.BuildNumber') as string;
  const buildDefName = tl.getVariable('Build.DefinitionName') as string;
  const projName = tl.getVariable('System.TeamProject') as string;
  const collectionUrl = tl.getVariable('System.TeamFoundationCollectionUri') as string;
  const accessToken = tl.getVariable('System.AccessToken');
  if (!accessToken || accessToken.length === 0) {
    tl.setResult(tl.TaskResult.Failed, tl.loc('NoAccessToken'));
    return;
  }

  const analysisItems = loadAnalysisIssues(config.outputPath);
  const fingerprints = Object.keys(analysisItems);
  const workItemClient = new WorkItemClient(collectionUrl, projName, accessToken);
  await workItemClient.fieldEnsure(FieldNameCategoryQualified, fieldFactory, false);
  await workItemClient.fieldEnsure(FieldNameFingerprintQualified, fieldFactory, true);

  // Get all fingerprinted work items and setup for awaiting
  const workItems = await getIssueWorkItems(workItemClient, ...fingerprints);
  let pendingOps: Promise<any>[] = [];

  // Create new ones
  const createItems = fingerprints.filter((f) => !workItems.find((w) => w.fields[FieldNameFingerprintQualified] === f));
  for (const fingerprint of createItems) {
    pendingOps.push(
      workItemClient.create({
        type: 'bug',
        issue: analysisItems[fingerprint],
        buildDefName,
        buildLabel,
        buildId,
        sourceRoot,
        categoryFieldName: FieldNameCategoryQualified,
        fingerprintFieldName: FieldNameFingerprintQualified,
        areaPath: config.issueAreaPath,
        iterationPath: config.issueIterationPath
      })
    );
    pendingOps = await waitAtThreshold(pendingOps);
  }

  // Update existing ones
  const updateItems = workItems.filter(
    (w) =>
      !!w.fields[FieldNameFingerprintQualified] &&
      typeof w.fields[FieldNameFingerprintQualified] === 'string' &&
      (w.fields[FieldNameFingerprintQualified] as string).length > 0
  );
  for (const workItem of updateItems) {
    pendingOps.push(
      workItemClient.update({
        id: workItem.id,
        buildDefName,
        buildLabel,
        buildId,
        sourceRoot,
        type: 'bug',
        issue: analysisItems[workItem.fields[FieldNameFingerprintQualified] as string],
        categoryFieldName: FieldNameCategoryQualified,
        fingerprintFieldName: FieldNameFingerprintQualified,
        areaPath: config.issueAreaPath,
        iterationPath: config.issueIterationPath,
      })
    );
    pendingOps = await waitAtThreshold(pendingOps);
  }

  pendingOps = await waitAtThreshold(pendingOps);
}
