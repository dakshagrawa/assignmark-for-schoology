// ==UserScript==
// @name         Schoology Calendar Assignment Checker
// @author       Daksh Agrawal
// @namespace    https://fuhsd.schoology.com/
// @version      1.2
// @description  Calendar-only checkboxes with hybrid ID resolution (canonical + fingerprint), conflict merging, and persistent mapping to keep checks stable.
// @match        https://fuhsd.schoology.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    const STORAGE_KEY = 'sc_cal_checkbox_states_calendar_only';
    const SETTINGS_KEY = 'sc_cal_checkbox_settings_calendar_only';
    const IDMAP_KEY = 'sc_cal_idmap_calendar_only_v2'; // persistent mapping: fingerprint -> canonical ID
    const POLL_MS = 3000;
    const STYLE_ID = 'sc_cal_calendar_only_styles';

    // --- Storage helpers
    const getSettings = () => {
        try { return Object.assign({ hide: false, dim: true }, JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')); }
        catch { return { hide: false, dim: true }; }
    };
    const saveSettings = s => { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s||{})); } catch {} };
    const getStates = () => {
        try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; }
    };
    const saveStates = s => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s||{})); } catch {} };

    const loadIdMap = () => { try { return JSON.parse(localStorage.getItem(IDMAP_KEY) || '{}'); } catch { return {}; } };
    const saveIdMap = m => { try { localStorage.setItem(IDMAP_KEY, JSON.stringify(m||{})); } catch {} };

    // --- Text + hash helpers
    const normalize = s => (s || '').toString().trim().replace(/\s+/g,' ').toLowerCase();

    function shortHash(str) {
        let h = 2166136261 >>> 0;
        for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619) >>> 0;
        return (h >>> 0).toString(36);
    }

    function elementPathFingerprint(el, depth = 6) {
        if (!el || !el.tagName) return '';
        const parts = [];
        let cur = el;
        for (let i = 0; i < depth && cur; i++, cur = cur.parentElement) {
            const tag = (cur.tagName || '').toLowerCase();
            let idx = 1;
            let sib = cur;
            while (sib.previousElementSibling) { sib = sib.previousElementSibling; idx++; }
            parts.push(`${tag}:nth(${idx})`);
        }
        return parts.join('>');
    }

    function normalizeHref(h) {
        try {
            const u = new URL(h, location.origin);
            u.hash = '';
            // Strip common tracking params
            ['utm_source','utm_medium','utm_campaign','utm_term','utm_content','fbclid'].forEach(k => u.searchParams.delete(k));
            return u.pathname; // canonical to path only for stability
        } catch { return (h||'')+''; }
    }

    // --- HYBRID ID RESOLUTION + MERGE
    // 1) Try canonical (href/data-*). 2) Compute old fingerprint ID. 3) Merge states if both exist.
    // 4) Persist mapping from fingerprint -> canonical for future stability.
    function computeCalendarStableId(node) {
        if (!node) return null;

        const states = getStates();
        const idMap = loadIdMap();

        // Canonical from href (/assignment/...), then dataset attributes
        let canonical = null;
        try {
            // Search anchor near node
            let anc = node.tagName === 'A' ? node : null;
            if (!anc) {
                let cur = node;
                for (let i = 0; i < 6 && cur; i++, cur = cur.parentElement) {
                    if (cur.tagName === 'A') { anc = cur; break; }
                    const a = cur.querySelector && cur.querySelector('a[href*="/assignment/"]');
                    if (a) { anc = a; break; }
                }
            }
            if (anc && anc.href) {
                const path = normalizeHref(anc.href);
                if (path && /\/assignment\/\d+/.test(path)) canonical = 'href::' + path;
            }
        } catch {}

        if (!canonical) {
            const attrs = ['data-assignment-id','data-event-id','data-event-instance','data-id'];
            for (const aName of attrs) {
                let cur = node;
                for (let i=0;i<6 && cur;i++,cur=cur.parentElement) {
                    const v = cur.getAttribute && cur.getAttribute(aName);
                    if (v) { canonical = `eid::${v}`; break; }
                }
                if (canonical) break;
            }
        }

        // Old fingerprint id (title + time + path)
        const title = normalize(node.querySelector?.('.fc-event-title, .fc-title, .event-title, a')?.textContent || node.textContent || '');
        const time = normalize(node.querySelector?.('.fc-event-time, .fc-time')?.textContent || '');
        const path = elementPathFingerprint(node, 6);
        const fpKey = `${title}||${time}||${path}`;
        const oldId = `cal::${shortHash(fpKey)}`;

        // If we previously mapped this fingerprint to a canonical id, use it
        if (!canonical && idMap[fpKey]) return idMap[fpKey];

        // If canonical exists, merge any old fingerprint state into canonical and persist mapping
        if (canonical) {
            if (states[oldId] && !states[canonical]) {
                // migrate old state into canonical
                states[canonical] = states[oldId];
                delete states[oldId];
                saveStates(states);
            }
            // Remember fingerprint -> canonical for future
            idMap[fpKey] = canonical;
            saveIdMap(idMap);
            return canonical;
        }

        // No canonical available: return old fingerprint id, and ensure it's mapped to itself for consistency
        if (!idMap[fpKey]) { idMap[fpKey] = oldId; saveIdMap(idMap); }
        return oldId;
    }

    // --- Styles (dim/hide)
    function ensureStyles() {
        if (document.getElementById(STYLE_ID)) return;
        const s = document.createElement('style');
        s.id = STYLE_ID;
        s.textContent = `
      .sc-cal-left-wrapper { display:inline-flex; align-items:center; gap:6px; margin-right:6px; vertical-align:middle; }
      .sc-cal-left-checkbox { width:13.5px; height:13.5px; margin:0; padding:0; cursor:pointer; accent-color:#0078d4; transform:scale(0.95); border-radius:2px; }
      .sc-checked-dim { opacity:0.55 !important; color:#333 !important; text-decoration:line-through !important; transition:none !important; }
      .sc-hidden-checked { display:none !important; transition:none !important; }

      .sc-cal-toolbar { position: fixed; right: 12px; bottom: 70px; z-index: 2147483000; display: flex; flex-direction: column; gap: 8px; align-items: center; }
      .sc-cal-toolbar .sc-icon-btn { width: 52px; height: 52px; display: inline-flex; flex-direction: column; align-items: center; justify-content: center; gap:4px; border-radius: 10px; background: #fff; border: 1px solid #e6e6e6; box-shadow: 0 6px 18px rgba(0,0,0,0.08); cursor: pointer; }
      .sc-cal-toolbar .sc-icon-btn svg { width:20px; height:20px; fill:#444; }
      .sc-cal-toolbar .sc-label { font-size:11px; color:#444; line-height:1; }
      .sc-cal-toolbar .sc-icon-btn[aria-pressed="true"] { background:#0078d4; border-color: transparent; }
      .sc-cal-toolbar .sc-icon-btn[aria-pressed="true"] svg { fill:#fff; }
      .sc-cal-toolbar .sc-icon-btn[aria-pressed="true"] .sc-label { color:#fff; }
    `;
      document.head.appendChild(s);
  }

    // --- Apply state only to calendar-injected items
    function applyStateToCalendarId(id, checked) {
        const settings = getSettings();
        document.querySelectorAll(`[data-sc-id="${id}"][data-sc-source="calendar"]`).forEach(el => {
            if (!(el instanceof HTMLElement)) return;
            if (checked) {
                if (settings.dim) el.classList.add('sc-checked-dim'); else el.classList.remove('sc-checked-dim');
                if (settings.hide) el.classList.add('sc-hidden-checked'); else el.classList.remove('sc-hidden-checked');
            } else {
                el.classList.remove('sc-checked-dim');
                el.classList.remove('sc-hidden-checked');
            }
            const cb = el.querySelector?.('.sc-cal-left-checkbox');
            if (cb) cb.checked = checked;
        });
    }

    function applyAllCalendarStates() {
        const states = getStates();
        Object.keys(states || {}).forEach(id => applyStateToCalendarId(id, true));
    }

    // --- Checkbox injection (calendar only)
    function injectLeftCheckboxForCalendar(node) {
        if (!node || !(node instanceof HTMLElement)) return;
        if (node.querySelector('.sc-cal-left-wrapper')) return;

        const id = computeCalendarStableId(node);
        if (!id) return;

        try { node.dataset.scId = id; node.dataset.scSource = 'calendar'; } catch {}

        const wrapper = document.createElement('span');
        wrapper.className = 'sc-cal-left-wrapper';
        wrapper.setAttribute('data-sc-left', '1');

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.className = 'sc-cal-left-checkbox';
        cb.dataset.scId = id;
        cb.title = 'Mark done (calendar-only)';

        const block = e => e.stopPropagation();
        cb.addEventListener('pointerdown', block, { passive: true });
        cb.addEventListener('touchstart', block, { passive: true });
        cb.addEventListener('mousedown', block, { passive: true });
        cb.addEventListener('click', e => e.stopPropagation(), true);

        cb.addEventListener('change', () => {
            const states = getStates();
            if (cb.checked) states[id] = Date.now(); else delete states[id];
            saveStates(states);
            applyStateToCalendarId(id, cb.checked);
        });

        wrapper.appendChild(cb);

        const titleEl = node.querySelector('.fc-event-title, .fc-title, .event-title, a') || node.firstChild;
        if (titleEl && titleEl.parentElement) titleEl.parentElement.insertBefore(wrapper, titleEl);
        else node.insertBefore(wrapper, node.firstChild);

        const checked = !!getStates()[id];
        cb.checked = checked;
        applyStateToCalendarId(id, checked);
    }

    // --- Scan function: calendar selectors only (no upcoming/home)
    function scanCalendarOnly() {
        const selectors = ['.fc-event', '.fc-daygrid-event', '.fc-list-item', '.fc-event-inner', '.fc-event-main-frame'];
        const nodes = new Set();
        selectors.forEach(sel => Array.from(document.querySelectorAll(sel)).forEach(n => nodes.add(n)));
        nodes.forEach(n => injectLeftCheckboxForCalendar(n));
        applyAllCalendarStates();
    }

    // --- Toolbar (calendar-only presence)
    function ensureToolbar() {
        const hasCalendar = !!(
            document.querySelector('.fc') ||
            document.querySelector('.fc-daygrid') ||
            document.querySelector('.fc-day-grid') ||
            document.querySelector('.fc-view') ||
            location.pathname.includes('/calendar')
        );
        if (!hasCalendar) return;
        if (document.querySelector('.sc-cal-toolbar')) return;

        const toolbar = document.createElement('div');
        toolbar.className = 'sc-cal-toolbar';

        const eyeOpen = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5c-7 0-11 6.5-11 7s4 7 11 7 11-6.5 11-7-4-7-11-7zm0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8z"/></svg>`;
        const eyeClosed = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.1 2.1L0.69 3.51l3.34 3.34C2.73 8.89 1.73 10.88 1 12c1.73 4.89 6 8 11 8 2.11 0 4.07-.52 5.8-1.44l3.4 3.4 1.41-1.41L2.1 2.1zM12 7a5 5 0 0 1 5 5c0 .73-.13 1.43-.36 2.06L9.06 6.36C10.2 6.13 11.09 6 12 6v1z"/></svg>`;
        const dimIcon = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v2a7 7 0 0 0 0 14v2a9 9 0 0 1 0-18zm-1 4v8a4 4 0 0 0 0-8z"/></svg>`;
        const clearIcon = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6zM19 4h-3.5l-1-1h-5l-1 1H5v2h14z"/></svg>`;

        function makeBtn(id, iconHtml, label, pressed) {
            const btn = document.createElement('button');
            btn.className = 'sc-icon-btn';
            btn.id = id;
            btn.setAttribute('aria-pressed', pressed ? 'true' : 'false');
            btn.innerHTML = iconHtml + `<span class="sc-label">${label}</span>`;
            return btn;
        }

        const s = getSettings();
        const btnHide = makeBtn('sc-hide', s.hide ? eyeClosed : eyeOpen, 'Hide', !!s.hide);
        const btnDim = makeBtn('sc-dim', dimIcon, 'Dim', !!s.dim);
        const btnClear= makeBtn('sc-clear',clearIcon,'Clear', false);

        toolbar.appendChild(btnHide);
        toolbar.appendChild(btnDim);
        toolbar.appendChild(btnClear);
        document.body.appendChild(toolbar);

        function updateHideBtn() {
            const ss = getSettings();
            btnHide.setAttribute('aria-pressed', ss.hide ? 'true' : 'false');
            btnHide.innerHTML = (ss.hide ? eyeClosed : eyeOpen) + `<span class="sc-label">Hide</span>`;
        }

        btnHide.addEventListener('click', () => {
            const ss = getSettings(); ss.hide = !ss.hide; saveSettings(ss);
            const states = getStates();
            Object.keys(states).forEach(id => applyStateToCalendarId(id, true));
            updateHideBtn();
        });

        btnDim.addEventListener('click', () => {
            const ss = getSettings(); ss.dim = !ss.dim; saveSettings(ss);
            const states = getStates();
            Object.keys(states).forEach(id => applyStateToCalendarId(id, true));
            btnDim.setAttribute('aria-pressed', ss.dim ? 'true' : 'false');
        });

        btnClear.addEventListener('click', () => {
            if (!confirm('Clear all saved calendar checkbox states?')) return;
            saveStates({});
            document.querySelectorAll('[data-sc-source="calendar"]').forEach(el => {
                el.classList.remove('sc-checked-dim', 'sc-hidden-checked');
                const cb = el.querySelector?.('.sc-cal-left-checkbox');
                if (cb) cb.checked = false;
            });
        });

        updateHideBtn();
    }

    // --- Boot and observers
    function init() {
        ensureStyles();
        ensureToolbar();
        scanCalendarOnly();

        const mo = new MutationObserver(muts => {
            if (muts.some(m => m.addedNodes && m.addedNodes.length)) scanCalendarOnly();
        });
        mo.observe(document.body, { childList: true, subtree: true });

        setInterval(scanCalendarOnly, POLL_MS);
        document.addEventListener('visibilitychange', () => { if (!document.hidden) scanCalendarOnly(); });
        window.addEventListener('focus', scanCalendarOnly);
    }

    if (document.readyState === 'complete' || document.readyState === 'interactive') init();
    else window.addEventListener('DOMContentLoaded', init);

})();
