export interface Command {
  id: string;
  category: string;
  title: string;
}

interface EntityInfo {
  logicalName: string;
  displayName: string;
  primaryIdAttribute: string;
  primaryNameAttribute: string;
}

enum Step {
  Commands,
  OpenRecordEntity,
  OpenRecordId,
}

let commandsPromise: Promise<Command[]> | null = null;
let entityMetadataPromise: Promise<EntityInfo[]> | null = null;

export function initSpotlight() {
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
  const url = `${window.Xrm?.Page?.context.getClientUrl()}/api/data/v9.1/EntityDefinitions?$select=DisplayName,LogicalName,PrimaryIdAttribute,PrimaryNameAttribute`;
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
  const pillWrap = document.createElement('div');
  pillWrap.style.cssText = 'margin-bottom:6px;min-height:24px;';
  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Search commands...';
  input.style.cssText =
    'width:95%;padding:10px 12px;font-size:16px;border:none;outline:none;border-radius:6px;background:rgba(255,255,255,0.6);backdrop-filter:blur(4px);';
  const list = document.createElement('ul');
  list.style.cssText = 'max-height:300px;overflow-y:auto;margin:8px 0 0;padding:0;list-style:none;';
  const progress = document.createElement('progress');
  progress.style.cssText = 'width:100%;display:none;height:4px;margin-top:6px;';
  container.append(pillWrap, input, list, progress);
  backdrop.append(container);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closeSpotlight();
  });
  document.body.append(backdrop);
  input.focus();

  const commands = await loadCommands();
  let metadata: EntityInfo[] = [];
  let filtered: (Command | EntityInfo)[] = commands;
  let state: Step = Step.Commands;
  let selectedEntity = '';
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
    if (state === Step.Commands) {
      (filtered as Command[]).slice(0, 20).forEach((cmd) => {
        const li = document.createElement('li');
        li.textContent = cmd.title;
        li.dataset.id = cmd.id;
        li.dataset.category = cmd.category;
        li.style.cssText = 'padding:6px 12px;cursor:pointer;border-radius:6px;font-size:14px;';
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
          input.placeholder = 'Record GUID...';
          list.innerHTML = '';
          renderPills();
        });
        list.append(li);
      });

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
    select(list.firstElementChild as HTMLLIElement | null);
  }

  input.addEventListener('input', async () => {
    const q = input.value.trim();
    if (state === Step.Commands) {
      filtered = q ? commands.filter((c) => fuzzyMatch(q, c.title)) : commands;
    } else if (state === Step.OpenRecordEntity) {
      filtered = metadata.filter((m) => fuzzyMatch(q, m.displayName) || fuzzyMatch(q, m.logicalName));
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
          type: 'openRecord',
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
      }
    }
  });

  async function executeCommand(cmd: Command) {
    if (cmd.id === 'openRecord') {
      state = Step.OpenRecordEntity;
      pills.push('Open');
      progress.style.display = 'block';
      metadata = await loadEntityMetadata();
      progress.style.display = 'none';
      filtered = metadata;
      input.placeholder = 'Search entity...';
      input.value = '';
      renderPills();
      render();
      return;
    } else if (cmd.id === 'refreshEntityMetadata') {
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

function closeSpotlight() {
  const el = document.getElementById('dl-spotlight-backdrop');
  if (el) el.remove();
}
