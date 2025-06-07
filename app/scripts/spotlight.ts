export interface Command {
  id: string;
  category: string;
  title: string;
  icon?: string;
}

interface EntityInfo {
  logicalName: string;
  displayName: string;
  primaryIdAttribute: string;
  primaryNameAttribute: string;
}

interface UserInfo {
  userId: string;
  userName: string;
  fullName: string;
}

enum Step {
  Commands,
  OpenRecordEntity,
  OpenRecordId,
  ImpersonateSearch,
  EntityInfoEntity,
  EntityInfoDisplay,
}

let commandsPromise: Promise<Command[]> | null = null;
let entityMetadataPromise: Promise<EntityInfo[]> | null = null;
let handleSpotlightMessage: ((message: any) => void) | null = null;

const commandIcons: Record<string, string> = {
  openRecordSpotlight: 'launch',
  impersonateUserSpotlight: 'person_search',
  impersonationResetSpotlight: 'person_off',
  openAdmin: 'open_in_new',
  openMakePowerApps: 'open_in_new',
  entityInfoSpotlight: 'info',
  reloadData: 'refresh',
};

export function initSpotlight() {
  document.addEventListener('keydown', async (e) => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === 'KeyP') {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (!document.getElementById('dl-spotlight-backdrop')) {
        await openSpotlight();
      }
    } else if (e.key === 'Escape') {
      closeSpotlight(true);
    }
  });
}

async function loadCommands(): Promise<Command[]> {
  if (commandsPromise) return commandsPromise;
  commandsPromise = fetch(chrome.runtime.getURL('app/commands.json')).then((r) => r.json());
  return commandsPromise;
}

function fuzzyMatch(query: string, text: string): boolean {
  query = query.toLowerCase();
  text = text.toLowerCase();
  let i = 0;
  for (const c of query) {
    i = text.indexOf(c, i);
    if (i === -1) return false;
    i++;
  }
  return true;
}

async function loadEntityMetadata(force = false): Promise<EntityInfo[]> {
  if (entityMetadataPromise && !force) return entityMetadataPromise;
  const cached = localStorage.getItem('dl-entity-metadata');
  if (cached && !force) {
    entityMetadataPromise = Promise.resolve(JSON.parse(cached));
    return entityMetadataPromise;
  }
  const url = `${window.location.origin}/api/data/v9.1/EntityDefinitions?$select=DisplayName,LogicalName,PrimaryIdAttribute,PrimaryNameAttribute`;
  entityMetadataPromise = fetch(url)
    .then((r) => r.json())
    .then((d) =>
      d.value.map((v: any) => ({
        logicalName: v.LogicalName,
        displayName: v.DisplayName?.UserLocalizedLabel?.Label || v.LogicalName,
        primaryIdAttribute: v.PrimaryIdAttribute,
        primaryNameAttribute: v.PrimaryNameAttribute,
      }))
    )
    .then((list: EntityInfo[]) => {
      localStorage.setItem('dl-entity-metadata', JSON.stringify(list));
      return list;
    });
  return entityMetadataPromise;
}

