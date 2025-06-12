import { pref } from './prefix';

chrome.runtime.sendMessage(
  {
    type: pref('Page'),
    category: 'Load',
  },
  (resp) => {
    const data: any = (resp as any).data ?? resp;
    const rows = data.rows ?? data;
    const category = (resp as any).category ?? '';
    const entityName = data.entityName as string | undefined;
    const friendly =
      category === 'allFields'
        ? 'All Fields'
        : category === 'quickFindFields'
          ? 'Quick Find Fields'
          : category === 'entityMetadata'
            ? 'Entity Metadata'
            : category === 'environment'
              ? 'Environment'
              : category === 'myRoles'
                ? 'My Roles'
                : category;
    if (entityName && category) {
      document.title = `SWIFTPAD - ${friendly} - ${entityName}`;
      const header = document.getElementById('header');
      if (header) header.textContent = `${friendly} for ${entityName}`;
    }

    const virtualResults = document.createDocumentFragment();
    for (let i = 0; i < rows.length; i++) {
      if (i > 0) {
        const row = document.createElement('tr');
        rows[i].cells.forEach((x, idx) => {
          const cell = document.createElement('td');
          cell.className = idx === 0 ? 'name' : idx === 1 ? 'display' : 'value';
          cell.innerText = x;
          row.appendChild(cell);
        });
        virtualResults.appendChild(row);
      } else {
        const row = document.createElement('tr');
        rows[i].cells.forEach((x) => {
          const cell = document.createElement('td');
          cell.innerText = x;
          row.appendChild(cell);
        });
        document.getElementById('tableheader').appendChild(row);
      }
    }
    document.getElementById('results').appendChild(virtualResults);
    //@ts-ignore
    const list = new List('grid', {
      valueNames: ['name', 'display', 'value'],
    });
    list.sort('name');

    const headerCells = document.querySelectorAll<HTMLTableCellElement>('#tableheader td');
    headerCells.forEach((cell, idx) => {
      const key = idx === 0 ? 'name' : idx === 1 ? 'display' : 'value';
      cell.style.cursor = 'pointer';
      cell.addEventListener('click', () => list.sort(key));
    });

    const toggle = document.getElementById('toggle-display') as HTMLInputElement | null;
    const updateDisplay = () => {
      const display = toggle?.checked ?? true;
      document.querySelectorAll<HTMLTableCellElement>('#results td.display').forEach((td) => {
        td.style.display = display ? '' : 'none';
      });
      document.querySelectorAll<HTMLTableCellElement>('#tableheader td:nth-child(2)').forEach((th) => {
        th.style.display = display ? '' : 'none';
      });
    };
    if (toggle) {
      toggle.addEventListener('change', updateDisplay);
      updateDisplay();
    }
  }
);
