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
    }
  }
);
