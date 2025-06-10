/** Utility functions for loading and filtering available commands. */
import { Command } from '../types';

let commandsPromise: Promise<Command[]> | null = null;

/** Load list of commands from bundled JSON file */
export async function loadCommands(): Promise<Command[]> {
  if (commandsPromise) return commandsPromise;
  commandsPromise = fetch(chrome.runtime.getURL('app/commands.json')).then((r) => r.json());
  return commandsPromise;
}

/** Simple fuzzy search used by spotlight */
export function fuzzyMatch(query: string, text: string): boolean {
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
