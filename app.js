import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://hhyhulqngdkwsxhymmcd.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhoeWh1bHFuZ2Rrd3N4aHltbWNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxMzEyMDEsImV4cCI6MjA5MjcwNzIwMX0.dmSy7Q8Je5lEY4XCFzwvfPnkBYLebPE0yZMhy6Y8czI';
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

const fmt = (n) => n != null ? '$' + Number(n).toLocaleString() : '—';
const page = () => location.pathname.split('/').pop() || 'index.html';

// ── HELPERS ──────────────────────────────────────────────────
async function getCommunities() {
  const { data } = await db.from('civic_communities').select('*').order('name');
  return data || [];
}

function statusBadge(status) {
  return `<span class="status-badge status-${status}">${status.replace('_', ' ')}</span>`;
}

function emptyState(icon, title, msg) {
  return `<div class="empty-state"><div class="es-icon">${icon}</div><h3>${title}</h3><p>${msg}</p></div>`;
}

// ── HOME ─────────────────────────────────────────────────────
async function initHome() {
  const [communities, allocations, outcomes, evidence] = await Promise.all([
    db.from('civic_communities').select('id', { count: 'exact', head: true }),
    db.from('civic_allocations').select('id', { count: 'exact', head: true }),
    db.from('civic_outcomes').select('id', { count: 'exact', head: true }),
    db.from('civic_evidence').select('id', { count: 'exact', head: true }),
  ]);
  document.getElementById('statCommunities').textContent = communities.count ?? 0;
  document.getElementById('statAllocations').textContent = allocations.count ?? 0;
  document.getElementById('statOutcomes').textContent = outcomes.count ?? 0;
  document.getElementById('statEvidence').textContent = evidence.count ?? 0;
  await renderCommunityGrid('communityGrid');
}

// ── COMMUNITY GRID ───────────────────────────────────────────
async function renderCommunityGrid(containerId) {
  const grid = document.getElementById(containerId);
  if (!grid) return;
  const communities = await getCommunities();
  if (!communities.length) { grid.innerHTML = emptyState('🏙️', 'No communities yet', 'Communities will appear here as data is added.'); return; }
  grid.innerHTML = communities.map(c => `
    <div class="community-card">
      <h3>${c.name}</h3>
      <div class="cc-county">${c.county ? c.county + ' County · ' : ''}${c.state}</div>
      ${c.population ? `<div class="cc-pop">Population: ${c.population.toLocaleString()}</div>` : ''}
      <a class="cc-link" href="budget.html?community=${c.id}">View Budget →</a>
    </div>
  `).join('');
}

// ── BUDGET PAGE ──────────────────────────────────────────────
async function initBudget() {
  const communities = await getCommunities();
  const sel = document.getElementById('filterCommunity');
  if (sel) communities.forEach(c => { const o = document.createElement('option'); o.value = c.id; o.textContent = c.name; sel.appendChild(o); });

  const params = new URLSearchParams(location.search);
  if (params.get('community') && sel) sel.value = params.get('community');

  const loadBudget = async () => {
    let q = db.from('civic_budget_sources').select('*, civic_communities(name)').order('fiscal_year', { ascending: false });
    const comm = sel?.value; const year = document.getElementById('filterYear')?.value; const type = document.getElementById('filterType')?.value;
    if (comm) q = q.eq('community_id', comm);
    if (year) q = q.eq('fiscal_year', year);
    if (type) q = q.eq('source_type', type);
    const { data } = await q;
    const rows = data || [];

    // populate year filter
    const yearSel = document.getElementById('filterYear');
    if (yearSel && yearSel.options.length === 1) {
      [...new Set(rows.map(r => r.fiscal_year))].sort((a,b) => b-a).forEach(y => {
        const o = document.createElement('option'); o.value = y; o.textContent = y; yearSel.appendChild(o);
      });
    }

    const totalCollected = rows.reduce((s, r) => s + Number(r.amount_collected || 0), 0);
    const totalAllocated = rows.reduce((s, r) => s + Number(r.amount_allocated || 0), 0);
    const summary = document.getElementById('budgetSummary');
    if (summary) summary.innerHTML = `
      <div class="sum-item"><strong>${fmt(totalCollected)}</strong>Total Collected</div>
      <div class="sum-item"><strong>${fmt(totalAllocated)}</strong>Total Allocated</div>
      <div class="sum-item"><strong>${rows.length}</strong>Revenue Lines</div>
    `;

    const tbody = document.getElementById('budgetBody');
    if (!tbody) return;
    if (!rows.length) { tbody.innerHTML = `<tr><td colspan="7" class="loading">No data found. Add budget records to get started.</td></tr>`; return; }
    tbody.innerHTML = rows.map(r => `
      <tr>
        <td>${r.civic_communities?.name || '—'}</td>
        <td>${r.fiscal_year}</td>
        <td><span class="status-badge status-allocated">${r.source_type.replace(/_/g,' ')}</span></td>
        <td>${r.source_label}</td>
        <td>${fmt(r.amount_collected)}</td>
        <td>${fmt(r.amount_allocated)}</td>
        <td>${r.notes || '—'}</td>
      </tr>
    `).join('');
  };

  document.getElementById('filterCommunity')?.addEventListener('change', loadBudget);
  document.getElementById('filterYear')?.addEventListener('change', loadBudget);
  document.getElementById('filterType')?.addEventListener('change', loadBudget);
  await loadBudget();
}

