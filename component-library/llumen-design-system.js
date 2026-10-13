/**
 * Llumen design system — page behavior (theme, sidebar nav, copy, WCAG color scales).
 * Consumed by llumen-design-system_1.html.
 * Theme: sets <html data-theme="dark|light">; pair with semantic tokens in llumen-design-system.css.
 */
const THEME_KEY = 'llumen-theme';
function showTab(id, btn) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(el => {
    el.classList.remove('active');
    if (el.getAttribute('role') === 'tab') el.setAttribute('aria-selected', 'false');
  });
  document.getElementById(id).classList.add('active');
  btn.classList.add('active');
  if (btn.getAttribute('role') === 'tab') btn.setAttribute('aria-selected', 'true');
}
function initPlaygroundSubtabs() {
  const root = document.querySelector('.pg-playground-tabs');
  if (!root) return;
  root.addEventListener('click', function (e) {
    const tab = e.target.closest('[data-pg-tab]');
    if (!tab || !root.contains(tab)) return;
    const name = tab.getAttribute('data-pg-tab');
    if (!name) return;
    root.querySelectorAll('[data-pg-tab]').forEach(function (t) {
      const on = t === tab;
      t.classList.toggle('active', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    root.querySelectorAll('.pg-play-panel').forEach(function (panel) {
      const on = panel.id === 'pg-panel-' + name;
      panel.classList.toggle('active', on);
      if (on) panel.removeAttribute('hidden');
      else panel.setAttribute('hidden', '');
    });
  });
}

const PG_RADIUS_KEY = 'llumen-pg-ui-radius';
const PG_RADIUS_DEFAULT = 'xl';
const PG_RADIUS_IDS = ['none', 'xxs', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl', 'full'];

function initPlaygroundRadius() {
  const playground = document.getElementById('playground');
  const row = document.querySelector('.pg-radius-swatch-row');
  if (!playground || !row) return;

  function apply(token) {
    if (PG_RADIUS_IDS.indexOf(token) === -1) token = PG_RADIUS_DEFAULT;
    playground.style.setProperty('--lc-ui-radius', 'var(--radius-' + token + ')');
    row.querySelectorAll('[data-pg-radius]').forEach(function (btn) {
      const on = btn.getAttribute('data-pg-radius') === token;
      btn.classList.toggle('pg-radius-swatch--active', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      if (btn.getAttribute('role') === 'radio') btn.setAttribute('aria-checked', on ? 'true' : 'false');
    });
    try {
      sessionStorage.setItem(PG_RADIUS_KEY, token);
    } catch (e) {}
  }

  var initial = PG_RADIUS_DEFAULT;
  try {
    var s = sessionStorage.getItem(PG_RADIUS_KEY);
    if (s && PG_RADIUS_IDS.indexOf(s) !== -1) initial = s;
  } catch (e) {}

  row.addEventListener('click', function (e) {
    var b = e.target.closest('[data-pg-radius]');
    if (!b || !row.contains(b)) return;
    apply(b.getAttribute('data-pg-radius'));
  });

  apply(initial);
}

function initPlaygroundSurfaces() {
  const panel = document.getElementById('pg-panel-surfaces');
  if (!panel) return;

  const cardsGrid = document.getElementById('pg-surface-cards-grid');
  const cardsAdd = document.getElementById('pg-surface-cards-add');
  var cardIndex = 0;

  function cardMarkup(n) {
    return (
      '<div class="pg-surface-card">' +
      '<p class="pg-surface-card__title">Card ' +
      n +
      '</p>' +
      '<p class="pg-surface-card__body">Uses <span style="font-family:JetBrains Mono,monospace;">--lc-bg-card</span>, <span style="font-family:JetBrains Mono,monospace;">--lc-border-card</span>, <span style="font-family:JetBrains Mono,monospace;">--lc-shadow-card</span>.</p>' +
      '</div>'
    );
  }

  function appendCard() {
    if (!cardsGrid) return;
    cardIndex += 1;
    var wrap = document.createElement('div');
    wrap.innerHTML = cardMarkup(cardIndex);
    cardsGrid.appendChild(wrap.firstElementChild);
  }

  if (cardsGrid) {
    for (var i = 0; i < 4; i++) appendCard();
  }
  if (cardsAdd && cardsGrid) {
    cardsAdd.addEventListener('click', function () {
      appendCard();
    });
  }

  var modalOverlay = document.getElementById('pg-surface-modal-overlay');
  var modalOpen = document.getElementById('pg-surface-modal-open');
  var modalDismiss = document.getElementById('pg-surface-modal-dismiss');
  var modalBackdrop = document.getElementById('pg-surface-modal-backdrop');
  var modalDialog = modalOverlay ? modalOverlay.querySelector('.pg-surface-modal-overlay__dialog') : null;

  function openModal() {
    if (!modalOverlay) return;
    modalOverlay.removeAttribute('hidden');
    document.body.style.overflow = 'hidden';
    if (modalDialog && typeof modalDialog.focus === 'function') {
      try {
        modalDialog.focus();
      } catch (e) {}
    }
  }

  function closeModal() {
    if (!modalOverlay) return;
    modalOverlay.setAttribute('hidden', '');
    document.body.style.overflow = '';
    if (modalOpen && typeof modalOpen.focus === 'function') modalOpen.focus();
  }

  if (modalOpen) modalOpen.addEventListener('click', openModal);
  if (modalDismiss) modalDismiss.addEventListener('click', closeModal);
  if (modalBackdrop) modalBackdrop.addEventListener('click', closeModal);

  var ddField = document.getElementById('pg-surface-dropdown-field');
  var ddTrigger = document.getElementById('pg-surface-dropdown-trigger');
  var ddMenu = document.getElementById('pg-surface-dropdown-menu');
  var ddLabel = document.getElementById('pg-surface-dropdown-label');
  if (ddMenu && document.body) {
    document.body.appendChild(ddMenu);
  }

  function positionDropdownMenu() {
    if (!ddTrigger || !ddMenu || ddMenu.hasAttribute('hidden')) return;
    var r = ddTrigger.getBoundingClientRect();
    ddMenu.style.top = r.bottom + 6 + 'px';
    ddMenu.style.left = r.left + 'px';
    ddMenu.style.width = Math.max(r.width, 160) + 'px';
  }

  function onDdReposition() {
    positionDropdownMenu();
  }

  var ddRepositionBound = false;
  function bindDdReposition() {
    if (ddRepositionBound) return;
    ddRepositionBound = true;
    window.addEventListener('resize', onDdReposition);
    window.addEventListener('scroll', onDdReposition, true);
  }

  function unbindDdReposition() {
    if (!ddRepositionBound) return;
    ddRepositionBound = false;
    window.removeEventListener('resize', onDdReposition);
    window.removeEventListener('scroll', onDdReposition, true);
  }

  function closeDropdown() {
    if (!ddMenu || !ddTrigger) return;
    ddMenu.setAttribute('hidden', '');
    ddTrigger.setAttribute('aria-expanded', 'false');
    unbindDdReposition();
    ddMenu.style.top = '';
    ddMenu.style.left = '';
    ddMenu.style.width = '';
  }

  function toggleDropdown() {
    if (!ddMenu || !ddTrigger) return;
    var isHidden = ddMenu.hasAttribute('hidden');
    if (isHidden) {
      ddMenu.removeAttribute('hidden');
      ddTrigger.setAttribute('aria-expanded', 'true');
      positionDropdownMenu();
      bindDdReposition();
    } else {
      closeDropdown();
    }
  }

  if (ddTrigger && ddMenu) {
    ddTrigger.addEventListener('click', function (e) {
      e.stopPropagation();
      toggleDropdown();
    });
    ddMenu.addEventListener('click', function (e) {
      var opt = e.target.closest('[data-pg-dd-value]');
      if (!opt || !ddMenu.contains(opt)) return;
      if (ddLabel) ddLabel.textContent = opt.getAttribute('data-pg-dd-value') || opt.textContent;
      closeDropdown();
    });
  }

  var tipLayer = document.getElementById('pg-surface-tooltip-flyout');
  if (tipLayer && document.body) {
    document.body.appendChild(tipLayer);
  }
  var tipHideTimer = null;
  var tipClickOpen = false;
  var tipAnchorEl = null;

  function hideTooltip() {
    if (!tipLayer) return;
    tipLayer.setAttribute('hidden', '');
    tipLayer.classList.remove('pg-surface-tooltip-flyout--interactive');
    var tipInner = tipLayer.querySelector('.pg-surface-tooltip-flyout__inner');
    if (tipInner) tipInner.textContent = '';
    else tipLayer.textContent = '';
    tipClickOpen = false;
    tipAnchorEl = null;
  }

  function showTooltip(anchor, place, interactive) {
    if (!tipLayer || !anchor) return;
    tipAnchorEl = anchor;
    if (!interactive) tipClickOpen = false;
    var tipInner = tipLayer.querySelector('.pg-surface-tooltip-flyout__inner');
    if (tipInner) tipInner.textContent = 'Short contextual help';
    else tipLayer.textContent = 'Short contextual help';
    tipLayer.removeAttribute('hidden');
    tipLayer.classList.toggle('pg-surface-tooltip-flyout--interactive', !!interactive);
    tipLayer.style.visibility = 'hidden';
    tipLayer.style.top = '0';
    tipLayer.style.left = '0';
    var pad = 8;
    var r = anchor.getBoundingClientRect();
    var lw = tipLayer.offsetWidth;
    var lh = tipLayer.offsetHeight;
    var top;
    var left;
    if (place === 'top') {
      top = r.top - lh - pad;
      left = r.left + r.width / 2 - lw / 2;
    } else if (place === 'bottom') {
      top = r.bottom + pad;
      left = r.left + r.width / 2 - lw / 2;
    } else if (place === 'left') {
      top = r.top + r.height / 2 - lh / 2;
      left = r.left - lw - pad;
    } else {
      top = r.top + r.height / 2 - lh / 2;
      left = r.right + pad;
    }
    left = Math.max(pad, Math.min(left, window.innerWidth - lw - pad));
    top = Math.max(pad, Math.min(top, window.innerHeight - lh - pad));
    tipLayer.style.top = top + 'px';
    tipLayer.style.left = left + 'px';
    tipLayer.style.visibility = 'visible';
  }

  panel.querySelectorAll('.pg-surface-tip').forEach(function (btn) {
    var mode = btn.getAttribute('data-pg-tip-mode');
    var place = btn.getAttribute('data-pg-tip-place') || 'top';
    if (mode === 'hover') {
      btn.addEventListener('mouseenter', function () {
        if (tipHideTimer) clearTimeout(tipHideTimer);
        showTooltip(btn, place, false);
      });
      btn.addEventListener('mouseleave', function () {
        tipHideTimer = setTimeout(function () {
          if (!tipClickOpen) hideTooltip();
        }, 120);
      });
    } else if (mode === 'click') {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        if (tipClickOpen && tipAnchorEl === btn && tipLayer && !tipLayer.hasAttribute('hidden')) {
          hideTooltip();
          return;
        }
        tipClickOpen = true;
        showTooltip(btn, place, true);
      });
    }
  });

  document.addEventListener(
    'click',
    function (e) {
      if (
        ddField &&
        ddMenu &&
        !e.target.closest('#pg-surface-dropdown-field') &&
        !e.target.closest('#pg-surface-dropdown-menu')
      ) {
        closeDropdown();
      }
      if (tipClickOpen && tipLayer && !e.target.closest('.pg-surface-tip')) hideTooltip();
    },
    true
  );

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    closeModal();
    closeDropdown();
    hideTooltip();
  });
}
function setTheme(mode) {
  const root = document.documentElement;
  if (mode === 'light') {
    root.setAttribute('data-theme', 'light');
  } else {
    root.setAttribute('data-theme', 'dark');
  }
  try { localStorage.setItem(THEME_KEY, mode); } catch (e) {}
  const lightBtn = document.getElementById('theme-light');
  const darkBtn = document.getElementById('theme-dark');
  if (lightBtn && darkBtn) {
    const isLight = mode === 'light';
    lightBtn.setAttribute('aria-pressed', isLight ? 'true' : 'false');
    darkBtn.setAttribute('aria-pressed', isLight ? 'false' : 'true');
  }
}
function initTheme() {
  let mode = 'dark';
  try {
    const s = localStorage.getItem(THEME_KEY);
    if (s === 'light' || s === 'dark') mode = s;
  } catch (e) {}
  setTheme(mode);
}
function cp(hex) {
  navigator.clipboard.writeText(hex).catch(() => {});
  const t = document.getElementById('toast');
  t.textContent = hex + ' copied';
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 1400);
}
/** 1x1 canvas resolves any supported CSS <color> (e.g. color(srgb r g b), color-mix) to 8-bit sRGB. */
var __css2hexCanvas, __css2hexCtx;
function getCss2hexContext() {
  if (!__css2hexCtx) {
    __css2hexCanvas = document.createElement('canvas');
    __css2hexCanvas.width = 1;
    __css2hexCanvas.height = 1;
    __css2hexCtx = __css2hexCanvas.getContext('2d', { willReadFrequently: true });
  }
  return __css2hexCtx;
}
/**
 * @returns {{ r: number, g: number, b: number, a: number } | null}
 */
