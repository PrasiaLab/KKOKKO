(() => {
  "use strict";

  const CLASS_URLS = ["./data/Who_are_you_class.json", "./Who_are_you_class.json"];
  const OVERALL_URLS = ["./data/Who_are_you.json", "./Who_are_you.json"];
  const CLASS_ORDER = ["AbyssRevenant","Enforcer","SolarSentinel","RuneScribe","MirageBlade","WildWarrior","IncenseArcher"];
  const mappings = window.PRASIA_MAPPINGS || {};
  const classNames = mappings.classes || {};
  const serverNames = mappings.servers || {};

  const state = {
    classRows: [], overallRows: [], metrics: [], selected: "all", charts: {}, serverMetric: "population", metadata: null
  };

  const $ = (id) => document.getElementById(id);
  const fmt = (n, digits = 0) => Number(n || 0).toLocaleString("ko-KR", {maximumFractionDigits: digits, minimumFractionDigits: digits});
  const pct = (n, digits = 1) => `${fmt(n, digits)}%`;
  const classLabel = (code) => classNames[code] || code || "-";
  const serverLabel = (code) => serverNames[code] || code || "-";
  const safeNumber = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;

  async function fetchFirst(urls) {
    let lastError;
    for (const url of urls) {
      try {
        const res = await fetch(`${url}?ts=${Date.now()}`, {cache: "no-store"});
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
      } catch (error) { lastError = error; }
    }
    throw lastError || new Error("데이터를 불러오지 못했습니다.");
  }

  function normalize(item) {
    return {
      world: String(item.world || item.server || ""),
      name: String(item.name || item.nickname || "-"),
      guild: String(item.guild || item.guild_name || "-").trim() || "-",
      classCode: String(item.class || item.class_name || item.className || ""),
      level: safeNumber(item.level || item.character_level),
      grade: safeNumber(item.grade || item.raid_level),
      ranking: safeNumber(item.ranking || item.rank)
    };
  }

  function avg(rows, key) { return rows.length ? rows.reduce((s,r)=>s+r[key],0)/rows.length : 0; }
  function max(rows, key) { return rows.length ? Math.max(...rows.map(r=>r[key])) : 0; }
  function ratio(part, whole) { return whole ? part / whole * 100 : 0; }
  function minMaxScore(value, values) {
    const min = Math.min(...values), maxVal = Math.max(...values);
    if (maxVal === min) return 50;
    return Math.round((value - min) / (maxVal - min) * 100);
  }

  function buildMetrics() {
    const totalClass = state.classRows.length;
    const totalTop = state.overallRows.length;
    const maxLevelAll = max(state.classRows, "level");
    state.metrics = CLASS_ORDER.map(code => {
      const rows = state.classRows.filter(r => r.classCode === code);
      const topRows = state.overallRows.filter(r => r.classCode === code);
      const overallShare = ratio(rows.length, totalClass);
      const topShare = ratio(topRows.length, totalTop);
      const representation = overallShare ? topShare / overallShare : 0;
      return {
        code, name: classLabel(code), rows, topRows,
        count: rows.length,
        share: overallShare,
        avgLevel: avg(rows,"level"), avgGrade: avg(rows,"grade"),
        maxLevel: max(rows,"level"), maxGrade: max(rows,"grade"),
        topCount: topRows.length, topShare, representation,
        highLevelRatio: ratio(rows.filter(r=>r.level >= Math.max(1,maxLevelAll-2)).length, rows.length),
        highGradeRatio: ratio(rows.filter(r=>r.grade >= 25).length, rows.length)
      };
    });
  }

  function chartDefaults() {
    Chart.defaults.color = "#98a3b2";
    Chart.defaults.borderColor = "rgba(255,255,255,.07)";
    Chart.defaults.font.family = 'Pretendard, "Noto Sans KR", sans-serif';
  }

  function destroyChart(key) { if (state.charts[key]) { state.charts[key].destroy(); delete state.charts[key]; } }

  function createChart(key, canvasId, config) {
    destroyChart(key);
    state.charts[key] = new Chart($(canvasId), config);
  }

  function renderTabs() {
    const target = $("classTabs");
    const entries = [{code:"all",name:"전체"}, ...state.metrics.map(m=>({code:m.code,name:m.name}))];
    target.innerHTML = entries.map(item => `<button type="button" class="class-tab ${item.code === state.selected ? "active" : ""}" data-class-code="${item.code}" role="tab">${item.name}</button>`).join("");
    target.querySelectorAll("button").forEach(btn => btn.addEventListener("click", () => selectClass(btn.dataset.classCode)));
  }

  function renderSummary(metric = null) {
    const total = state.classRows.length;
    const rows = metric ? metric.rows : state.classRows;
    const topRows = metric ? metric.topRows : state.overallRows;
    const cards = metric ? [
      ["확인 인원", `${fmt(metric.count)}명`, `전체 직업의 ${pct(metric.share)}`],
      ["평균 레벨", fmt(metric.avgLevel,2), `최고 ${fmt(metric.maxLevel)}`],
      ["평균 토벌", fmt(metric.avgGrade,2), `최고 ${fmt(metric.maxGrade)}`],
      ["상위 100 포함", `${fmt(metric.topCount)}명`, `상위권 점유율 ${pct(metric.topShare)}`]
    ] : [
      ["전체 확인 인원", `${fmt(total)}명`, "직업별 랭킹 합계"],
      ["평균 레벨", fmt(avg(rows,"level"),2), `최고 ${fmt(max(rows,"level"))}`],
      ["평균 토벌", fmt(avg(rows,"grade"),2), `최고 ${fmt(max(rows,"grade"))}`],
      ["상위 100 포함", `${fmt(topRows.length)}명`, `${new Set(topRows.map(r=>r.world)).size}개 서버`]
    ];
    $("classSummaryGrid").innerHTML = cards.map(([label,value,note])=>`<article class="summary-card"><span>${label}</span><strong>${value}</strong><small>${note}</small></article>`).join("");
  }

  function renderPopulationChart(metric = null) {
    const labels = state.metrics.map(m=>m.name);
    const data = state.metrics.map(m=>m.count);
    $("populationChartTitle").textContent = metric ? `${metric.name}와 전체 직업 인원 비교` : "직업별 확인 인원";
    createChart("population","populationChart",{
      type:"bar",
      data:{labels,datasets:[{label:"확인 인원",data,borderWidth:0,borderRadius:8,backgroundColor:state.metrics.map(m=>m.code===metric?.code?"rgba(241,208,107,.86)":"rgba(106,168,255,.52)")}]},
      options:{responsive:true,maintainAspectRatio:false,indexAxis:"y",plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>`${fmt(c.raw)}명`}}},scales:{x:{beginAtZero:true,ticks:{callback:v=>fmt(v)}},y:{grid:{display:false}}}}
    });
  }

  function renderShareChart(metric = null) {
    $("shareChartTitle").textContent = metric ? `${metric.name} 전체·상위권 점유율` : "전체 직업 점유율";
    const config = metric ? {
      type:"doughnut",
      data:{labels:["전체 직업 내 점유율","서버 상위 100 내 점유율"],datasets:[{data:[metric.share,metric.topShare],backgroundColor:["rgba(106,168,255,.72)","rgba(241,208,107,.82)"],borderWidth:0}]},
      options:{responsive:true,maintainAspectRatio:false,cutout:"65%",plugins:{legend:{position:"bottom"},tooltip:{callbacks:{label:c=>`${c.label}: ${pct(c.raw)}`}}}}
    } : {
      type:"doughnut",
      data:{labels:state.metrics.map(m=>m.name),datasets:[{data:state.metrics.map(m=>m.count),borderWidth:0}]},
      options:{responsive:true,maintainAspectRatio:false,cutout:"62%",plugins:{legend:{position:"bottom",labels:{boxWidth:12,padding:13}},tooltip:{callbacks:{label:c=>`${c.label}: ${fmt(c.raw)}명 (${pct(ratio(c.raw,state.classRows.length))})`}}}}
    };
    createChart("share","shareChart",config);
  }

  function renderComparisonTable() {
    $("classComparisonBody").innerHTML = state.metrics.map(m => {
      const cls = m.representation >= 1.08 ? "high" : m.representation <= .92 ? "low" : "";
      return `<tr><td class="class-name-cell">${m.name}</td><td>${fmt(m.count)}명</td><td>${pct(m.share)}</td><td>${fmt(m.avgLevel,2)}</td><td>${fmt(m.avgGrade,2)}</td><td>${fmt(m.topCount)}명</td><td>${pct(m.topShare)}</td><td><span class="represent-index ${cls}">${fmt(m.representation,2)}</span></td></tr>`;
    }).join("");
  }

  function renderProfile(metric) {
    const values = {
      population:minMaxScore(metric.count,state.metrics.map(m=>m.count)),
      avgLevel:minMaxScore(metric.avgLevel,state.metrics.map(m=>m.avgLevel)),
      avgGrade:minMaxScore(metric.avgGrade,state.metrics.map(m=>m.avgGrade)),
      topShare:minMaxScore(metric.topShare,state.metrics.map(m=>m.topShare)),
      highLevel:minMaxScore(metric.highLevelRatio,state.metrics.map(m=>m.highLevelRatio)),
      highGrade:minMaxScore(metric.highGradeRatio,state.metrics.map(m=>m.highGradeRatio))
    };
    createChart("profile","profileChart",{
      type:"radar",
      data:{labels:["전체 인원","평균 레벨","평균 토벌","상위 100 점유율","상위 레벨층","고토벌층"],datasets:[{label:metric.name,data:Object.values(values),backgroundColor:"rgba(225,184,62,.15)",borderColor:"rgba(241,208,107,.9)",pointBackgroundColor:"#f1d06b",pointRadius:3,borderWidth:2}]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{r:{beginAtZero:true,max:100,ticks:{display:false,stepSize:20},grid:{color:"rgba(255,255,255,.09)"},angleLines:{color:"rgba(255,255,255,.09)"},pointLabels:{color:"#cfd6df",font:{size:11,weight:"700"}}}}}
    });
  }

  function makeDistribution(rows,key) {
    const counts = new Map();
    rows.forEach(r=>counts.set(r[key],(counts.get(r[key])||0)+1));
    return [...counts.entries()].sort((a,b)=>a[0]-b[0]);
  }

  function renderDistribution(metric) {
    const level = makeDistribution(metric.rows,"level");
    const grade = makeDistribution(metric.rows,"grade");
    createChart("level","levelChart",{type:"bar",data:{labels:level.map(x=>x[0]),datasets:[{label:"인원",data:level.map(x=>x[1]),backgroundColor:"rgba(106,168,255,.65)",borderRadius:7}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{grid:{display:false}},y:{beginAtZero:true,ticks:{precision:0}}}}});
    createChart("grade","gradeChart",{type:"bar",data:{labels:grade.map(x=>x[0]),datasets:[{label:"인원",data:grade.map(x=>x[1]),backgroundColor:"rgba(84,205,167,.65)",borderRadius:7}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{grid:{display:false}},y:{beginAtZero:true,ticks:{precision:0}}}}});
  }

  function serverRows(metric) {
    const worlds = [...new Set(state.classRows.map(r=>r.world))];
    return worlds.map(world=>({
      world,label:serverLabel(world),
      population:metric.rows.filter(r=>r.world===world).length,
      top100:metric.topRows.filter(r=>r.world===world).length
    })).sort((a,b)=>b[state.serverMetric]-a[state.serverMetric]);
  }

  function renderServerChart(metric) {
    const rows = serverRows(metric);
    const key = state.serverMetric;
    createChart("server","serverChart",{type:"bar",data:{labels:rows.map(r=>r.label),datasets:[{label:key==="population"?"전체 인원":"상위 100 포함",data:rows.map(r=>r[key]),backgroundColor:key==="population"?"rgba(106,168,255,.62)":"rgba(241,208,107,.7)",borderRadius:6}]},options:{responsive:true,maintainAspectRatio:false,indexAxis:"y",plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>`${fmt(c.raw)}명`}}},scales:{x:{beginAtZero:true,ticks:{precision:0}},y:{grid:{display:false}}}}});
  }

  function guildRows(metric) {
    const totals = new Map(), selected = new Map();
    state.classRows.forEach(r=>{if(r.guild!=="-"){const k=`${r.world}|||${r.guild}`;totals.set(k,(totals.get(k)||0)+1);}});
    metric.rows.forEach(r=>{if(r.guild!=="-"){const k=`${r.world}|||${r.guild}`;selected.set(k,(selected.get(k)||0)+1);}});
    return [...selected.entries()].map(([key,count])=>{const [world,guild]=key.split("|||");return{world,guild,count,total:totals.get(key)||count,share:ratio(count,totals.get(key)||count)}}).sort((a,b)=>b.count-a.count||b.share-a.share).slice(0,20);
  }

  function renderGuildTable(metric) {
    const rows = guildRows(metric);
    $("guildTableBody").innerHTML = rows.length ? rows.map((r,i)=>`<tr><td>${i+1}</td><td>${serverLabel(r.world)}</td><td>${r.guild}</td><td>${fmt(r.count)}명</td><td>${pct(r.share)}</td></tr>`).join("") : '<tr><td class="empty-row" colspan="5">표시할 결사 데이터가 없습니다.</td></tr>';
  }

  function rankText(value, values, highText, midText, lowText) {
    const sorted=[...values].sort((a,b)=>b-a), rank=sorted.indexOf(value)+1;
    if(rank<=2)return highText; if(rank>=6)return lowText; return midText;
  }

  function renderReports(metric) {
    const reports = [
      ["전체 분포", `${metric.name}는 전체 클래스 랭킹 확인 인원의 ${pct(metric.share)}를 차지하며, ${rankText(metric.count,state.metrics.map(m=>m.count),"전체 인원이 많은 편입니다.","전체 인원이 중간 수준입니다.","상대적으로 희소한 편입니다.")}`],
      ["상위권 노출", `서버별 상위 100위에는 ${fmt(metric.topCount)}명이 포함되어 있으며, 전체 점유율 대비 상위권 대표성은 ${fmt(metric.representation,2)}입니다. ${metric.representation>=1.08?"전체 비중보다 상위권에서 더 자주 확인됩니다.":metric.representation<=.92?"전체 비중에 비해 상위권 노출은 낮은 편입니다.":"전체 비중과 상위권 비중이 비슷합니다."}`],
      ["레벨·토벌", `평균 레벨은 ${fmt(metric.avgLevel,2)}, 평균 토벌은 ${fmt(metric.avgGrade,2)}입니다. ${rankText(metric.avgGrade,state.metrics.map(m=>m.avgGrade),"직업 간 비교에서 평균 토벌이 높은 편입니다.","직업 간 비교에서 평균 수준입니다.","직업 간 비교에서 평균 토벌이 낮은 편입니다.")}`],
      ["해석 안내", "이 결과는 랭킹에 노출된 캐릭터 구성의 상대 비교이며, 실제 전투 성능·조작 난이도·파티 역할을 직접 평가한 수치는 아닙니다."]
    ];
    $("classReportList").innerHTML=reports.map(([title,text])=>`<article class="class-report-item"><strong>${title}</strong><p>${text}</p></article>`).join("");
    $("selectedClassDescription").textContent=reports[0][1];
  }

  function renderSelected(metric) {
    $("selectedClassSection").hidden=false;
    $("selectedClassName").textContent=metric.name;
    $("selectedClassBadge").textContent=metric.name;
    renderProfile(metric); renderDistribution(metric); renderServerChart(metric); renderGuildTable(metric); renderReports(metric);
  }

  function clearSelectedCharts() { ["profile","level","grade","server"].forEach(destroyChart); }

  function selectClass(code) {
    state.selected=code; renderTabs();
    const metric=state.metrics.find(m=>m.code===code)||null;
    renderSummary(metric); renderPopulationChart(metric); renderShareChart(metric);
    if(metric){renderSelected(metric); $("selectedClassSection").scrollIntoView({behavior:"smooth",block:"start"});}
    else{$("selectedClassSection").hidden=true;clearSelectedCharts();}
  }

  function bindServerMetric() {
    $("serverMetricSwitch").querySelectorAll("button").forEach(btn=>btn.addEventListener("click",()=>{
      state.serverMetric=btn.dataset.serverMetric;
      $("serverMetricSwitch").querySelectorAll("button").forEach(x=>x.classList.toggle("active",x===btn));
      const metric=state.metrics.find(m=>m.code===state.selected); if(metric)renderServerChart(metric);
    }));
  }

  async function init() {
    try {
      chartDefaults();
      const [classData,overallData]=await Promise.all([fetchFirst(CLASS_URLS),fetchFirst(OVERALL_URLS)]);
      state.classRows=(classData.rankings||classData.data||[]).map(normalize).filter(r=>CLASS_ORDER.includes(r.classCode));
      state.overallRows=(overallData.rankings||overallData.data||[]).map(normalize).filter(r=>CLASS_ORDER.includes(r.classCode));
      state.metadata=classData.metadata||overallData.metadata||{};
      buildMetrics();
      $("classUpdatedAt").textContent=state.metadata.extracted_at_text||state.metadata.extracted_at||"-";
      renderTabs(); renderSummary(); renderPopulationChart(); renderShareChart(); renderComparisonTable(); bindServerMetric();
      $("classAnalysisContent").hidden=false;
      $("classStatus").textContent=`${fmt(state.classRows.length)}명의 클래스 랭킹과 ${fmt(state.overallRows.length)}명의 서버 상위 100위 데이터를 불러왔습니다.`;
      $("classStatus").classList.add("success");
    } catch(error) {
      console.error("클래스 분석 로드 오류",error);
      $("classStatus").textContent="클래스 분석 데이터를 불러오지 못했습니다. JSON 경로와 파일명을 확인해주세요.";
      $("classStatus").classList.add("error");
    }
  }

  init();
})();
