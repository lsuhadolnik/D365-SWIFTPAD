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
      document.title = `SWIFTPAD - Processes - ${entityName}`;
      const h = document.querySelector('h2');
      if (h) h.textContent = `Processes & Business Rules for ${entityName}`;
    }
    const rows = rowsData
      .map((r) => {
        const cells = r
          .map((c, i) => {
            if (i === 0) return '';
            return i !== 1
              ? `<td>${c.value}</td>`
              : `<td class='name'><a target="_blank" href="${r[0].value}">${c.value}</a></td>`;
          })
          .join('');
        return `<tr>${cells}</tr>`;
      })
      .join('');
    if (rowsData.length > 0) {
      document.getElementById('results').innerHTML = rows;
      new List('grid', {
        valueNames: ['name'],
      });
    }
  }
);
