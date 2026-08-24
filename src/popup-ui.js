const ACCENT_SWATCHES = Object.freeze([
  '#0078d4',
  '#0a84ff',
  '#5856d6',
  '#af52de',
  '#ff2d55',
  '#30b866'
]);

export function createSettingsPopup(doc, callbacks = {}) {
  const shell = doc.createElement('div');
  shell.className = 'popup-shell';
  shell.innerHTML = `
    <header class="popup-header">
      <img src="../icons/icon48.png" width="38" height="38" alt="">
      <div>
        <h1>Assignmark</h1>
        <p>Calendar checkoffs</p>
      </div>
    </header>

    <section class="settings-card" data-section="view">
      <div class="section-heading">
        <div>
          <h2>Calendar view</h2>
          <p>Choose which assignments appear.</p>
        </div>
      </div>
      <div class="segmented-control" role="group" aria-label="Calendar item filter">
        <button type="button" data-filter="all" aria-pressed="true">All</button>
        <button type="button" data-filter="pending" aria-pressed="false">To do</button>
        <button type="button" data-filter="done" aria-pressed="false">Done</button>
      </div>
    </section>

    <section class="settings-card" data-section="appearance">
      <div class="section-heading">
        <div>
          <h2>Appearance</h2>
          <p>Keep the calendar calm and personal.</p>
        </div>
      </div>

      <button type="button" class="settings-row switch-row" data-role="fade-completed" role="switch" aria-checked="true">
        <span>
          <strong>Fade completed</strong>
          <small>Makes checked items lighter and strikes them through. It never deletes a checkmark.</small>
        </span>
        <span class="switch" aria-hidden="true"><span></span></span>
      </button>

      <div class="color-setting">
        <div class="color-copy">
          <label for="sc-accent">Accent color</label>
          <small>Used for checkboxes and active controls.</small>
        </div>
        <div class="color-field-wrap">
          <span class="color-preview" data-role="color-preview" aria-hidden="true"></span>
          <input id="sc-accent" data-role="accent-color" type="text" inputmode="text" autocomplete="off" spellcheck="false" aria-label="Accent color hex value">
        </div>
      </div>

      <div class="swatches" role="group" aria-label="Accent color presets">
        ${ACCENT_SWATCHES.map((color) => `<button type="button" data-accent="${color}" aria-label="Use accent color ${color}" style="--swatch:${color}"></button>`).join('')}
      </div>
    </section>

    <section class="settings-card danger-card" data-section="data">
      <div class="section-heading">
        <div>
          <h2>Saved checkoffs</h2>
          <p>These actions change stored completion data.</p>
        </div>
      </div>
      <button type="button" class="danger-button" data-role="reset-all" disabled>Reset all checkoffs</button>
      <p class="reset-explanation" data-role="reset-all-explanation">No saved checkoffs to reset.</p>
      <button type="button" class="secondary-button" data-role="undo" hidden>Undo reset</button>
    </section>

    <p class="popup-status" data-role="status" role="status" aria-live="polite"></p>
    <footer>Stored locally. No analytics or external requests.</footer>
  `;

  const filterButtons = [...shell.querySelectorAll('[data-filter]')];
  const fadeButton = shell.querySelector('[data-role="fade-completed"]');
  const accentInput = shell.querySelector('[data-role="accent-color"]');
  const colorPreview = shell.querySelector('[data-role="color-preview"]');
  const resetAll = shell.querySelector('[data-role="reset-all"]');
  const resetExplanation = shell.querySelector('[data-role="reset-all-explanation"]');
  const undo = shell.querySelector('[data-role="undo"]');
  const status = shell.querySelector('[data-role="status"]');
  let currentDim = true;

  for (const button of filterButtons) {
    button.addEventListener('click', () => void callbacks.onFilterChange?.(button.dataset.filter));
  }
  fadeButton.addEventListener('click', () => void callbacks.onDimChange?.(!currentDim));
  accentInput.addEventListener('change', () => void callbacks.onAccentChange?.(accentInput.value));
  for (const swatch of shell.querySelectorAll('[data-accent]')) {
    swatch.addEventListener('click', () => void callbacks.onAccentChange?.(swatch.dataset.accent));
  }
  resetAll.addEventListener('click', () => void callbacks.onResetAll?.());
  undo.addEventListener('click', () => void callbacks.onUndo?.());

  function render({ settings = {}, checkedCount = 0, canUndo = false } = {}) {
    const filter = ['all', 'pending', 'done'].includes(settings.filter) ? settings.filter : 'all';
    currentDim = Boolean(settings.dim);
    const accentColor = /^#[0-9a-f]{6}$/i.test(String(settings.accentColor || ''))
      ? String(settings.accentColor).toLowerCase()
      : '#0078d4';

    for (const button of filterButtons) {
      button.setAttribute('aria-pressed', String(button.dataset.filter === filter));
    }
    fadeButton.setAttribute('aria-checked', String(currentDim));
    accentInput.value = accentColor;
    colorPreview.style.background = accentColor;
    shell.style.setProperty('--accent', accentColor);

    const count = Math.max(0, Number(checkedCount) || 0);
    resetAll.disabled = count === 0;
    resetAll.setAttribute('aria-label', count === 0
      ? 'Reset all checkoffs unavailable because none are saved'
      : `Reset all ${count} saved checkoffs across every calendar date`);
    resetExplanation.textContent = count === 0
      ? 'No saved checkoffs to reset.'
      : `Removes ${count} saved checkoff${count === 1 ? '' : 's'} from every calendar date.`;
    undo.hidden = !canUndo;
  }

  function setStatus(message = '', tone = 'neutral') {
    status.textContent = message;
    status.dataset.tone = tone;
  }

  return { element: shell, render, setStatus };
}
