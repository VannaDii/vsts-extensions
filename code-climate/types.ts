export type AnalysisFormats = 'json' | 'text' | 'html';

export type TaskConfig = {
  configFilePath: string;
  analysisFormat: AnalysisFormats;
  sourcePath: string;
  outputPath: string;
  debug: boolean;
  engineTimeout: number;
  memLimit: number;
  trackIssues: boolean;
};

export type BuildLinkType = 'Build' | 'Found in build' | 'Integrated in build';

/**  The class to represent a collection of REST reference links. */
export type ReferenceLinks = { readonly links: Object };

/**  The type of the field. */
export type FieldType =
  | 'boolean'
  | 'dateTime'
  | 'double'
  | 'guid'
  | 'history'
  | 'html'
  | 'identity'
  | 'integer'
  | 'picklistDouble'
  | 'picklistInteger'
  | 'picklistString'
  | 'plainText'
  | 'string'
  | 'treePath';

/**  The usage of the field. */
export type FieldUsage = 'none' | 'tree' | 'workItem' | 'workItemLink' | 'workItemTypeExtension';

/**  The work item field operation type. */
export type WorkItemOperation = 'add' | 'copy' | 'move' | 'remove' | 'replace' | 'test';

export type WorkItemType = 'bug';

export type WorkItemPatch = WorkItemFieldPatch[];

export interface WorkItemFieldPatch {
  /** The path to copy from for the Move/Copy operation. */
  from?: string;

  /** The patch operation */
  op: WorkItemOperation;

  /** The path for the operation.
   * * In the case of an array, a zero based index can be used to specify the position in the array (e.g. /biscuits/0/name).
   * * The "-" character can be used instead of an index to insert at the end of the array (e.g. /biscuits/-).
   */
  path: string;

  /** The value for the operation. This is either a primitive or a JToken. */
  value: string | object;
}

/** Describes a work item field operation. */
export interface WorkItemFieldOperation {
  /** Friendly name of the operation. */
  name: string;

  /** Reference name of the operation. */
  referenceName?: string;
}

export interface WorkItemRelation {
  /**  Collection of link attributes. */
  attributes: object;

  /**  Relation type. */
  rel: string;

  /**  Link url. */
  url: string;
}

export interface WorkItemCommentVersionRef {
  /** The id assigned to the comment. */
  commentId: number;

  /** [Internal] The work item revision where this comment was originally added. */
  createdInRevision: number;

  /** [Internal] Specifies whether comment was deleted. */
  isDeleted: boolean;

  /** [Internal] The text of the comment. */
  text: string;

  /**  The URL to this item. */
  url: string;

  /** The version number. */
  version: number;
}

export interface WorkItem {
  /**  Link references to related REST resources. */
  _links?: ReferenceLinks;

  /** Reference to a specific version of the comment added/edited/deleted in this revision. */
  commentVersionRef?: WorkItemCommentVersionRef;

  /**  Map of field and values for the work item. */
  fields: { [key: string]: string | object };

  /** The work item ID. */
  id: number;

  /**  Relations of the work item. */
  relations?: WorkItemRelation[];

  /** Revision number of the work item. */
  rev: number;

  /**  The URL to this work item. */
  url: string;
}

/** Describes a field on a work item and it's properties specific to that work item type. */
export interface WorkItemField {
  /** Link references to related REST resources. */
  _links?: ReferenceLinks;

  /** Indicates whether the field is sortable in server queries. */
  canSortBy: boolean;

  /**  The description of the field. */
  description?: string;

  /** Indicates whether this field is deleted. */
  isDeleted: boolean;

  /** Indicates whether this field is an identity field. */
  isIdentity: boolean;

  /** Indicates whether this instance is picklist. */
  isPicklist: boolean;

  /** Indicates whether this instance is a suggested picklist . */
  isPicklistSuggested: boolean;

  /** Indicates whether the field can be queried in the server. */
  isQueryable: boolean;

  /** The name of the field. */
  name: string;

  /** If this field is picklist, the identifier of the picklist associated, otherwise null */
  picklistId?: string;

  /** Indicates whether the field is [read only]. */
  readOnly: boolean;

  /** The reference name of the field. */
  referenceName: string;

  /** The supported operations on this field. */
  supportedOperations: WorkItemFieldOperation[];

