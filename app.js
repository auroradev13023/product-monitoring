'use strict';

/* ══════════════════════════════════════════════════════
   INITIAL DATA
══════════════════════════════════════════════════════ */

const SEED_MONITORS = [
  {
    id: 'm1',
    name: 'Velocity Runner Aurora',
    url: 'https://kicks-example.myshopify.com/products/velocity-runner',
    platform: 'shopify',
    keywords: '+runner +aurora -kids',
    sizes: ['9', '9.5', '10', '10.5'],
    colors: ['Aurora Blue', 'White'],
    profileId: 'p1',
    interval: 30,
    status: 'monitoring',
    nextCheckIn: 22,
    totalChecks: 247,
    detections: 0,
  },
  {
    id: 'm2',
    name: 'Capsule Hoodie Drop',
    url: 'https://street-example.myshopify.com/products/capsule-hoodie',
    platform: 'shopify',
    keywords: '+capsule +hoodie -kids',
    sizes: ['M', 'L', 'XL'],
    colors: ['Black', 'Cream'],
    profileId: 'p1',
    interval: 45,
    status: 'monitoring',
    nextCheckIn: 38,
    totalChecks: 112,
    detections: 0,
  },
  {
    id: 'm3',
    name: 'Limited Artist Poster',
    url: 'https://art-example.com/shop/poster',
    platform: 'woocommerce',
    keywords: '+limited +poster',
    sizes: ['One Size'],
    colors: ['Any'],
    profileId: 'p2',
    interval: 60,
    status: 'paused',
    nextCheckIn: 60,
    totalChecks: 53,
    detections: 2,
  },
  {
    id: 'm4',
    name: 'QA Staging Monitor',
    url: 'https://staging-store.myshopify.com/products/test-release',
    platform: 'shopify',
    keywords: '+test +release',
    sizes: ['M'],
    colors: ['Any'],
    profileId: 'p2',
    interval: 120,
    status: 'paused',
    nextCheckIn: 120,
    totalChecks: 18,
    detections: 0,
  },
];

const SEED_PROFILES = [
  {
    id: 'p1',
    name: 'Main Buyer',
    firstName: 'Alex',
    lastName: 'Johnson',
    email: 'alex.johnson@example.com',
    phone: '+1 555 0100',
    address: { line1: '123 Main Street', city: 'New York', state: 'NY', zip: '10001', country: 'US' },
    sizes: { shoe: '9.5', shirt: 'M' },
    colors: ['Aurora Blue', 'Black'],
  },
  {
    id: 'p2',
    name: 'QA Test Profile',
    firstName: 'Test',
    lastName: 'User',
    email: 'qa@example.com',
    phone: '+1 555 0200',
    address: { line1: '456 Test Avenue', city: 'Brooklyn', state: 'NY', zip: '11201', country: 'US' },
    sizes: { shoe: '10', shirt: 'L' },
    colors: ['Any'],
  },
];

/* ══════════════════════════════════════════════════════
   STATE
══════════════════════════════════════════════════════ */

const S = {
  monitors: SEED_MONITORS.map(m => ({ ...m, sizes: [...m.sizes], colors: [...m.colors] })),
  profiles: SEED_PROFILES.map(p => ({ ...p, address: { ...p.address }, sizes: { ...p.sizes }, colors: [...p.colors] })),
  alerts: [
    { id: 'a0', level: 'success', title: 'Drop detected', message: 'Limited Artist Poster — 2 detections in prior session.', monitorId: 'm3', ts: Date.now() - 7200000 },
    { id: 'a1', level: 'info', title: 'Engine ready', message: 'DropGuard monitoring engine initialized in demo mode.', monitorId: null, ts: Date.now() - 120000 },
  ],
  logs: [
    { id: 'l0', level: 'info', title: 'Engine initialized', detail: 'Loaded 4 monitors and 2 profiles. Demo mode active.', ts: Date.now() - 120000 },
    { id: 'l1', level: 'info', title: 'Adapters loaded', detail: 'Shopify adapter: 3 monitors. WooCommerce adapter: 1 monitor.', ts: Date.now() - 119000 },
    { id: 'l2', level: 'warning', title: 'Proxy disabled', detail: 'No proxy configured. Using direct connection for demo.', ts: Date.now() - 118000 },
  ],
  channels: { inapp: true, discord: false, email: false, sms: false },
  settings: { discordWebhook: '', emailTo: '', smsTo: '', defaultInterval: 30, proxyEnabled: false, proxyList: '' },
  currentPage: 'dashboard',
  allPaused: false,
  engineTimer: null,
  logFilter: 'all',
  logSearch: '',
  wizard: { step: 0, monitorId: null, profileId: null },
  _modalSaveCallback: null,
  _scanStarted: false,
};

/* ══════════════════════════════════════════════════════
   UTILS
══════════════════════════════════════════════════════ */

let _uidSeq = 0;
const uid = () => `id${++_uidSeq}_${Math.random().toString(36).slice(2, 7)}`;

