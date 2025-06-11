export interface RoleInfo {
  name: string;
  roleid: string;
}

import { pref, strip } from '../prefix';

export function requestRoles(): Promise<RoleInfo[]> {
  return new Promise((resolve) => {
    const handler = (ev: MessageEvent) => {
      if (strip(ev.data?.type) === 'myRolesResponse') {
        window.removeEventListener('message', handler);
        resolve(ev.data.content as RoleInfo[]);
      }
    };
    window.addEventListener('message', handler);
    window.postMessage({ type: pref('myRolesRequest') }, '*');
  });
}

export function requestEntityMetadata(entity: string): Promise<Record<string, any>> {
  return new Promise((resolve) => {
    const handler = (ev: MessageEvent) => {
      if (strip(ev.data?.type) === 'entityMetadataResponse') {
        window.removeEventListener('message', handler);
        resolve(ev.data.content as Record<string, any>);
      }
    };
    window.addEventListener('message', handler);
    window.postMessage({ type: pref('entityMetadataRequest'), content: entity }, '*');
  });
}