  /** The type of the field. */
  type: FieldType;

  /** The URL of the field. */
  url?: string;

  /** The usage of the field. */
  usage: FieldUsage;
}

export const AllSupportedOperations: WorkItemFieldOperation[] = [
  {
    referenceName: 'SupportedOperations.Equals',
    name: '=',
  },
  {
    referenceName: 'SupportedOperations.NotEquals',
    name: '<>',
  },
  {
    referenceName: 'SupportedOperations.GreaterThan',
    name: '>',
  },
  {
    referenceName: 'SupportedOperations.LessThan',
    name: '<',
  },
  {
    referenceName: 'SupportedOperations.GreaterThanEquals',
    name: '>=',
  },
  {
    referenceName: 'SupportedOperations.LessThanEquals',
    name: '<=',
  },
  {
    referenceName: 'SupportedOperations.Contains',
    name: 'Contains',
  },
  {
    referenceName: 'SupportedOperations.NotContains',
    name: 'Does Not Contain',
  },
  {
    referenceName: 'SupportedOperations.In',
    name: 'In',
  },
  {
    name: 'Not In',
  },
  {
    referenceName: 'SupportedOperations.InGroup',
    name: 'In Group',
  },
  {
    referenceName: 'SupportedOperations.NotInGroup',
    name: 'Not In Group',
  },
  {
    referenceName: 'SupportedOperations.Ever',
    name: 'Was Ever',
  },
  {
    referenceName: 'SupportedOperations.EqualsField',
    name: '= [Field]',
  },
  {
    referenceName: 'SupportedOperations.NotEqualsField',
    name: '<> [Field]',
  },
  {
    referenceName: 'SupportedOperations.GreaterThanField',
    name: '> [Field]',
  },
  {
    referenceName: 'SupportedOperations.LessThanField',
    name: '< [Field]',
  },
  {
    referenceName: 'SupportedOperations.GreaterThanEqualsField',
    name: '>= [Field]',
  },
  {
    referenceName: 'SupportedOperations.LessThanEqualsField',
    name: '<= [Field]',
  },
];

export interface WorkItemFieldReference {
  /** The friendly name of the field. */
  name: string;

  /** The reference name of the field. */
  referenceName: string;

  /** The REST URL of the resource. */
  url: string;
}

export type QueryResultType = 'workItem' | 'workItemLink';

export type QueryType = 'flat' | 'oneHop' | 'tree';

export interface WorkItemQuerySortColumn {
  /** The direction to sort by. */
  descending: boolean;

  /** A work item field. */
  field: WorkItemFieldReference;
}

export interface WorkItemReference {
  /** Work item ID. */
  id: number;

  /** REST API URL of the resource */
  url: string;
}

export interface WorkItemLink {
  /** The type of link. */
  rel: string;

  /** The source work item. */
  source: WorkItemReference;

  /** The target work item. */
  target: WorkItemReference;
}

export type QueryCondition = { fieldName: string; operator: string; value: string | number | boolean };

export interface WorkItemQueryResult {
  /**  The date the query was run in the context of. */
  asOf: string;

  /**  The columns of the query. */
  columns: WorkItemFieldReference[];

  /** The result type */
  queryResultType: QueryResultType;

  /** The type of the query */
  queryType: QueryType;

  /** The sort columns of the query. */
  sortColumns: WorkItemQuerySortColumn[];

  /**  The work item links returned by the query. */
  workItemRelations: WorkItemLink[];

  /** The work items returned by the query. */
  workItems: WorkItemReference[];
}

export interface WorkItemBatch {
  count: number;
  value: WorkItem[];
}

export interface AnalysisItem {
  type: 'measurement' | 'issue';
  engine_name: string;
}

export interface AnalysisMeasurement extends AnalysisItem {
  name: string;
  type: 'measurement';
  value: number;
}

export interface AnalysisIssueLocation {
  path: string;
  positions: {
    begin: {
      line: number;
      column: number;
    };
    end: {
      line: number;
      column: number;
    };
  };
}

export interface AnalysisIssue extends AnalysisItem {
  type: 'issue';
  check_name: string;
  content: {
    body: string;
  };
  description: string;
  categories: string[];
  remediation_points: number;
  location: AnalysisIssueLocation;
  fingerprint: string;
  severity: string;
}
