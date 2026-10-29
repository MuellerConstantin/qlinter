import { seedDefaultConfig } from './util/storage.js';
import type { LocationChangeMessage } from './types.js';

const CONTENT_SCRIPT_ID = 'qlinter-content';
const MAIN_SCRIPT_ID = 'qlinter-main';
const SCRIPT_IDS = [CONTENT_SCRIPT_ID, MAIN_SCRIPT_ID];
const CONTENT_STYLES = 'styles/content.css';

async function syncContentScripts(): Promise<void> {
  const granted = await chrome.permissions.getAll();
  const origins = granted.origins ?? [];

  const existing = await chrome.scripting.getRegisteredContentScripts({
    ids: SCRIPT_IDS,
  });

  if (existing.length > 0) {
    await chrome.scripting.unregisterContentScripts({ ids: SCRIPT_IDS });
  }

  if (origins.length === 0) {
    console.log('[qlinter] no granted origins — content scripts unregistered');
    return;
  }

  await chrome.scripting.registerContentScripts([
    {
      id: CONTENT_SCRIPT_ID,
      matches: origins,
      js: ['content.js'],
      css: [CONTENT_STYLES],
      runAt: 'document_idle',
    },
    {
      id: MAIN_SCRIPT_ID,
      matches: origins,
      js: ['main.js'],
      runAt: 'document_idle',
      world: 'MAIN',
    },
  ]);

  console.log('[qlinter] content scripts registered for', origins);
}

chrome.permissions.onAdded.addListener((perms) => {
  void handlePermissionsAdded(perms);
});

async function handlePermissionsAdded(perms: chrome.permissions.Permissions): Promise<void> {
  await syncContentScripts();

  const origins = perms.origins ?? [];

  if (origins.length === 0) {
    return;
  }

  const tabs = await chrome.tabs.query({ url: origins });

  await Promise.all(
    tabs.map(async (tab) => {
      if (typeof tab.id !== 'number') {
        return;
      }

      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js'],
        });

        await chrome.scripting.insertCSS({
          target: { tabId: tab.id },
          files: [CONTENT_STYLES],
        });

        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['main.js'],
          world: 'MAIN',
        });
      } catch (err) {
        console.warn('[qlinter] failed to inject content script into tab', tab.id, err);
      }
    }),
  );
}

chrome.permissions.onRemoved.addListener(() => {
  void syncContentScripts();
});

/*
 * Seeding runs on startup as well as on install so a profile that missed the
 * install event still ends up with a usable default. It is a no-op once any
 * config has been stored, so repeating it costs a single storage read.
 */
chrome.runtime.onInstalled.addListener(() => {
  void syncContentScripts();
  void seedDefaultConfig();
});

chrome.runtime.onStartup.addListener(() => {
  void syncContentScripts();
  void seedDefaultConfig();
});

chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
  if (details.frameId !== 0) {
    return;
  }

  const message: LocationChangeMessage = { type: 'qlinter:location-change' };
  chrome.tabs.sendMessage(details.tabId, message).catch(() => {});
});

console.log('[qlinter] service worker booted');
