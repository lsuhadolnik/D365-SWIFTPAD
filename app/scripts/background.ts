import {
  IExtensionMessage,
  IImpersonationResponse,
  ExtensionMessageContent,
  IImpersonateMessage,
  ImpersonationStorage,
} from './interfaces/types';

let userId: string;
let content: ExtensionMessageContent;

chrome.runtime.onMessage.addListener(async function (
  message: IExtensionMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse
) {
  console.log('Levelup background received', message);
  if (message.type === 'Page') {
    const c = message.category;
    console.log('Levelup background processing category', c);
    switch (c) {
      case 'Settings':
        console.log('Opening organisation details');
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
        console.log('Opening grid page for', c);
        content = message.content;
        chrome.tabs.create({
          url: chrome.runtime.getURL('app/pages/grid.html'),
        });
        break;
      case 'workflows':
        console.log('Opening processes page');
        content = message.content;
        chrome.tabs.create({
          url: chrome.runtime.getURL('app/pages/processes.html'),
        });
        break;
      case 'Extension':
        console.log('Updating extension state', message.content);
        renderBadge();
        if (message.content === 'On') {
          chrome.action.enable(sender.tab.id);
        } else if (message.content === 'Off') chrome.action.disable(sender.tab.id);
        break;
      case 'Load':
        console.log('Loading cached content');
        sendResponse(content);
        break;
      case 'allUserRoles':
        console.log('Opening user roles');
        content = message.content;
        chrome.tabs.create({
          url: chrome.runtime.getURL('app/pages/userroles.html'),
        });
        break;
      case 'optionsets':
        console.log('Opening optionsets');
        content = message.content;
        chrome.tabs.create({
          url: chrome.runtime.getURL('app/pages/optionsets.html'),
        });
        break;
      case 'Impersonation':
        console.log('Handling impersonation response');
        const impersonationResponse = <IImpersonationResponse>message.content;
        if (impersonationResponse.users.length === 0 || !impersonationResponse.impersonateRequest.canImpersonate)
          return;

        if (impersonationResponse.users.length > 1) {
          chrome.runtime.sendMessage(<IExtensionMessage>{
            type: 'search',
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
                console.log('Dynamic rules updated for impersonation');
                renderBadge(impersonationResponse.impersonateRequest.url);
              }
            );
          } else {
            chrome.declarativeNetRequest.getDynamicRules((rules) => {
              const ruleIds = rules.map((x) => x.id);
              chrome.declarativeNetRequest.updateDynamicRules({
                removeRuleIds: ruleIds,
              });
              console.log('Dynamic rules cleared');
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
    console.log('Resetting impersonation state');
    chrome.declarativeNetRequest.getDynamicRules((rules) => {
      const ruleIds = rules.map((x) => x.id);
      chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: ruleIds,
      });
      console.log('Dynamic rules cleared');
    });
    chrome.storage.local.clear();
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) chrome.tabs.reload(tab.id, { bypassCache: true });
  } else if (message.type === 'impersonation' || message.type === 'search' || message.type === 'openRecordQuick') {
    console.log('Forwarding data message to content script');
    const data = <IImpersonateMessage | { entity: string; id: string }>message.content,
      [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;

    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: postExtensionMessageWithData,
      args: [message.type.toString(), message.category.toString(), data],
    });
  } else {
    console.log('Forwarding generic message to content script');
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;

    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: postExtensionMessage,
      args: [message.type.toString(), message.category.toString()],
    });
  }
});

async function renderBadge(url?: string) {
  console.log('Levelup rendering badge for', url);
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
  console.log('postExtensionMessage', { message, category });
  window.postMessage({ type: message, category: category }, '*');
}

function postExtensionMessageWithData(message: string, category: string, data: object) {
  console.log('postExtensionMessageWithData', { message, category, data });
  window.postMessage({ type: message, category: category, content: data }, '*');
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
