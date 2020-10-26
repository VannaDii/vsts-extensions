import fs from 'fs';
import path from 'path';
import * as tl from 'azure-pipelines-task-lib/task';

import { WorkItemClient } from '../workItems';
import {
  AllSupportedOperations,
  AnalysisIssue,
  AnalysisItem,
  TaskConfig,
  WorkItem,
  WorkItemField,
  WorkItemOptions,
} from '../types';
import { getEvenHash } from '../utils';

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

function loadAnalysisIssues(analysisPath: string, sourceRoot: string): { [key: string]: AnalysisIssue } {
  const sourceRootHash = getEvenHash(sourceRoot);
  const data = JSON.parse(fs.readFileSync(analysisPath).toString());
  const allIssues = (data as AnalysisItem[])
    .filter((i) => i.type === 'issue')
    .map((v) => v as AnalysisIssue)
    .reduce((p, c) => ({ ...p, [`${sourceRootHash}-${c.fingerprint}`]: c }), {});

  tl.debug(`Found ${Object.keys(allIssues).length} analysis issues.`);

  return allIssues;
}

async function getScopedWorkItems(workItemClient: WorkItemClient, areaPath: string, iterationPath: string) {
  tl.debug(`Searching for work items in ${areaPath} and ${iterationPath}.`);
  const queryResult = await workItemClient.query(
    ['System.Id', FieldNameFingerprintQualified],
    [
      {
        fieldName: 'System.AreaPath',
        operator: '=',
        value: `'${areaPath}'`,
      },
      {
        fieldName: 'System.IterationPath',
        operator: '=',
        value: `'${iterationPath}'`,
      },
      {
        fieldName: 'System.State',
        operator: '<>',
        value: `'Done'`,
      },
      {
        fieldName: 'CodeClimate.Fingerprint',
        operator: '<>',
        value: `''`,
      },
    ]
  );
  const workItemIds = queryResult?.workItems.map((w) => w.id);
  const result = await getWorkItemsById(workItemClient, workItemIds);

  return result;
}

async function getWorkItemsById(workItemClient: WorkItemClient, workItemIds?: number[]) {
  const result: WorkItem[] = [];
  if (!!workItemIds) {
    tl.debug(`Getting work items with ${workItemIds.length} IDs starting at ${workItemIds[0]}.`);
    do {
      const batchIds = workItemIds.splice(0, 200);
      const workItemBatch = await workItemClient.get(['System.Id', FieldNameFingerprintQualified], ...batchIds);
      if (!!workItemBatch) {
        tl.debug(`Adding ${workItemBatch.value.length} work items for update starting at ${workItemIds[0]}.`);
        result.push(...workItemBatch.value);
      } else {
        tl.debug(`No updatable items found for ${workItemIds.length} IDs starting at ${workItemIds[0]}.`);
      }
    } while (workItemIds.length > 0);
  }
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

  const analysisItems = loadAnalysisIssues(config.outputPath, sourceRoot);
  const workItemClient = new WorkItemClient(collectionUrl, projName, accessToken);
  try {
    await workItemClient.fieldEnsure(FieldNameCategoryQualified, fieldFactory, false);
    await workItemClient.fieldEnsure(FieldNameFingerprintQualified, fieldFactory, true);
  } catch (error) {
    return tl.setResult(tl.TaskResult.Failed, `${error.name}: ${error.message}\n${error.stack}`, true);
  }

  // Get all fingerprinted items in the area/iteration
  const fingerprints = Object.keys(analysisItems);
  const scopedWorkItems = await getScopedWorkItems(workItemClient, config.issueAreaPath, config.issueIterationPath);
  const scopedFingerprints = scopedWorkItems.map((wi) => wi.fields[FieldNameFingerprintQualified] as string);
  const itemsForUpdate = scopedWorkItems.filter((wi) =>
    fingerprints.includes(wi.fields[FieldNameFingerprintQualified] as string)
  );
  const itemsForTransition = scopedWorkItems.filter(
    (wi) => !fingerprints.includes(wi.fields[FieldNameFingerprintQualified] as string)
  );
  const itemsForCreate = fingerprints.filter((fp) => !scopedFingerprints.includes(fp));

  // Setup common properties, and setup for awaiting
  let pendingOps: Promise<any>[] = [];
  const allItemProps: WorkItemOptions = {
    areaPath: config.issueAreaPath,
    buildDefName,
    buildId,
    buildLabel,
    categoryFieldName: FieldNameCategoryQualified,
    fingerprintFieldName: FieldNameFingerprintQualified,
    issue: (undefined as unknown) as AnalysisIssue,
    iterationPath: config.issueIterationPath,
    sourceRoot,
    type: 'bug',
  };

  // Create new work item
  tl.debug(`Creating ${itemsForCreate.length} new work items`);
  for (const fingerprint of itemsForCreate) {
    const issue = analysisItems[fingerprint];
    pendingOps.push(workItemClient.create({ ...allItemProps, issue }));
    pendingOps = await waitAtThreshold(pendingOps);
  }

  // Update existing work items
  tl.debug(`Updating ${itemsForUpdate.length} existing work items`);
  for (const workItem of itemsForUpdate) {
    const fingerprint = workItem.fields[FieldNameFingerprintQualified] as string;
    const issue = analysisItems[fingerprint];
    pendingOps.push(workItemClient.update({ ...allItemProps, id: workItem.id, issue }));
    pendingOps = await waitAtThreshold(pendingOps);
  }

  // Transition old work items
  tl.debug(`Transitioning ${itemsForTransition.length} old work items`);
  const transitionTo = 'Done'; // Relatively safe for now. There are other ways of getting this more dynamically.
  for (const workItem of itemsForTransition) {
    const fingerprint = workItem.fields[FieldNameFingerprintQualified] as string;
    const issue = analysisItems[fingerprint];
    pendingOps.push(workItemClient.transition({ ...allItemProps, transitionTo, id: workItem.id, issue }));
    pendingOps.push(
      workItemClient.comment(
        workItem.id,
        `Transitioned to ${transitionTo} because Code Climate doesn't see this particular issue anymore. It may still exist at a different location in code because fingerprints are location sensitive.`
      )
    );
    pendingOps = await waitAtThreshold(pendingOps);
  }

  // Wait for any strangler to finish
  if (!!pendingOps && pendingOps.length > 0) {
    await Promise.all(pendingOps);
  }
}
