import {
  IExtensionMessage,
  IImpersonationResponse,
  ExtensionMessageContent,
  IImpersonateMessage,
  ImpersonationStorage,
} from './interfaces/types';
import { pref, strip } from './prefix';

let userId: string;
let content: ExtensionMessageContent;

chrome.runtime.onMessage.addListener(async function (
  message: IExtensionMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse
) {
  const type = strip(message.type);
  if (type === 'Page') {
    const c = message.category;
    switch (c) {
      case 'Settings':
        content = message.content;
        chrome.tabs.create({
          url: chrome.runtime.getURL('app/pages/organisationdetails.html'),
        });
        break;
      case 'myRoles':
      case 'allFields':
      case 'quickFindFields':
      case 'entityMetadata':
      case 'environment':
        content = message.content;
        chrome.tabs.create({
          url: chrome.runtime.getURL('app/pages/grid.html'),
        });
        break;
      case 'workflows':
        content = message.content;
        chrome.tabs.create({
          url: chrome.runtime.getURL('app/pages/processes.html'),
        });
        break;
      case 'Extension':
        renderBadge();
        if (message.content === 'On') {
          chrome.action.enable(sender.tab.id);
        } else if (message.content === 'Off') chrome.action.disable(sender.tab.id);
        break;
      case 'Load':
        sendResponse(content);
        break;
      case 'allUserRoles':
        content = message.content;
        chrome.tabs.create({
          url: chrome.runtime.getURL('app/pages/userroles.html'),
        });
        break;
      case 'optionsets':
        content = message.content;
        chrome.tabs.create({
          url: chrome.runtime.getURL('app/pages/optionsets.html'),
        });
        break;
      case 'Impersonation-UserSearch':
        if (sender.tab?.id) {
          chrome.scripting.executeScript({
            target: { tabId: sender.tab.id },
            func: postExtensionMessageWithData,
            args: ['Page', 'Impersonation-UserSearch', message.content as IImpersonationResponse],
          });
        }
        break;
      case 'Impersonation':
        const impersonationResponse = <IImpersonationResponse>message.content;
        if (!impersonationResponse.impersonateRequest.canImpersonate) {
          if (sender.tab?.id) {
            chrome.scripting.executeScript({
              target: { tabId: sender.tab.id },
              func: postExtensionMessageWithData,
              args: ['Page', 'Impersonation', impersonationResponse],
            });
          }
          return;
        }

        // If more than one result or this is just a search request, return the list
        if (!impersonationResponse.impersonateRequest.url || impersonationResponse.users.length !== 1) {
          chrome.runtime.sendMessage(<IExtensionMessage>{
            type: pref('search'),
            category: 'Impersonation',
            content: impersonationResponse.users,
          });
        } else {
          userId = impersonationResponse.users[0].userId;

          chrome.storage.local.set({
            [impersonationResponse.impersonateRequest.url]: <ImpersonationStorage>{
              isImpersonationActive: impersonationResponse.impersonateRequest.isActive,
              userName: impersonationResponse.impersonateRequest.userName,
              userFullName: impersonationResponse.users[0].fullName,
            },
          });
          if (impersonationResponse.impersonateRequest.isActive) {
            chrome.declarativeNetRequest.updateDynamicRules(
              {
                removeRuleIds: [1],
                addRules: [
                  {
                    id: 1,
                    priority: 1,
                    action: {
                      type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
                      requestHeaders: [
                        {
                          header: 'CallerObjectId',
                          operation: chrome.declarativeNetRequest.HeaderOperation.SET,
                          value: userId,
                        },
                      ],
                    },
                    condition: {
                      regexFilter: `${impersonationResponse.impersonateRequest.url}api/*`,
                      resourceTypes: [
                        chrome.declarativeNetRequest.ResourceType.MAIN_FRAME,
                        chrome.declarativeNetRequest.ResourceType.SUB_FRAME,
                        chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST,
                      ],
                    },
                  },
                ],
              },
              async () => {
                renderBadge(impersonationResponse.impersonateRequest.url);
              }
            );
          } else {
            chrome.declarativeNetRequest.getDynamicRules((rules) => {
              const ruleIds = rules.map((x) => x.id);
              chrome.declarativeNetRequest.updateDynamicRules({
                removeRuleIds: ruleIds,
              });
            });
            chrome.storage.local.clear();
          }
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (tab) chrome.tabs.reload(tab.id, { bypassCache: true });
        }
        break;
      default:
        break;
    }
  } else if (message.type === 'reset') {
    chrome.declarativeNetRequest.getDynamicRules((rules) => {
      const ruleIds = rules.map((x) => x.id);
      chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: ruleIds,
      });
    });
    chrome.storage.local.clear();
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) chrome.tabs.reload(tab.id, { bypassCache: true });
  } else if (type === 'impersonation' || type === 'search' || type === 'openRecordQuick') {
    const data = <IImpersonateMessage | { entity: string; id: string }>message.content,
      [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;

    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: postExtensionMessageWithData,
      args: [type, message.category.toString(), data],
    });
  } else {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;

    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: postExtensionMessage,
      args: [type, message.category.toString()],
    });
  }
});

async function renderBadge(url?: string) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url) return;

  if (!url) url = `${new URL(tab.url).origin}/`;
  const localSettingForEnv: ImpersonationStorage = (await chrome.storage.local.get(url))[url];
  if (!localSettingForEnv) {
    chrome.action.setBadgeBackgroundColor({ color: [0, 0, 0, 0] });
    chrome.action.setBadgeText({ text: '' });
    chrome.action.setTitle({ title: '' });
    return;
  }
  if (localSettingForEnv.isImpersonationActive) {
    chrome.action.setBadgeBackgroundColor({ color: [255, 0, 0, 255] });
    chrome.action.setTitle({ title: `Impersonating ${localSettingForEnv.userName}` });
    chrome.action.setBadgeText({
      text: localSettingForEnv.userFullName,
    });
  }
}

function postExtensionMessage(message: string, category: string) {
  window.postMessage({ type: pref(message), category: category }, '*');
}

function postExtensionMessageWithData(message: string, category: string, data: object) {
  window.postMessage({ type: pref(message), category: category, content: data }, '*');
}

chrome.action.onClicked.addListener((tab) => {
  if (!tab.id) return;
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      window.dispatchEvent(new CustomEvent('openSpotlight', { detail: { tip: true } }));
    },
  });
});
