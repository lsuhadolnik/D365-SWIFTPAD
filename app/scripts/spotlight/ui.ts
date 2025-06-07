import { Command, EntityInfo, UserInfo, Step, SpotlightState } from './types';
import { loadCommands, fuzzyMatch } from './commands';
import { loadEntityMetadata } from './metadata';

// Icon mappings used when rendering the command list
const commandIcons: Record<string, string> = {
  openRecordSpotlight: 'launch',
  impersonateUserSpotlight: 'person_search',
  impersonationResetSpotlight: 'person_off',
  openAdmin: 'open_in_new',
  openMakePowerApps: 'open_in_new',
  entityInfoSpotlight: 'info',
  reloadData: 'refresh',
  runFetchXmlSpotlight: 'code',
};

const categoryIcons: Record<string, string> = {
  Navigation: 'open_in_new',
  Forms: 'description',
  Grid: 'table_view',
  Settings: 'settings',
  Impersonation: 'person',
  myRoles: 'account_circle',
  allUserRoles: 'people',
  quickFindFields: 'search',
  sendToFXB: 'code',
  '': 'extension',
};

let handleSpotlightMessage: ((message: any) => void) | null = null;
let spotlightCleanup: (() => void) | null = null;
let fetchResults: { id: string; name: string }[] = [];
let fetchEntity = '';
let recordResults: { id: string; name: string }[] = [];

/**
 * Initialize keyboard shortcut (Ctrl+Shift+P) to open spotlight
 */
export function initSpotlight() {
  if (!/\.crm.*\.dynamics\.com$/.test(window.location.hostname)) return;
  document.addEventListener('keydown', async (e) => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === 'KeyP') {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (!document.getElementById('dl-spotlight-backdrop')) {
        await openSpotlight();
      }
    } else if (e.key === 'Escape') {
      closeSpotlight();
    }
  });
}

/** Open entity list in a new tab */
function openEntityList(entity: string) {
  const xrm = (window as any).Xrm;
  const clientUrl =
    xrm?.Utility?.getGlobalContext?.()?.getCurrentAppUrl?.() || xrm?.Page?.context?.getClientUrl?.() || location.origin;
  const base = clientUrl + (clientUrl.includes('appid') ? '&' : '/main.aspx?');
  window.open(`${base}etn=${entity}&pagetype=entitylist`);
}