async function openSpotlight() {
  const backdrop = document.createElement('div');
  backdrop.id = 'dl-spotlight-backdrop';
  backdrop.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.3);z-index:2147483647;';
  const container = document.createElement('div');
  container.id = 'dl-spotlight-container';
  container.style.cssText =
    'position:absolute;top:20%;left:50%;transform:translateX(-50%);background:rgba(255,255,255,0.75);color:#000;border-radius:12px;padding:16px;width:500px;box-shadow:0 8px 30px rgba(0,0,0,0.2);backdrop-filter:blur(20px);';

  if (!document.getElementById('dl-spotlight-icons')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.id = 'dl-spotlight-icons';
    link.href = chrome.runtime.getURL('app/styles/material-icons.min.css');
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
  input.placeholder = 'Search commands...';
  input.style.cssText =
    'width:95%;padding:10px 12px;font-size:16px;border:none;outline:none;border-radius:6px;background:rgba(255,255,255,0.6);backdrop-filter:blur(4px);';
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
  container.append(pillWrap, input, list, infoPanel, progress);
  backdrop.append(container);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closeSpotlight(true);
  });
  document.body.append(backdrop);
  input.focus();
  const lastQuery = localStorage.getItem('dl-spotlight-query');
  if (lastQuery) {
    input.value = lastQuery;
    input.select();
  }

  const commands = await loadCommands();
  let metadata: EntityInfo[] = [];
  let filtered: (Command | EntityInfo)[] = commands;
  let state: Step = Step.Commands;
  let selectedEntity = '';
  let users: UserInfo[] = [];
  const pills: string[] = [];

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
      (filtered as Command[]).slice(0, 20).forEach((cmd) => {
        const li = document.createElement('li');
        const icon = document.createElement('span');
        icon.className = 'material-icons';
        icon.textContent = commandIcons[cmd.id] || 'chevron_right';
        icon.style.marginRight = '8px';
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
    } else if (state === Step.OpenRecordEntity || state === Step.EntityInfoEntity) {
      (filtered as EntityInfo[]).slice(0, 20).forEach((ent) => {
        const li = document.createElement('li');
        li.innerHTML = `${ent.displayName} <code style="background:#f0f0f0;padding:2px 4px;border-radius:4px;font-family:monospace;">${ent.logicalName}</code>`;
        li.style.cssText = 'padding:6px 12px;cursor:pointer;border-radius:6px;font-size:14px;';
        li.addEventListener('mouseenter', () => select(li));
        li.addEventListener('click', () => {
          selectedEntity = ent.logicalName;
          pills.push(ent.displayName);
          if (state === Step.OpenRecordEntity) {
            state = Step.OpenRecordId;
            input.value = '';
            input.placeholder = 'Record GUID...';
            list.innerHTML = '';
            renderPills();
          } else {
            state = Step.EntityInfoDisplay;
            infoPanel.innerHTML = `
              <div><strong>${ent.displayName}</strong></div>
              <div>Logical: ${ent.logicalName}</div>
              <div>Primary Id: ${ent.primaryIdAttribute}</div>
              <div>Primary Name: ${ent.primaryNameAttribute}</div>`;
            list.style.display = 'none';
            infoPanel.style.display = 'block';
            renderPills();
          }
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
            input.placeholder = 'Record GUID...';
            list.innerHTML = '';
            renderPills();
          });
          list.append(li);
        }
      }
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
    }
    select(list.firstElementChild as HTMLLIElement | null);
  }

  input.addEventListener('input', async () => {
    const q = input.value.trim();
    if (state === Step.Commands) {
      filtered = q ? commands.filter((c) => fuzzyMatch(q, c.title)) : commands;
    } else if (state === Step.OpenRecordEntity || state === Step.EntityInfoEntity) {
      filtered = metadata.filter((m) => fuzzyMatch(q, m.displayName) || fuzzyMatch(q, m.logicalName));
    } else if (state === Step.ImpersonateSearch) {
      if (q) {
        progressText.textContent = 'Loading users...';
        progress.style.display = 'block';
        chrome.runtime.sendMessage({
          type: 'search',
          category: 'Impersonation',
          content: { userName: q },
        });
      } else {
        users = [];
        filtered = [];
        progress.style.display = 'none';
      }
    }
    render();
  });
  input.addEventListener('keydown', async (e) => {
    if (state === Step.OpenRecordId && e.key === 'Enter') {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (input.value.trim()) {
        closeSpotlight();
        chrome.runtime.sendMessage({
          type: 'openRecordQuick',
          category: 'Navigation',
          content: { entity: selectedEntity, id: input.value.trim() },
        });
      }
      return;
    }

    if (e.key === 'Backspace' && input.value === '' && pills.length > 0) {
      pills.pop();
      if (state === Step.OpenRecordId) {
        state = Step.OpenRecordEntity;
        input.placeholder = 'Search entity...';
        filtered = metadata;
      } else if (state === Step.EntityInfoDisplay) {
        state = Step.EntityInfoEntity;
        infoPanel.style.display = 'none';
        list.style.display = '';
        filtered = metadata;
      } else {
        state = Step.Commands;
        filtered = commands;
      }
      renderPills();
      render();
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (selected && selected.nextElementSibling) select(selected.nextElementSibling as HTMLLIElement);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (selected && selected.previousElementSibling) select(selected.previousElementSibling as HTMLLIElement);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (selected && state === Step.Commands) {
        executeCommand({
          id: selected.dataset.id!,
          category: selected.dataset.category!,
          title: selected.textContent || '',
        });
      } else if (selected && state === Step.OpenRecordEntity) {
        (selected as HTMLElement).click();
      } else if (selected && state === Step.ImpersonateSearch) {
        (selected as HTMLElement).click();
      } else if (selected && state === Step.EntityInfoEntity) {
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
    } else if (cmd.id === 'entityInfoSpotlight') {
      state = Step.EntityInfoEntity;
      pills.push('Info');
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
}

function closeSpotlight(save = false) {
  const el = document.getElementById('dl-spotlight-backdrop');
  if (el && save) {
    const inputEl = el.querySelector<HTMLInputElement>('#dl-spotlight-input');
    if (inputEl) localStorage.setItem('dl-spotlight-query', inputEl.value);
  } else if (el) {
    localStorage.removeItem('dl-spotlight-query');
  }
  if (handleSpotlightMessage) {
    chrome.runtime.onMessage.removeListener(handleSpotlightMessage);
    handleSpotlightMessage = null;
  }
  if (el) el.remove();
}
