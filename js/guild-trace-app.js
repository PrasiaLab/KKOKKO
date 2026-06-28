const GUILD_TRACE_DATA_BASE = '../data/guild-trace';

const state = {
  snapshots: [],
  matches: [],
  beforePayload: null,
  afterPayload: null,
  siteConfig: null,
};

const $ = (id) => document.getElementById(id);

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[ch]));
}

async function fetchJson(path) {
  const res = await fetch(`${path}?v=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`${path} 로드 실패 (${res.status})`);
  return res.json();
}


function formatTraceTitle(config) {
  const title = config?.trace_title || config?.menu_label || '결사 이전 분석';
  const season = String(config?.trace_season || '').trim();

  return season ? `${title} (${season})` : title;
}

function applyTraceTitle(config) {
  const title = formatTraceTitle(config);
  document.title = title;

  const pageTitle = $('tracePageTitle');
  const closedTitle = $('traceClosedTitle');

  if (pageTitle) pageTitle.textContent = title;
  if (closedTitle) closedTitle.textContent = title;
}

async function loadFirestoreSiteConfig() {
  try {
    if (!window.guildTraceFirestoreConfigPromise) {
      return null;
    }

    return await window.guildTraceFirestoreConfigPromise;
  } catch (error) {
    console.warn('Firestore 설정 로드 오류', error);
    return null;
  }
}

async function loadSiteConfig() {
  let fileConfig = {};

  try {
    fileConfig = await fetchJson(`${GUILD_TRACE_DATA_BASE}/site_config.json`);
  } catch (err) {
    fileConfig = {};
  }

  const firestoreConfig = await loadFirestoreSiteConfig();
  state.siteConfig = {
    trace_enabled: true,
    trace_title: '결사 이전 분석',
    trace_season: '',
    trace_closed_message: '결사 이전 분석 페이지는 서버 이전 기간에만 운영됩니다.',
    default_before_snapshot: '2026-06-25_1150',
    default_after_snapshot: 'latest',
    ...fileConfig,
    ...(firestoreConfig || {}),
  };

  applyTraceTitle(state.siteConfig);

  const enabled = state.siteConfig?.trace_enabled !== false;
  const closedPanel = $('traceClosedPanel');
  const content = $('traceContent');

  if (!enabled) {
    if (closedPanel) {
      closedPanel.hidden = false;
      closedPanel.querySelector('.closed-message').textContent =
        state.siteConfig?.trace_closed_message ||
        state.siteConfig?.trace_message ||
        '결사 이전 분석 페이지는 서버 이전 기간에만 운영됩니다.';
    }

    if (content) content.hidden = true;

    return false;
  }

  if (closedPanel) closedPanel.hidden = true;
  if (content) content.hidden = false;

  return true;
}

function normalizeSnapshotPath(snap) {
  if (snap.path) {
    const p = String(snap.path);
    if (p.startsWith('http://') || p.startsWith('https://') || p.startsWith('../')) return p;
    return `../${p.replace(/^\.\//, '')}`;
  }
  return `${GUILD_TRACE_DATA_BASE}/snapshots/${snap.id}/guilds.json`;
}

async function loadSnapshotIndex() {
  const enabled = await loadSiteConfig();
  if (!enabled) return;

  let payload;
  try {
    payload = await fetchJson(`${GUILD_TRACE_DATA_BASE}/snapshots_index.json`);
  } catch (err) {
    try {
      payload = await fetchJson(`${GUILD_TRACE_DATA_BASE}/snapshots/manifest.json`);
    } catch (err2) {
      payload = { snapshots: [] };
    }
  }
  const snapshots = Array.isArray(payload.snapshots) ? payload.snapshots : [];
  state.snapshots = snapshots
    .filter(s => s && s.id)
    .map(s => ({
      id: s.id,
      label: s.label || PrasiaCompare.formatSnapshotId(s.id),
      created_at: s.created_at || s.label || '',
      path: normalizeSnapshotPath(s),
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
  renderSnapshotOptions();
}

function renderSnapshotOptions() {
  $('snapshotCount').textContent = state.snapshots.length.toLocaleString('ko-KR');
  const before = $('beforeSelect');
  const after = $('afterSelect');
  before.innerHTML = '';
  after.innerHTML = '';
  if (!state.snapshots.length) {
    before.innerHTML = '<option value="">저장된 스냅샷 없음</option>';
    after.innerHTML = '<option value="">저장된 스냅샷 없음</option>';
    setSummary(null, null, '-', '스냅샷 없음');
    setEmpty('저장된 스냅샷이 없습니다. 먼저 Actions에서 스냅샷을 생성해주세요.');
    closeModal();
    return;
  }
  for (const snap of state.snapshots) {
    const label = snap.label;
    const opt1 = new Option(label, snap.id);
    const opt2 = new Option(label, snap.id);
    before.add(opt1);
    after.add(opt2);
  }
  const beforeDefault = state.siteConfig?.default_before_snapshot;
  const afterDefault = state.siteConfig?.default_after_snapshot;
  const beforeIndex = beforeDefault ? state.snapshots.findIndex(s => s.id === beforeDefault) : -1;
  const afterIndex = afterDefault && afterDefault !== 'latest' ? state.snapshots.findIndex(s => s.id === afterDefault) : -1;
  before.selectedIndex = beforeIndex >= 0 ? beforeIndex : Math.max(0, state.snapshots.length - 2);
  after.selectedIndex = afterIndex >= 0 ? afterIndex : Math.max(0, state.snapshots.length - 1);
}

function selectedSnapshot(selectId) {
  const id = $(selectId).value;
  return state.snapshots.find(s => s.id === id);
}

async function compareSelected() {
  const beforeSnap = selectedSnapshot('beforeSelect');
  const afterSnap = selectedSnapshot('afterSelect');
  if (!beforeSnap || !afterSnap) return setEmpty('비교할 스냅샷을 선택해주세요.');
  if (beforeSnap.id === afterSnap.id) return setEmpty('서로 다른 이전/이후 스냅샷을 선택해주세요.');

  setSummary(beforeSnap, afterSnap, '-', '불러오는 중');
  setEmpty('선택한 스냅샷을 불러오는 중입니다.');
  try {
    const [beforePayload, afterPayload] = await Promise.all([fetchJson(beforeSnap.path), fetchJson(afterSnap.path)]);
    state.beforePayload = beforePayload;
    state.afterPayload = afterPayload;
    const result = PrasiaCompare.buildMatches(beforePayload, afterPayload, {
      beforeLimit: Number($('beforeLimitSelect').value),
      afterLimit: Number($('afterLimitSelect').value),
    });
    state.matches = result.matches;
    setSummary(beforeSnap, afterSnap, `${result.comparedBefore.toLocaleString('ko-KR')} × ${result.comparedAfter.toLocaleString('ko-KR')} · 내부 기준 비교`, '완료');
    updateServerFilter(result.matches);
    renderResults();
  } catch (err) {
    console.error(err);
    setSummary(beforeSnap, afterSnap, '-', '실패');
    setEmpty(`데이터 로드 실패: ${escapeHtml(err.message)}`);
  }
}

function setSummary(beforeSnap, afterSnap, target, status) {
  const cells = $('compareSummary').querySelectorAll('strong');
  cells[0].textContent = beforeSnap ? beforeSnap.label : '-';
  cells[1].textContent = afterSnap ? afterSnap.label : '-';
  cells[2].textContent = target;
  cells[3].textContent = status;
}

function setEmpty(message) {
  $('resultBody').innerHTML = `<tr><td colspan="9" class="empty">${message}</td></tr>`;
  setNotice('');
}

function sameServer(m) {
  return String(m.before.serverName || '') === String(m.after.serverName || '');
}

function sameGuildIdentity(m) {
  return sameServer(m)
    && String(m.before.guild_name || '') === String(m.after.guild_name || '')
    && String(m.before.guild_master || '') === String(m.after.guild_master || '');
}

function serverMoveHtml(m) {
  const before = escapeHtml(m.before.serverName || '-');
  const after = escapeHtml(m.after.serverName || '-');
  if (sameServer(m)) return `<span class="server-same">${before}</span>`;
  return `<span class="server-move"><span>${before}</span><b>→</b><span>${after}</span></span>`;
}

function displayJudgement(m) {
  if (sameGuildIdentity(m)) return { key: 'no-change', text: '변동없음' };
  if (sameServer(m)) return { key: 'same-server', text: '동일 서버' };
  return m.judgement;
}

function traceLabelText(guild) {
  const raw = String(guild?.trace_label || guild?.match_rule || '').trim();
  const rule = String(guild?.match_rule || '').trim();
  if (rule === '92plus' || raw === '92+' || raw === '92plus') return 'A조건';
  if (rule === '92plus_with_91_support' || raw === '92+·91 보조' || raw === '92+91' || raw.includes('91 보조')) return 'A+B조건';
  if (rule === 'top3_existing_levels' || raw.startsWith('상위')) return 'B조건';
  return '내부기준';
}

function updateServerFilter(matches) {
  const select = $('serverFilter');
  if (!select) return;
  const current = select.value || 'all';
  const map = new Map();
  for (const m of matches || []) {
    if (sameServer(m)) continue;
    const name = m.after.serverName || '-';
    const code = m.after.server || name;
    const key = `${name}||${code}`;
    map.set(key, { name, code, count: (map.get(key)?.count || 0) + 1 });
  }
  const rows = Array.from(map.values()).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ko', { numeric: true }));
  select.innerHTML = '<option value="all">전체 서버</option>' + rows.map(r => `<option value="${escapeHtml(r.name)}">${escapeHtml(r.name)} (${r.count})</option>`).join('');
  if ([...select.options].some(opt => opt.value === current)) select.value = current;
}

function setNotice(message) {
  const notice = $('resultNotice');
  if (!notice) return;
  if (!message) {
    notice.hidden = true;
    notice.innerHTML = '';
    return;
  }
  notice.hidden = false;
  notice.innerHTML = message;
}

function renderConcentrationNotice(rows) {
  if (!rows.length) return setNotice('');
  const counts = new Map();
  for (const m of rows) {
    const key = `${m.after.serverName}|${m.after.guild_name}|${m.after.guild_master}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  let maxCount = 0;
  let maxMatch = null;
  for (const m of rows) {
    const key = `${m.after.serverName}|${m.after.guild_name}|${m.after.guild_master}`;
    const count = counts.get(key) || 0;
    if (count > maxCount) {
      maxCount = count;
      maxMatch = m;
    }
  }
  const lowCount = rows.filter(m => m.total < 55).length;
  if (maxCount >= 5 || lowCount >= Math.ceil(rows.length * 0.45)) {
    const target = maxMatch ? `${escapeHtml(maxMatch.after.serverName)} / ${escapeHtml(maxMatch.after.guild_name)} / ${escapeHtml(maxMatch.after.guild_master)}` : '특정 이후 결사';
    setNotice(`
      <strong>해석 주의</strong>
      <span>현재 결과는 <b>내부 기준 기반의 참고 후보</b>로 정리되어 있어요. 낮은 점수 후보가 많다면 서버 이전이 아직 완료되지 않았거나 이후 후보 범위가 좁을 때 생길 수 있으므로, <b>낮음/동일 서버 후보는 참고용</b>으로 봐주세요.</span>
    `);
  } else {
    setNotice('');
  }
}

function filterMatches() {
  const q = $('searchInput').value.trim().toLowerCase();
  const move = $('moveFilter')?.value || 'all';
  const grade = $('gradeFilter').value;
  const server = $('serverFilter')?.value || 'all';
  return state.matches.filter(m => {
    const hay = [m.before.guild_name, m.before.guild_master, m.before.serverName, m.after.guild_name, m.after.guild_master, m.after.serverName].join(' ').toLowerCase();
    if (q && !hay.includes(q)) return false;
    if (move === 'moved' && sameServer(m)) return false;
    if (move === 'same' && !sameServer(m)) return false;
    if (move === 'noChange' && !sameGuildIdentity(m)) return false;
    if (server !== 'all' && (sameServer(m) || String(m.after.serverName || '') !== server)) return false;
    if (grade === 'veryHigh') return m.total >= 85;
    if (grade === 'high') return m.total >= 70;
    if (grade === 'possible') return m.total >= 55;
    if (grade === 'lowOnly') return m.total < 55;
    return true;
  });
}

function renderResults() {
  const rows = filterMatches();
  if (!rows.length) return setEmpty('조건에 맞는 후보가 없습니다.');
  renderConcentrationNotice(rows);
  $('resultBody').innerHTML = rows.map((m) => {
    const judgement = displayJudgement(m);
    return `
      <tr class="${sameServer(m) ? 'same-server-row' : 'moved-server-row'}">
        <td>${m.before.guild_rank}</td>
        <td class="guild-name">${escapeHtml(m.before.guild_name)}</td>
        <td>${escapeHtml(m.before.guild_master)}</td>
        <td class="server-name">${serverMoveHtml(m)}</td>
        <td class="guild-name">${escapeHtml(m.after.guild_name)}</td>
        <td>${escapeHtml(m.after.guild_master)}</td>
        <td class="score">${m.total.toFixed(1)}점</td>
        <td><span class="badge ${judgement.key}">${judgement.text}</span></td>
        <td><button class="view-btn" type="button" data-index="${state.matches.indexOf(m)}">보기</button></td>
      </tr>`;
  }).join('');
}

function distHtml(title, before, after) {
  const keys = Array.from(new Set([...Object.keys(before || {}), ...Object.keys(after || {})]))
    .sort((a,b) => String(b).localeCompare(String(a), 'ko', {numeric:true}));
  if (!keys.length) return `<div class="score-row"><span>${title}</span><strong>자료 없음</strong></div>`;
  return `<div class="score-row"><span>${title}</span><strong>${keys.map(k => `${escapeHtml(k)} ${before?.[k] || 0}→${after?.[k] || 0}`).join(' / ')}</strong></div>`;
}

function memberTable(title, guild) {
  const members = guild.members || [];
  const body = members.length ? members.map(m => `
    <tr class="${m.is_master ? 'master-row' : ''}">
      <td>${escapeHtml(m.nickname)}</td>
      <td>${m.level}</td>
      <td>${escapeHtml(m.class)}</td>
      <td>${m.hunt_level ? m.hunt_level : '-'}</td>
    </tr>
  `).join('') : `<tr><td colspan="4" class="empty">기준 레벨 멤버 원본 없음</td></tr>`;
  return `
    <div class="member-box">
      <h3>${title}</h3>
      <table class="member-table">
        <thead><tr><th>닉네임</th><th>레벨</th><th>직업군</th><th>토벌</th></tr></thead>
        <tbody>${body}</tbody>
      </table>
    </div>`;
}


function alternateHtml(match) {
  const alts = Array.isArray(match.alternates) ? match.alternates : [];
  if (!alts.length) return '';
  const rows = alts.map(alt => {
    const used = alt.alreadyUsed ? '<span class="alt-used">대표 매칭 제외</span>' : '<span class="alt-free">참고 후보</span>';
    const move = String(match.before.serverName || '') === String(alt.after.serverName || '')
      ? escapeHtml(alt.after.serverName || '-')
      : `${escapeHtml(match.before.serverName || '-')} → ${escapeHtml(alt.after.serverName || '-')}`;
    return `
      <tr>
        <td>${move}</td>
        <td>${escapeHtml(alt.after.guild_name)}</td>
        <td>${escapeHtml(alt.after.guild_master)}</td>
        <td class="score">${alt.total.toFixed(3)}점</td>
        <td>${used}</td>
      </tr>`;
  }).join('');
  return `
    <div class="alternate-box">
      <h3>대표 매칭에서 제외된 참고 후보</h3>
      <p>이미 더 강하게 1:1 매칭된 이후 결사는 대표 결과에서 제외하고, 상세 참고용으로만 표시합니다.</p>
      <table class="member-table alt-table">
        <thead><tr><th>서버</th><th>이후 결사</th><th>결사장</th><th>내부점수</th><th>상태</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function openModal(matchIndex) {
  const m = state.matches[Number(matchIndex)];
  if (!m) return;
  $('modalTitle').textContent = `${m.before.guild_name} → ${m.after.guild_name}`;
  $('modalSub').innerHTML = `${escapeHtml(m.before.serverName)} ${escapeHtml(m.before.guild_master)} → ${escapeHtml(m.after.serverName)} ${escapeHtml(m.after.guild_master)}`;
  $('modalContent').innerHTML = `
    <div class="detail-grid compact-detail-grid">
      <div class="detail-card"><span>유사도</span><strong>${m.total.toFixed(1)}점</strong></div>
      <div class="detail-card"><span>내부 정렬점수</span><strong>${m.internalScore ? m.internalScore.toFixed(6) : m.total.toFixed(6)}</strong></div>
      <div class="detail-card"><span>판정</span><strong>${displayJudgement(m).text}</strong></div>
      <div class="detail-card"><span>이전 점수</span><strong>${m.before.guild_score.toLocaleString('ko-KR')}</strong></div>
      <div class="detail-card"><span>이후 점수</span><strong>${m.after.guild_score.toLocaleString('ko-KR')}</strong></div>
      <div class="detail-card"><span>이전 기준</span><strong>${escapeHtml(traceLabelText(m.before))}</strong></div>
      <div class="detail-card"><span>이후 기준</span><strong>${escapeHtml(traceLabelText(m.after))}</strong></div>
    </div>
    ${alternateHtml(m)}
    <div class="member-columns">
      ${memberTable('이전 멤버', m.before)}
      ${memberTable('이후 멤버', m.after)}
    </div>
  `;
  $('modalBackdrop').hidden = false;
}

function closeModal() {
  $('modalBackdrop').hidden = true;
}

function bindEvents() {
  $('reloadBtn').addEventListener('click', loadSnapshotIndex);
  $('compareBtn').addEventListener('click', compareSelected);
  $('searchInput').addEventListener('input', renderResults);
  $('moveFilter')?.addEventListener('change', renderResults);
  $('serverFilter')?.addEventListener('change', renderResults);
  $('gradeFilter').addEventListener('change', renderResults);
  $('beforeLimitSelect').addEventListener('change', () => state.matches.length && compareSelected());
  $('afterLimitSelect').addEventListener('change', () => state.matches.length && compareSelected());
  $('resultBody').addEventListener('click', e => {
    const btn = e.target.closest('[data-index]');
    if (btn) openModal(btn.dataset.index);
  });
  $('modalClose').addEventListener('click', closeModal);
  $('modalBackdrop').addEventListener('click', e => { if (e.target.id === 'modalBackdrop') closeModal(); });
}

bindEvents();
closeModal();
loadSnapshotIndex();