async function openSpotlight(options?: { tip?: boolean }) {
  const backdrop = document.createElement('div');
  backdrop.id = 'dl-spotlight-backdrop';
  backdrop.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.3);z-index:2147483647;';
  const container = document.createElement('div');
  container.id = 'dl-spotlight-container';
  container.style.cssText =
    'position:absolute;top:20%;left:50%;transform:translateX(-50%);background:rgba(255,255,255,0.45);color:#000;border-radius:12px;padding:16px;width:500px;box-shadow:0 8px 30px rgba(0,0,0,0.2);backdrop-filter:blur(9px);';

  const logo = document.createElement('img');
  logo.src = chrome.runtime.getURL('app/images/lp_ll.png');
  logo.style.cssText = 'position:absolute;top:8px;right:8px;height:32px;';

  if (!document.getElementById('dl-spotlight-icons')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.id = 'dl-spotlight-icons';
    link.href = 'https://fonts.googleapis.com/icon?family=Material+Icons';
    document.head.append(link);
    const style = document.createElement('style');
    style.textContent =
      '.dl-spinner{border:4px solid #f3f3f3;border-top:4px solid #555;border-radius:50%;width:24px;height:24px;animation:dl-spin 1s linear infinite;}@keyframes dl-spin{0%{transform:rotate(0deg);}100%{transform:rotate(360deg);}}';
    document.head.append(style);
  }
  const pillWrap = document.createElement('div');
  pillWrap.style.cssText = 'margin-bottom:6px;min-height:24px;';
  const input = document.createElement('input');
  input.type = 'text';
  input.id = 'dl-spotlight-input';
  input.autocomplete = 'off';
  input.setAttribute('autocorrect', 'off');
  input.setAttribute('spellcheck', 'false');
  input.style.cssText =
    'width:95%;padding:10px 12px;font-size:16px;border:none;outline:none;border-radius:6px;background:rgba(255,255,255,0.4);backdrop-filter:blur(4px);';
  const list = document.createElement('ul');
  list.style.cssText = 'max-height:300px;overflow-y:auto;margin:8px 0 0;padding:0;list-style:none;';
  const infoPanel = document.createElement('div');
  infoPanel.style.cssText =
    'display:none;margin-top:8px;font-size:14px;background:#f7f7f7;padding:8px;border-radius:6px;';
  const progress = document.createElement('div');
  progress.style.cssText = 'display:none;text-align:center;margin-top:6px;';
  progress.innerHTML =
    '<div class="dl-spinner" style="margin:0 auto"></div><div class="dl-progress-text" style="font-size:12px;color:#555;margin-top:4px;"></div>';
  const progressText = progress.querySelector<HTMLDivElement>('.dl-progress-text')!;
  container.append(logo, pillWrap, input, list, infoPanel, progress);
  if (options?.tip) {
    const tip = document.createElement('div');
    tip.textContent = 'Tip: Press Ctrl+Shift+P to open this window.';
    tip.style.cssText = 'margin-top:8px;font-size:12px;color:#555;text-align:right;';
    container.append(tip);
  }
  backdrop.append(container);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closeSpotlight();
  });
  document.body.append(backdrop);
  input.focus();
  const stateObj: SpotlightState = { query: '', state: Step.Commands, pills: [], selectedEntity: '' };
  input.value = stateObj.query;
  input.select();

  const commands = (await loadCommands()).filter((c) => c.id !== 'startImpersonationButton');
  let metadata: EntityInfo[] = [];
  let filtered: (Command | EntityInfo)[] = commands;
  let state: Step = stateObj.state;
  let selectedEntity = stateObj.selectedEntity;
  let users: UserInfo[] = [];
  const pills: string[] = [...stateObj.pills];

  if (state === Step.FetchXml) {
    state = Step.Commands;
    pills.length = 0;
    selectedEntity = '';
  }

  if (state === Step.OpenRecordEntity || state === Step.OpenRecordId) {
    progressText.textContent = 'Loading metadata...';
    progress.style.display = 'block';
    metadata = await loadEntityMetadata();
    progress.style.display = 'none';
    filtered = metadata;
    input.placeholder =
      state === Step.OpenRecordId ? 'Enter GUID or start typing the name of the entity' : 'Search entity...';
  } else if (state === Step.EntityInfoDisplay) {
    input.placeholder = '';
  } else if (state === Step.ImpersonateSearch) {
    input.placeholder = 'Search user...';
  } else {
    input.placeholder = 'Search commands...';
  }

  renderPills();

  let selected: HTMLLIElement | null = null;
  function select(li: HTMLLIElement | null) {
    if (selected) selected.style.background = '';
    selected = li;
    if (selected) {
      selected.style.background = '#e0e0e0';
      selected.scrollIntoView({ block: 'nearest' });
    }
  }

  function renderPills() {
    pillWrap.innerHTML = '';
    pills.forEach((p, idx) => {
      const span = document.createElement('span');
      span.textContent = p;
      span.style.cssText =
        'display:inline-block;background:#dedede;border-radius:12px;padding:2px 8px;margin-right:4px;font-size:12px;';
      if (idx === pills.length - 1) {
        const x = document.createElement('span');
        x.textContent = ' ×';
        x.style.cursor = 'pointer';
        x.addEventListener('click', () => {
          pills.pop();
          if (state === Step.OpenRecordId) {
            state = Step.OpenRecordEntity;
            input.placeholder = 'Search entity...';
            filtered = metadata;
            render();
          } else {
            state = Step.Commands;
            filtered = commands;
            render();
          }
          renderPills();
        });
        span.append(x);
      }
      pillWrap.append(span);
    });
  }

  function render() {
    list.innerHTML = '';
    infoPanel.style.display = 'none';
    list.style.display = '';
    if (state === Step.Commands) {
      const showAll = input.value.trim() === '';
      const cmds = showAll ? (filtered as Command[]) : (filtered as Command[]).slice(0, 20);
      cmds.forEach((cmd) => {
        const li = document.createElement('li');
        const icon = document.createElement('span');
        icon.className = 'material-icons';
        icon.textContent = cmd.icon || commandIcons[cmd.id] || categoryIcons[cmd.category] || 'chevron_right';
        icon.style.cssText = 'margin-right:8px;color:#a631af;font-size:15px;';
        const text = document.createElement('span');
        text.textContent = cmd.title;
        li.append(icon, text);
        li.dataset.id = cmd.id;
        li.dataset.category = cmd.category;
        li.style.cssText =
          'padding:6px 12px;cursor:pointer;border-radius:6px;font-size:14px;display:flex;align-items:center;';
        li.addEventListener('mouseenter', () => select(li));
        li.addEventListener('click', () => executeCommand(cmd));
        list.append(li);
      });
    } else if (state === Step.OpenRecordEntity) {
      (filtered as EntityInfo[]).slice(0, 20).forEach((ent) => {
        const li = document.createElement('li');
        li.innerHTML = `${ent.displayName} <code style="background:#f0f0f0;padding:2px 4px;border-radius:4px;font-family:monospace;">${ent.logicalName}</code>`;
        li.style.cssText = 'padding:6px 12px;cursor:pointer;border-radius:6px;font-size:14px;';
        li.addEventListener('mouseenter', () => select(li));
        li.addEventListener('click', () => {
          selectedEntity = ent.logicalName;
          pills.push(ent.displayName);
          state = Step.OpenRecordId;
          input.value = '';
          input.placeholder = 'Enter GUID or start typing the name of the entity';
          list.innerHTML = '';
          renderPills();
        });
        // Double click directly opens the list view
        li.addEventListener('dblclick', () => {
          closeSpotlight();
          openEntityList(ent.logicalName);
        });
        list.append(li);
      });
      if (state === Step.OpenRecordEntity) {
        const typed = input.value.trim();
        if (typed && !metadata.some((m) => m.logicalName.toLowerCase() === typed.toLowerCase())) {
          const li = document.createElement('li');
          li.innerHTML = `Use <code style="background:#f0f0f0;padding:2px 4px;border-radius:4px;font-family:monospace;">${typed}</code>`;
          li.style.cssText = 'padding:6px 12px;cursor:pointer;border-radius:6px;font-size:14px;color:#555;';
          li.addEventListener('mouseenter', () => select(li));
          li.addEventListener('click', () => {
            selectedEntity = typed;
            pills.push(typed);
            state = Step.OpenRecordId;
            input.value = '';
            input.placeholder = 'Enter GUID or start typing the name of the entity';
            list.innerHTML = '';
            renderPills();
          });
          list.append(li);
        }
      }
    } else if (state === Step.OpenRecordId) {
      const openListLi = document.createElement('li');
      openListLi.textContent = `Open ${selectedEntity} list`;
      openListLi.style.cssText = 'padding:6px 12px;cursor:pointer;border-radius:6px;font-size:14px;';
      openListLi.addEventListener('mouseenter', () => select(openListLi));
      openListLi.addEventListener('click', () => {
        closeSpotlight();
        openEntityList(selectedEntity);
      });
      list.append(openListLi);

      (filtered as { id: string; name: string }[]).slice(0, 20).forEach((r) => {
        const li = document.createElement('li');
        li.textContent = `${r.name} (${r.id})`;
        li.style.cssText = 'padding:6px 12px;cursor:pointer;border-radius:6px;font-size:14px;';
        li.addEventListener('mouseenter', () => select(li));
        li.addEventListener('click', () => {
          closeSpotlight();
          chrome.runtime.sendMessage({
            type: 'openRecordQuick',
            category: 'Navigation',
            content: { entity: selectedEntity, id: r.id },
          });
        });
        list.append(li);
      });
    } else if (state === Step.ImpersonateSearch) {
      (filtered as UserInfo[]).slice(0, 20).forEach((u) => {
        const li = document.createElement('li');
        li.textContent = `${u.fullName} (${u.userName})`;
        li.style.cssText = 'padding:6px 12px;cursor:pointer;border-radius:6px;font-size:14px;';
        li.addEventListener('mouseenter', () => select(li));
        li.addEventListener('click', () => {
          closeSpotlight();
          chrome.runtime.sendMessage({
            type: 'impersonation',
            category: 'Impersonation',
            content: { isActive: true, userName: u.userName, url: `${location.origin}/` },
          });
        });
        list.append(li);
      });
    } else if (state === Step.FetchXml) {
      (filtered as { id: string; name: string }[]).slice(0, 20).forEach((r) => {
        const li = document.createElement('li');
        li.textContent = `${r.name} (${r.id})`;
        li.style.cssText = 'padding:6px 12px;cursor:pointer;border-radius:6px;font-size:14px;';
        li.addEventListener('mouseenter', () => select(li));
        li.addEventListener('click', () => {
          closeSpotlight();
          chrome.runtime.sendMessage({
            type: 'openRecordQuick',
            category: 'Navigation',
            content: { entity: fetchEntity, id: r.id },
          });
        });
        list.append(li);
      });
    }
    select(list.firstElementChild as HTMLLIElement | null);
  }

  input.addEventListener('input', async () => {
    const q = input.value.trim();
    if (state === Step.Commands) {
      filtered = q ? commands.filter((c) => fuzzyMatch(q, c.title)) : commands;
    } else if (state === Step.OpenRecordEntity) {
      const items = metadata.filter((m) => fuzzyMatch(q, m.displayName) || fuzzyMatch(q, m.logicalName));
      if (q) {
        const lower = q.toLowerCase();
        items.sort((a, b) => {
          const aStarts =
            a.displayName.toLowerCase().startsWith(lower) || a.logicalName.toLowerCase().startsWith(lower) ? 0 : 1;
          const bStarts =
            b.displayName.toLowerCase().startsWith(lower) || b.logicalName.toLowerCase().startsWith(lower) ? 0 : 1;
          if (aStarts !== bStarts) return aStarts - bStarts;
          return a.displayName.localeCompare(b.displayName);
        });
      }
      filtered = items;
    } else if (state === Step.OpenRecordId) {
      const info = metadata.find((m) => m.logicalName === selectedEntity);
      if (info) {
        if (/^[{]?[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}[}]?$/.test(q)) {
          recordResults = [{ id: q.replace(/[{}]/g, ''), name: q.replace(/[{}]/g, '') }];
        } else if (q.length > 2) {
          progressText.textContent = 'Loading...';
          progress.style.display = 'block';
          const query = encodeURIComponent(q);
          const url = `${location.origin}/api/data/v9.1/${info.logicalCollectionName}?$select=${info.primaryIdAttribute},${info.primaryNameAttribute}&$filter=contains(${info.primaryNameAttribute},'${query}')&$top=20`;
          const data = await fetch(url).then((r) => r.json());
          recordResults = data.value.map((v: any) => ({
            id: v[info.primaryIdAttribute],
            name: v[info.primaryNameAttribute],
          }));
          progress.style.display = 'none';
        } else {
          recordResults = [];
        }
        filtered = recordResults;
      }
    } else if (state === Step.ImpersonateSearch) {
      const ql = q.toLowerCase();
      filtered = users.filter((u) => u.fullName.toLowerCase().includes(ql) || u.userName.toLowerCase().includes(ql));
    } else if (state === Step.FetchXml) {
      const ql = q.toLowerCase();
      filtered = fetchResults.filter((r) => r.name.toLowerCase().includes(ql) || r.id.toLowerCase().includes(ql));
    }
    render();
  });

  input.addEventListener('keydown', (ev) => {
    if (ev.key === 'ArrowDown') {
      select((selected?.nextElementSibling as HTMLLIElement) || list.firstElementChild);
      ev.preventDefault();
    } else if (ev.key === 'ArrowUp') {
      select((selected?.previousElementSibling as HTMLLIElement) || list.lastElementChild);
      ev.preventDefault();
    } else if (ev.key === 'Enter') {
      if (selected && state === Step.Commands) {
        const id = selected.dataset.id!;
        const cmd = commands.find((c) => c.id === id)!;
        executeCommand(cmd);
      } else if (selected && state === Step.OpenRecordEntity) {
        // Enter opens the list directly
        openEntityList((selected.textContent || '').split(' ')[0]);
        closeSpotlight();
      } else if (selected && state === Step.EntityInfoDisplay) {
        (selected as HTMLElement).click();
      } else if (selected && state === Step.OpenRecordId) {
        (selected as HTMLElement).click();
      } else if (selected && state === Step.FetchXml) {
        (selected as HTMLElement).click();
      }
    }
  });

  handleSpotlightMessage = function (message: any) {
    if (message.type === 'search' && message.category === 'Impersonation' && state === Step.ImpersonateSearch) {
      users = message.content as UserInfo[];
      filtered = users;
      progress.style.display = 'none';
      progressText.textContent = '';
      render();
    }
  };

  chrome.runtime.onMessage.addListener(handleSpotlightMessage);

  async function executeCommand(cmd: Command) {
    if (cmd.id === 'openRecordSpotlight') {
      state = Step.OpenRecordEntity;
      pills.push('Open');
      progressText.textContent = 'Loading metadata...';
      progress.style.display = 'block';
      metadata = await loadEntityMetadata();
      progress.style.display = 'none';
      filtered = metadata;
      input.placeholder = 'Search entity...';
      input.value = '';
      renderPills();
      render();
      return;
    } else if (cmd.id === 'runFetchXmlSpotlight') {
      state = Step.FetchXml;
      pills.push('FetchXML');
      list.style.display = 'none';
      infoPanel.style.display = 'block';
      infoPanel.innerHTML =
        '<div style="font-weight:bold;margin-bottom:4px;">FetchXML Runner</div>' +
        '<textarea id="dl-fetchxml" style="width:100%;height:80px;\"></textarea>' +
        '<div style="font-size:12px;margin-top:4px;">Press Ctrl+Enter to run</div>';
      input.style.display = 'none';
      const textarea = infoPanel.querySelector<HTMLTextAreaElement>('textarea')!;
      textarea.focus();
      textarea.addEventListener('keydown', async (ev) => {
        if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) {
          ev.preventDefault();
          progressText.textContent = 'Loading results...';
          progress.style.display = 'block';
          const xml = textarea.value.trim();
          const entityMatch = xml.match(/<entity name=['"](.*?)['"]>/);
          const entity = entityMatch ? entityMatch[1] : '';
          fetchEntity = entity;
          if (!entity) {
            progress.style.display = 'none';
            return;
          }
          const meta = (await loadEntityMetadata()).find((m) => m.logicalName === entity);
          const encoded = encodeURIComponent(xml);
          const resp = await fetch(
            `${location.origin}/api/data/v9.1/${meta?.logicalCollectionName || entity + 's'}?fetchXml=${encoded}`
          );
          const data = await resp.json();
          const primary = meta?.primaryNameAttribute || 'name';
          const idAttr = meta?.primaryIdAttribute || `${entity}id`;
          fetchResults = (data.value || []).map((r: any) => ({
            id: r[idAttr],
            name: r[primary] || r[idAttr],
          }));
          filtered = fetchResults;
          progress.style.display = 'none';
          list.style.display = '';
          infoPanel.style.display = 'none';
          input.style.display = '';
          input.value = '';
          state = Step.FetchXml;
          render();
        }
      });
      return;
    } else if (cmd.id === 'entityInfoSpotlight') {
      state = Step.EntityInfoDisplay;
      pills.push('Details');
      const logical = (window as any).Xrm?.Page?.data?.entity?.getEntityName() || '';
      const id = (window as any).Xrm?.Page?.data?.entity?.getId() || '';
      let name = '';
      if (logical) {
        progressText.textContent = 'Loading metadata...';
        progress.style.display = 'block';
        metadata = await loadEntityMetadata();
        const ent = metadata.find((m) => m.logicalName === logical);
        if (ent) {
          name = (window as any).Xrm?.Page?.getAttribute(ent.primaryNameAttribute)?.getValue() || '';
        }
        progress.style.display = 'none';
      }
      infoPanel.innerHTML = `<div><strong>${logical}</strong></div><div>Id: ${id}</div><div>Name: ${name}</div>`;
      list.style.display = 'none';
      infoPanel.style.display = 'block';
      renderPills();
      render();
      return;
    } else if (cmd.id === 'impersonateUserSpotlight') {
      state = Step.ImpersonateSearch;
      pills.push('Impersonate');
      input.placeholder = 'Search user...';
      input.value = '';
      users = [];
      filtered = [];
      progressText.textContent = 'Loading users...';
      progress.style.display = 'block';
      chrome.runtime.sendMessage({
        type: 'search',
        category: 'Impersonation',
        content: { userName: '' },
      });
      renderPills();
      render();
      return;
    } else if (cmd.id === 'impersonationResetSpotlight') {
      closeSpotlight();
      chrome.runtime.sendMessage({ type: 'reset', category: 'Impersonation' });
      return;
    } else if (cmd.id === 'refreshEntityMetadata') {
      progressText.textContent = 'Loading metadata...';
      progress.style.display = 'block';
      await loadEntityMetadata(true);
      progress.style.display = 'none';
      filtered = commands;
      render();
      return;
    }
    closeSpotlight();
    chrome.runtime.sendMessage({ type: cmd.id, category: cmd.category });
  }

  render();

  spotlightCleanup = () => {
    if (handleSpotlightMessage) {
      chrome.runtime.onMessage.removeListener(handleSpotlightMessage);
      handleSpotlightMessage = null;
    }
  };
}

export function closeSpotlight() {
  const el = document.getElementById('dl-spotlight-backdrop');
  if (spotlightCleanup) spotlightCleanup();
  spotlightCleanup = null;
  if (el) el.remove();
}

// Allow other parts of the extension to programmatically open spotlight
window.addEventListener('openSpotlight', async (e) => {
  const detail = (e as CustomEvent).detail as { tip?: boolean } | undefined;
  if (!document.getElementById('dl-spotlight-backdrop')) {
    await openSpotlight(detail);
  }
});