function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function fmtRelative(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function fmtCountdown(s) {
  if (s <= 0) return '00:00';
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function esc(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function statusLabel(status) {
  return { monitoring: '● Monitoring', live: '⚡ Live', paused: '⏸ Paused', error: '✕ Error' }[status] || status;
}

/* ══════════════════════════════════════════════════════
   ENGINE (SIMULATION)
══════════════════════════════════════════════════════ */

function startEngine() {
  if (S.engineTimer) clearInterval(S.engineTimer);
  S.engineTimer = setInterval(tick, 1000);
}

function tick() {
  if (S.allPaused) return;

  S.monitors.forEach(m => {
    if (m.status === 'paused') return;
    m.nextCheckIn = Math.max(0, m.nextCheckIn - 1);

    if (m.nextCheckIn === 0) {
      m.nextCheckIn = m.interval;
      m.totalChecks += 1;
      runCheck(m);
    }

    // Update countdown in-place if element exists
    const el = document.getElementById(`countdown-${m.id}`);
    if (el) el.textContent = fmtCountdown(m.nextCheckIn);
    const checksEl = document.getElementById(`checks-${m.id}`);
    if (checksEl) checksEl.textContent = m.totalChecks;
  });
}

function runCheck(monitor) {
  addLog('info', `Check: ${monitor.name}`, `Polling ${monitor.platform} product page for keyword match and variant availability.`);
  // ~6% random chance per check to simulate an eventual detection
  if (Math.random() < 0.06) triggerLive(monitor);
}

function triggerLive(monitor) {
  if (monitor.status === 'live') return; // already live
  monitor.status = 'live';
  monitor.detections += 1;

  const profile = S.profiles.find(p => p.id === monitor.profileId);
  const size = monitor.sizes[0] || 'N/A';
  const color = monitor.colors[0] || 'N/A';

  addAlert('success', 'Drop Detected!',
    `${monitor.name} · Size ${size} · ${color}${profile ? ' · Profile: ' + profile.name : ''}`,
    monitor.id);
  addLog('success', `Product live: ${monitor.name}`, `Keywords matched. Variant: ${size} / ${color}. Notification dispatched.`);

  if (S.channels.inapp) showToast(`⚡ LIVE: ${monitor.name} — ${size} / ${color}`, 'success');
  if (S.channels.discord) addLog('info', 'Discord alert sent', `Posted to webhook: ${monitor.name}`);
  if (S.channels.email) addLog('info', 'Email alert sent', `Sent to: ${S.settings.emailTo || '(not configured)'}`);

  updateBadges();

  // Refresh card status indicator in-place
  const card = document.getElementById(`card-${monitor.id}`);
  if (card) {
    card.className = `monitor-card live`;
    const badge = card.querySelector('.status-badge');
    if (badge) { badge.className = 'status-badge live'; badge.textContent = '⚡ Live'; }
    const toggleBtn = card.querySelector('[data-action="toggle-monitor"]');
    if (toggleBtn) toggleBtn.textContent = 'Pause';
  }

  if (S.currentPage === 'dashboard') renderPageContent();

  // Auto-reset after 30s so the demo keeps cycling
  setTimeout(() => {
    if (monitor.status === 'live') {
      monitor.status = 'monitoring';
      monitor.nextCheckIn = monitor.interval;
      if (S.currentPage === 'monitors' || S.currentPage === 'dashboard') renderPageContent();
    }
  }, 30000);
}

/* ══════════════════════════════════════════════════════
   ROUTER
══════════════════════════════════════════════════════ */

const PAGE_TITLES = {
  dashboard: 'Dashboard',
  monitors: 'Monitors',
  checkout: 'Checkout Assist',
  profiles: 'Profiles',
  alerts: 'Alerts',
  logs: 'Logs',
  settings: 'Settings',
};

function navigate(page) {
  S.currentPage = page;
  S._scanStarted = false;
  document.getElementById('page-title').textContent = PAGE_TITLES[page] || page;
  document.querySelectorAll('.nav-link').forEach(a => {
    a.classList.toggle('active', a.dataset.page === page);
  });
  renderPageContent();
}

function renderPageContent() {
  const el = document.getElementById('main-content');
  const renderers = {
    dashboard: renderDashboard,
    monitors: renderMonitors,
    checkout: renderCheckout,
    profiles: renderProfiles,
    alerts: renderAlerts,
    logs: renderLogs,
    settings: renderSettings,
  };
  el.innerHTML = (renderers[S.currentPage] || renderDashboard)();

  // Post-render hooks
  if (S.currentPage === 'checkout' && S.wizard.step === 1 && !S._scanStarted) {
    S._scanStarted = true;
    startScanAnimation();
  }
  if (S.currentPage === 'logs') {
    const searchEl = document.getElementById('log-search');
    if (searchEl) {
      searchEl.addEventListener('input', () => {
        S.logSearch = searchEl.value;
        clearTimeout(S._logSearchTimer);
        S._logSearchTimer = setTimeout(renderPageContent, 180);
      });
    }
  }
}

/* ══════════════════════════════════════════════════════
   PAGE: DASHBOARD
══════════════════════════════════════════════════════ */

function renderDashboard() {
  const active = S.monitors.filter(m => m.status !== 'paused').length;
  const totalDetections = S.monitors.reduce((a, m) => a + m.detections, 0);
  const liveMonitors = S.monitors.filter(m => m.status === 'live');
  const recentAlerts = [...S.alerts].sort((a, b) => b.ts - a.ts).slice(0, 5);
  const upcoming = S.monitors.filter(m => m.status !== 'paused').sort((a, b) => a.nextCheckIn - b.nextCheckIn).slice(0, 5);

  return `
    <div class="page-dashboard">
      <div class="metrics-row">
        <div class="metric-card">
          <span class="metric-label">Active Monitors</span>
          <strong class="metric-value">${active}</strong>
          <small>${S.monitors.filter(m => m.platform === 'shopify').length} Shopify · ${S.monitors.filter(m => m.platform === 'woocommerce').length} WooCommerce</small>
        </div>
        <div class="metric-card">
          <span class="metric-label">Avg Alert Latency</span>
          <strong class="metric-value">0.8s</strong>
          <small>In-app · Discord webhook</small>
        </div>
        <div class="metric-card">
          <span class="metric-label">Total Detections</span>
          <strong class="metric-value">${totalDetections}</strong>
          <small>${S.monitors.filter(m => m.detections > 0).length} monitor${S.monitors.filter(m => m.detections > 0).length !== 1 ? 's' : ''} with hits</small>
        </div>
        <div class="metric-card">
          <span class="metric-label">Compliance</span>
          <strong class="metric-value success-text">100%</strong>
          <small>No bypass features active</small>
        </div>
      </div>

      ${liveMonitors.length > 0 ? `
      <div class="live-banner">
        <span class="pulse-dot large"></span>
        <div>
          <strong>Live drop detected!</strong>
          <span>${liveMonitors.map(m => esc(m.name)).join(', ')} ${liveMonitors.length === 1 ? 'is' : 'are'} currently live.</span>
        </div>
        <button class="button primary small" data-action="goto-checkout">Open Checkout Assist</button>
      </div>` : ''}

      <div class="dashboard-grid">
        <div class="panel">
          <div class="panel-header">
            <div><p class="eyebrow">Notification history</p><h3>Recent Alerts</h3></div>
            <a class="text-link" data-page="alerts">View all →</a>
          </div>
          ${recentAlerts.length === 0 ? '<p class="muted-text">No alerts yet. Monitors are active.</p>' : `
          <div class="alert-list">
            ${recentAlerts.map(a => `
              <div class="alert-row level-${esc(a.level)}">
                <div class="alert-icon">${a.level === 'success' ? '✓' : a.level === 'warning' ? '⚠' : 'i'}</div>
                <div>
                  <strong>${esc(a.title)}</strong>
                  <p>${esc(a.message)}</p>
                </div>
                <span class="muted-text small">${fmtRelative(a.ts)}</span>
              </div>`).join('')}
          </div>`}
        </div>

        <div class="panel">
          <div class="panel-header">
            <div><p class="eyebrow">Check schedule</p><h3>Next Checks</h3></div>
            <a class="text-link" data-page="monitors">Manage →</a>
          </div>
          <div class="upcoming-list">
            ${upcoming.length === 0 ? '<p class="muted-text">No active monitors.</p>' : upcoming.map(m => `
              <div class="upcoming-row">
                <div>
                  <strong>${esc(m.name)}</strong>
                  <span class="muted-text small">${esc(m.platform)}</span>
                </div>
                <span class="status-badge ${esc(m.status)}" id="countdown-${esc(m.id)}">
                  ${m.status === 'live' ? '⚡ LIVE' : fmtCountdown(m.nextCheckIn)}
                </span>
              </div>`).join('')}
          </div>
        </div>
      </div>

      <div class="panel compliance-panel">
        <div class="panel-header">
          <div><p class="eyebrow">Safety & policy</p><h3>Active Compliance Guardrails</h3></div>
          <span class="pill success">Always enforced</span>
        </div>
        <div class="guardrail-grid">
          <div class="guardrail-item">✓ No CAPTCHA bypass</div>
          <div class="guardrail-item">✓ No waitroom / queue bypass</div>
          <div class="guardrail-item">✓ No protected data scraping</div>
          <div class="guardrail-item">✓ No payment automation</div>
          <div class="guardrail-item">✓ Public page access only</div>
          <div class="guardrail-item">✓ Per-site adapter policy rules</div>
        </div>
      </div>
    </div>`;
}

/* ══════════════════════════════════════════════════════
   PAGE: MONITORS
══════════════════════════════════════════════════════ */

function renderMonitors() {
  const live = S.monitors.filter(m => m.status === 'live').length;
  const active = S.monitors.filter(m => m.status === 'monitoring').length;

  return `
    <div class="page-section">
      <div class="section-toolbar">
        <span class="muted-text">${S.monitors.length} total · ${active} monitoring · ${live} live · ${S.monitors.filter(m => m.status === 'paused').length} paused</span>
        <button class="button primary small" data-action="add-monitor">+ Add Monitor</button>
      </div>
      <div class="monitor-list">
        ${S.monitors.length === 0
          ? '<p class="muted-text panel" style="padding:20px">No monitors yet. Click "Add Monitor" to create one.</p>'
          : S.monitors.map(renderMonitorCard).join('')}
      </div>
    </div>`;
}

function renderMonitorCard(m) {
  const profile = S.profiles.find(p => p.id === m.profileId);
  return `
    <div class="monitor-card ${esc(m.status)}" id="card-${esc(m.id)}">
      <div class="monitor-card-header">
        <div class="monitor-title-group">
          <span class="status-badge ${esc(m.status)}">${statusLabel(m.status)}</span>
          <strong>${esc(m.name)}</strong>
        </div>
        <div class="monitor-actions">
          <button class="button ghost small" data-action="edit-monitor" data-id="${esc(m.id)}">Edit</button>
          <button class="button ghost small" data-action="toggle-monitor" data-id="${esc(m.id)}">${m.status === 'paused' ? 'Resume' : 'Pause'}</button>
          <button class="button danger small" data-action="delete-monitor" data-id="${esc(m.id)}">✕</button>
        </div>
      </div>

      <div class="monitor-meta">
        <span class="pill neutral">${esc(m.platform)}</span>
        <span class="muted-text small">${esc(m.url)}</span>
      </div>

      <div class="monitor-details">
        <div><span class="detail-label">Keywords</span><code>${esc(m.keywords || '—')}</code></div>
        <div><span class="detail-label">Profile</span><span>${esc(profile ? profile.name : 'None')}</span></div>
        <div><span class="detail-label">Sizes</span><span>${m.sizes.map(s => `<span class="tag">${esc(s)}</span>`).join(' ') || '—'}</span></div>
        <div><span class="detail-label">Colors</span><span>${m.colors.map(c => `<span class="tag">${esc(c)}</span>`).join(' ') || '—'}</span></div>
      </div>

      <div class="monitor-footer">
        <div class="monitor-stat">
          <span>Next check</span>
          <strong id="countdown-${esc(m.id)}">${m.status === 'paused' ? '—' : fmtCountdown(m.nextCheckIn)}</strong>
        </div>
        <div class="monitor-stat">
          <span>Interval</span>
          <strong>${m.interval}s</strong>
        </div>
        <div class="monitor-stat">
          <span>Total checks</span>
          <strong id="checks-${esc(m.id)}">${m.totalChecks}</strong>
        </div>
        <div class="monitor-stat">
          <span>Detections</span>
          <strong class="${m.detections > 0 ? 'success-text' : ''}">${m.detections}</strong>
        </div>
      </div>
    </div>`;
}

/* ══════════════════════════════════════════════════════
   PAGE: CHECKOUT ASSIST (4-STEP WIZARD)
══════════════════════════════════════════════════════ */

function renderCheckout() {
  const step = S.wizard.step;
  if (step === 1) return renderWizardStep1();
  if (step === 2) return renderWizardStep2();
  if (step === 3) return renderWizardStep3();
  return renderWizardStep0();
}

function wizardStepsHTML(active) {
  const steps = ['Configure', 'Detect', 'Prefill', 'Handoff'];
  return `<div class="wizard-steps">
    ${steps.map((s, i) => {
      const cls = i < active ? 'done' : i === active ? 'active' : '';
      return `<div class="wizard-step ${cls}">${i < active ? '✓ ' : `${i + 1}. `}${s}</div>`;
    }).join('')}
  </div>`;
}

function renderWizardStep0() {
  return `
    <div class="wizard-container">
      ${wizardStepsHTML(0)}
      <div class="panel wizard-panel">
        <h3>Configure Checkout Assist</h3>
        <p class="muted-text" style="margin-bottom:20px">Select the product monitor task and buyer profile to use.</p>

        <div class="form-group">
          <label class="form-label">Monitor Task *</label>
          <select class="form-control" id="wizard-monitor">
            <option value="">— Select a monitor —</option>
            ${S.monitors.map(m => `<option value="${esc(m.id)}" ${m.id === S.wizard.monitorId ? 'selected' : ''}>${esc(m.name)} (${esc(m.platform)})</option>`).join('')}
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">Buyer Profile *</label>
          <select class="form-control" id="wizard-profile">
            <option value="">— Select a profile —</option>
            ${S.profiles.map(p => `<option value="${esc(p.id)}" ${p.id === S.wizard.profileId ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}
          </select>
        </div>

        <div class="compliance-note" style="margin-top:18px">
          <strong>⚠ Compliance reminder</strong>
          <p>This tool stops immediately if CAPTCHA, queue protection, or bot detection is encountered. Payment is always completed manually by you.</p>
        </div>

        <div class="form-actions">
          <button class="button primary" data-action="wizard-step0-next">Start Checkout Assist →</button>
        </div>
      </div>
    </div>`;
}

function renderWizardStep1() {
  const monitor = S.monitors.find(m => m.id === S.wizard.monitorId);
  return `
    <div class="wizard-container">
      ${wizardStepsHTML(1)}
      <div class="panel wizard-panel">
        <h3>Scanning Product Availability</h3>
        <p class="muted-text" style="margin-bottom:16px">
          Checking public product page for <strong>${esc(monitor?.name || 'selected product')}</strong>.
        </p>

        <div class="scan-animation"><div class="scan-bar" id="scan-bar"></div></div>

        <div class="scan-checks">
          <div class="scan-check pending" id="scan-c1">Connecting to product page…</div>
          <div class="scan-check pending" id="scan-c2">Matching keywords…</div>
          <div class="scan-check pending" id="scan-c3">Checking variant availability…</div>
          <div class="scan-check pending" id="scan-c4">Verifying policy compliance…</div>
        </div>

        <div id="scan-result" class="hidden"></div>

        <div class="form-actions">
          <button class="button ghost" data-action="wizard-back">← Back</button>
          <button class="button primary hidden" id="wizard-continue-btn" data-action="wizard-step1-next">Continue →</button>
        </div>
      </div>
    </div>`;
}

function renderWizardStep2() {
  const monitor = S.monitors.find(m => m.id === S.wizard.monitorId);
  const profile = S.profiles.find(p => p.id === S.wizard.profileId);
  const size = monitor?.sizes[0] || '—';
  const color = monitor?.colors[0] || '—';

  return `
    <div class="wizard-container">
      ${wizardStepsHTML(2)}
      <div class="panel wizard-panel">
        <h3>Prefilling Allowed Information</h3>
        <p class="muted-text" style="margin-bottom:4px">
          Permitted fields prefilled from profile <strong>${esc(profile?.name || '—')}</strong>. Payment is NOT automated.
        </p>

        <div class="prefill-grid">
          <div class="prefill-field filled">
            <span class="prefill-label">First Name</span>
            <span class="prefill-value">${esc(profile?.firstName || '—')}</span>
            <span class="prefill-status">✓ Prefilled</span>
          </div>
          <div class="prefill-field filled">
            <span class="prefill-label">Last Name</span>
            <span class="prefill-value">${esc(profile?.lastName || '—')}</span>
            <span class="prefill-status">✓ Prefilled</span>
          </div>
          <div class="prefill-field filled">
            <span class="prefill-label">Email</span>
            <span class="prefill-value">${esc(profile?.email || '—')}</span>
            <span class="prefill-status">✓ Prefilled</span>
          </div>
          <div class="prefill-field filled">
            <span class="prefill-label">Phone</span>
            <span class="prefill-value">${esc(profile?.phone || '—')}</span>
            <span class="prefill-status">✓ Prefilled</span>
          </div>
          <div class="prefill-field filled">
            <span class="prefill-label">Size</span>
            <span class="prefill-value">${esc(size)}</span>
            <span class="prefill-status">✓ Selected</span>
          </div>
          <div class="prefill-field filled">
            <span class="prefill-label">Color</span>
            <span class="prefill-value">${esc(color)}</span>
            <span class="prefill-status">✓ Selected</span>
          </div>
          <div class="prefill-field filled">
            <span class="prefill-label">Shipping Address</span>
            <span class="prefill-value">${esc(profile?.address?.line1 || '—')}, ${esc(profile?.address?.city || '')}</span>
            <span class="prefill-status">✓ Prefilled</span>
          </div>
          <div class="prefill-field blocked">
            <span class="prefill-label">Payment Info</span>
            <span class="prefill-value">— Not automated —</span>
            <span class="prefill-status">⚠ Manual entry required</span>
          </div>
          <div class="prefill-field blocked">
            <span class="prefill-label">CAPTCHA</span>
            <span class="prefill-value">— Never bypassed —</span>
            <span class="prefill-status">✕ Tool stops here</span>
          </div>
          <div class="prefill-field blocked">
            <span class="prefill-label">Queue / Waitroom</span>
            <span class="prefill-value">— Never bypassed —</span>
            <span class="prefill-status">✕ User waits normally</span>
          </div>
        </div>

        <div class="form-actions">
          <button class="button ghost" data-action="wizard-back">← Back</button>
          <button class="button primary" data-action="wizard-step2-next">Open Checkout Page →</button>
        </div>
      </div>
    </div>`;
}

function renderWizardStep3() {
  const monitor = S.monitors.find(m => m.id === S.wizard.monitorId);
  const profile = S.profiles.find(p => p.id === S.wizard.profileId);
  const size = monitor?.sizes[0] || 'N/A';
  const color = monitor?.colors[0] || 'N/A';

  return `
    <div class="wizard-container">
      ${wizardStepsHTML(3)}
      <div class="panel wizard-panel">
        <h3>✓ Checkout Page Ready for Review</h3>
        <p class="muted-text" style="margin-bottom:16px">Profile info has been prefilled. You must review and complete the purchase manually.</p>

        <div class="mock-checkout">
          <div class="mock-checkout-header">
            <span class="pill neutral">${esc(monitor?.platform || 'shop')} · Preview</span>
            <span class="muted-text small">${esc(monitor?.url || '')}</span>
          </div>
          <div class="mock-product-row">
            <div class="mock-product-img"></div>
            <div>
              <strong>${esc(monitor?.name || 'Product')}</strong>
              <p>Size: ${esc(size)} · Color: ${esc(color)}</p>
              <span class="pill success">In Stock</span>
            </div>
          </div>
          <div class="mock-form">
            <div class="mock-field"><span>Name</span><strong>${esc(profile?.firstName || '')} ${esc(profile?.lastName || '')}</strong></div>
            <div class="mock-field"><span>Email</span><strong>${esc(profile?.email || '')}</strong></div>
            <div class="mock-field"><span>Address</span><strong>${esc(profile?.address?.line1 || '')}, ${esc(profile?.address?.city || '')}, ${esc(profile?.address?.state || '')} ${esc(profile?.address?.zip || '')}</strong></div>
            <div class="mock-field blocked"><span>Payment</span><strong>⚠ Enter manually below</strong></div>
          </div>
        </div>

        <div class="compliance-note warning" style="margin-top:16px">
          <strong>Action required from you</strong>
          <ul>
            <li>Review the prefilled shipping details above.</li>
            <li>Enter your payment information manually on the real checkout page.</li>
            <li>Complete the purchase at your own discretion.</li>
            <li>This tool does NOT submit orders automatically.</li>
          </ul>
        </div>

        <div class="form-actions">
          <button class="button ghost" data-action="wizard-reset">✕ Cancel</button>
          <button class="button primary" data-action="wizard-complete">✓ Acknowledge & Complete Manually</button>
        </div>
      </div>
    </div>`;
}

/* ══════════════════════════════════════════════════════
   PAGE: PROFILES
══════════════════════════════════════════════════════ */

function renderProfiles() {
  return `
    <div class="page-section">
      <div class="section-toolbar">
        <span class="muted-text">${S.profiles.length} profile${S.profiles.length !== 1 ? 's' : ''}</span>
        <button class="button primary small" data-action="add-profile">+ Add Profile</button>
      </div>
      <div class="profile-grid">
        ${S.profiles.length === 0
          ? '<p class="muted-text panel" style="padding:20px">No profiles yet. Add one to use checkout assist.</p>'
          : S.profiles.map(renderProfileCard).join('')}
      </div>
    </div>`;
}

function renderProfileCard(p) {
  const usedBy = S.monitors.filter(m => m.profileId === p.id).length;
  return `
    <div class="panel profile-card-full">
      <div class="profile-card-header">
        <div class="profile-avatar">${esc((p.firstName[0] || '?').toUpperCase())}${esc((p.lastName[0] || '').toUpperCase())}</div>
        <div>
          <strong>${esc(p.name)}</strong>
          <p class="muted-text small">${esc(p.email)}</p>
        </div>
        <div class="monitor-actions">
          <button class="button ghost small" data-action="edit-profile" data-id="${esc(p.id)}">Edit</button>
          <button class="button danger small" data-action="delete-profile" data-id="${esc(p.id)}">✕</button>
        </div>
      </div>
      <div class="profile-details">
        <div><span class="detail-label">Full Name</span>${esc(p.firstName)} ${esc(p.lastName)}</div>
        <div><span class="detail-label">Phone</span>${esc(p.phone || '—')}</div>
        <div><span class="detail-label">Address</span>${esc(p.address.line1)}, ${esc(p.address.city)}, ${esc(p.address.state)} ${esc(p.address.zip)}</div>
        <div><span class="detail-label">Shoe Size</span>${esc(p.sizes.shoe || '—')} US</div>
        <div><span class="detail-label">Shirt Size</span>${esc(p.sizes.shirt || '—')}</div>
        <div><span class="detail-label">Preferred Colors</span>${p.colors.map(c => `<span class="tag">${esc(c)}</span>`).join(' ') || '—'}</div>
      </div>
      <div class="profile-footer">
        <span class="muted-text small">Used by ${usedBy} monitor${usedBy !== 1 ? 's' : ''}</span>
        <button class="button ghost small" data-action="use-profile-checkout" data-id="${esc(p.id)}">Use in Checkout Assist →</button>
      </div>
    </div>`;
}

/* ══════════════════════════════════════════════════════
   PAGE: ALERTS
══════════════════════════════════════════════════════ */

function renderAlerts() {
  const sorted = [...S.alerts].sort((a, b) => b.ts - a.ts);
  return `
    <div class="page-section">
      <div class="panel">
        <div class="panel-header">
          <div><p class="eyebrow">Notification channels</p><h3>Alert Configuration</h3></div>
        </div>
        <div class="channel-grid">
          <label class="channel-row ${S.channels.inapp ? 'active' : ''}">
            <input type="checkbox" ${S.channels.inapp ? 'checked' : ''} data-channel="inapp" />
            <div><strong>In-App Alerts</strong><span class="muted-text">Toast notifications in the dashboard</span></div>
            <span class="pill ${S.channels.inapp ? 'success' : 'neutral'}">${S.channels.inapp ? 'Active' : 'Off'}</span>
          </label>
          <label class="channel-row ${S.channels.discord ? 'active' : ''}">
            <input type="checkbox" ${S.channels.discord ? 'checked' : ''} data-channel="discord" />
            <div><strong>Discord Webhook</strong><span class="muted-text">Posts alert messages to a Discord channel</span></div>
            <span class="pill ${S.channels.discord ? 'success' : 'neutral'}">${S.channels.discord ? 'Active' : 'Off'}</span>
          </label>
          <label class="channel-row ${S.channels.email ? 'active' : ''}">
            <input type="checkbox" ${S.channels.email ? 'checked' : ''} data-channel="email" />
            <div><strong>Email Alerts</strong><span class="muted-text">Send detection emails to configured address</span></div>
            <span class="pill ${S.channels.email ? 'success' : 'neutral'}">${S.channels.email ? 'Active' : 'Off'}</span>
          </label>
          <label class="channel-row ${S.channels.sms ? 'active' : ''}">
            <input type="checkbox" ${S.channels.sms ? 'checked' : ''} data-channel="sms" />
            <div><strong>SMS Escalation</strong><span class="muted-text">Text message when other channels are unread</span></div>
            <span class="pill ${S.channels.sms ? 'success' : 'neutral'}">${S.channels.sms ? 'Active' : 'Off'}</span>
          </label>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <div><p class="eyebrow">History</p><h3>Alert Log (${S.alerts.length})</h3></div>
          <button class="button ghost small" data-action="clear-alerts">Clear</button>
        </div>
        ${sorted.length === 0 ? '<p class="muted-text">No alerts yet.</p>' : `
        <div class="alert-table">
          <div class="alert-table-header">
            <span>Level</span><span>Title</span><span>Message</span><span>Time</span>
          </div>
          ${sorted.map(a => `
            <div class="alert-table-row">
              <span class="alert-level-badge ${esc(a.level)}">${esc(a.level)}</span>
              <span><strong>${esc(a.title)}</strong></span>
              <span class="muted-text">${esc(a.message)}</span>
              <span class="muted-text small">${fmtTime(a.ts)}</span>
            </div>`).join('')}
        </div>`}
      </div>
    </div>`;
}

/* ══════════════════════════════════════════════════════
   PAGE: LOGS
══════════════════════════════════════════════════════ */

function renderLogs() {
  const levels = ['all', 'info', 'success', 'warning', 'error'];
  let filtered = [...S.logs].sort((a, b) => b.ts - a.ts);
  if (S.logFilter !== 'all') filtered = filtered.filter(l => l.level === S.logFilter);
  if (S.logSearch) {
    const q = S.logSearch.toLowerCase();
    filtered = filtered.filter(l => l.title.toLowerCase().includes(q) || l.detail.toLowerCase().includes(q));
  }

  return `
    <div class="page-section">
      <div class="log-toolbar">
        <div class="filter-tabs">
          ${levels.map(f => `<button class="filter-tab ${S.logFilter === f ? 'active' : ''}" data-log-filter="${f}">${f}</button>`).join('')}
        </div>
        <input class="form-control search-input" id="log-search" placeholder="Search logs…" value="${esc(S.logSearch)}" />
        <button class="button ghost small" data-action="export-logs">↓ Export JSON</button>
        <button class="button ghost small" data-action="clear-logs">Clear</button>
      </div>
      <div class="log-entries">
        ${filtered.length === 0 ? '<p class="muted-text" style="padding:16px">No entries match the current filter.</p>' :
          filtered.map(l => `
            <div class="log-entry">
              <span class="log-time">${fmtTime(l.ts)}</span>
              <span class="log-level ${esc(l.level)}">${esc(l.level)}</span>
              <div><strong>${esc(l.title)}</strong><p>${esc(l.detail)}</p></div>
            </div>`).join('')}
      </div>
    </div>`;
}

/* ══════════════════════════════════════════════════════
   PAGE: SETTINGS
══════════════════════════════════════════════════════ */

function renderSettings() {
  return `
    <div class="settings-page">
      <div class="panel">
        <div class="panel-header"><div><p class="eyebrow">Notification</p><h3>Alert Credentials</h3></div></div>
        <div class="settings-form">
          <div class="form-group">
            <label class="form-label">Discord Webhook URL</label>
            <input class="form-control" id="s-discord" placeholder="https://discord.com/api/webhooks/…" value="${esc(S.settings.discordWebhook)}" />
          </div>
          <div class="form-group">
            <label class="form-label">Alert Email Address</label>
            <input class="form-control" id="s-email" type="email" placeholder="alerts@example.com" value="${esc(S.settings.emailTo)}" />
          </div>
          <div class="form-group">
            <label class="form-label">SMS Phone Number</label>
            <input class="form-control" id="s-sms" placeholder="+1 555 0000" value="${esc(S.settings.smsTo)}" />
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header"><div><p class="eyebrow">Engine</p><h3>Monitoring Defaults</h3></div></div>
        <div class="settings-form">
          <div class="form-group">
            <label class="form-label">Default Check Interval (seconds)</label>
            <input class="form-control" id="s-interval" type="number" min="10" max="3600" value="${S.settings.defaultInterval}" />
            <span class="muted-text small">Minimum 10 seconds. Applies to new monitors.</span>
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header"><div><p class="eyebrow">Network</p><h3>Proxy Configuration</h3></div></div>
        <div class="settings-form">
          <label class="channel-row ${S.settings.proxyEnabled ? 'active' : ''}">
            <input type="checkbox" id="s-proxy-enabled" ${S.settings.proxyEnabled ? 'checked' : ''} />
            <div>
              <strong>Enable Proxy Rotation</strong>
              <span class="muted-text">Use proxies for product page checks (legitimate access only — no bypass)</span>
            </div>
          </label>
          <div class="form-group" style="margin-top:12px">
            <label class="form-label">Proxy List <span class="muted-text">(one per line: host:port or host:port:user:pass)</span></label>
            <textarea class="form-control" id="s-proxies" rows="5" placeholder="192.168.1.1:8080&#10;proxy.example.com:3128:user:pass">${esc(S.settings.proxyList)}</textarea>
          </div>
        </div>
      </div>

      <div class="form-actions">
        <button class="button primary" data-action="save-settings">Save Settings</button>
      </div>
    </div>`;
}

/* ══════════════════════════════════════════════════════
   MONITOR MODAL
══════════════════════════════════════════════════════ */

function openMonitorModal(id) {
  const m = id ? S.monitors.find(x => x.id === id) : null;
  openModal(
    m ? 'Edit Monitor' : 'Add Monitor',
    `<div class="form-group">
      <label class="form-label">Product Name *</label>
      <input class="form-control" id="mf-name" value="${esc(m?.name || '')}" placeholder="e.g. Velocity Runner Aurora" />
    </div>
    <div class="form-group">
      <label class="form-label">Product URL *</label>
      <input class="form-control" id="mf-url" value="${esc(m?.url || '')}" placeholder="https://shop.myshopify.com/products/…" />
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Platform</label>
        <select class="form-control" id="mf-platform">
          <option value="shopify" ${m?.platform === 'shopify' ? 'selected' : ''}>Shopify</option>
          <option value="woocommerce" ${m?.platform === 'woocommerce' ? 'selected' : ''}>WooCommerce</option>
          <option value="custom" ${m?.platform === 'custom' ? 'selected' : ''}>Custom</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Check Interval (sec)</label>
        <input class="form-control" id="mf-interval" type="number" min="10" max="3600" value="${m?.interval ?? S.settings.defaultInterval}" />
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Keywords <span class="muted-text">(+include, -exclude)</span></label>
      <input class="form-control" id="mf-keywords" value="${esc(m?.keywords || '')}" placeholder="+runner +aurora -kids" />
    </div>
    <div class="form-group">
      <label class="form-label">Sizes <span class="muted-text">(comma-separated)</span></label>
      <input class="form-control" id="mf-sizes" value="${esc((m?.sizes || []).join(', '))}" placeholder="9, 9.5, 10, 10.5" />
    </div>
    <div class="form-group">
      <label class="form-label">Colors <span class="muted-text">(comma-separated)</span></label>
      <input class="form-control" id="mf-colors" value="${esc((m?.colors || []).join(', '))}" placeholder="Aurora Blue, White" />
    </div>
    <div class="form-group">
      <label class="form-label">Buyer Profile</label>
      <select class="form-control" id="mf-profile">
        <option value="">— None —</option>
        ${S.profiles.map(p => `<option value="${esc(p.id)}" ${m?.profileId === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}
      </select>
    </div>`,
    () => saveMonitorFromModal(id),
    'Save Monitor',
  );
}

function saveMonitorFromModal(existingId) {
  const name = document.getElementById('mf-name')?.value.trim();
  const url = document.getElementById('mf-url')?.value.trim();
  if (!name || !url) { showToast('Name and URL are required.', 'error'); return false; }

  const data = {
    name, url,
    platform: document.getElementById('mf-platform').value,
    interval: Math.max(10, parseInt(document.getElementById('mf-interval').value) || 30),
    keywords: document.getElementById('mf-keywords').value.trim(),
    sizes: document.getElementById('mf-sizes').value.split(',').map(s => s.trim()).filter(Boolean),
    colors: document.getElementById('mf-colors').value.split(',').map(s => s.trim()).filter(Boolean),
    profileId: document.getElementById('mf-profile').value || null,
  };

  if (existingId) {
    Object.assign(S.monitors.find(x => x.id === existingId), data);
    addLog('info', `Monitor updated: ${data.name}`, `Interval: ${data.interval}s, Keywords: ${data.keywords}`);
    showToast(`Monitor "${data.name}" updated.`, 'success');
  } else {
    S.monitors.push({ ...data, id: uid(), status: 'monitoring', nextCheckIn: data.interval, totalChecks: 0, detections: 0 });
    addLog('info', `Monitor created: ${data.name}`, `Platform: ${data.platform}, Interval: ${data.interval}s`);
    showToast(`Monitor "${data.name}" added.`, 'success');
  }

  updateBadges();
  return true;
}

/* ══════════════════════════════════════════════════════
   PROFILE MODAL
══════════════════════════════════════════════════════ */

function openProfileModal(id) {
  const p = id ? S.profiles.find(x => x.id === id) : null;
  openModal(
    p ? 'Edit Profile' : 'Add Profile',
    `<div class="form-group">
      <label class="form-label">Profile Name *</label>
      <input class="form-control" id="pf-name" value="${esc(p?.name || '')}" placeholder="e.g. Main Buyer" />
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">First Name</label>
        <input class="form-control" id="pf-first" value="${esc(p?.firstName || '')}" />
      </div>
      <div class="form-group">
        <label class="form-label">Last Name</label>
        <input class="form-control" id="pf-last" value="${esc(p?.lastName || '')}" />
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Email</label>
        <input class="form-control" id="pf-email" type="email" value="${esc(p?.email || '')}" />
      </div>
      <div class="form-group">
        <label class="form-label">Phone</label>
        <input class="form-control" id="pf-phone" value="${esc(p?.phone || '')}" />
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Address Line 1</label>
      <input class="form-control" id="pf-addr1" value="${esc(p?.address?.line1 || '')}" />
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">City</label>
        <input class="form-control" id="pf-city" value="${esc(p?.address?.city || '')}" />
      </div>
      <div class="form-group">
        <label class="form-label">State</label>
        <input class="form-control" id="pf-state" value="${esc(p?.address?.state || '')}" />
      </div>
      <div class="form-group">
        <label class="form-label">ZIP</label>
        <input class="form-control" id="pf-zip" value="${esc(p?.address?.zip || '')}" />
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Shoe Size (US)</label>
        <input class="form-control" id="pf-shoe" value="${esc(p?.sizes?.shoe || '')}" placeholder="9.5" />
      </div>
      <div class="form-group">
        <label class="form-label">Shirt Size</label>
        <input class="form-control" id="pf-shirt" value="${esc(p?.sizes?.shirt || '')}" placeholder="M" />
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Preferred Colors <span class="muted-text">(comma-separated)</span></label>
      <input class="form-control" id="pf-colors" value="${esc((p?.colors || []).join(', '))}" placeholder="Aurora Blue, Black" />
    </div>`,
    () => saveProfileFromModal(id),
    'Save Profile',
  );
}

function saveProfileFromModal(existingId) {
  const name = document.getElementById('pf-name')?.value.trim();
  if (!name) { showToast('Profile name is required.', 'error'); return false; }

  const data = {
    name,
    firstName: document.getElementById('pf-first').value.trim(),
    lastName: document.getElementById('pf-last').value.trim(),
    email: document.getElementById('pf-email').value.trim(),
    phone: document.getElementById('pf-phone').value.trim(),
    address: {
      line1: document.getElementById('pf-addr1').value.trim(),
      city: document.getElementById('pf-city').value.trim(),
      state: document.getElementById('pf-state').value.trim(),
      zip: document.getElementById('pf-zip').value.trim(),
      country: 'US',
    },
    sizes: {
      shoe: document.getElementById('pf-shoe').value.trim(),
      shirt: document.getElementById('pf-shirt').value.trim(),
    },
    colors: document.getElementById('pf-colors').value.split(',').map(s => s.trim()).filter(Boolean),
  };

  if (existingId) {
    Object.assign(S.profiles.find(x => x.id === existingId), data);
    addLog('info', `Profile updated: ${data.name}`, `${data.firstName} ${data.lastName} · ${data.email}`);
    showToast(`Profile "${data.name}" updated.`, 'success');
  } else {
    S.profiles.push({ ...data, id: uid() });
    addLog('info', `Profile created: ${data.name}`, `${data.firstName} ${data.lastName} · ${data.email}`);
    showToast(`Profile "${data.name}" added.`, 'success');
  }
  return true;
}

/* ══════════════════════════════════════════════════════
   MODAL SYSTEM
══════════════════════════════════════════════════════ */

function openModal(title, bodyHTML, onSave, saveLabel = 'Save') {
  S._modalSaveCallback = onSave;
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = bodyHTML;
  document.getElementById('modal-save-btn').textContent = saveLabel;
  const overlay = document.getElementById('modal-overlay');
  overlay.classList.remove('hidden');
  requestAnimationFrame(() => overlay.classList.add('visible'));
  setTimeout(() => {
    const first = document.querySelector('#modal-body input:not([type="checkbox"]), #modal-body select');
    if (first) first.focus();
  }, 50);
}

function closeModal() {
  const overlay = document.getElementById('modal-overlay');
  overlay.classList.remove('visible');
  setTimeout(() => overlay.classList.add('hidden'), 220);
  S._modalSaveCallback = null;
}

/* ══════════════════════════════════════════════════════
   TOAST SYSTEM
══════════════════════════════════════════════════════ */

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = message;
  container.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 320);
  }, 4000);
}