// ── ALLOCATIONS PAGE ─────────────────────────────────────────
async function initAllocations() {
  const communities = await getCommunities();
  const sel = document.getElementById('filterCommunity');
  if (sel) communities.forEach(c => { const o = document.createElement('option'); o.value = c.id; o.textContent = c.name; sel.appendChild(o); });

  const load = async () => {
    let q = db.from('civic_allocations').select('*, civic_communities(name), civic_roles(role_title)').order('created_at', { ascending: false });
    const comm = sel?.value; const cat = document.getElementById('filterCategory')?.value; const status = document.getElementById('filterStatus')?.value;
    if (comm) q = q.eq('community_id', comm);
    if (cat) q = q.eq('category', cat);
    if (status) q = q.eq('status', status);
    const { data } = await q;
    const rows = data || [];
    const grid = document.getElementById('allocationsGrid');
    if (!grid) return;
    if (!rows.length) { grid.innerHTML = emptyState('🏗️', 'No allocations yet', 'Fund allocations will appear here once data is loaded.'); return; }
    grid.innerHTML = rows.map(r => {
      const pct = r.amount_allocated > 0 ? Math.min(100, Math.round(Number(r.amount_spent || 0) / Number(r.amount_allocated) * 100)) : 0;
      return `
        <div class="alloc-card">
          <div class="alloc-card-header">
            <h3>${r.project_label}</h3>
            ${statusBadge(r.status)}
          </div>
          <div class="alloc-meta">${r.civic_communities?.name || ''} · ${r.category.replace(/_/g,' ')} · FY${r.fiscal_year}</div>
          ${r.civic_roles ? `<div class="alloc-meta">🧑‍💼 ${r.civic_roles.role_title}</div>` : ''}
          <div class="alloc-amounts">
            <div class="alloc-amount"><div class="label">Allocated</div><div class="value">${fmt(r.amount_allocated)}</div></div>
            <div class="alloc-amount"><div class="label">Spent</div><div class="value">${fmt(r.amount_spent)}</div></div>
          </div>
          <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
          ${r.notes ? `<p style="font-size:.8rem;color:#64748b;margin-top:8px">${r.notes}</p>` : ''}
        </div>
      `;
    }).join('');
  };

  document.getElementById('filterCommunity')?.addEventListener('change', load);
  document.getElementById('filterCategory')?.addEventListener('change', load);
  document.getElementById('filterStatus')?.addEventListener('change', load);
  await load();
}

