import { pref } from '../prefix';

chrome.runtime.sendMessage(
  {
    type: pref('Page'),
    category: 'Load',
  },
  function (resp) {
    const data: any = (resp as any).data ?? resp;
    const rowsData = data.rows ?? data;
    const entityName = data.entityName as string | undefined;
    if (entityName) {
      document.title = `SWIFTPAD - Option Sets - ${entityName}`;
      const h = document.getElementById('header');
      if (h) h.textContent = `Option Sets for ${entityName}`;
    }
    const rows = rowsData
      .map((r) => {
        const cells = `<td class="name">${r.name}</td><td class="display">${r.displayName}</td>
                    <td>
                    <table>
                    <thead>
                    <tr><th>Name</th><th>Value</th></tr>
                    </thead>
                    <tbody>
                    ${r.options.map((o) => '<tr><td>' + o.text + '</td><td>' + o.value + '</td></tr>').join('')}
                    </tbody>
                    </table>
                    </td>`;
        return `<tr>${cells}</tr>`;
      })
      .join('');
    if (rowsData.length > 0) {
      document.getElementById('results').innerHTML = rows;
      const list = new List('grid', {
        valueNames: ['name', 'display'],
      });
      list.sort('name');

      const headerCells = document.querySelectorAll<HTMLTableCellElement>('#tableheader th');
      headerCells.forEach((cell, idx) => {
        const key = idx === 0 ? 'name' : 'display';
        cell.style.cursor = 'pointer';
        cell.addEventListener('click', () => list.sort(key));
      });

      const toggle = document.getElementById('toggle-display') as HTMLInputElement | null;
      const updateDisplay = () => {
        const display = toggle?.checked ?? true;
        document.querySelectorAll<HTMLTableCellElement>('#results td.display').forEach((td) => {
          td.style.display = display ? '' : 'none';
        });
        document.querySelectorAll<HTMLTableCellElement>('#tableheader th:nth-child(2)').forEach((th) => {
          th.style.display = display ? '' : 'none';
        });
      };
      if (toggle) {
        toggle.addEventListener('change', updateDisplay);
        updateDisplay();
      }
    }
  }
);
