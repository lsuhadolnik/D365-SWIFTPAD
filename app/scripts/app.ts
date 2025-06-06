import { Utility } from './inject/levelup.common.utility';
import { ICustomMessage } from './interfaces/types';

class App {
  isCRMPage: boolean;

  constructor() {
    this.isCRMPage = Array.from(document.scripts).some(
      (x) =>
        x.src.indexOf('/uclient/scripts') !== -1 ||
        x.src.indexOf('/_static/_common/scripts/PageLoader.js') !== -1 ||
        x.src.indexOf('/_static/_common/scripts/crminternalutility.js') !== -1
    );
    console.log('Levelup App initialized', {
      isCRMPage: this.isCRMPage,
    });
  }

  start() {
    console.log('Levelup App starting');
    this.hookupEventListeners();
    if (this.isCRMPage) {
      Utility.injectScript(chrome.runtime.getURL('libraries/Sdk.Soap.min.js'));
      Utility.injectScript(chrome.runtime.getURL('scripts/levelup.extension.js'));
      Utility.enableExtension(true);
    } else {
      Utility.enableExtension(false);
    }
  }

  private hookupEventListeners() {
    document.addEventListener('levelup', (data: ICustomMessage) => {
      if (data.detail && data.detail.type === 'Page') {
        console.log('Levelup message dispatched to background', data.detail);
        chrome.runtime.sendMessage(data.detail);
      }
    });
  }
}

new App().start();