// ── OUTCOMES PAGE ────────────────────────────────────────────
async function initOutcomes() {
  const load = async () => {
    let q = db.from('civic_outcomes').select('*, civic_allocations(project_label, civic_communities(name))').order('reported_at', { ascending: false });
    const status = document.getElementById('filterStatus')?.value;
    if (status) q = q.eq('outcome_status', status);
    const { data } = await q;
    const rows = data || [];
    const list = document.getElementById('outcomesList');
    if (!list) return;
    if (!rows.length) { list.innerHTML = emptyState('📊', 'No outcomes yet', 'Outcomes will be recorded here as projects are completed and verified.'); return; }
    list.innerHTML = rows.map(r => `
      <div class="outcome-item">
        <div class="outcome-status-dot dot-${r.outcome_status}"></div>
        <div class="outcome-body">
          <h3>${r.outcome_label}</h3>
          <div class="outcome-meta">
            ${r.civic_allocations?.project_label ? `Project: ${r.civic_allocations.project_label}` : ''}
            ${r.civic_allocations?.civic_communities?.name ? ` · ${r.civic_allocations.civic_communities.name}` : ''}
            · ${r.outcome_status.charAt(0).toUpperCase() + r.outcome_status.slice(1)}
            · ${r.reported_at}
          </div>
          ${r.metric_name ? `<div class="outcome-metric">📐 ${r.metric_name}: <strong>${r.metric_value}${r.metric_unit ? ' ' + r.metric_unit : ''}</strong></div>` : ''}
          ${r.notes ? `<p style="font-size:.85rem;color:#64748b;margin-top:8px">${r.notes}</p>` : ''}
          ${r.evidence_url ? `<a href="${r.evidence_url}" target="_blank" class="ev-link">View Evidence →</a>` : ''}
        </div>
      </div>
    `).join('');
  };
  document.getElementById('filterStatus')?.addEventListener('change', load);
  await load();
}

// ── EVIDENCE WALL ────────────────────────────────────────────
async function initEvidence() {
  const load = async () => {
    let q = db.from('civic_evidence').select('*, civic_communities(name)').eq('status','approved').order('created_at', { ascending: false });
    const type = document.getElementById('filterType')?.value;
    if (type) q = q.eq('evidence_type', type);
    const { data } = await q;
    const rows = data || [];
    const grid = document.getElementById('evidenceGrid');
    if (!grid) return;
    if (!rows.length) { grid.innerHTML = emptyState('📷', 'No evidence yet', 'Be the first to document conditions in your community. Submit a report using the button above.'); return; }
    grid.innerHTML = rows.map(r => `
      <div class="evidence-card">
        <span class="evidence-type-tag">${r.evidence_type.replace('_',' ')}</span>
        <h3>${r.title}</h3>
        ${r.description ? `<p>${r.description}</p>` : ''}
        ${r.location_label ? `<div class="ev-meta">📍 ${r.location_label}</div>` : ''}
        <div class="ev-meta">Submitted by ${r.submitted_by || 'Anonymous'} · ${new Date(r.created_at).toLocaleDateString()}</div>
        ${r.url ? `<a href="${r.url}" target="_blank" class="ev-link">View Source →</a>` : ''}
      </div>
    `).join('');
  };
  document.getElementById('filterType')?.addEventListener('change', load);
  await load();
}

// ── SUBMIT FORM ──────────────────────────────────────────────
async function initSubmit() {
  const communities = await getCommunities();
  const sel = document.getElementById('communityId');
  if (sel) communities.forEach(c => { const o = document.createElement('option'); o.value = c.id; o.textContent = c.name; sel.appendChild(o); });

  document.getElementById('evidenceForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('submitBtn');
    btn.textContent = 'Submitting…';
    btn.disabled = true;
    const payload = {
      community_id: document.getElementById('communityId').value,
      evidence_type: document.getElementById('evidenceType').value,
      title: document.getElementById('evidenceTitle').value,
      description: document.getElementById('evidenceDesc').value || null,
      location_label: document.getElementById('locationLabel').value || null,
      url: document.getElementById('evidenceUrl').value || null,
      submitted_by: document.getElementById('submittedBy').value || null,
      status: 'pending',
    };
    const { error } = await db.from('civic_evidence').insert(payload);
    if (error) {
      alert('Something went wrong: ' + error.message);
      btn.textContent = 'Submit Report';
      btn.disabled = false;
    } else {
      document.getElementById('evidenceForm').classList.add('hidden');
      document.getElementById('formSuccess').classList.remove('hidden');
    }
  });
}

// ── ROUTER ───────────────────────────────────────────────────
const p = page();
if (p === 'index.html' || p === '') initHome();
else if (p === 'community.html') renderCommunityGrid('communityGrid');
else if (p === 'budget.html') initBudget();
else if (p === 'allocations.html') initAllocations();
else if (p === 'outcomes.html') initOutcomes();
else if (p === 'evidence.html') initEvidence();
else if (p === 'submit.html') initSubmit();
