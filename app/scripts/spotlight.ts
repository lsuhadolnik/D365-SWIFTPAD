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
  commandsPromise = fetch(chrome.runtime.getURL('app/pages/options.html'))
    .then((r) => r.text())
    .then((text) => {
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, 'text/html');
      const cmds: Command[] = [];
      doc.querySelectorAll('#environmentLinks .mdl-navigation__link').forEach((d) => {
        cmds.push({
          id: (d as HTMLElement).id,
          category: d.getAttribute('data-category') || '',
          title: d.textContent.trim(),
        });
      });
      doc.querySelectorAll('button[id]').forEach((btn) => {
        const id = (btn as HTMLElement).id;
        let category = btn.getAttribute('data-category') || '';
        if (id === 'searchUserButton' || id === 'startImpersonationButton' || id === 'resetImpersonationButton') {
          category = 'Impersonation';
        }
        const span = btn.querySelector('span');
        const title = (span ? span.textContent : btn.textContent).trim();
        cmds.push({ id, category, title });
      });
      return cmds;
    });
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
  backdrop.style.cssText =
    'position:fixed;inset:0;background:rgba(0,0,0,0.3);backdrop-filter:blur(2px);z-index:2147483647;';
  const container = document.createElement('div');
  container.id = 'dl-spotlight-container';
  container.style.cssText =
    'position:absolute;top:20%;left:50%;transform:translateX(-50%);background:#fff;color:#000;border-radius:8px;padding:16px;width:480px;box-shadow:0 4px 20px rgba(0,0,0,0.2);backdrop-filter:blur(10px);';
  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Search commands...';
  input.style.cssText = 'width:100%;padding:8px;font-size:16px;border:none;outline:none;';
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
    if (selected) selected.style.background = '#e0e0e0';
  }

  function render() {
    list.innerHTML = '';
    filtered.slice(0, 20).forEach((cmd) => {
      const li = document.createElement('li');
      li.textContent = cmd.title;
      li.dataset.id = cmd.id;
      li.dataset.category = cmd.category;
      li.style.cssText = 'padding:4px 8px;cursor:pointer;border-radius:4px;';
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
      if (selected && selected.nextElementSibling) select(selected.nextElementSibling as HTMLLIElement);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (selected && selected.previousElementSibling) select(selected.previousElementSibling as HTMLLIElement);
    } else if (e.key === 'Enter') {
      e.preventDefault();
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
