/**
 * Spotlight UI implementation. Handles keyboard activation, rendering
 * of results and command execution.
 */
import { Command, EntityInfo, UserInfo, Step } from './types';
import { IImpersonationResponse } from '../interfaces/types';
import { loadCommands, fuzzyMatch } from './commands';
import { loadEntityMetadata } from './metadata';
import { SpotlightState, initialState } from './state';
import { showToast, debounce } from './utils';
import { requestRoles, requestEntityMetadata } from './controller';
import { pref, strip } from '../prefix';

// Icon mappings used when rendering the command list
const commandIcons: Record<string, string> = {
  openRecordSpotlight: 'launch',
  impersonateUserSpotlight: 'person_search',
  impersonationResetSpotlight: 'person_off',
  openAdmin: 'open_in_new',
  openMakePowerApps: 'open_in_new',
  manageAppUsers: 'open_in_new',
  manageUsers: 'open_in_new',
  entityInfoSpotlight: 'info',
  reloadData: 'refresh',
  autoReload: 'autorenew',
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
let handleExecCmd: ((ev: CustomEvent) => void) | null = null;
let spotlightCleanup: (() => void) | null = null;
let fetchResults: { id: string; name: string }[] = [];
let fetchEntity = '';
let recordResults: { id: string; name: string }[] = [];
let favorites: string[] = [];
let favColors: Record<string, { bg: string; icon: string }> = {};

async function loadFavorites() {
  const data = await chrome.storage.sync.get(['favorites', 'favColors']);
  favorites = (data.favorites as string[]) || [];
  favColors = (data.favColors as typeof favColors) || {};
}

function saveFavorites() {
  chrome.storage.sync.set({ favorites, favColors });
}

/**
 * Initialize keyboard shortcut (Ctrl+Shift+P) to open spotlight
 */
export function initSpotlight() {
  if (!/\.crm.*\.dynamics\.com$/.test(window.location.hostname) && !(window as any).HARNESS) return;
  document.addEventListener('keydown', async (e) => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === 'KeyP') {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (!document.getElementById('dl-spotlight-backdrop')) {
        await openSpotlight();
      }
    } else if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.code === 'KeyP') {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (!document.getElementById('dl-spotlight-backdrop')) {
        await openSpotlight({ command: 'openRecordSpotlight' });
      } else {
        window.dispatchEvent(new CustomEvent('execCmd', { detail: 'openRecordSpotlight' }));
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

function currentEntityFromUrl(): string | null {
  const url = new URL(location.href);
  let ent = url.searchParams.get('etn');
  if (!ent && url.hash.includes('etn=')) {
    const m = url.hash.match(/etn=([^&]+)/);
    if (m) ent = m[1];
  }
  return ent;
}

async function openSpotlight(options?: { tip?: boolean; command?: string }) {
  const backdrop = document.createElement('div');
  backdrop.id = 'dl-spotlight-backdrop';
  const container = document.createElement('div');
  container.id = 'dl-spotlight-container';

  const logo = document.createElement('img');
  logo.id = 'dl-spotlight-logo';
  logo.src = chrome.runtime.getURL('app/images/lp_ll.png');

  if (!document.getElementById('dl-spotlight-icons')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.id = 'dl-spotlight-icons';
    link.href = 'https://fonts.googleapis.com/icon?family=Material+Icons';
    document.head.append(link);
  }
  if (!document.getElementById('dl-spotlight-css')) {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.id = 'dl-spotlight-css';
    css.href = chrome.runtime.getURL('app/styles/spotlight.css');
    document.head.append(css);
  }
  const favWrap = document.createElement('div');
  favWrap.id = 'dl-spotlight-favs';
  favWrap.style.display = 'none';
  const pillWrap = document.createElement('div');
  pillWrap.id = 'dl-spotlight-pills';
  const input = document.createElement('input');
  input.type = 'text';
  input.id = 'dl-spotlight-input';
  input.autocomplete = 'off';
  input.setAttribute('autocorrect', 'off');
  input.setAttribute('spellcheck', 'false');
  const list = document.createElement('ul');
  list.id = 'dl-spotlight-list';
  const infoPanel = document.createElement('div');
  infoPanel.id = 'dl-spotlight-info';
  const progress = document.createElement('div');
  progress.id = 'dl-spotlight-progress';
  progress.innerHTML = '<div class="dl-spinner"></div><div class="dl-progress-text"></div>';
  const progressText = progress.querySelector<HTMLDivElement>('.dl-progress-text')!;
  const tip = document.createElement('div');
  tip.className = 'dl-tip';
  tip.style.display = 'none';
  const sendSearch = debounce((q: string) => {
    progressText.textContent = 'Loading...';
    progress.style.display = 'block';
    chrome.runtime.sendMessage({
      type: pref('search'),
      category: 'Impersonation',
      content: { userName: q },
    });
  }, 100);
  container.append(logo, pillWrap, input, list, infoPanel, progress, tip);
  backdrop.append(favWrap, container);
  if (options?.tip) {
    tip.textContent = 'Tip: Press Ctrl+Shift+P to open this window.';
    tip.style.display = 'block';
  }
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closeSpotlight();
  });
  document.body.append(backdrop);
  input.focus();
  window.addEventListener('blur', () => {
    let attempts = 0;
    const id = setInterval(() => {
      input.focus();
      if (document.activeElement === input && document.hasFocus()) {
        if (++attempts > 5) clearInterval(id);
      } else if (++attempts > 20) {
        clearInterval(id);
      }
    }, 200);
  });
  const stateObj: SpotlightState = initialState();
  input.value = stateObj.query;
  input.select();

  const commands = (await loadCommands()).filter((c) => c.id !== 'startImpersonationButton');
  await loadFavorites();
  let metadata: EntityInfo[] = [];
  let filtered: (Command | EntityInfo)[] = commands;
  let state: Step = stateObj.state;
  let selectedEntity = stateObj.selectedEntity;
  let users: UserInfo[] = [];
  const pills: string[] = [...stateObj.pills];
  let checkingImpersonation = false;

  if (state === Step.FetchXml) {
    state = Step.Commands;
    pills.length = 0;
    selectedEntity = '';
  }

  if (
    state === Step.OpenRecordEntity ||
    state === Step.OpenRecordId ||
    state === Step.OpenListEntity ||
    state === Step.NewRecordEntity
  ) {
    progressText.textContent = 'Loading metadata...';
    progress.style.display = 'block';
    metadata = await loadEntityMetadata();
    progress.style.display = 'none';
    filtered = metadata;
    input.placeholder =
      state === Step.OpenRecordId ? 'Enter GUID or start typing the name of the entity' : 'Search entity...';
  } else if (state === Step.EntityInfoDisplay || state === Step.EnvironmentInfoDisplay) {
    input.placeholder = '';
  } else if (state === Step.ImpersonateSearch) {
    input.placeholder = 'Search user...';
  } else {
    input.placeholder = 'Search commands...';
  }

  renderPills();

  let selected: HTMLLIElement | null = null;
  function select(li: HTMLLIElement | null) {
    if (selected) selected.classList.remove('dl-selected');
    selected = li;
    if (selected) {
      selected.classList.add('dl-selected');
      selected.scrollIntoView({ block: 'nearest' });
    }
  }

  function renderPills() {
    pillWrap.innerHTML = '';
    pills.forEach((p, idx) => {
      const span = document.createElement('span');
      span.textContent = p;
      span.className = 'dl-pill';
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
            input.style.display = '';
            render();
          }
          renderPills();
        });
        span.append(x);
      }
      pillWrap.append(span);
    });
    renderFavorites();
  }

  let dragIndex = -1;
  function renderFavorites() {
    favWrap.innerHTML = '';
    if (pills.length > 0 || state !== Step.Commands || favorites.length === 0) {
      favWrap.style.display = 'none';
      return;
    }
    favWrap.style.display = 'flex';
    favorites.slice(0, 8).forEach((id, idx) => {
      const cmd = commands.find((c) => c.id === id);
      if (!cmd) return;
      const div = document.createElement('div');
      div.className = 'dl-fav';
      div.draggable = true;
      div.dataset.index = String(idx);

      const iconWrap = document.createElement('div');
      iconWrap.className = 'dl-fav-icon-wrap';
      const ic = document.createElement('span');
      ic.className = 'material-icons dl-fav-icon';
      ic.textContent = cmd.icon || commandIcons[cmd.id] || categoryIcons[cmd.category] || 'chevron_right';
      iconWrap.append(ic);

      const colors = favColors[id];
      if (colors) {
        iconWrap.style.background = colors.bg;
        ic.style.color = colors.icon;
      }

      const brush = document.createElement('span');
      brush.className = 'material-icons dl-brush';
      brush.textContent = 'brush';

      const palette = document.createElement('div');
      palette.className = 'dl-palette';
      palette.style.display = 'none';

      const presets = [
        { bg: '#f3e8fc', icon: '#a631af' },
        { bg: '#e8f1fc', icon: '#1959a8' },
        { bg: '#e8fce8', icon: '#1a7a1f' },
        { bg: '#fff4e5', icon: '#c47a07' },
        { bg: '#fde8f3', icon: '#c01b77' },
        { bg: '#f0f0f0', icon: '#555555' },
      ];
      presets.forEach((p) => {
        const sw = document.createElement('div');
        sw.className = 'dl-swatch';
        sw.style.background = p.bg;
        sw.addEventListener('click', (ev) => {
          ev.stopPropagation();
          favColors[id] = { bg: p.bg, icon: p.icon };
          saveFavorites();
          renderFavorites();
          palette.style.display = 'none';
        });
        palette.append(sw);
      });

      brush.addEventListener('click', (ev) => {
        ev.stopPropagation();
        palette.style.display = palette.style.display === 'none' ? 'flex' : 'none';
      });

      const txt = document.createElement('div');
      txt.className = 'dl-fav-title';
      txt.textContent = cmd.title;

      div.append(iconWrap, brush, palette, txt);
      div.addEventListener('click', () => executeCommand(cmd));
      div.addEventListener('dragstart', () => {
        dragIndex = idx;
      });
      div.addEventListener('dragover', (ev) => {
        ev.preventDefault();
      });
      div.addEventListener('drop', (ev) => {
        ev.preventDefault();
        const targetIdx = Number(div.dataset.index);
        if (dragIndex < 0 || targetIdx === dragIndex) return;
        const item = favorites.splice(dragIndex, 1)[0];
        favorites.splice(targetIdx, 0, item);
        saveFavorites();
        renderFavorites();
      });
      favWrap.append(div);
    });
  }

  function render() {
    list.innerHTML = '';
    infoPanel.style.display =
      state === Step.FetchXml || state === Step.EnvironmentInfoDisplay || state === Step.EntityInfoDisplay
        ? 'block'
        : 'none';
    list.style.display = '';
    if (state === Step.Commands) {
      renderCommands();
    } else if (state === Step.OpenRecordEntity || state === Step.OpenListEntity || state === Step.NewRecordEntity) {
      renderEntities();
    } else if (state === Step.OpenRecordId) {
      renderRecords();
    } else if (state === Step.ImpersonateSearch) {
      renderUsers();
    } else if (state === Step.FetchXml) {
      renderFetchResults();
    } else if (state === Step.EnvironmentInfoDisplay) {
      list.style.display = 'none';
      infoPanel.style.display = 'block';
    }
    select(list.firstElementChild as HTMLLIElement | null);
    renderFavorites();
  }

  function renderCommands() {
    const showAll = input.value.trim() === '';
    const cmds = showAll ? (filtered as Command[]) : (filtered as Command[]).slice(0, 20);
    cmds.forEach((cmd) => {
      const li = document.createElement('li');
      const icon = document.createElement('span');
      icon.className = 'material-icons dl-command-icon';
      icon.textContent = cmd.icon || commandIcons[cmd.id] || categoryIcons[cmd.category] || 'chevron_right';
      const text = document.createElement('span');
      text.textContent = cmd.title;
      const star = document.createElement('span');
      star.className = 'material-icons dl-star';
      star.textContent = favorites.includes(cmd.id) ? 'star' : 'star_border';
      star.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const idx = favorites.indexOf(cmd.id);
        if (idx >= 0) {
          favorites.splice(idx, 1);
        } else {
          favorites.push(cmd.id);
        }
        saveFavorites();
        renderFavorites();
        star.textContent = favorites.includes(cmd.id) ? 'star' : 'star_border';
      });
      li.append(icon, text, star);
      li.dataset.id = cmd.id;
      li.dataset.category = cmd.category;
      li.className = 'dl-listitem';
      li.addEventListener('mouseenter', () => select(li));
      li.addEventListener('click', () => executeCommand(cmd));
      list.append(li);
    });
  }

  function renderEntities() {
    const queryEmpty = input.value.trim() === '';
    const currentEntity = queryEmpty ? currentEntityFromUrl() : null;
    if (currentEntity) {
      const ent = (filtered as EntityInfo[]).find((e) => e.logicalName === currentEntity);
      if (ent) {
        const li = document.createElement('li');
        li.innerHTML = `${ent.displayName} <code class="dl-code">${ent.logicalName}</code>`;
        li.className = 'dl-listitem';
        li.addEventListener('mouseenter', () => select(li));
        li.addEventListener('click', () => {
          selectedEntity = ent.logicalName;
          if (state === Step.OpenListEntity) {
            closeSpotlight();
            openEntityList(ent.logicalName);
            return;
          }
          if (state === Step.NewRecordEntity) {
            closeSpotlight();
            chrome.runtime.sendMessage({
              type: pref('newRecord'),
              category: 'Navigation',
              content: ent.logicalName,
            });
            return;
          }
          pills.push(ent.displayName);
          state = Step.OpenRecordId;
          input.value = '';
          input.placeholder = 'Enter GUID or start typing the name of the entity';
          recordResults = [];
          filtered = recordResults;
          list.innerHTML = '';
          renderPills();
          render();
        });
        li.addEventListener('dblclick', () => {
          closeSpotlight();
          openEntityList(ent.logicalName);
        });
        list.append(li);
      }
    }

    (filtered as EntityInfo[])
      .filter((e) => !currentEntity || e.logicalName !== currentEntity)
      .slice(0, 20)
      .forEach((ent) => {
        const li = document.createElement('li');
        li.innerHTML = `${ent.displayName} <code class="dl-code">${ent.logicalName}</code>`;
        li.className = 'dl-listitem';
        li.addEventListener('mouseenter', () => select(li));
        li.addEventListener('click', () => {
          selectedEntity = ent.logicalName;
          if (state === Step.OpenListEntity) {
            closeSpotlight();
            openEntityList(ent.logicalName);
            return;
          }
          if (state === Step.NewRecordEntity) {
            closeSpotlight();
            chrome.runtime.sendMessage({
              type: pref('newRecord'),
              category: 'Navigation',
              content: ent.logicalName,
            });
            return;
          }
          pills.push(ent.displayName);
          state = Step.OpenRecordId;
          input.value = '';
          input.placeholder = 'Enter GUID or start typing the name of the entity';
          recordResults = [];
          filtered = recordResults;
          list.innerHTML = '';
          renderPills();
          render();
        });
        // Double click directly opens the list view
        li.addEventListener('dblclick', () => {
          closeSpotlight();
          openEntityList(ent.logicalName);
        });
        list.append(li);
      });
    if (state === Step.OpenRecordEntity || state === Step.OpenListEntity || state === Step.NewRecordEntity) {
      const typed = input.value.trim();
      if (typed && !metadata.some((m) => m.logicalName.toLowerCase() === typed.toLowerCase())) {
        const li = document.createElement('li');
        li.innerHTML = `Use <code class="dl-code">${typed}</code>`;
        li.className = 'dl-listitem dl-muted';
        li.addEventListener('mouseenter', () => select(li));
        li.addEventListener('click', () => {
          selectedEntity = typed;
          if (state === Step.OpenListEntity) {
            closeSpotlight();
            openEntityList(typed);
            return;
          }
          if (state === Step.NewRecordEntity) {
            closeSpotlight();
            chrome.runtime.sendMessage({
              type: pref('newRecord'),
              category: 'Navigation',
              content: typed,
            });
            return;
          }
          pills.push(typed);
          state = Step.OpenRecordId;
          input.value = '';
          input.placeholder = 'Enter GUID or start typing the name of the entity';
          recordResults = [];
          filtered = recordResults;
          list.innerHTML = '';
          renderPills();
          render();
        });
        list.append(li);
      }
    }
  }

  function renderRecords() {
    (filtered as { id: string; name: string }[]).slice(0, 20).forEach((r) => {
      const li = document.createElement('li');
      li.textContent = `${r.name} (${r.id})`;
      li.className = 'dl-listitem';
      li.addEventListener('mouseenter', () => select(li));
      li.addEventListener('click', () => {
        closeSpotlight();
        chrome.runtime.sendMessage({
          type: pref('openRecordQuick'),
          category: 'Navigation',
          content: { entity: selectedEntity, id: r.id },
        });
      });
      list.append(li);
    });

    const openListLi = document.createElement('li');
    openListLi.textContent = `Open ${selectedEntity} list`;
    openListLi.className = 'dl-listitem';
    openListLi.addEventListener('mouseenter', () => select(openListLi));
    openListLi.addEventListener('click', () => {
      closeSpotlight();
      openEntityList(selectedEntity);
    });
    list.append(openListLi);
  }

  function renderUsers() {
    (filtered as UserInfo[]).slice(0, 20).forEach((u) => {
      const li = document.createElement('li');
      li.textContent = `${u.fullName} (${u.userName})`;
      li.className = 'dl-listitem';
      li.addEventListener('mouseenter', () => select(li));
      li.addEventListener('click', () => {
        closeSpotlight();
        chrome.runtime.sendMessage({
          type: pref('Page'),
          category: 'Impersonation',
          content: {
            impersonateRequest: {
              isActive: true,
              url: `${location.origin}/`,
              canImpersonate: true,
            },
            users: [u],
          },
        });
      });
      list.append(li);
    });
  }

  function renderFetchResults() {
    (filtered as { id: string; name: string }[]).slice(0, 20).forEach((r) => {
      const li = document.createElement('li');
      li.textContent = `${r.name} (${r.id})`;
      li.className = 'dl-listitem';
      li.addEventListener('mouseenter', () => select(li));
      li.addEventListener('click', () => {
        closeSpotlight();
        chrome.runtime.sendMessage({
          type: pref('openRecordQuick'),
          category: 'Navigation',
          content: { entity: fetchEntity, id: r.id },
        });
      });
      list.append(li);
    });
  }

  input.addEventListener('input', async () => {
    const q = input.value.trim();
    if (state === Step.Commands) {
      filtered = q ? commands.filter((c) => fuzzyMatch(q, c.title)) : commands;
    } else if (state === Step.OpenRecordEntity || state === Step.OpenListEntity || state === Step.NewRecordEntity) {
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
      sendSearch(q);
      filtered = [];
    } else if (state === Step.FetchXml) {
      const ql = q.toLowerCase();
      filtered = fetchResults.filter((r) => r.name.toLowerCase().includes(ql) || r.id.toLowerCase().includes(ql));
    } else if (state === Step.EnvironmentInfoDisplay) {
      filtered = [];
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
    } else if (ev.key === 'Backspace' && input.value === '' && pills.length > 0) {
      pills.pop();
      state = Step.Commands;
      filtered = commands;
      input.placeholder = 'Search commands...';
      input.style.display = '';
      infoPanel.style.display = 'none';
      list.style.display = '';
      tip.style.display = 'none';
      if (state === Step.OpenRecordId) {
        state = Step.OpenRecordEntity;
        input.placeholder = 'Search entity...';
        filtered = metadata;
      } else {
        state = Step.Commands;
        filtered = commands;
        input.placeholder = 'Search commands...';
        input.style.display = '';
      }
      renderPills();
      render();
    } else if (ev.key === 'Enter' && selected) {
      if (state === Step.Commands) {
        const id = selected.dataset.id!;
        const cmd = commands.find((c) => c.id === id)!;
        executeCommand(cmd);
      } else {
        (selected as HTMLElement).click();
      }
    }
  });

  function handleGlobalBackspace(ev: KeyboardEvent) {
    if (ev.key === 'Backspace' && state === Step.EnvironmentInfoDisplay) {
      ev.preventDefault();
      pills.pop();
      state = Step.Commands;
      filtered = commands;
      input.placeholder = 'Search commands...';
      input.style.display = '';
      infoPanel.style.display = 'none';
      list.style.display = '';
      tip.style.display = 'none';
      renderPills();
      render();
    }
  }
  document.addEventListener('keydown', handleGlobalBackspace);
  spotlightCleanup = () => {
    document.removeEventListener('keydown', handleGlobalBackspace);
    if (handleSpotlightMessage) {
      window.removeEventListener('message', handleSpotlightMessage as EventListener);
      handleSpotlightMessage = null;
    }
    if (handleExecCmd) {
      window.removeEventListener('execCmd', handleExecCmd as EventListener);
      handleExecCmd = null;
    }
  };

  handleSpotlightMessage = function (rawMessage: any) {
    const message = rawMessage.data || rawMessage;
    const type = strip(message.type);

    if (
      type === 'Page' &&
      message.category === 'Impersonation-UserSearch' &&
      (state === Step.ImpersonateSearch || checkingImpersonation)
    ) {
      const resp = message.content as IImpersonationResponse;
      progress.style.display = 'none';
      progressText.textContent = '';
      if (checkingImpersonation) {
        checkingImpersonation = false;
        state = Step.ImpersonateSearch;
        pills.push('Impersonate');
        input.placeholder = 'Search user...';
        input.value = '';
        users = resp.users;
        filtered = resp.users;
        renderPills();
      } else {
        users = resp.users;
        filtered = resp.users;
      }
      render();
    } else if (type === 'Page' && message.category === 'Impersonation' && checkingImpersonation) {
      const resp = message.content as IImpersonationResponse;
      checkingImpersonation = false;
      progress.style.display = 'none';
      progressText.textContent = '';
      if (!resp.impersonateRequest.canImpersonate) {
        showToast('You do not have impersonation permissions');
      }
    } else if (type === 'Page' && message.category === 'Impersonation' && state === Step.ImpersonateSearch) {
      const resp = message.content as IImpersonationResponse;
      if (!resp.impersonateRequest.canImpersonate) {
        progress.style.display = 'none';
        progressText.textContent = '';
        showToast('You do not have impersonation permissions');
      }
    }
  };

  window.addEventListener('message', handleSpotlightMessage);
  handleExecCmd = (ev: CustomEvent) => {
    const cmd = commands.find((c) => c.id === ev.detail);
    if (cmd) void executeCommand(cmd);
  };
  window.addEventListener('execCmd', handleExecCmd as EventListener);

  async function executeCommand(cmd: Command) {
    favWrap.style.display = 'none';
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
      tip.textContent = 'Not seeing the entity you need? Try refreshing the metadata';
      tip.style.display = 'block';
      renderPills();
      render();
      return;
    } else if (cmd.id === 'openList') {
      state = Step.OpenListEntity;
      pills.push('List');
      progressText.textContent = 'Loading metadata...';
      progress.style.display = 'block';
      metadata = await loadEntityMetadata();
      progress.style.display = 'none';
      filtered = metadata;
      input.placeholder = 'Search entity...';
      input.value = '';
      tip.textContent = 'Not seeing the entity you need? Try refreshing the metadata';
      tip.style.display = 'block';
      renderPills();
      render();
      return;
    } else if (cmd.id === 'newRecord') {
      state = Step.NewRecordEntity;
      pills.push('New');
      progressText.textContent = 'Loading metadata...';
      progress.style.display = 'block';
      metadata = await loadEntityMetadata();
      progress.style.display = 'none';
      filtered = metadata;
      input.placeholder = 'Search entity...';
      input.value = '';
      tip.textContent = 'Not seeing the entity you need? Try refreshing the metadata';
      tip.style.display = 'block';
      renderPills();
      render();
      return;
    } else if (cmd.id === 'runFetchXmlSpotlight') {
      state = Step.FetchXml;
      pills.push('FetchXML');
      list.style.display = 'none';
      infoPanel.style.display = 'block';
      infoPanel.innerHTML =
        '<div class="dl-fetchxml-header">FetchXML Runner</div>' +
        '<textarea id="dl-fetchxml"></textarea>' +
        '<div class="dl-fetchxml-help">Press Ctrl+Enter to run</div>';
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
          infoPanel.style.display = 'block';
          input.style.display = 'none';
          state = Step.FetchXml;
          render();
        }
      });
      tip.style.display = 'none';
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
    } else if (cmd.id === 'myRoles') {
      state = Step.EnvironmentInfoDisplay;
      pills.push('Roles');
      infoPanel.innerHTML = '';
      progressText.textContent = 'Loading roles...';
      progress.style.display = 'block';
      try {
        const roles = await requestRoles();
        const rows = roles.map(
          (r) =>
            `<div class="dl-info-row">${r.name}: <span class="dl-copy dl-code" data-val="${r.roleid}">${r.roleid}</span></div>`
        );
        if (rows.length) {
          infoPanel.innerHTML = `<div class="dl-copy-hint">Click to Copy</div>${rows.join('')}`;
        } else {
          infoPanel.textContent = 'No security roles found';
        }
        input.style.display = 'none';
        infoPanel.querySelectorAll<HTMLSpanElement>('.dl-copy').forEach((el) => {
          el.addEventListener('click', () => {
            const val = el.dataset.val || '';
            navigator.clipboard.writeText(val).catch(() => {
              const inp = document.createElement('input');
              inp.value = val;
              document.body.append(inp);
              inp.select();
              document.execCommand('copy');
              inp.remove();
            });
            showToast('Copied to Clipboard');
          });
        });
      } finally {
        progress.style.display = 'none';
      }
      list.style.display = 'none';
      infoPanel.style.display = 'block';
      input.placeholder = '';
      input.value = '';
      renderPills();
      render();
      return;
    } else if (cmd.id === 'entityMetadata') {
      state = Step.EnvironmentInfoDisplay;
      pills.push('Metadata');
      const entity =
        (window as any).Xrm?.Page?.data?.entity?.getEntityName?.() ||
        (window as any).Xrm?.Utility?.getPageContext?.()?.input?.entityName ||
        '';
      if (!entity) {
        showToast('No entity context');
        return;
      }
      progressText.textContent = 'Loading metadata...';
      progress.style.display = 'block';
      try {
        const data = await requestEntityMetadata(entity);
        const rows = Object.keys(data)
          .filter((k) => !k.startsWith('@'))
          .map((k) => {
            const raw = typeof data[k] === 'object' ? JSON.stringify(data[k], null, 2) : String(data[k]);
            const attrVal = raw.replaceAll('"', '&quot;');
            const htmlVal = raw.replace(/</g, '&lt;').replace(/>/g, '&gt;');
            return `<div class="dl-info-row">${k}: <span class="dl-copy dl-code" data-val="${attrVal}">${htmlVal}</span></div>`;
          });
        infoPanel.innerHTML = `<div class="dl-copy-hint">Click to Copy</div>${rows.join('')}`;
        input.style.display = 'none';
        infoPanel.querySelectorAll<HTMLSpanElement>('.dl-copy').forEach((el) => {
          el.addEventListener('click', () => {
            const val = el.dataset.val || '';
            navigator.clipboard.writeText(val).catch(() => {
              const inp = document.createElement('input');
              inp.value = val;
              document.body.append(inp);
              inp.select();
              document.execCommand('copy');
              inp.remove();
            });
            showToast('Copied to Clipboard');
          });
        });
      } finally {
        progress.style.display = 'none';
      }
      list.style.display = 'none';
      infoPanel.style.display = 'block';
      input.placeholder = '';
      input.value = '';
      renderPills();
      render();
      return;
    } else if (cmd.id === 'environmentDetails') {
      state = Step.EnvironmentInfoDisplay;
      pills.push('Environment');
      progressText.textContent = 'Loading details...';
      progress.style.display = 'block';
      try {
        const resp = await fetch(`${location.origin}/api/data/v9.1/RetrieveCurrentOrganization(AccessType='Default')`);
        const data = await resp.json();
        const env = data.Detail || {};
        const appId = new URLSearchParams(location.search).get('appid');
        if (appId) env.AppId = appId;
        const rows = Object.keys(env).map((k) => {
          const raw = typeof env[k] === 'object' ? JSON.stringify(env[k], null, 2) : String(env[k]);
          const attrVal = raw.replaceAll('"', '&quot;');
          const htmlVal = raw.replace(/</g, '&lt;').replace(/>/g, '&gt;');
          return `<div class="dl-info-row">${k}: <span class="dl-copy dl-code" data-val="${attrVal}">${htmlVal}</span></div>`;
        });
        infoPanel.innerHTML = `<div class="dl-copy-hint">Click to Copy</div>${rows.join('')}`;
        input.style.display = 'none';
        infoPanel.querySelectorAll<HTMLSpanElement>('.dl-copy').forEach((el) => {
          el.addEventListener('click', () => {
            const val = el.dataset.val || '';
            navigator.clipboard.writeText(val).catch(() => {
              const inp = document.createElement('input');
              inp.value = val;
              document.body.append(inp);
              inp.select();
              document.execCommand('copy');
              inp.remove();
            });
            showToast('Copied to Clipboard');
          });
        });
      } finally {
        progress.style.display = 'none';
      }
      list.style.display = 'none';
      infoPanel.style.display = 'block';
      input.placeholder = '';
      input.value = '';
      renderPills();
      render();
      return;
    } else if (cmd.id === 'impersonateUserSpotlight') {
      checkingImpersonation = true;
      progressText.textContent = 'Checking permissions...';
      progress.style.display = 'block';
      chrome.runtime.sendMessage({
        type: pref('search'),
        category: 'Impersonation',
        content: { userName: '' },
      });
      return;
    } else if (cmd.id === 'impersonationResetSpotlight') {
      closeSpotlight();
      chrome.runtime.sendMessage({ type: pref('reset'), category: 'Impersonation' });
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
    tip.style.display = 'none';
    closeSpotlight();
    chrome.runtime.sendMessage({ type: pref(cmd.id), category: cmd.category });
  }

  render();

  if (options?.command) {
    const cmd = commands.find((c) => c.id === options.command);
    if (cmd) await executeCommand(cmd);
  }

  spotlightCleanup = () => {
    if (handleSpotlightMessage) {
      window.removeEventListener('message', handleSpotlightMessage as EventListener);
      handleSpotlightMessage = null;
    }
    if (handleExecCmd) {
      window.removeEventListener('execCmd', handleExecCmd as EventListener);
      handleExecCmd = null;
    }
    document.removeEventListener('keydown', handleGlobalBackspace);
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
  const detail = (e as CustomEvent).detail as { tip?: boolean; command?: string } | undefined;
  if (!document.getElementById('dl-spotlight-backdrop')) {
    await openSpotlight(detail);
  }
});
