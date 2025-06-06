export interface Command {
  id: string;
  category: string;
  title: string;
}

let commandsPromise: Promise<Command[]> | null = null;

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

async function openSpotlight() {
  const backdrop = document.createElement('div');
  backdrop.id = 'dl-spotlight-backdrop';
  backdrop.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.3);z-index:2147483647;';
  const container = document.createElement('div');
  container.id = 'dl-spotlight-container';
  container.style.cssText =
    'position:absolute;top:20%;left:50%;transform:translateX(-50%);background:rgba(255,255,255,0.75);color:#000;border-radius:12px;padding:16px;width:500px;box-shadow:0 8px 30px rgba(0,0,0,0.2);backdrop-filter:blur(20px);';
  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Search commands...';
  input.style.cssText =
    'width:95%;padding:10px 12px;font-size:16px;border:none;outline:none;border-radius:6px;background:rgba(255,255,255,0.6);backdrop-filter:blur(4px);';
  const list = document.createElement('ul');
  list.style.cssText = 'max-height:300px;overflow-y:auto;margin:8px 0 0;padding:0;list-style:none;';
  container.append(input, list);
  backdrop.append(container);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closeSpotlight();
  });
  document.body.append(backdrop);
  input.focus();

  const commands = await loadCommands();
  let filtered = commands;

  let selected: HTMLLIElement | null = null;
  function select(li: HTMLLIElement | null) {
    if (selected) selected.style.background = '';
    selected = li;
    if (selected) {
      selected.style.background = '#e0e0e0';
      selected.scrollIntoView({ block: 'nearest' });
    }
  }

  function render() {
    list.innerHTML = '';
    filtered.slice(0, 20).forEach((cmd) => {
      const li = document.createElement('li');
      li.textContent = cmd.title;
      li.dataset.id = cmd.id;
      li.dataset.category = cmd.category;
      li.style.cssText = 'padding:6px 12px;cursor:pointer;border-radius:6px;font-size:14px;';
      li.addEventListener('mouseenter', () => select(li));
      li.addEventListener('click', () => executeCommand(cmd));
      list.append(li);
    });
    select(list.firstElementChild as HTMLLIElement | null);
  }

  input.addEventListener('input', () => {
    const q = input.value.trim();
    filtered = q ? commands.filter((c) => fuzzyMatch(q, c.title)) : commands;
    render();
  });
  input.addEventListener('keydown', (e) => {
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
      if (selected)
        executeCommand({
          id: selected.dataset.id!,
          category: selected.dataset.category!,
          title: selected.textContent || '',
        });
    }
  });

  render();
}

function executeCommand(cmd: Command) {
  closeSpotlight();
  chrome.runtime.sendMessage({ type: cmd.id, category: cmd.category });
}

function closeSpotlight() {
  const el = document.getElementById('dl-spotlight-backdrop');
  if (el) el.remove();
}