/* ══════════════════════════════════════════════════════
   ALERTS & LOGS
══════════════════════════════════════════════════════ */

function addAlert(level, title, message, monitorId = null) {
  S.alerts.push({ id: uid(), level, title, message, monitorId, ts: Date.now() });
  updateBadges();
  if (S.currentPage === 'alerts') renderPageContent();
}

function addLog(level, title, detail) {
  S.logs.push({ id: uid(), level, title, detail, ts: Date.now() });
  if (S.currentPage === 'logs') renderPageContent();
}

function updateBadges() {
  const mb = document.getElementById('badge-monitors');
  const ab = document.getElementById('badge-alerts');
  if (mb) mb.textContent = S.monitors.filter(m => m.status !== 'paused').length;
  if (ab) ab.textContent = S.alerts.filter(a => a.level === 'success').length;
}

/* ══════════════════════════════════════════════════════
   WIZARD LOGIC
══════════════════════════════════════════════════════ */

function handleWizardStep0Next() {
  const mId = document.getElementById('wizard-monitor')?.value;
  const pId = document.getElementById('wizard-profile')?.value;
  if (!mId) { showToast('Please select a monitor task.', 'error'); return; }
  if (!pId) { showToast('Please select a buyer profile.', 'error'); return; }
  S.wizard.monitorId = mId;
  S.wizard.profileId = pId;
  S.wizard.step = 1;
  S._scanStarted = false;
  renderPageContent();
}