function cssColorToRgba8(css) {
  if (css == null) return null;
  const t = String(css).trim();
  if (!t || t === 'transparent') return null;
  if (t[0] === '#' && t.length === 7) {
    return {
      r: parseInt(t.slice(1, 3), 16),
      g: parseInt(t.slice(3, 5), 16),
      b: parseInt(t.slice(5, 7), 16),
      a: 1
    };
  }
  const srgbM = t.match(
    /color\(\s*srgb\s+([-\d.eE]+)\s+([-\d.eE]+)\s+([-\d.eE]+)(?:\s*\/\s*([-\d.eE]+%?))?\s*\)/i
  );
  if (srgbM) {
    const clip = (x) => Math.max(0, Math.min(255, Math.round(Number(x) * 255)));
    let a = 1;
    if (srgbM[4] != null && String(srgbM[4]).trim() !== '') {
      const av = String(srgbM[4]).trim();
      a = /%$/.test(av) ? Math.max(0, Math.min(1, parseFloat(av.replace(/%/g, ''), 10) / 100)) : Math.max(0, Math.min(1, Number(av)));
    }
    return { r: clip(srgbM[1]), g: clip(srgbM[2]), b: clip(srgbM[3]), a: a };
  }
  const mLegacy = t.match(
    /rgba?\(\s*([-\d.]+)[\s,]+([-\d.]+)[\s,]+([-\d.]+)(?:\s*\/\s*([-\d.]+%?)|\s*,\s*([-\d.]+%?))?\s*\)/i
  );
  if (mLegacy) {
    const r = Math.max(0, Math.min(255, Math.round(Number(mLegacy[1]))));
    const g = Math.max(0, Math.min(255, Math.round(Number(mLegacy[2]))));
    const b = Math.max(0, Math.min(255, Math.round(Number(mLegacy[3]))));
    let a = 1;
    const ap = mLegacy[4] != null && String(mLegacy[4]).trim() !== '' ? mLegacy[4] : mLegacy[5];
    if (ap != null && String(ap).trim() !== '') {
      const av = String(ap).trim();
      a = /%$/.test(av) ? Math.max(0, Math.min(1, parseFloat(av.replace(/%/g, ''), 10) / 100)) : Math.max(0, Math.min(1, Number(av)));
    }
    return { r, g, b, a: a };
  }
  const ctx = getCss2hexContext();
  if (!ctx) return null;
  try {
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = t;
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    if (d[3] === 0) return null;
    return { r: d[0], g: d[1], b: d[2], a: d[3] / 255 };
  } catch (e) {
    return null;
  }
}
/** Solid #rrggbb for contrast / copy: semi-transparent is composited over white (same as a white swatch backer). */
function rgbaToHex6ForUi(r, g, b, a) {
  const a1 = a == null ? 1 : a;
  const comp = (c) => {
    if (a1 >= 0.99) return Math.round(c);
    return Math.max(0, Math.min(255, Math.round(c * a1 + 255 * (1 - a1))));
  };
  const rr = comp(r),
    gg = comp(g),
    bb = comp(b);
  const toH = (x) => ('0' + Math.max(0, Math.min(255, x | 0)).toString(16)).slice(-2);
  return '#' + toH(rr) + toH(gg) + toH(bb);
}
function rgbStringToHex(css) {
  const o = cssColorToRgba8(css);
  if (!o) return null;
  return rgbaToHex6ForUi(o.r, o.g, o.b, o.a);
}
/** Display string for meta line; shows alpha when not opaque. */
function rgbaToCssDisplay(r, g, b, a) {
  if (a != null && a < 0.99) {
    return 'rgb(' + r + ' ' + g + ' ' + b + ' / ' + (Math.round(a * 1000) / 1000) + ')';
  }
  return 'rgb(' + r + ', ' + g + ', ' + b + ')';
}
function resolveVarToHex(varName) {
  const probe = document.createElement('div');
  const vn = varName.indexOf('var(') === 0 ? varName : 'var(' + varName + ')';
  probe.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;pointer-events:none;visibility:hidden;background:' + vn;
  document.body.appendChild(probe);
  const rgb = getComputedStyle(probe).backgroundColor;
  document.body.removeChild(probe);
  return rgbStringToHex(rgb);
}
function cpVar(varName) {
  const h = resolveVarToHex(varName);
  if (h) cp(h);
}

