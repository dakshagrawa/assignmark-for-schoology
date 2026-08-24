import '@melloware/coloris/dist/coloris.css';
import './popup.css';
import Coloris from '@melloware/coloris';
import { DATA_KEY } from './core.js';
import { initSettingsPopup } from './popup-controller.js';

function subscribeStorage(callback) {
  const listener = (changes, areaName) => {
    if (areaName === 'local' && changes[DATA_KEY]?.newValue) callback(changes[DATA_KEY].newValue);
  };
  chrome.storage.onChanged.addListener(listener);
}

async function start() {
  Coloris.init();
  await initSettingsPopup(document, {
    sendMessage: (message) => chrome.runtime.sendMessage(message),
    confirmAction: (message) => window.confirm(message),
    subscribeStorage
  });
  Coloris({
    el: '#sc-accent',
    theme: 'polaroid',
    themeMode: 'auto',
    format: 'hex',
    alpha: false,
    swatches: ['#0078d4', '#0a84ff', '#5856d6', '#af52de', '#ff2d55', '#30b866']
  });
  document.querySelector('#app')?.setAttribute('aria-busy', 'false');
}

void start().catch((error) => {
  console.error('[Assignmark] Settings popup failed to start.', error);
  const root = document.querySelector('#app');
  if (root) {
    root.setAttribute('aria-busy', 'false');
    root.textContent = 'Assignmark settings could not load. Close this popup and try again.';
  }
});
