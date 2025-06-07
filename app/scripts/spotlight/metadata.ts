/** Fetches and caches entity metadata for the current environment. */
import { EntityInfo } from './types';

let entityMetadataPromise: Promise<EntityInfo[]> | null = null;
const storageKey = `dl-entity-metadata-${location.origin}`;

/**
 * Load entity metadata and cache it per environment. The first call fetches
 * metadata from the server and stores it in localStorage. Subsequent calls
 * return the cached version unless `force` is true.
 */
export async function loadEntityMetadata(force = false): Promise<EntityInfo[]> {
  if (entityMetadataPromise && !force) return entityMetadataPromise;

  const cached = localStorage.getItem(storageKey);
  if (cached && !force) {
    const list = JSON.parse(cached) as EntityInfo[];
    list.sort((a, b) => a.displayName.localeCompare(b.displayName));
    entityMetadataPromise = Promise.resolve(list);
    return entityMetadataPromise;
  }

  const url = `${location.origin}/api/data/v9.1/EntityDefinitions?$select=DisplayName,LogicalName,PrimaryIdAttribute,PrimaryNameAttribute,LogicalCollectionName`;
  entityMetadataPromise = fetch(url)
    .then((r) => r.json())
    .then((d) =>
      d.value.map((v: any) => ({
        logicalName: v.LogicalName,
        displayName: v.DisplayName?.UserLocalizedLabel?.Label || v.LogicalName,
        primaryIdAttribute: v.PrimaryIdAttribute,
        primaryNameAttribute: v.PrimaryNameAttribute,
        logicalCollectionName: v.LogicalCollectionName,
      }))
    )
    .then((list: EntityInfo[]) => {
      list.sort((a, b) => a.displayName.localeCompare(b.displayName));
      localStorage.setItem(storageKey, JSON.stringify(list));
      return list;
    });

  return entityMetadataPromise;
}
