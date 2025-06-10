import { Utility } from './inject/levelup.common.utility';
import { IExtensionMessage, IImpersonateMessage } from './interfaces/types';
import { Forms } from './inject/levelup.forms';
import { Service } from './inject/levelup.servicecalls';
import { Navigation } from './inject/levelup.navigation';
import { Grid } from './inject/levelup.grid';

window.addEventListener('message', async function (event) {
  let utility: Utility;
  let formWindow: Window;
  let formDocument: Document;
  let xrm: Xrm.XrmStatic;

  console.log('Levelup received window message', event.data);

  // Ignore messages that are results from this page to avoid infinite loops
  if (event.data?.type === 'Page') return;

  // home.dynamics.com also messaging. Ignore.
  if (location.origin !== event.origin && location.origin !== `${event.origin}.mcas.ms`) return;
  const source = <Window>event.source;
  if (source.Xrm && event.data.type) {
    const clientUrl =
      (source.Xrm.Page.context.getCurrentAppUrl && source.Xrm.Page.context.getCurrentAppUrl()) ||
      source.Xrm.Page.context.getClientUrl();

    // This is for differentiating between OnPrem, OnPrem on IFD or CRM Online
    const cleanedClientUrl = !clientUrl.endsWith(Xrm.Page.context.getOrgUniqueName())
      ? clientUrl
      : clientUrl.substr(0, clientUrl.lastIndexOf('/'));
    if (!cleanedClientUrl.startsWith(event.origin)) return;
    const contentPanels = Array.from(document.querySelectorAll('iframe')).filter(function (d) {
      return d.style.visibility !== 'hidden';
    });
    //@ts-ignore
    if (source.Xrm.Internal.isUci && Xrm.Internal.isUci()) {
      formWindow = window;
      formDocument = document;
      xrm = window.Xrm;
      utility = new Utility(formDocument, formWindow, xrm, clientUrl);
    } else if (contentPanels && contentPanels.length > 0) {
      formWindow = contentPanels[0].contentWindow;
      formDocument = contentPanels[0].contentDocument;
      xrm = formWindow.Xrm;
      if (!xrm) {
        formWindow = window;
        formDocument = document;
        xrm = window.Xrm;
      }
      utility = new Utility(formDocument, formWindow, xrm, clientUrl);
    }
    if (utility.is2016OrGreater) {
      await utility.retrieveEnvironmentDetails();
    }
    if ((<IExtensionMessage>event.data).category === 'Forms' && !xrm.Page.data) {
      alert('This command can only be performed in the context of a form');
      return;
    }
    try {
      const message = <IExtensionMessage>event.data;
      console.log('Levelup executing message', message);
      switch (message.category) {
        case 'Forms':
          new Forms(utility)[message.type]();
          break;
        case 'API':
          new Service(utility)[message.type]();
          break;
        case 'Grid':
          new Grid(utility)[message.type]();
          break;
        case 'Navigation':
          if (message.type === 'openRecordQuick') {
            const content = message.content as { entity: string; id: string };
            new Navigation(utility).openRecord(content.entity, content.id);
          } else {
            new Navigation(utility)[message.type]();
          }
          break;
        case 'Impersonation':
          const impersonateMessage = <IImpersonateMessage>message.content;
          new Service(utility).impersonateUser(impersonateMessage);
          break;
        case 'myRolesRequest':
          {
            const roles = await new Service(utility).getMyRolesData();
            window.postMessage({ type: 'myRolesResponse', content: roles }, '*');
          }
          break;
        case 'entityMetadataRequest':
          {
            const entity = message.content as string;
            const meta = await new Service(utility).getEntityMetadataData(entity);
            window.postMessage({ type: 'entityMetadataResponse', content: meta }, '*');
          }
          break;
        case 'myRoles':
        case 'allUserRoles':
        case 'entityMetadata':
        case 'environment':
        case 'optionsets':
        case 'workflows':
        case 'allFields':
          new Service(utility)[message.type]();
          break;
      }
    } catch (e) {
      console.error('Levelup message execution failed', e);
      alert('Levelup encountered an error. Check console for details.');
    }
  }
});
