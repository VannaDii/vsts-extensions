import path from 'path';
import got, { OptionsOfJSONResponseBody, HTTPError } from 'got';
import MarkdownIt from 'markdown-it';
import * as tl from 'azure-pipelines-task-lib/task';
import { customAlphabet } from 'nanoid/non-secure';
import MarkdownItHighlightJs from 'markdown-it-highlightjs';
import {
  AnalysisIssue,
  BuildLinkType,
  QueryCondition,
  WorkItem,
  WorkItemBatch,
  WorkItemField,
  WorkItemOptions,
  WorkItemPatch,
  WorkItemQueryResult,
} from './types';
import { getEvenHash } from './utils';

type LogType = 'debug' | 'info' | 'warn' | 'error';
type OpContext = { correlationId: string; [key: string]: string | number | boolean | object };
const SeverityMap: { [key: string]: string } = {
  info: '4 - Low',
  minor: '3 - Medium',
  major: '2 - High',
  critical: '1 - Critical',
  blocker: '1 - Critical',
};

export class WorkItemClient {
  private readonly witUrls = {
    Fields: 'fields',
    WIQL: 'wiql',
    WorkItemsBatch: 'workitemsbatch',
    WorkItems: 'workitems',
  };
  private readonly markdown = new MarkdownIt({ linkify: true, typographer: true, xhtmlOut: true }).use(
    MarkdownItHighlightJs,
    {
      inline: true,
    }
  );
  private readonly nanoid = customAlphabet('1234567890abcdefghijklmnopqrstuvwxyz', 10);
  private readonly webOpts: OptionsOfJSONResponseBody = {
    searchParams: { 'api-version': '6.0' },
    headers: {
      authorization: `Bearer ${this.accessToken}`,
    },
    resolveBodyOnly: false,
    responseType: 'json',
    isStream: false,
  };

  constructor(
    private readonly collectionUrl: string,
    private readonly projName: string,
    private readonly accessToken: string
  ) {}

  private qualify(url: string, useProject: boolean = true) {
    return useProject
      ? path.join(this.collectionUrl, this.projName, '_apis/wit', url)
      : path.join(this.collectionUrl, '_apis/wit', url);
  }

  private log(type: LogType, context: OpContext, message: string) {
    switch (type) {
      case 'debug':
        return tl.debug(`[${context.correlationId}] ${message} ${JSON.stringify(context)}`);
      case 'error':
        return tl.error(`[${context.correlationId}] ${message} ${JSON.stringify(context)}`);
      case 'warn':
        return tl.warning(`[${context.correlationId}] ${message} ${JSON.stringify(context)}`);
      case 'info':
        return console.info(`[${context.correlationId}] ${message}`, context);
    }
  }

  private async tryCatch<T>(op: (context: OpContext) => Promise<T>, reThrow: boolean = false): Promise<T | undefined> {
    const correlationId = this.nanoid();
    const context: OpContext = { correlationId };
    try {
      return await op(context);
    } catch (err) {
      const errorKeys = Object.keys(err);
      const response = err.response?.body || 'No response data available';
      const error = !!err.toJSON
        ? err.toJSON() // For advanced errors
        : errorKeys.length > 0
        ? errorKeys.reduce((p, c) => ({ ...p, [c]: err[c] }), {}) // For basic custom errors
        : { name: err.name, message: err.message, stack: err.stack }; // For built-in errors
      tl.error(`[${correlationId}] ${JSON.stringify({ error, context, response }, undefined, 2)}`);
      if (reThrow) throw err;
    }
    return undefined;
  }

  private getAffectedLinesMarkup(issue: AnalysisIssue, sourceRoot: string): string {
    const lines: string[] = [];
    const category = (issue.categories.length > 0 ? issue.categories[0] : 'Unknown').toUpperCase();
    switch (category) {
      case 'STYLE':
        lines.push(
          `Open ${sourceRoot}/${issue.location.path} and observe lines ${issue.location.positions.begin.line} - ${issue.location.positions.end.line}.`
        );
        break;
      case 'COMPLEXITY':
        lines.push(
          `Open ${sourceRoot}/${issue.location.path} and observe lines ${issue.location.lines.begin} - ${issue.location.lines.end}.`
        );
        break;
      case 'DUPLICATION':
        lines.push(
          `Open ${sourceRoot}/${issue.location.path} and observe lines ${issue.location.lines.begin} - ${issue.location.lines.end}.`,
          ...issue.other_locations.map(
            (loc) => `Open ${sourceRoot}/${loc.path} and observe lines ${loc.lines.begin} - ${loc.lines.end}.`
          )
        );
        break;
    }
    return `<ol><li>${lines.join('</li><li>')}</li></ol>`;
  }

