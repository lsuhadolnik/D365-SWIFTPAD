import { Utility } from './levelup.common.utility';

export class Navigation {
  constructor(private utility: Utility) {}

  openRecord(entityName: string, entityId?: string): void {
    if (!entityName) {
      let defaultEntity = this.utility.Xrm.Page?.data?.entity?.getEntityName();
      if (!defaultEntity) {
        const params = new URLSearchParams(this.utility.formWindow.location.search);
        defaultEntity = params.get('etn');
      }
      entityName = prompt('Entity?', defaultEntity || '');
    }
    if (entityName && !entityId) {
      entityId = prompt('Id?', '');
    }
    if (entityId) {
      window.open(
        `${this.utility.clientUrlForParams}etn=${entityName}&id=${entityId}&newWindow=true&pagetype=entityrecord`,
        '_blank'
      );
    }
  }

  newRecord() {
    const entityName = prompt('Entity?', '');
    if (entityName) {
      window.open(`${this.utility.clientUrlForParams}etn=${entityName}&newWindow=true&pagetype=entityrecord`, '_blank');
    }
  }

  openSecurity() {
    window.top.document
      .getElementById('navBar')
      // @ts-ignore
      .control.raiseNavigateRequest({ uri: '/tools/AdminSecurity/adminsecurity_area.aspx?pagemode=iframe&' });
  }

  openSystemJobs() {
    this.openList('asyncoperation');
  }

  openSolutions() {
    if (this.utility.isOnline) {
      window.open(
        `https://make.powerapps.com/environments/${this.utility.environmentDetail.EnvironmentId}/solutions`,
        '_blank'
      );
    } else {
      this.openList('solution');
    }
  }

  openProcesses() {
    this.openList('workflow');
  }

  openMain() {
    window.open(`${this.utility.clientUrl}`, '_blank');
  }

  openAdvFind() {
    if (!this.utility.Xrm.Page.data || !this.utility.Xrm.Page.data.entity) {
      window.open(`${this.utility.clientUrlForParams}pagetype=advancedfind`, '_blank');
    } else {
      const entityName = this.utility.Xrm.Page.data.entity.getEntityName();
      window.open(
        //@ts-ignore
        `${this.utility.clientUrlForParams}extraqs=EntityCode%3d${this.utility.Xrm.Internal.getEntityCode(
          entityName
        )}&pagetype=advancedfind`,
        '_blank'
      );
    }
  }

  mocaClient() {
    let url =
      //@ts-ignore
      (Xrm.Page.context.isOffice365 && Xrm.Page.context.isOffice365()) ||
      //@ts-ignore
      (Xrm.Page.context.isOnPremises && !Xrm.Page.context.isOnPremises())
        ? Xrm.Page.context.getClientUrl()
        : window.location.origin;
    window.open(
      `${url}/nga/main.htm?org=${this.utility.Xrm.Page.context.getOrgUniqueName()}&server=${Xrm.Page.context.getClientUrl()}`
    );
  }

  myUserRecord() {
    this.openRecord('systemuser', this.utility.Xrm.Page.context.getUserId());
  }

  myMailbox() {
    let attributes = 'MailboxId';
    let entity = 'MailboxSet';
    let filter = `RegardingObjectId/Id eq (guid'${this.utility.currentUserId}')`;
    if (this.utility.is2016OrGreater) {
      entity = 'mailboxes';
      attributes = attributes.toLocaleLowerCase();
      filter = `_regardingobjectid_value eq ${this.utility.currentUserId}`;
    }
    this.utility
      .fetch(entity, attributes, filter)
      .then((results) => {
        if (results.length > 0) {
          this.openRecord('mailbox', results[0].MailboxId || results[0].mailboxid);
        }
      })
      .catch((err) => {
        console.log(err);
      });
  }

  diagnostics() {
    //@ts-ignore
    if (Xrm.Internal.isUci && Xrm.Internal.isUci()) {
      window.open(`${Xrm.Page.context.getClientUrl()}/tools/diagnostics/diag.aspx/GetMetrics`);
    } else {
      window.open(`${this.utility.clientUrl}/tools/diagnostics/diag.aspx`, '_blank');
    }
  }

  perfCenter() {
    //@ts-ignore
    if (Xrm.Internal.isUci && Xrm.Internal.isUci() && !location.search.includes('perf=')) {
      window.location.href = `${this.utility.clientUrl}&perf=true`;
    } else {
      //@ts-ignore
      Mscrm.Performance.PerformanceCenter.get_instance().TogglePerformanceResultsVisibility();
    }
  }

  instancePicker() {
    if (
      //@ts-ignore
      (Xrm.Page.context.isOffice365 && Xrm.Page.context.isOffice365()) ||
      //@ts-ignore
      (Xrm.Page.context.isOnPremises && !Xrm.Page.context.isOnPremises())
    ) {
      let clientUrl = Xrm.Page.context.getClientUrl();
      window.open(
        `https://port${clientUrl.substr(clientUrl.indexOf('.'))}/G/Instances/InstancePicker.aspx?redirect=False`,
        '_blank'
      );
    } else {
      alert('Instance picker is available only for Dynamics 365/Dynamics CRM Online');
    }
  }

  openList(entityName: string) {
    if (!entityName) {
      entityName = prompt('Entity?', '');
    }
    if (entityName) {
      window.open(`${this.utility.clientUrlForParams}etn=${entityName}&pagetype=entitylist`);
    }
  }

