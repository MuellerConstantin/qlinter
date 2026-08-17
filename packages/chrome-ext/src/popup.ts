import type {
  DiagnosticCounts,
  DiagnosticsMessage,
  FixAllMessage,
  GetDiagnosticsMessage,
  GetStatusMessage,
  Message,
  Status,
  StatusMessage,
} from './types.js';

const statusDot = document.getElementById('status-dot') as HTMLSpanElement;
const statusLabel = document.getElementById('status-label') as HTMLSpanElement;
const grantButton = document.getElementById('grant-button') as HTMLButtonElement;
const fixAllButton = document.getElementById('fix-all-button') as HTMLButtonElement;
const settingsButton = document.getElementById('settings-button') as HTMLButtonElement;

const summary = document.getElementById('summary') as HTMLDivElement;
const countError = document.getElementById('count-error') as HTMLSpanElement;
const countWarning = document.getElementById('count-warning') as HTMLSpanElement;
const countInfo = document.getElementById('count-info') as HTMLSpanElement;

const STATUS_MESSAGE_KEYS: Record<Status, string> = {
  loading: 'statusLoading',
  active: 'statusActive',
  'needs-permission': 'statusNeedsPermission',
  'not-applicable': 'statusNotApplicable',
  errored: 'statusErrored',
};

let activeTabId: number | null = null;

function renderStatus(status: Status): void {
  statusLabel.textContent = chrome.i18n.getMessage(STATUS_MESSAGE_KEYS[status]);

  statusDot.classList.toggle('active', status === 'active');
  statusDot.classList.toggle('errored', status === 'errored');

  grantButton.hidden = status !== 'needs-permission';

  if (status !== 'active') {
    fixAllButton.hidden = true;
  }
}

function renderCounts(counts: DiagnosticCounts | undefined, fixable: number): void {
  summary.hidden = !counts;
  fixAllButton.hidden = !counts || fixable <= 0;

  if (!counts) {
    return;
  }

  countError.textContent = String(counts.error);
  countWarning.textContent = String(counts.warning);
  countInfo.textContent = String(counts.info);
}

grantButton.textContent = chrome.i18n.getMessage('grantButton');
fixAllButton.textContent = chrome.i18n.getMessage('fixAllButton');
fixAllButton.onclick = () => {
  if (activeTabId === null) {
    return;
  }
  const request: FixAllMessage = { type: 'qlinter:fix-all' };
  chrome.tabs.sendMessage(activeTabId, request).catch(() => {});
};

const settingsLabel = chrome.i18n.getMessage('settingsButton');
settingsButton.setAttribute('aria-label', settingsLabel);
settingsButton.title = settingsLabel;
settingsButton.onclick = () => {
  chrome.runtime.openOptionsPage();
};

renderStatus('loading');

async function getActiveTab(): Promise<chrome.tabs.Tab | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function originPattern(url: string): string | null {
  try {
    const u = new URL(url);

    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      return null;
    }

    return `${u.protocol}//${u.hostname}/*`;
  } catch {
    return null;
  }
}

async function isOriginGranted(origin: string): Promise<boolean> {
  const granted = await chrome.permissions.getAll();
  return (granted.origins ?? []).includes(origin);
}

async function queryStatus(tabId: number): Promise<Status> {
  try {
    const request: GetStatusMessage = { type: 'qlinter:get-status' };
    const response = (await chrome.tabs.sendMessage(tabId, request)) as StatusMessage | undefined;
    return response?.status ?? 'errored';
  } catch {
    return 'errored';
  }
}

async function queryDiagnostics(tabId: number): Promise<DiagnosticsMessage | null> {
  try {
    const request: GetDiagnosticsMessage = { type: 'qlinter:get-diagnostics' };
    const response = (await chrome.tabs.sendMessage(tabId, request)) as DiagnosticsMessage | undefined;
    return response ?? null;
  } catch {
    return null;
  }
}

async function refresh(): Promise<void> {
  const tab = await getActiveTab();
  activeTabId = tab?.id ?? null;

  if (!tab?.id || !tab.url) {
    renderStatus('not-applicable');
    return;
  }

  const origin = originPattern(tab.url);

  if (!origin) {
    renderStatus('not-applicable');
    return;
  }

  if (!(await isOriginGranted(origin))) {
    renderStatus('needs-permission');

    grantButton.onclick = () => {
      chrome.permissions
        .request({ origins: [origin] })
        .then((ok) => {
          if (ok) {
            void refresh();
          }
        })
        .catch((err) => {
          console.warn('[qlinter:popup] permission request failed', err);
        });
    };
    return;
  }

  const status = await queryStatus(tab.id);
  renderStatus(status);

  if (status === 'active') {
    const diagnostics = await queryDiagnostics(tab.id);
    renderCounts(diagnostics?.counts, diagnostics?.fixable ?? 0);
  } else {
    renderCounts(undefined, 0);
  }
}

// Returns `undefined` rather than `void`: Chrome reads the return value to
// decide whether `sendResponse` will be called asynchronously, and this
// listener never responds.
chrome.runtime.onMessage.addListener((message: Message): undefined => {
  if (message?.type === 'qlinter:status') {
    /*
     * An `active` broadcast means the content script came up after this
     * popup's own pass already ran — which is the normal case right after a
     * permission grant, where the pass races the service worker's injection
     * and comes back with no counts. Repainting just the label would leave the
     * popup showing an active status above an empty body, so re-run the whole
     * query instead.
     */
    if (message.status === 'active') {
      void refresh();
      return;
    }

    renderStatus(message.status);
    renderCounts(undefined, 0);
  }

  if (message?.type === 'qlinter:diagnostics') {
    renderCounts(message.counts, message.fixable);
  }
});

void refresh();
