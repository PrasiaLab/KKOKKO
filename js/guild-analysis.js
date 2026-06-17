(() => {
  "use strict";

  const root = document.getElementById("guild-analysis");
  if (!root) return;

  const URLS = {
    guild: "./data/Who_are_you_guild.json",
    score: "./data/Who_are_you_guild_score.json",
    members: "./data/Who_are_you_class.json"
  };

  const mappings = window.PRASIA_MAPPINGS || {};
  const serverNames = mappings.servers || {};
  const classNames = mappings.classes || {};
  const classCodes = Object.keys(classNames);

  const state = { guilds: [], scores: [], members: [], selectedA: null, selectedB: null };
  const el = id => document.getElementById(id);
  const status = el("guildAnalysisStatus");
  const results = el("guildAnalysisResults");

  function toArray(data) {
    if (Array.isArray(data)) return data;
    return data?.rankings || data?.data || data?.items || [];
  }

  function num(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  function text(value, fallback = "-") {
    const v = String(value ?? "").trim();
    return v || fallback;
  }

  function worldOf(item) {
    return text(item.world || item.server || item.world_code, "");
  }

  function guildNameOf(item) {
    return text(item.guild_name || item.guild || item.name, "");
  }

  function normalizeKey(world, guild) {
    return `${String(world).trim()}::${String(guild).trim().toLowerCase()}`;
  }

  function serverLabel(world) {
    return serverNames[world] || world || "-";
  }

  function classLabel(code) {
    return classNames[code] || code || "기타";
  }

  async function fetchJson(url) {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(url);
    const raw = await response.text();
    return raw.trim() ? JSON.parse(raw) : null;
  }

  function setStatus(message, type = "") {
    status.textContent = message;
    status.className = "guild-analysis-status" + (type ? ` ${type}` : "");
  }

  function normalizeGuild(item) {
    return {
      key: normalizeKey(worldOf(item), guildNameOf(item)),
      world: worldOf(item),
      name: guildNameOf(item),
      master: text(item.guild_master || item.guild_master_gc_name || item.master),
      serverRank: num(item.ranking || item.rank),
      serverRankChange: num(item.ranking_change || item.rank_change),
      guildLevel: num(item.guild_level || item.level),
      memberCount: num(item.guild_member_count || item.member_count || item.members)
    };
  }

  function normalizeScore(item) {
    return {
      key: normalizeKey(worldOf(item), guildNameOf(item)),
      labRank: num(item.ranking || item.rank || item.lab_rank),
      labRankChange: num(item.ranking_change || item.rank_change),
      score: num(item.total_score || item.score || item.guild_score),
      scoreChange: num(item.score_change || item.total_score_change),
      status: text(item.status || item.change_type, "")
    };
  }

  function normalizeMember(item) {
    const code = text(item.class || item.class_name || item.className || item.ranking_class_code, "기타");
    return {
      world: worldOf(item),
      guild: guildNameOf(item),
      level: num(item.level || item.character_level),
      grade: num(item.grade || item.raid_level),
      classCode: code
    };
  }

  function populateServers() {
    ["A", "B"].forEach(side => {
      const select = el(`guildAnalysisServer${side}`);
      const worlds = [...new Set(state.guilds.map(g => g.world))]
        .sort((a, b) => serverLabel(a).localeCompare(serverLabel(b), "ko"));
      worlds.forEach(world => {
        const option = document.createElement("option");
        option.value = world;
        option.textContent = serverLabel(world);
        select.appendChild(option);
      });
    });
  }

  function setupSearch(side) {
    const server = el(`guildAnalysisServer${side}`);
    const input = el(`guildAnalysisName${side}`);
    const box = el(`guildAnalysisSuggestions${side}`);

    function render() {
      const world = server.value;
      const query = input.value.trim().toLowerCase();
      box.innerHTML = "";
      if (!world || !query) { box.hidden = true; return; }

      const list = state.guilds
        .filter(g => g.world === world && g.name.toLowerCase().includes(query))
        .slice(0, 12);

      if (!list.length) {
        box.innerHTML = '<div class="guild-analysis-empty">일치하는 결사가 없습니다.</div>';
        box.hidden = false;
        return;
      }

      list.forEach(guild => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "guild-analysis-suggestion";
        button.innerHTML = `<span><strong>${escapeHtml(guild.name)}</strong><small>${escapeHtml(guild.master)} · ${guild.memberCount}명</small></span><em>서버 ${guild.serverRank || "-"}위</em>`;
        button.addEventListener("click", () => selectGuild(side, guild));
        box.appendChild(button);
      });
      box.hidden = false;
    }

    input.addEventListener("input", render);
    server.addEventListener("change", () => {
      input.value = "";
      state[`selected${side}`] = null;
      updateSelected(side);
      box.hidden = true;
    });
    input.addEventListener("focus", render);
    document.addEventListener("click", event => {
      if (!event.target.closest(`.guild-${side.toLowerCase()}`)) box.hidden = true;
    });
  }

  function selectGuild(side, guild) {
    state[`selected${side}`] = guild;
    el(`guildAnalysisName${side}`).value = guild.name;
    el(`guildAnalysisSuggestions${side}`).hidden = true;
    updateSelected(side);
  }

  function updateSelected(side) {
    const target = el(`guildAnalysisSelected${side}`);
    const guild = state[`selected${side}`];
    if (!guild) {
      target.textContent = "선택된 결사가 없습니다.";
      target.classList.remove("ready");
      return;
    }
    target.textContent = `${serverLabel(guild.world)} · ${guild.name} · 결사장 ${guild.master}`;
    target.classList.add("ready");
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;" }[c]));
  }

  function scoreFor(guild) {
    return state.scores.find(s => s.key === guild.key) || {};
  }

  function membersFor(guild) {
    return state.members.filter(m => normalizeKey(m.world, m.guild) === guild.key);
  }

  function average(list, key) {
    if (!list.length) return 0;
    return list.reduce((sum, item) => sum + num(item[key]), 0) / list.length;
  }

  function countMap(list, key) {
    return list.reduce((acc, item) => {
      const value = item[key];
      acc[value] = (acc[value] || 0) + 1;
      return acc;
    }, {});
  }

  function profile(guild) {
    const members = membersFor(guild);
    const score = scoreFor(guild);
    const levels = members.map(m => m.level).filter(Boolean);
    const grades = members.map(m => m.grade).filter(Boolean);
    const maxLevel = levels.length ? Math.max(...levels) : 0;
    const maxGrade = grades.length ? Math.max(...grades) : 0;
    const classCounts = countMap(members, "classCode");
    return {
      guild, score, members,
      confirmed: members.length,
      avgLevel: average(members, "level"),
      avgGrade: average(members, "grade"),
      maxLevel,
      maxGrade,
      maxLevelCount: levels.filter(v => v === maxLevel).length,
      maxGradeCount: grades.filter(v => v === maxGrade).length,
      highLevelRatio: members.length ? levels.filter(v => v >= maxLevel - 1).length / members.length * 100 : 0,
      highGradeRatio: members.length ? grades.filter(v => v >= maxGrade - 1).length / members.length * 100 : 0,
      classCounts
    };
  }

  function changeMarkup(value, statusText = "") {
    const status = statusText.toUpperCase();
    if (status === "NEW") return '<span class="metric-change new">NEW</span>';
    if (!value) return '<span class="metric-change same">-</span>';
    return `<span class="metric-change ${value > 0 ? "up" : "down"}">${value > 0 ? "▲" : "▼"}${Math.abs(value)}</span>`;
  }

  function format(value, digits = 0) {
    return Number(value || 0).toLocaleString("ko-KR", { maximumFractionDigits: digits, minimumFractionDigits: digits });
  }

  function renderMetrics(a, b) {
    const rows = [
      ["연구소 결사 순위", a.score.labRank ? `${a.score.labRank}위 ${changeMarkup(a.score.labRankChange, a.score.status)}` : "-", b.score.labRank ? `${b.score.labRank}위 ${changeMarkup(b.score.labRankChange, b.score.status)}` : "-", true],
      ["서버 내 결사 순위", a.guild.serverRank ? `${a.guild.serverRank}위` : "-", b.guild.serverRank ? `${b.guild.serverRank}위` : "-", true],
      ["결사 레벨", a.guild.guildLevel ? `Lv.${a.guild.guildLevel}` : "-", b.guild.guildLevel ? `Lv.${b.guild.guildLevel}` : "-"],
      ["총점", a.score.score ? `${format(a.score.score)}점 ${changeMarkup(a.score.scoreChange)}` : "-", b.score.score ? `${format(b.score.score)}점 ${changeMarkup(b.score.scoreChange)}` : "-"],
      ["전체 결사원", `${format(a.guild.memberCount)}명`, `${format(b.guild.memberCount)}명`],
      ["랭킹 확인 인원", `${format(a.confirmed)}명`, `${format(b.confirmed)}명`],
      ["평균 레벨", a.confirmed ? format(a.avgLevel, 2) : "-", b.confirmed ? format(b.avgLevel, 2) : "-"],
      ["평균 토벌", a.confirmed ? format(a.avgGrade, 2) : "-", b.confirmed ? format(b.avgGrade, 2) : "-"]
    ];

    const numeric = [
      [a.score.labRank, b.score.labRank, true], [a.guild.serverRank, b.guild.serverRank, true],
      [a.guild.guildLevel, b.guild.guildLevel], [a.score.score, b.score.score],
      [a.guild.memberCount, b.guild.memberCount], [a.confirmed, b.confirmed],
      [a.avgLevel, b.avgLevel], [a.avgGrade, b.avgGrade]
    ];

    el("guildAnalysisMetricList").innerHTML = rows.map((row, i) => {
      const [av, bv, lowerWins] = numeric[i];
      const aWin = av && bv && (lowerWins ? av < bv : av > bv);
      const bWin = av && bv && (lowerWins ? bv < av : bv > av);
      return `<div class="guild-analysis-metric-row"><div class="metric-value ${aWin ? "winner" : ""}">${row[1]}</div><div class="metric-label">${row[0]}</div><div class="metric-value ${bWin ? "winner" : ""}">${row[2]}</div></div>`;
    }).join("");
  }

  function percentile(value, values, reverse = false) {
    const clean = values.filter(v => Number.isFinite(v));
    if (!clean.length) return 0;
    const sorted = [...clean].sort((a,b) => a-b);
    const below = sorted.filter(v => v <= value).length;
    const score = below / sorted.length * 100;
    return Math.max(5, Math.min(100, reverse ? 105 - score : score));
  }

  function allProfiles() {
    return state.guilds.map(profile).filter(p => p.confirmed > 0);
  }

  function powerValues(target, all) {
    const metrics = [
      [target.guild.memberCount, all.map(p => p.guild.memberCount)],
      [target.guild.guildLevel, all.map(p => p.guild.guildLevel)],
      [target.avgLevel, all.map(p => p.avgLevel)],
      [target.avgGrade, all.map(p => p.avgGrade)],
      [target.highLevelRatio, all.map(p => p.highLevelRatio)],
      [target.highGradeRatio, all.map(p => p.highGradeRatio)]
    ];
    return metrics.map(([value, values]) => percentile(value, values));
  }

  function renderRadar(targetId, labels, valuesA, valuesB, nameA, nameB, options = {}) {
    const size = 430, cx = 215, cy = 205, radius = 145, count = labels.length;
    const maxValue = Math.max(1, num(options.maxValue) || 100);
    const suffix = options.suffix || "";
    const point = (index, value) => {
      const angle = -Math.PI / 2 + index * Math.PI * 2 / count;
      const normalized = Math.max(0, Math.min(100, num(value) / maxValue * 100));
      const r = radius * normalized / 100;
      return [cx + Math.cos(angle) * r, cy + Math.sin(angle) * r];
    };
    const polygon = values => values.map((v,i) => point(i,v).join(",")).join(" ");
    let svg = `<svg viewBox="0 0 ${size} ${size}" role="img" aria-label="레이더 차트">`;
    [20,40,60,80,100].forEach(level => {
      svg += `<polygon class="guild-radar-grid" points="${polygon(Array(count).fill(maxValue * level / 100))}"/>`;
    });
    labels.forEach((label,i) => {
      const [x,y] = point(i,maxValue);
      const angle = -Math.PI / 2 + i * Math.PI * 2 / count;
      const labelRadius = radius * 1.16;
      const lx = cx + Math.cos(angle) * labelRadius;
      const ly = cy + Math.sin(angle) * labelRadius;
      const anchor = Math.abs(lx-cx) < 10 ? "middle" : lx < cx ? "end" : "start";
      svg += `<line class="guild-radar-axis" x1="${cx}" y1="${cy}" x2="${x}" y2="${y}"/><text class="guild-radar-label" x="${lx}" y="${ly}" dominant-baseline="middle" text-anchor="${anchor}">${escapeHtml(label)}</text>`;
    });
    svg += `<polygon class="guild-radar-a" points="${polygon(valuesA)}"/><polygon class="guild-radar-b" points="${polygon(valuesB)}"/>`;
    valuesA.forEach((v,i) => { const [x,y]=point(i,v); svg += `<circle class="guild-radar-dot-a" cx="${x}" cy="${y}" r="3.5"><title>${escapeHtml(labels[i])}: ${format(v,1)}${escapeHtml(suffix)}</title></circle>`; });
    valuesB.forEach((v,i) => { const [x,y]=point(i,v); svg += `<circle class="guild-radar-dot-b" cx="${x}" cy="${y}" r="3.5"><title>${escapeHtml(labels[i])}: ${format(v,1)}${escapeHtml(suffix)}</title></circle>`; });
    svg += `</svg><div class="guild-radar-legend"><span><i></i>${escapeHtml(nameA)}</span><span><i></i>${escapeHtml(nameB)}</span></div>`;
    if (options.scaleLabel) svg += `<div class="guild-radar-scale">${escapeHtml(options.scaleLabel)}</div>`;
    el(targetId).innerHTML = svg;
  }

  function classRatios(profile) {
    return classCodes.map(code => profile.confirmed ? (profile.classCounts[code] || 0) / profile.confirmed * 100 : 0);
  }

  function renderBars(targetId, mapA, mapB, labels) {
    const max = Math.max(1, ...labels.flatMap(label => [mapA[label] || 0, mapB[label] || 0]));
    el(targetId).innerHTML = `<div class="guild-analysis-distribution">${labels.map(label => {
      const av = mapA[label] || 0, bv = mapB[label] || 0;
      return `<div class="guild-analysis-bar-row"><div class="guild-analysis-bar-label">${escapeHtml(label)}</div><div class="guild-analysis-dual-bars"><div class="guild-analysis-bar-line"><div class="guild-analysis-bar-track"><div class="guild-analysis-bar-fill" style="width:${av/max*100}%"></div></div><span class="guild-analysis-bar-value">A ${av}명</span></div><div class="guild-analysis-bar-line b"><div class="guild-analysis-bar-track"><div class="guild-analysis-bar-fill" style="width:${bv/max*100}%"></div></div><span class="guild-analysis-bar-value">B ${bv}명</span></div></div></div>`;
    }).join("")}</div>`;
  }

  function topKeys(mapA, mapB, limit = 8) {
    return [...new Set([...Object.keys(mapA), ...Object.keys(mapB)])]
      .map(Number).sort((a,b) => b-a).slice(0,limit).map(String);
  }

  function renderClassTable(a,b) {
    el("guildClassDistribution").innerHTML = `<div class="guild-class-table-wrap"><table class="guild-class-table"><thead><tr><th>직업</th><th>${escapeHtml(a.guild.name)} 인원</th><th>${escapeHtml(a.guild.name)} 비율</th><th>${escapeHtml(b.guild.name)} 인원</th><th>${escapeHtml(b.guild.name)} 비율</th></tr></thead><tbody>${classCodes.map(code => {
      const ac=a.classCounts[code]||0, bc=b.classCounts[code]||0;
      const ar=a.confirmed?ac/a.confirmed*100:0, br=b.confirmed?bc/b.confirmed*100:0;
      return `<tr><td>${escapeHtml(classLabel(code))}</td><td class="guild-class-a">${ac}명</td><td>${format(ar,1)}%</td><td class="guild-class-b">${bc}명</td><td>${format(br,1)}%</td></tr>`;
    }).join("")}</tbody></table></div>`;
  }

  function dominantClass(profile) {
    const entries = classCodes.map(code => [code, profile.classCounts[code] || 0]).sort((a,b) => b[1]-a[1]);
    const [code,count] = entries[0] || ["",0];
    return { code, count, ratio: profile.confirmed ? count/profile.confirmed*100 : 0 };
  }

  function buildComments(a,b) {
    const comments = [];
    const aPower = a.avgLevel + a.avgGrade;
    const bPower = b.avgLevel + b.avgGrade;
    let summary;
    if (Math.abs(aPower-bPower) < .6) summary = "두 결사는 평균 레벨과 평균 토벌 지표가 비슷해 전반적인 성장 수준이 유사합니다.";
    else if (aPower > bPower) summary = `${a.guild.name}이 평균 레벨과 토벌을 합친 성장 지표에서 다소 앞서는 모습입니다.`;
    else summary = `${b.guild.name}이 평균 레벨과 토벌을 합친 성장 지표에서 다소 앞서는 모습입니다.`;

    function sideText(p, other) {
      const dominant = dominantClass(p);
      const traits = [];
      if (p.confirmed < other.confirmed && p.avgGrade > other.avgGrade) traits.push("확인 인원은 적지만 평균 토벌이 높아 소수정예 토벌형에 가깝습니다");
      else if (p.highLevelRatio > other.highLevelRatio + 5) traits.push("상위 레벨층의 비율이 상대적으로 두텁습니다");
      else if (p.highGradeRatio > other.highGradeRatio + 5) traits.push("고토벌 인원 비율이 상대적으로 높습니다");
      else if (p.guild.memberCount > other.guild.memberCount) traits.push("전체 결사원 규모가 상대적으로 큰 편입니다");
      else traits.push("전체적으로 균형에 가까운 지표를 보입니다");
      if (dominant.count) traits.push(`${classLabel(dominant.code)}가 ${dominant.count}명(${format(dominant.ratio,1)}%)으로 가장 많습니다`);
      return traits.join(". ") + ".";
    }

    comments.push(["종합 분석","데이터 기반 요약",summary]);
    comments.push(["A 결사 특징",a.guild.name,sideText(a,b)]);
    comments.push(["B 결사 특징",b.guild.name,sideText(b,a)]);
    el("guildAnalysisComments").innerHTML = comments.map(([tag,title,body]) => `<article class="guild-analysis-comment"><span>${escapeHtml(tag)}</span><strong>${escapeHtml(title)}</strong><p>${escapeHtml(body)}</p></article>`).join("");
  }

  function runAnalysis() {
    if (!state.selectedA || !state.selectedB) { setStatus("A와 B 결사를 모두 선택해주세요.", "error"); return; }
    if (state.selectedA.key === state.selectedB.key) { setStatus("서로 다른 결사를 선택해주세요.", "error"); return; }

    const a = profile(state.selectedA), b = profile(state.selectedB);
    if (!a.confirmed || !b.confirmed) { setStatus("선택한 결사의 랭킹 확인 인원 데이터가 부족합니다.", "error"); return; }

    el("guildAnalysisTitleA").textContent = `${serverLabel(a.guild.world)} · ${a.guild.name}`;
    el("guildAnalysisTitleB").textContent = `${serverLabel(b.guild.world)} · ${b.guild.name}`;
    renderMetrics(a,b);

    const all = allProfiles();
    renderRadar("guildPowerRadar", ["결사 규모","결사 레벨","평균 레벨","평균 토벌","상위 레벨층","고토벌층"], powerValues(a,all), powerValues(b,all), a.guild.name, b.guild.name);

    const classValuesA = classRatios(a);
    const classValuesB = classRatios(b);
    const highestClassRatio = Math.max(0, ...classValuesA, ...classValuesB);
    const classRadarMax = Math.max(20, Math.ceil(highestClassRatio / 5) * 5);
    renderRadar(
      "guildClassRadar",
      classCodes.map(classLabel),
      classValuesA,
      classValuesB,
      a.guild.name,
      b.guild.name,
      {
        maxValue: classRadarMax,
        suffix: "%",
        scaleLabel: `직업 구성비 기준 · 외곽선 ${classRadarMax}%`
      }
    );

    const levelA=countMap(a.members,"level"), levelB=countMap(b.members,"level");
    const gradeA=countMap(a.members,"grade"), gradeB=countMap(b.members,"grade");
    renderBars("guildLevelDistribution",levelA,levelB,topKeys(levelA,levelB,10));
    renderBars("guildGradeDistribution",gradeA,gradeB,topKeys(gradeA,gradeB,8));
    renderClassTable(a,b);
    buildComments(a,b);

    const updated = new Date();
    el("guildAnalysisUpdatedAt").textContent = `분석 시각 ${updated.toLocaleString("ko-KR")}`;
    results.hidden = false;
    setStatus("결사 전력 분석이 완료되었습니다.", "success");
    results.scrollIntoView({ behavior:"smooth", block:"start" });
  }

  function resetAll() {
    state.selectedA = state.selectedB = null;
    ["A","B"].forEach(side => {
      el(`guildAnalysisServer${side}`).value = "";
      el(`guildAnalysisName${side}`).value = "";
      el(`guildAnalysisSuggestions${side}`).hidden = true;
      updateSelected(side);
    });
    results.hidden = true;
    setStatus("서버와 결사를 선택한 뒤 분석하기 버튼을 눌러주세요.");
  }

  Promise.allSettled([fetchJson(URLS.guild),fetchJson(URLS.score),fetchJson(URLS.members)])
    .then(([guildResult,scoreResult,memberResult]) => {
      if (guildResult.status !== "fulfilled") throw new Error("guild");
      state.guilds = toArray(guildResult.value).map(normalizeGuild).filter(g => g.world && g.name);
      state.scores = scoreResult.status === "fulfilled" ? toArray(scoreResult.value).map(normalizeScore) : [];
      state.members = memberResult.status === "fulfilled" ? toArray(memberResult.value).map(normalizeMember).filter(m => m.world && m.guild) : [];
      if (!state.guilds.length) throw new Error("empty");
      populateServers();
      setupSearch("A"); setupSearch("B");
      setStatus("서버와 결사를 선택한 뒤 분석하기 버튼을 눌러주세요.");
    })
    .catch(() => setStatus("결사 데이터를 불러오지 못했습니다. 데이터 파일을 확인해주세요.","error"));

  el("guildAnalysisRun").addEventListener("click",runAnalysis);
  el("guildAnalysisReset").addEventListener("click",resetAll);
})();
