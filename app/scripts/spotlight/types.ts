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

export enum Step {
  Commands,
  OpenRecordEntity,
  OpenRecordId,
  OpenListEntity,
  NewRecordEntity,
  ImpersonateSearch,
  FetchXml,
  EntityInfoDisplay,
  EnvironmentInfoDisplay,
}