function startScanAnimation() {
  const checks = [
    { id: 'scan-c1', label: '✓ Connected to product page (public URL)' },
    { id: 'scan-c2', label: '✓ Keywords matched in product title and description' },
    { id: 'scan-c3', label: '✓ Preferred variant available: size and color in stock' },
    { id: 'scan-c4', label: '✓ Policy verified — no CAPTCHA or protected data required' },
  ];

  let i = 0;
  const interval = setInterval(() => {
    if (i >= checks.length) {
      clearInterval(interval);
      const scanBar = document.getElementById('scan-bar');
      if (scanBar) { scanBar.style.width = '100%'; scanBar.style.animation = 'none'; }
      const result = document.getElementById('scan-result');
      if (result) {
        result.classList.remove('hidden');
        const monitor = S.monitors.find(m => m.id === S.wizard.monitorId);
        result.innerHTML = `
          <div class="scan-success">
            <span class="scan-success-icon">⚡</span>
            <div>
              <strong>Product is LIVE!</strong>
              <p>${esc(monitor?.sizes[0] || 'Selected size')} / ${esc(monitor?.colors[0] || 'Selected color')} — In Stock and ready for checkout.</p>
            </div>
          </div>`;
        addLog('success', 'Product availability confirmed', `${esc(monitor?.name || 'Product')} live during checkout assist scan.`);
      }
      const continueBtn = document.getElementById('wizard-continue-btn');
      if (continueBtn) continueBtn.classList.remove('hidden');
      return;
    }
    const el = document.getElementById(checks[i].id);
    if (el) { el.textContent = checks[i].label; el.classList.replace('pending', 'done'); }
    i++;
  }, 700);
}