  private getStandardIssueOps(opts: WorkItemOptions): WorkItemPatch {
    if (!opts.issue) {
      throw new Error(`Cannot build operations without an issue. ${JSON.stringify(opts)}`);
    }

    const checkName = opts.issue.check_name;
    const timestamp = new Date().toISOString();
    const buildLinkType: BuildLinkType = 'Found in build';
    const titlePrefix = `${checkName[0].toUpperCase()}${checkName.replace('-', ' ').slice(1)}`;
    const basicDesc = this.getAffectedLinesMarkup(opts.issue, opts.sourceRoot);
    const extDesc = opts.issue.content?.body.length > 0 ? this.markdown.render(opts.issue.content.body) : '';
    const sourceRootHash = getEvenHash(opts.sourceRoot);

    return [
      {
        op: 'add',
        path: `/fields/${opts.fingerprintFieldName}`,
        value: `${sourceRootHash}-${opts.issue.fingerprint}`,
        from: null,
      },
      {
        op: 'add',
        path: `/fields/${opts.categoryFieldName}`,
        value: opts.issue.categories.length > 0 ? opts.issue.categories[0] : 'Unknown',
        from: null,
      },
      {
        op: 'add',
        path: '/fields/System.Tags',
        value: ['Code Climate', ...opts.issue.categories, opts.issue.check_name].join(','),
        from: null,
      },
      {
        op: 'add',
        path: '/fields/System.Title',
        value: `${titlePrefix} in ${opts.sourceRoot}/${opts.issue.location.path}`,
        from: null,
      },
      {
        op: 'add',
        path: '/fields/System.State',
        value: opts.transitionTo || 'New',
        from: null,
      },
      {
        op: 'add',
        path: '/fields/Microsoft.VSTS.Build.FoundIn',
        value: `${opts.buildDefName}_${opts.buildLabel}`,
        from: null,
      },
      {
        op: 'add',
        path: '/fields/Microsoft.VSTS.Scheduling.Effort',
        value: Math.max(1, opts.issue.remediation_points / 10000).toString(),
        from: null,
      },
      {
        op: 'add',
        path: '/fields/Microsoft.VSTS.TCM.ReproSteps',
        value: `${opts.issue.description}<br/><br/>${basicDesc}<br/><br/>${extDesc}`,
        from: null,
      },
      {
        op: 'add',
        path: '/fields/System.AreaPath',
        value: opts.areaPath,
        from: null,
      },
      {
        op: 'add',
        path: '/fields/System.IterationPath',
        value: opts.iterationPath,
        from: null,
      },
      {
        op: 'add',
        path: '/fields/Microsoft.VSTS.Common.ValueArea',
        value: 'Architectural',
        from: null,
      },
      {
        op: 'add',
        path: '/fields/Microsoft.VSTS.Common.Severity',
        value: SeverityMap[opts.issue.severity.toLowerCase()] || '3 - Medium',
        from: null,
      },
      {
        op: 'add',
        path: '/relations/-',
        value: {
          rel: 'ArtifactLink',
          url: `vstfs:///Build/Build/${opts.buildId}`,
          attributes: {
            authorizedDate: timestamp,
            resourceCreatedDate: timestamp,
            resourceModifiedDate: timestamp,
            revisedDate: '9999-01-01T00:00:00Z',
            comment: 'Linked by Code Climate',
            name: buildLinkType,
          },
        },
      },
    ];
  }

  async create(opts: WorkItemOptions) {
    return this.tryCatch(async (context) => {
      const workItemUrl = this.qualify(path.join(this.witUrls.WorkItems, `$${opts.type.toLowerCase()}`));
      const ops = this.getStandardIssueOps(opts);

      context.url = workItemUrl;
      context.scope = this.create.name;
      this.log('debug', context, 'Creating work item for analysis issue.');
      const result = await got.patch<WorkItem>(workItemUrl, {
        ...this.webOpts,
        json: ops,
        headers: { ...this.webOpts.headers, 'Content-Type': 'application/json-patch+json' },
      });

      return result.body;
    });
  }

  async update(opts: WorkItemOptions) {
    return this.tryCatch(async (context) => {
      if (!opts.id) throw new Error('Cannot update a work item without an ID.');

      const workItemUrl = this.qualify(path.join(this.witUrls.WorkItems, opts.id.toString()));
      const ops = this.getStandardIssueOps(opts);

      context.url = workItemUrl;
      context.scope = this.update.name;
      this.log('debug', context, 'Updating work item for analysis issue.');
      const result = await got.patch<WorkItem>(workItemUrl, {
        ...this.webOpts,
        json: ops,
        headers: { ...this.webOpts.headers, 'Content-Type': 'application/json-patch+json' },
      });

      return result.body;
    });
  }

