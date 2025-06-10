export interface ViewInfo {
  columns: string[];
  fetchxml: string;
}

export async function loadDefaultViewInfo(entity: { logicalName: string }): Promise<ViewInfo> {
  const url = `${location.origin}/api/data/v9.1/savedqueries?$select=fetchxml,layoutxml&$filter=returnedtypecode eq '${entity.logicalName}' and isdefault eq true and querytype eq 0`;
  const resp = await fetch(url);
  const data = await resp.json();
  if (!data.value?.length) return { columns: [], fetchxml: '' };
  const view = data.value[0];
  const parser = new DOMParser();
  const doc = parser.parseFromString(view.layoutxml, 'text/xml');
  const cols = Array.from(doc.querySelectorAll('cell[name]'))
    .map((c) => c.getAttribute('name') || '')
    .filter((c) => !!c);
  return { columns: cols, fetchxml: view.fetchxml };
}

export async function searchRecords(
  entity: {
    logicalCollectionName: string;
    primaryIdAttribute: string;
  },
  fields: string[],
  query: string
): Promise<any[]> {
  if (!query) return [];
  const select = Array.from(new Set([entity.primaryIdAttribute, ...fields])).join(',');
  const filter = fields.map((f) => `contains(${f},'${query}')`).join(' or ');
  const url = `${location.origin}/api/data/v9.1/${entity.logicalCollectionName}?$select=${select}&$filter=${encodeURIComponent(filter)}&$top=20`;
  const resp = await fetch(url);
  const data = await resp.json();
  return data.value || [];
}

export function renderTable(
  container: HTMLElement,
  columns: string[],
  records: any[],
  idAttr: string,
  onSelect: (id: string) => void
) {
  container.innerHTML = '';
  const table = document.createElement('table');
  const thead = document.createElement('thead');
  const hr = document.createElement('tr');
  columns.forEach((c) => {
    const th = document.createElement('th');
    th.textContent = c;
    hr.append(th);
  });
  thead.append(hr);
  table.append(thead);
  const tbody = document.createElement('tbody');
  records.forEach((r) => {
    const tr = document.createElement('tr');
    columns.forEach((c) => {
      const td = document.createElement('td');
      const val = r[c] ?? '';
      td.textContent = val;
      tr.append(td);
    });
    tr.addEventListener('click', () => onSelect(r[idAttr]));
    tbody.append(tr);
  });
  table.append(tbody);
  container.append(table);
}