/* ══════════════════════════════════════════════════════
   MONITOR ACTIONS
══════════════════════════════════════════════════════ */

function toggleMonitor(id) {
  const m = S.monitors.find(x => x.id === id);
  if (!m || m.status === 'live') return;
  if (m.status === 'paused') {
    m.status = 'monitoring';
    m.nextCheckIn = m.interval;
    addLog('info', `Monitor resumed: ${m.name}`, 'Polling restarted by operator.');
  } else {
    m.status = 'paused';
    addLog('info', `Monitor paused: ${m.name}`, 'Polling stopped by operator.');
  }
  updateBadges();
  renderPageContent();
}

function deleteMonitor(id) {
  const m = S.monitors.find(x => x.id === id);
  if (!m || !confirm(`Delete monitor "${m.name}"?`)) return;
  S.monitors = S.monitors.filter(x => x.id !== id);
  addLog('warning', `Monitor deleted: ${m.name}`, 'Task removed from engine.');
  updateBadges();
  renderPageContent();
  showToast(`Monitor "${m.name}" deleted.`, 'info');
}

function deleteProfile(id) {
  const p = S.profiles.find(x => x.id === id);
  if (!p || !confirm(`Delete profile "${p.name}"?`)) return;
  S.profiles = S.profiles.filter(x => x.id !== id);
  addLog('warning', `Profile deleted: ${p.name}`, 'Profile removed.');
  renderPageContent();
  showToast(`Profile "${p.name}" deleted.`, 'info');
}