  async transition(opts: WorkItemOptions) {
    return this.tryCatch(async (context) => {
      if (!opts.id) throw new Error('Cannot transition a work item without an ID.');
      if (!opts.transitionTo) throw new Error('Cannot transition a work item without a target state.');

      const workItemUrl = this.qualify(path.join(this.witUrls.WorkItems, opts.id.toString()));
      const ops: WorkItemPatch = [{ op: 'add', path: '/fields/System.State', value: opts.transitionTo, from: null }];

      context.url = workItemUrl;
      context.scope = this.transition.name;
      this.log('debug', context, 'Transitioning work item for analysis issue.');
      const result = await got.patch<WorkItem>(workItemUrl, {
        ...this.webOpts,
        json: ops,
        headers: { ...this.webOpts.headers, 'Content-Type': 'application/json-patch+json' },
      });

      return result.body;
    });
  }

  async comment(id: number, comment: string) {
    return this.tryCatch(async (context) => {
      if (!id || id < 1) throw new Error('Cannot comment on a work item without an ID.');

      const workItemUrl = this.qualify(path.join('workItems', id.toString(), 'comments'));

      context.url = workItemUrl;
      context.scope = this.comment.name;
      this.log('debug', context, 'Commenting on work item for analysis issue.');
      const result = await got.post<WorkItem>(workItemUrl, {
        ...this.webOpts,
        json: { text: comment },
        searchParams: { 'api-version': '6.0-preview.3' },
        headers: { ...this.webOpts.headers, 'Content-Type': 'application/json-patch+json' },
      });
    });
  }

  async get(fields: string[], ...ids: number[]) {
    return this.tryCatch(async (context) => {
      const batchUrl = this.qualify(this.witUrls.WorkItemsBatch);
      context.url = batchUrl;
      context.scope = this.get.name;
      context.fields = fields;
      context.ids = ids;
      this.log('debug', context, 'Getting work items.');
      if (!ids || ids.length === 0) {
        return {
          count: 0,
          value: [],
        } as WorkItemBatch;
      }
      const result = await got.post<WorkItemBatch>(batchUrl, { ...this.webOpts, json: { ids, fields } });

      return result.body;
    });
  }

  async query(fields: string[], conditions: QueryCondition[]) {
    return this.tryCatch(async (context) => {
      const fieldSet = fields.map((v) => `[${v}]`).join(', ');
      const conditionSet = conditions.map((c) => `[${c.fieldName}] ${c.operator} ${c.value}`).join(' AND ');
      const wiqlQuery = `Select ${fieldSet} From WorkItems Where ${conditionSet}`;
      const wiqlUrl = this.qualify(this.witUrls.WIQL);

      context.url = this.witUrls.WIQL;
      context.scope = this.query.name;
      context.wiqlQuery = wiqlQuery;
      this.log('debug', context, 'Querying work items.');
      const result = await got.post<WorkItemQueryResult>(wiqlUrl, { ...this.webOpts, json: { query: wiqlQuery } });

      return result.body;
    });
  }

  async fieldEnsure(
    fieldName: string,
    factory: (fieldName: string, isIdentity: boolean) => WorkItemField,
    isIdentity: boolean
  ) {
    let field!: WorkItemField | undefined;
    try {
      field = await this.fieldGet(fieldName);
      if (!field?.referenceName) throw new Error(`Cannot find ${fieldName}`);
    } catch (error) {
      if (!factory) throw error;
      field = factory(fieldName, isIdentity);
      field = await this.fieldCreate(field);
    }
    return field;
  }

  async fieldCreate(field: WorkItemField) {
    return this.tryCatch(async (context) => {
      const fieldsUrl = this.qualify(this.witUrls.Fields);
      context.url = fieldsUrl;
      context.scope = this.fieldCreate.name;
      context.field = field;
      this.log('info', context, 'Creating work item field.');
      const result = await got.post<WorkItemField>(fieldsUrl, { ...this.webOpts, json: field });
      context.field = field;
      this.log('info', context, 'Created work item field.');

      return result.body;
    }, true);
  }

  async fieldGet(fieldName: string) {
    return this.tryCatch(async (context) => {
      const fieldUrlProj = this.qualify(path.join(this.witUrls.Fields, fieldName));
      const fieldUrlColl = this.qualify(path.join(this.witUrls.Fields, fieldName), false);
      context.urlProj = fieldUrlProj;
      context.urlColl = fieldUrlColl;
      context.scope = this.fieldGet.name;
      this.log('debug', context, 'Getting work item field.');
      const [result, fallback] = await Promise.all([
        got<WorkItemField>(fieldUrlProj, { ...this.webOpts, throwHttpErrors: false }),
        got<WorkItemField>(fieldUrlColl, { ...this.webOpts, throwHttpErrors: false }),
      ]);

      if (result.statusCode !== 200 && fallback.statusCode !== 200) {
        throw new HTTPError(fallback);
      }

      return result.statusCode === 200 ? result.body : fallback.body;
    });
  }
}
