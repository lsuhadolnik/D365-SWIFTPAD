import { Utility } from './inject/levelup.common.utility';
import { ICustomMessage } from './interfaces/types';
import { initSpotlight } from './spotlight';
import { strip } from './prefix';

class App {
  isCRMPage: boolean;

  constructor() {
    this.isCRMPage = Array.from(document.scripts).some(
      (x) =>
        x.src.indexOf('/uclient/scripts') !== -1 ||
        x.src.indexOf('/_static/_common/scripts/PageLoader.js') !== -1 ||
        x.src.indexOf('/_static/_common/scripts/crminternalutility.js') !== -1
    );
    // initialization log removed
  }

  start() {
    this.hookupEventListeners();
    initSpotlight();
    if (this.isCRMPage) {
      Utility.injectScript(chrome.runtime.getURL('app/libraries/Sdk.Soap.min.js'));
      Utility.injectScript(chrome.runtime.getURL('app/scripts/levelup.extension.js'));
      Utility.enableExtension(true);
    } else {
      Utility.enableExtension(false);
    }
  }

  private hookupEventListeners() {
    document.addEventListener('levelup', (data: ICustomMessage) => {
      const type = strip(data.detail?.type);
      if (data.detail && type === 'Page') {
        if (data.detail.category === 'Impersonation' || data.detail.category === 'Impersonation-UserSearch') {
          return;
        }
        chrome.runtime.sendMessage(data.detail);
      }
    });
  }
}

new App().start();