  openMailboxes() {
    this.openList('mailbox');
  }

  openPPAC() {
    window.open('https://admin.powerplatform.microsoft.com/analytics/d365ce');
  }

  openAdmin() {
    window.open('https://admin.dynamics.com', '_blank');
  }

  openMakePowerApps() {
    window.open('https://make.powerapps.com', '_blank');
  }

  reloadData() {
    //@ts-ignore
    if (Xrm.Page?.data?.refresh) {
      //@ts-ignore
      const result = Xrm.Page.data.refresh(false);
      if (result && result.then) {
        result.then(() => this.showToast('Data reloaded'));
      } else {
        this.showToast('Data reloaded');
      }
      return;
    }
    window.location.reload();
  }

  private autoReloadTimer: number | null = null;
  private autoReloadSelected: HTMLButtonElement | null = null;

  autoReload() {
    const existing = document.getElementById('dl-auto-reload-toast');
    if (existing) {
      if (this.autoReloadTimer) clearInterval(this.autoReloadTimer);
      existing.remove();
      this.autoReloadTimer = null;
      return;
    }

    const toast = document.createElement('div');
    toast.id = 'dl-auto-reload-toast';
    toast.style.cssText =
      'position:fixed;bottom:20px;left:20px;background:#323232;color:#fff;padding:8px 16px;border-radius:4px;z-index:2147483647;display:flex;align-items:center;gap:8px;font-size:12px;';
    const title = document.createElement('span');
    title.textContent = 'Auto refresh';
    title.style.marginRight = '8px';
    const indicator = document.createElement('div');
    indicator.className = 'dl-indicator';
    const spinner = document.createElement('div');
    spinner.className = 'dl-spinner';
    const tick = document.createElement('span');
    tick.textContent = '✓';
    tick.className = 'dl-tick';
    indicator.append(spinner, tick);
    const btnWrap = document.createElement('div');
    btnWrap.style.display = 'flex';
    btnWrap.style.gap = '4px';
    let defaultBtn: HTMLButtonElement | null = null;
    const buttonStyle = 'background:#555;border:none;color:#fff;padding:2px 4px;border-radius:2px;cursor:pointer;';
    [
      { label: '1s', ms: 1000 },
      { label: '5s', ms: 5000 },
      { label: '10s', ms: 10000 },
    ].forEach((b) => {
      const btn = document.createElement('button');
      btn.textContent = b.label;
      btn.style.cssText = buttonStyle;
      btn.addEventListener('click', () => setFreq(b.ms, btn));
      btnWrap.append(btn);
      if (b.ms === 5000) defaultBtn = btn;
    });
    const stopBtn = document.createElement('button');
    stopBtn.textContent = 'Stop';
    stopBtn.style.cssText = buttonStyle;
    stopBtn.addEventListener('click', () => {
      if (this.autoReloadTimer) {
        clearInterval(this.autoReloadTimer);
        this.autoReloadTimer = null;
      }
      if (this.autoReloadSelected) {
        this.autoReloadSelected.classList.remove('selected');
        this.autoReloadSelected = null;
      }
      toast.remove();
    });
    btnWrap.append(stopBtn);
    toast.append(title, indicator, btnWrap);
    document.body.append(toast);

    const showTick = () => {
      tick.style.opacity = '1';
      setTimeout(() => {
        tick.style.opacity = '0';
      }, 500);
    };

    const reload = () => {
      //@ts-ignore
      if (Xrm.Page?.data?.refresh) {
        //@ts-ignore
        const result = Xrm.Page.data.refresh(false);
        if (result && result.then) {
          result.then(showTick);
        } else {
          showTick();
        }
        return;
      }
      window.location.reload();
    };

    const setFreq = (ms: number, btn?: HTMLButtonElement) => {
      if (this.autoReloadTimer) clearInterval(this.autoReloadTimer);
      this.autoReloadTimer = window.setInterval(reload, ms);
      if (this.autoReloadSelected) {
        this.autoReloadSelected.classList.remove('selected');
      }
      if (btn) {
        btn.classList.add('selected');
        this.autoReloadSelected = btn;
      }
    };

    setFreq(5000, defaultBtn);
  }

  solutionHistory() {
    if (
      //@ts-ignore
      (Xrm.Page.context.isOffice365 && Xrm.Page.context.isOffice365()) ||
      //@ts-ignore
      (Xrm.Page.context.isOnPremises && !Xrm.Page.context.isOnPremises())
    ) {
      window.open(
        `https://make.powerapps.com/environments/${this.utility.environmentDetail.EnvironmentId}/history`,
        '_blank'
      );
    } else {
      this.openList('msdyn_solutionhistory');
    }
  }

  debugRibbon() {
    //@ts-ignore
    if (Xrm.Internal.isUci && Xrm.Internal.isUci() && !location.search.includes('ribbondebug=')) {
      window.location.href = `${location.href}&ribbondebug=true`;
    }
  }

  formMonitor() {
    //@ts-ignore
    if (Xrm.Internal.isUci && Xrm.Internal.isUci() && !location.search.includes('monitor=')) {
      window.location.href = `${location.href}&monitor=true`;
    }
  }

  private showToast(message: string) {
    const toast = document.createElement('div');
    toast.className = 'dl-toast';
    toast.textContent = message;
    document.body.append(toast);
    requestAnimationFrame(() => {
      toast.style.opacity = '1';
    });
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.addEventListener('transitionend', () => toast.remove());
    }, 2000);
  }
}