/* Color scales: derived from --color-*-NN in :root (see llumen-design-system.css), WCAG 2.1 on swatch */
function initColorScales() {
  const K = '#000000';
  const W = '#ffffff';
  const STEPS = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'];
  const CC_SCALES = [
    { title: 'Brand — Primary', base: 'color-primary' },
    { title: 'Semantic — Positive', base: 'color-positive' },
    { title: 'Semantic — Warning', base: 'color-warning' },
    { title: 'Semantic — Negative', base: 'color-negative' },
    { title: 'Gray — Neutral', base: 'color-neutral' },
    { title: 'Refracted — refract-01', base: 'color-refract-01' },
    { title: 'Refracted — refract-02', base: 'color-refract-02' },
    { title: 'Refracted — refract-03', base: 'color-refract-03' },
    { title: 'Refracted — refract-04', base: 'color-refract-04' },
    { title: 'Categorical — 01', base: 'color-categorical-01' },
    { title: 'Categorical — 02', base: 'color-categorical-02' },
    { title: 'Categorical — 03', base: 'color-categorical-03' },
    { title: 'Categorical — 04', base: 'color-categorical-04' },
    { title: 'Categorical — 05', base: 'color-categorical-05' },
    { title: 'Categorical — 06', base: 'color-categorical-06' },
    { title: 'Categorical — 07', base: 'color-categorical-07' },
    { title: 'Categorical — 08', base: 'color-categorical-08' },
  ];
  function hexToRgb(h) {
    if (!h || h[0] !== '#') return null;
    const s = h.slice(1);
    if (s.length === 3) {
      return { r: parseInt(s[0] + s[0], 16), g: parseInt(s[1] + s[1], 16), b: parseInt(s[2] + s[2], 16) };
    }
    if (s.length !== 6) return null;
    return { r: parseInt(s.slice(0, 2), 16), g: parseInt(s.slice(2, 4), 16), b: parseInt(s.slice(4, 6), 16) };
  }
  function lin(c) {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }
  function relLum(hex) {
    const o = hexToRgb(hex);
    if (!o) return 0;
    return 0.2126 * lin(o.r) + 0.7152 * lin(o.g) + 0.0722 * lin(o.b);
  }
  function contrastRatio(c1, c2) {
    const a = relLum(c1);
    const b = relLum(c2);
    const L1 = Math.max(a, b);
    const L2 = Math.min(a, b);
    return (L1 + 0.05) / (L2 + 0.05);
  }
  function labelNormal(r) {
    if (r >= 7) return 'AAA';
    if (r >= 4.5) return 'AA';
    return '—';
  }
  function labelLarge(r) {
    if (r >= 4.5) return 'AAA';
    if (r >= 3) return 'AA';
    return '—';
  }
  function hexToRgbStr(hex) {
    const o = hexToRgb(hex);
    return o ? 'rgb(' + o.r + ', ' + o.g + ', ' + o.b + ')' : '';
  }
  function applyCcRow(row) {
    const hex = row.getAttribute('data-hex');
    if (!hex) return;
    const cOnBlack = contrastRatio(K, hex);
    const cOnWhite = contrastRatio(W, hex);
    const bEl = row.querySelector('.cc-bcv');
    const wEl = row.querySelector('.cc-wcv');
    if (bEl) bEl.textContent = cOnBlack.toFixed(2);
    if (wEl) wEl.textContent = cOnWhite.toFixed(2);
    const bn = row.querySelector('.cc-bn');
    const bl = row.querySelector('.cc-bl');
    const wn = row.querySelector('.cc-wn');
    const wl = row.querySelector('.cc-wl');
    if (bn) bn.textContent = labelNormal(cOnBlack);
    if (bl) bl.textContent = labelLarge(cOnBlack);
    if (wn) wn.textContent = labelNormal(cOnWhite);
    if (wl) wl.textContent = labelLarge(cOnWhite);
    const rgb = row.querySelector('.cc-rgb');
    if (rgb) rgb.textContent = hexToRgbStr(hex);
  }
  function buildRow(varCssName, displayToken) {
    const row = document.createElement('div');
    row.className = 'cc-row';
    const sw = document.createElement('div');
    sw.className = 'cc-swatch';
    sw.style.background = 'var(' + varCssName + ')';
    const pb = document.createElement('div');
    pb.className = 'cc-pill cc-pill--b';
    pb.setAttribute('aria-label', 'Black text on this background: ratio and WCAG level (normal, large)');
    const ik = document.createElement('span');
    ik.className = 'cc-ico cc-ico--k';
    ik.setAttribute('aria-hidden', 'true');
    pb.appendChild(ik);
    const spanB = document.createElement('span');
    spanB.className = 'cc-bcv';
    spanB.appendChild(document.createTextNode('0'));
    pb.appendChild(spanB);
    pb.appendChild(Object.assign(document.createElement('span'), { className: 'cc-bn', textContent: '—' }));
    pb.appendChild(Object.assign(document.createElement('span'), { className: 'cc-bl', textContent: '—' }));
    const pw = document.createElement('div');
    pw.className = 'cc-pill cc-pill--w';
    pw.setAttribute('aria-label', 'White text on this background: ratio and WCAG level (normal, large)');
    const iw = document.createElement('span');
    iw.className = 'cc-ico cc-ico--w';
    iw.setAttribute('aria-hidden', 'true');
    pw.appendChild(iw);
    const spanW = document.createElement('span');
    spanW.className = 'cc-wcv';
    spanW.appendChild(document.createTextNode('0'));
    pw.appendChild(spanW);
    pw.appendChild(Object.assign(document.createElement('span'), { className: 'cc-wn', textContent: '—' }));
    pw.appendChild(Object.assign(document.createElement('span'), { className: 'cc-wl', textContent: '—' }));
    sw.appendChild(pb);
    sw.appendChild(pw);
    const meta = document.createElement('div');
    meta.className = 'cc-meta';
    const t = document.createElement('div');
    t.className = 'cc-tok';
    t.textContent = displayToken;
    const h = document.createElement('div');
    h.className = 'cc-hex';
    h.textContent = '…';
    const r = document.createElement('div');
    r.className = 'cc-rgb';
    r.textContent = '';
    meta.appendChild(t);
    meta.appendChild(h);
    meta.appendChild(r);
    row.appendChild(sw);
    row.appendChild(meta);
    function finalizeHex() {
      const raw = getComputedStyle(sw).backgroundColor;
      const o = typeof cssColorToRgba8 === 'function' ? cssColorToRgba8(raw) : null;
      if (o) {
        const hx = rgbaToHex6ForUi(o.r, o.g, o.b, o.a);
        row.setAttribute('data-hex', hx);
        h.textContent = hx;
        r.textContent =
          typeof rgbaToCssDisplay === 'function' ? rgbaToCssDisplay(o.r, o.g, o.b, o.a) : hexToRgbStr(hx);
        applyCcRow(row);
        row.setAttribute('title', 'Copy ' + hx);
        row.setAttribute('aria-label', 'Copy ' + displayToken + ' ' + hx);
        return;
      }
      h.textContent = raw && String(raw).length ? String(raw) : '—';
      r.textContent = '';
    }
    row.setAttribute('role', 'button');
    row.setAttribute('tabindex', '0');
    row.addEventListener('click', function (e) {
      e.preventDefault();
      const v = row.getAttribute('data-hex');
      if (v) cp(v);
    });
    row.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const v = row.getAttribute('data-hex');
        if (v) cp(v);
      }
    });
    requestAnimationFrame(function () { requestAnimationFrame(finalizeHex); });
    return row;
  }
  function renderCcScales() {
    const el = document.getElementById('cc-scales-root');
    if (!el) return;
    el.textContent = '';
    CC_SCALES.forEach(function (scale) {
      const stepList = scale.steps || STEPS;
      const card = document.createElement('div');
      card.className = 'cc-scale card';
      const h2 = document.createElement('h2');
      h2.className = 'cc-h';
      h2.textContent = scale.title;
      card.appendChild(h2);
      const list = document.createElement('div');
      list.className = 'cc-list';
      stepList.forEach(function (step) {
        const name = scale.base + '-' + step;
        const v = '--' + name;
        list.appendChild(buildRow(v, name));
      });
      card.appendChild(list);
      el.appendChild(card);
    });
  }
  renderCcScales();
}

function initLlumenDoc() {
  initTheme();
  initPlaygroundSubtabs();
  initPlaygroundRadius();
  initPlaygroundSurfaces();
  initColorScales();
  const sidebarNav = document.querySelector('.sidebar-nav');
  if (sidebarNav) {
    sidebarNav.addEventListener('click', function (e) {
      const b = e.target.closest('.tab-btn');
      if (!b || !b.getAttribute('data-tab')) return;
      showTab(b.getAttribute('data-tab'), b);
    });
  }
  const light = document.getElementById('theme-light');
  const dark = document.getElementById('theme-dark');
  if (light) {
    light.addEventListener('click', function () {
      setTheme('light');
    });
  }
  if (dark) {
    dark.addEventListener('click', function () {
      setTheme('dark');
    });
  }
  document.body.addEventListener('click', function (e) {
    const el = e.target.closest('[data-cp]');
    if (!el) return;
    const n = el.getAttribute('data-cp');
    if (n) {
      e.preventDefault();
      cpVar(n);
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initLlumenDoc);
} else {
  initLlumenDoc();
}
