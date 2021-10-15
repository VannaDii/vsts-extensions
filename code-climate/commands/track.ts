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
  WorkItemReference,
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
    .reduce(
      (p, c) => ({
        ...p,
        [`${sourceRootHash}-${c.fingerprint}`]: {
          ...c,
          fingerprint: `${sourceRootHash}-${c.fingerprint}`,
        },
      }),
      {}
    );

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
  const workItemIds = queryResult?.workItems.map((w: WorkItemReference) => w.id);
  const result = await getWorkItemsById(workItemClient, workItemIds);

  return result;
}

async function getWorkItemsById(workItemClient: WorkItemClient, workItemIds?: number[]) {
  const result: WorkItem[] = [];
  if (!!workItemIds && workItemIds.length > 0) {
    tl.debug(`Getting work items with ${workItemIds.length} IDs starting at ${workItemIds[0]}.`);
    do {
      const batchIds = workItemIds.splice(0, 200);
      const workItemBatch = await workItemClient.get(['System.Id', FieldNameFingerprintQualified], ...batchIds);
      if (!!workItemBatch) {
        tl.debug(`Got ${workItemBatch.value.length} work items for starting at ${batchIds[0]}.`);
        const foundIds = workItemBatch.value.map((wi: WorkItem) => wi.id);
        const noMatchItems = batchIds.filter((id) => !foundIds.includes(id));
        if (!!noMatchItems && noMatchItems.length > 0) {
          tl.debug(`Missing items for ${noMatchItems.join(', ')}`);
        }
        result.push(...workItemBatch.value);
      } else {
        tl.debug(`No items found for ${batchIds.length} IDs starting at ${batchIds[0]}.`);
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
  } catch (error: any) {
    return tl.setResult(tl.TaskResult.Failed, `${error.name}: ${error.message}\n${error.stack}`, true);
  }

  // Get all fingerprinted items in the area/iteration
  const fingerprints = Object.keys(analysisItems);
  const scopedWorkItems = await getScopedWorkItems(workItemClient, config.issueAreaPath, config.issueIterationPath);
  const scopedFingerprints = scopedWorkItems.map((wi) => wi.fields[FieldNameFingerprintQualified] as string);
  const itemsForDelete = scopedWorkItems.filter(
    (v) =>
      v.id !==
      Math.min(
        ...scopedWorkItems
          .filter((wi) => wi.fields[FieldNameFingerprintQualified] === v.fields[FieldNameFingerprintQualified])
          .map((wi) => wi.id)
      )
  );
  const itemsForCreate = fingerprints.filter((fp) => !scopedFingerprints.includes(fp));
  const itemsForUpdate = scopedWorkItems.filter(
    (wi) => fingerprints.includes(wi.fields[FieldNameFingerprintQualified] as string) && !itemsForDelete.includes(wi)
  );
  const itemsForTransition = scopedWorkItems.filter(
    (wi) => !fingerprints.includes(wi.fields[FieldNameFingerprintQualified] as string)
  );

  // Setup common properties, and awaiting
  let pendingOps: Promise<any>[] = [];
  const allItemProps: WorkItemOptions = {
    areaPath: config.issueAreaPath,
    buildDefName,
    buildId,
    buildLabel,
    categoryFieldName: FieldNameCategoryQualified,
    fingerprintFieldName: FieldNameFingerprintQualified,
    issue: undefined as unknown as AnalysisIssue,
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
  const transitionTo = 'Done'; // Relatively safe for now. There are ways of getting this dynamically.
  for (const workItem of itemsForTransition) {
    const fingerprint = workItem.fields[FieldNameFingerprintQualified] as string;
    const issue = analysisItems[fingerprint];
    pendingOps.push(
      workItemClient
        .comment(
          workItem.id,
          `Transitioned to ${transitionTo} because Code Climate doesn't see this particular issue anymore. It may still exist at a different location in code because fingerprints are location sensitive.`
        )
        .then(() => workItemClient.get(['System.Id'], workItem.id)) // The `Boards` server seems to track retrieval-based time for consistency checks
        .then(() => workItemClient.transition({ ...allItemProps, transitionTo, id: workItem.id, issue }))
    );
    pendingOps = await waitAtThreshold(pendingOps);
  }

  // Wait for other ops to finish before handling deletes
  if (!!pendingOps && pendingOps.length > 0) {
    await Promise.all(pendingOps);
  }

  // Delete duplicate work items
  tl.debug(`Deleting ${itemsForDelete.length} duplicate work items`);
  for (const workItem of itemsForDelete) {
    const fingerprint = workItem.fields[FieldNameFingerprintQualified] as string;
    const issue = analysisItems[fingerprint];
    pendingOps.push(workItemClient.delete({ ...allItemProps, id: workItem.id, issue }, config.deleteDestroy));
    pendingOps = await waitAtThreshold(pendingOps);
  }

  // Wait for any stragglers to finish
  if (!!pendingOps && pendingOps.length > 0) {
    await Promise.all(pendingOps);
  }
}
