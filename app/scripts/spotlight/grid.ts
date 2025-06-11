export interface ViewInfo {
  columns: { name: string; label: string }[];
}

import { EntityInfo } from './types';

export async function loadPrimaryView(entity: string): Promise<ViewInfo> {
  const url = `${location.origin}/api/data/v9.1/savedqueries?$select=fetchxml,layoutxml&$filter=isdefault eq true and returnedtypecode eq '${entity}'`;
  const resp = await fetch(url);
  const data = await resp.json();
  const item = data.value?.[0];
  const info: ViewInfo = { columns: [] };
  if (item?.layoutxml) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(item.layoutxml, 'text/xml');
    const cells = Array.from(doc.getElementsByTagName('cell'));
    info.columns = cells
      .map((c) => ({ name: c.getAttribute('name') || '', label: c.getAttribute('name') || '' }))
      .filter((c) => c.name);
  }
  return info;
}

export async function queryRecords(
  entity: string,
  q: string,
  view: ViewInfo,
  info: EntityInfo
): Promise<{ id: string; cells: string[] }[]> {
  if (/^[{]?[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}[}]?$/.test(q)) {
    const id = q.replace(/[{}]/g, '');
    return [{ id, cells: [id] }];
  }
  if (q.length < 2) return [];
  const escaped = q.replace(/'/g, "''");
  const select = [info.primaryIdAttribute, ...view.columns.map((c) => c.name)].join(',');
  const filter = view.columns.map((c) => `contains(${c.name},'${escaped}')`).join(' or ');
  const url = `${location.origin}/api/data/v9.1/${info.logicalCollectionName}?$select=${select}&$filter=${filter}&$top=20`;
  const data = await fetch(url).then((r) => r.json());
  return (data.value || []).map((r: any) => ({
    id: r[info.primaryIdAttribute],
    cells: view.columns.map((c) => r[c.name] ?? ''),
  }));
}

export function renderGrid(
  container: HTMLElement,
  view: ViewInfo,
  rows: { id: string; cells: string[] }[],
  onClick: (id: string) => void,
  onSelect: (row: HTMLTableRowElement | null) => void
) {
  container.innerHTML = '';
  const table = document.createElement('table');
  table.className = 'dl-grid';
  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  view.columns.forEach((c) => {
    const th = document.createElement('th');
    th.textContent = c.label;
    headRow.append(th);
  });
  thead.append(headRow);
  const tbody = document.createElement('tbody');
  rows.forEach((r) => {
    const tr = document.createElement('tr');
    tr.dataset.id = r.id;
    r.cells.forEach((v) => {
      const td = document.createElement('td');
      td.textContent = v;
      tr.append(td);
    });
    tr.className = 'dl-listitem';
    tr.addEventListener('mouseenter', () => onSelect(tr));
    tr.addEventListener('click', () => onClick(r.id));
    tbody.append(tr);
  });
  table.append(thead, tbody);
  container.append(table);
}