/* ══════════════════════════════════════════════════════
   SETTINGS
══════════════════════════════════════════════════════ */

function saveSettings() {
  S.settings.discordWebhook = document.getElementById('s-discord')?.value.trim() || '';
  S.settings.emailTo = document.getElementById('s-email')?.value.trim() || '';
  S.settings.smsTo = document.getElementById('s-sms')?.value.trim() || '';
  S.settings.defaultInterval = Math.max(10, parseInt(document.getElementById('s-interval')?.value) || 30);
  S.settings.proxyEnabled = document.getElementById('s-proxy-enabled')?.checked || false;
  S.settings.proxyList = document.getElementById('s-proxies')?.value || '';
  addLog('info', 'Settings saved', `Discord: ${S.settings.discordWebhook ? 'configured' : 'empty'} · Proxy: ${S.settings.proxyEnabled ? 'enabled' : 'disabled'} · Interval: ${S.settings.defaultInterval}s`);
  showToast('Settings saved.', 'success');
}

/* ══════════════════════════════════════════════════════
   EXPORT
══════════════════════════════════════════════════════ */

function exportLogs() {
  const blob = new Blob([JSON.stringify(S.logs, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: `dropguard-logs-${Date.now()}.json` });
  a.click();
  URL.revokeObjectURL(url);
  showToast('Logs exported as JSON.', 'success');
}

/* ══════════════════════════════════════════════════════
   GLOBAL EVENT DELEGATION
══════════════════════════════════════════════════════ */

function setupGlobalEvents() {
  // Sidebar navigation
  document.getElementById('sidebar-nav').addEventListener('click', e => {
    const link = e.target.closest('[data-page]');
    if (link) navigate(link.dataset.page);
  });

  // Mobile sidebar toggle
  document.getElementById('menu-toggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });

  // Pause all / resume all
  document.getElementById('btn-pause-all').addEventListener('click', () => {
    S.allPaused = !S.allPaused;
    const btn = document.getElementById('btn-pause-all');
    const dot = document.getElementById('engine-dot');
    const label = document.getElementById('engine-label');
    if (S.allPaused) {
      S.monitors.forEach(m => { if (m.status === 'monitoring') m.status = 'paused'; });
      btn.textContent = 'Resume All';
      dot?.classList.add('paused');
      if (label) label.textContent = 'Engine paused';
      addLog('warning', 'All monitors paused', 'Global pause applied by operator.');
    } else {
      S.monitors.forEach(m => { if (m.status === 'paused') { m.status = 'monitoring'; m.nextCheckIn = m.interval; } });
      btn.textContent = 'Pause All';
      dot?.classList.remove('paused');
      if (label) label.textContent = 'Engine running';
      addLog('info', 'All monitors resumed', 'Global pause lifted by operator.');
    }
    updateBadges();
    if (S.currentPage === 'monitors' || S.currentPage === 'dashboard') renderPageContent();
  });

  // Simulate drop
  document.getElementById('btn-simulate').addEventListener('click', () => {
    const active = S.monitors.find(m => m.status === 'monitoring');
    if (!active) { showToast('No active monitors to simulate a drop on.', 'error'); return; }
    triggerLive(active);
  });

  // Main content delegation (actions + page links + log filters + channel toggles)
  document.getElementById('main-content').addEventListener('click', handleContentClick);
  document.getElementById('main-content').addEventListener('change', handleContentChange);

  // Modal controls
  document.getElementById('modal-close-btn').addEventListener('click', closeModal);
  document.getElementById('modal-cancel-btn').addEventListener('click', closeModal);
  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('modal-overlay')) closeModal();
  });
  document.getElementById('modal-save-btn').addEventListener('click', () => {
    if (S._modalSaveCallback && S._modalSaveCallback() !== false) {
      closeModal();
      renderPageContent();
    }
  });

  // Keyboard: Escape closes modal
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
  });
}

