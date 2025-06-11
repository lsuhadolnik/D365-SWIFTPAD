export interface Command {
  id: string;
  category: string;
  title: string;
  icon?: string;
}

export interface EntityInfo {
  logicalName: string;
  displayName: string;
  primaryIdAttribute: string;
  primaryNameAttribute: string;
  logicalCollectionName: string;
}

export interface UserInfo {
  userId: string;
  userName: string;
  fullName: string;
}

export interface ViewColumn {
  name: string;
  label: string;
}

export interface ViewInfo {
  columns: ViewColumn[];
}

export enum Step {
  Commands,
  OpenRecordEntity,
  OpenRecordId,
  ImpersonateSearch,
  FetchXml,
  EntityInfoDisplay,
  EnvironmentInfoDisplay,
}