function handleContentClick(e) {
  // Data-page links (e.g. "View all →")
  const pageLink = e.target.closest('[data-page]');
  if (pageLink && !e.target.closest('[data-action]')) {
    navigate(pageLink.dataset.page);
    return;
  }

  // Log filter tabs
  const filterTab = e.target.closest('[data-log-filter]');
  if (filterTab) {
    S.logFilter = filterTab.dataset.logFilter;
    renderPageContent();
    return;
  }

  // Action buttons
  const btn = e.target.closest('[data-action]');
  if (!btn) return;

  switch (btn.dataset.action) {
    case 'add-monitor':     openMonitorModal(); break;
    case 'edit-monitor':    openMonitorModal(btn.dataset.id); break;
    case 'toggle-monitor':  toggleMonitor(btn.dataset.id); break;
    case 'delete-monitor':  deleteMonitor(btn.dataset.id); break;
    case 'add-profile':     openProfileModal(); break;
    case 'edit-profile':    openProfileModal(btn.dataset.id); break;
    case 'delete-profile':  deleteProfile(btn.dataset.id); break;

    case 'use-profile-checkout':
      S.wizard = { step: 0, monitorId: null, profileId: btn.dataset.id };
      navigate('checkout');
      break;

    case 'goto-checkout':
      navigate('checkout');
      break;

    // Wizard
    case 'wizard-step0-next': handleWizardStep0Next(); break;
    case 'wizard-step1-next':
      S.wizard.step = 2;
      renderPageContent();
      break;
    case 'wizard-step2-next':
      S.wizard.step = 3;
      renderPageContent();
      break;
    case 'wizard-back':
      S.wizard.step = Math.max(0, S.wizard.step - 1);
      S._scanStarted = false;
      renderPageContent();
      break;
    case 'wizard-reset':
      S.wizard = { step: 0, monitorId: null, profileId: null };
      S._scanStarted = false;
      renderPageContent();
      break;
    case 'wizard-complete':
      addLog('success', 'Checkout handoff complete', 'User acknowledged manual payment requirement and proceeded independently.');
      showToast('Checkout assist complete. Purchase is in your hands — good luck!', 'success');
      S.wizard = { step: 0, monitorId: null, profileId: null };
      navigate('dashboard');
      break;

    // Alerts / Logs
    case 'clear-alerts':
      S.alerts = [];
      updateBadges();
      renderPageContent();
      break;
    case 'clear-logs':
      S.logs = [];
      renderPageContent();
      break;
    case 'export-logs': exportLogs(); break;

    // Settings
    case 'save-settings': saveSettings(); break;
  }
}

function handleContentChange(e) {
  // Alert channel toggles
  if (e.target.dataset.channel) {
    S.channels[e.target.dataset.channel] = e.target.checked;
    addLog('info', `Channel ${e.target.checked ? 'enabled' : 'disabled'}: ${e.target.dataset.channel}`, 'Alert channel configuration updated.');
    renderPageContent();
  }
}

/* ══════════════════════════════════════════════════════
   INIT
══════════════════════════════════════════════════════ */

function init() {
  setupGlobalEvents();
  navigate('dashboard');
  startEngine();
  updateBadges();
  addLog('info', 'Dashboard ready', 'DropGuard AIO Monitor prototype initialized.');
}

init();
