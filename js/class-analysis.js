(() => {
  "use strict";

  const CLASS_URLS = ["./data/Who_are_you_class.json", "./Who_are_you_class.json"];
  const OVERALL_URLS = ["./data/Who_are_you.json", "./Who_are_you.json"];
  const GUILD_URLS = ["./data/Who_are_you_guild.json", "./Who_are_you_guild.json"];
  const GUILD_SCORE_URLS = ["./data/Who_are_you_guild_score.json", "./Who_are_you_guild_score.json"];
  const CLASS_ORDER = ["AbyssRevenant","Enforcer","SolarSentinel","RuneScribe","MirageBlade","WildWarrior","IncenseArcher"];
  const LEVEL_MIN = 86;
  const GRADE_MIN = 21;
  const mappings = window.PRASIA_MAPPINGS || {};
  const classNames = mappings.classes || {};
  const serverNames = mappings.servers || {};

  const state = {
    classRows: [],
    overallRows: [],
    metrics: [],
    selected: "all",
    charts: {},
    metadata: null,
    guildRows: [], guildScoreRows: [], guildSort: "count", activeMetric: null
  };

  const $ = (id) => document.getElementById(id);
  const fmt = (n, digits = 0) => Number(n || 0).toLocaleString("ko-KR", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits
  });
  const pct = (n, digits = 1) => `${fmt(n, digits)}%`;
  const classLabel = (code) => classNames[code] || code || "-";
  const serverLabel = (code) => serverNames[code] || code || "-";
  const safeNumber = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
  const escapeHtml = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  async function fetchFirst(urls) {
    let lastError;
    for (const url of urls) {
      try {
        const res = await fetch(`${url}?ts=${Date.now()}`, {cache: "no-store"});
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
      } catch (error) {
        lastError = error;
      }
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

  function avg(rows, key) {
    return rows.length ? rows.reduce((sum, row) => sum + row[key], 0) / rows.length : 0;
  }

  function max(rows, key) {
    return rows.length ? Math.max(...rows.map((row) => row[key])) : 0;
  }

  function ratio(part, whole) {
    return whole ? part / whole * 100 : 0;
  }

  function relativeRankScore(value, values) {
    const sorted = [...values].filter(Number.isFinite).sort((a,b)=>a-b);
    if (!sorted.length) return 60;
    const lower = sorted.filter((item)=>item < value).length;
    const equal = sorted.filter((item)=>item === value).length;
    const percentile = sorted.length === 1 ? 0.5 : (lower + Math.max(0,equal-1)/2) / (sorted.length-1);
    return Math.round(20 + percentile * 80);
  }

  function worldGroupLabel(worldCode) {
    const label = serverLabel(worldCode);
    return label.replace(/\d{2}$/, "") || label;
  }

  function buildMetrics() {
    const totalTop = state.overallRows.length;

    state.metrics = CLASS_ORDER.map((code) => {
      const rows = state.classRows.filter((row) => row.classCode === code);
      const topRows = state.overallRows.filter((row) => row.classCode === code);
      const levelRows = rows.filter((row) => row.level >= LEVEL_MIN);
      const gradeRows = rows.filter((row) => row.grade >= GRADE_MIN);

      return {
        code,
        name: classLabel(code),
        rows,
        topRows,
        levelRows,
        gradeRows,
        topCount: topRows.length,
        topShare: ratio(topRows.length, totalTop),
        topAvgLevel: avg(topRows, "level"),
        topAvgGrade: avg(topRows, "grade"),
        detailAvgLevel: avg(levelRows, "level"),
        detailAvgGrade: avg(gradeRows, "grade"),
        maxLevel: max(rows, "level"),
        maxGrade: max(rows, "grade"),
        highLevelRatio: ratio(levelRows.length, rows.length),
        highGradeRatio: ratio(gradeRows.length, rows.length)
      };
    });
  }

  function chartDefaults() {
    Chart.defaults.color = "#98a3b2";
    Chart.defaults.borderColor = "rgba(255,255,255,.07)";
    Chart.defaults.font.family = 'Pretendard, "Noto Sans KR", sans-serif';
  }

  function destroyChart(key) {
    if (state.charts[key]) {
      state.charts[key].destroy();
      delete state.charts[key];
    }
  }

  function createChart(key, canvasId, config) {
    destroyChart(key);
    state.charts[key] = new Chart($(canvasId), config);
  }

  function renderTabs() {
    const target = $("classTabs");
    const entries = [{code: "all", name: "전체"}, ...state.metrics.map((metric) => ({
      code: metric.code,
      name: metric.name
    }))];

    target.innerHTML = entries.map((item) => `
      <button
        type="button"
        class="class-tab ${item.code === state.selected ? "active" : ""}"
        data-class-code="${item.code}"
        role="tab"
      >${item.name}</button>
    `).join("");

    target.querySelectorAll("button").forEach((button) => {
      button.addEventListener("click", () => selectClass(button.dataset.classCode));
    });
  }

  function renderSummary(metric = null) {
    const topRows = metric ? metric.topRows : state.overallRows;
    const cards = metric ? [
      ["상위 100위 포함 인원", `${fmt(metric.topCount)}명`, `상위권 점유율 ${pct(metric.topShare)}`],
      [`평균 레벨`, fmt(metric.detailAvgLevel, 2), `${LEVEL_MIN}레벨 이상 ${fmt(metric.levelRows.length)}명 기준`],
      ["평균 토벌", fmt(metric.detailAvgGrade, 2), `${GRADE_MIN}레벨 이상 ${fmt(metric.gradeRows.length)}명 기준`],
      ["최고 기록", `Lv.${fmt(metric.maxLevel)} / 토벌 ${fmt(metric.maxGrade)}`, "클래스 랭킹 수집 데이터 기준"]
    ] : [
      ["상위 100위 분석 인원", `${fmt(topRows.length)}명`, `${new Set(topRows.map((row) => row.world)).size}개 서버 합계`],
      ["분석 클래스", `${CLASS_ORDER.length}개`, "현재 클래스 랭킹 기준"],
      ["상위 100 평균 레벨", fmt(avg(topRows, "level"), 2), `최고 ${fmt(max(topRows, "level"))}`],
      ["상위 100 평균 토벌", fmt(avg(topRows, "grade"), 2), `최고 ${fmt(max(topRows, "grade"))}`]
    ];

    $("classSummaryGrid").innerHTML = cards.map(([label, value, note]) => `
      <article class="summary-card">
        <span>${label}</span>
        <strong>${value}</strong>
        <small>${note}</small>
      </article>
    `).join("");
  }

  function renderPopulationChart(metric = null) {
    const labels = state.metrics.map((item) => item.name);
    const data = state.metrics.map((item) => item.topCount);
    $("populationChartTitle").textContent = metric
      ? `${metric.name} 상위 100위 포함 비교`
      : "상위 100위 포함 인원";

    createChart("population", "populationChart", {
      type: "bar",
      data: {
        labels,
        datasets: [{
          label: "상위 100위 포함 인원",
          data,
          borderWidth: 0,
          borderRadius: 8,
          backgroundColor: state.metrics.map((item) =>
            item.code === metric?.code
              ? "rgba(241,208,107,.86)"
              : "rgba(106,168,255,.52)"
          )
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: "y",
        plugins: {
          legend: {display: false},
          tooltip: {callbacks: {label: (context) => `${fmt(context.raw)}명`}}
        },
        scales: {
          x: {beginAtZero: true, ticks: {callback: (value) => fmt(value)}},
          y: {grid: {display: false}}
        }
      }
    });
  }

  function renderShareChart(metric = null) {
    $("shareChartTitle").textContent = metric
      ? `${metric.name} 상위 100위 점유율`
      : "상위 100위 직업 점유율";

    const config = metric ? {
      type: "doughnut",
      data: {
        labels: [metric.name, "그 외 클래스"],
        datasets: [{
          data: [metric.topShare, Math.max(0, 100 - metric.topShare)],
          backgroundColor: ["rgba(241,208,107,.82)", "rgba(106,168,255,.25)"],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "65%",
        plugins: {
          legend: {position: "bottom"},
          tooltip: {callbacks: {label: (context) => `${context.label}: ${pct(context.raw)}`}}
        }
      }
    } : {
      type: "doughnut",
      data: {
        labels: state.metrics.map((item) => item.name),
        datasets: [{data: state.metrics.map((item) => item.topCount), borderWidth: 0}]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "62%",
        plugins: {
          legend: {position: "bottom", labels: {boxWidth: 12, padding: 13}},
          tooltip: {
            callbacks: {
              label: (context) => `${context.label}: ${fmt(context.raw)}명 (${pct(ratio(context.raw, state.overallRows.length))})`
            }
          }
        }
      }
    };

    createChart("share", "shareChart", config);
  }

  function renderComparisonTable() {
    $("classComparisonBody").innerHTML = state.metrics.map((metric) => `
      <tr>
        <td class="class-name-cell">${metric.name}</td>
        <td>${fmt(metric.topCount)}명</td>
        <td>${pct(metric.topShare)}</td>
        <td>${fmt(metric.topAvgLevel, 2)}</td>
        <td>${fmt(metric.topAvgGrade, 2)}</td>
      </tr>
    `).join("");
  }

  function renderProfile(metric) {
    const values = {
      topCount: relativeRankScore(metric.topCount, state.metrics.map((item) => item.topCount)),
      topAvgLevel: relativeRankScore(metric.topAvgLevel, state.metrics.map((item) => item.topAvgLevel)),
      topAvgGrade: relativeRankScore(metric.topAvgGrade, state.metrics.map((item) => item.topAvgGrade)),
      highLevel: relativeRankScore(metric.highLevelRatio, state.metrics.map((item) => item.highLevelRatio)),
      highGrade: relativeRankScore(metric.highGradeRatio, state.metrics.map((item) => item.highGradeRatio))
    };

    createChart("profile", "profileChart", {
      type: "radar",
      data: {
        labels: ["상위 100 인원", "상위권 평균 레벨", "상위권 평균 토벌", `${LEVEL_MIN}+ 비율`, `${GRADE_MIN}+ 토벌 비율`],
        datasets: [{
          label: metric.name,
          data: Object.values(values),
          backgroundColor: "rgba(225,184,62,.15)",
          borderColor: "rgba(241,208,107,.9)",
          pointBackgroundColor: "#f1d06b",
          pointRadius: 3,
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {legend: {display: false}},
        scales: {
          r: {
            beginAtZero: true,
            max: 100,
            ticks: {display: false, stepSize: 20},
            grid: {color: "rgba(255,255,255,.09)"},
            angleLines: {color: "rgba(255,255,255,.09)"},
            pointLabels: {color: "#cfd6df", font: {size: 11, weight: "700"}}
          }
        }
      }
    });
  }

  function makeDistribution(rows, key) {
    const counts = new Map();
    rows.forEach((row) => counts.set(row[key], (counts.get(row[key]) || 0) + 1));
    return [...counts.entries()].sort((a, b) => a[0] - b[0]);
  }

  function renderDistribution(metric) {
    const level = makeDistribution(metric.levelRows, "level");
    const grade = makeDistribution(metric.gradeRows, "grade");

    createChart("level", "levelChart", {
      type: "bar",
      data: {
        labels: level.map((item) => item[0]),
        datasets: [{
          label: "인원",
          data: level.map((item) => item[1]),
          backgroundColor: "rgba(106,168,255,.65)",
          borderRadius: 7
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {legend: {display: false}},
        scales: {x: {grid: {display: false}}, y: {beginAtZero: true, ticks: {precision: 0}}}
      }
    });

    createChart("grade", "gradeChart", {
      type: "bar",
      data: {
        labels: grade.map((item) => item[0]),
        datasets: [{
          label: "인원",
          data: grade.map((item) => item[1]),
          backgroundColor: "rgba(84,205,167,.65)",
          borderRadius: 7
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {legend: {display: false}},
        scales: {x: {grid: {display: false}}, y: {beginAtZero: true, ticks: {precision: 0}}}
      }
    });
  }

  function worldRows(metric) {
    const totals = new Map();
    const selected = new Map();

    state.overallRows.forEach((row) => {
      const group = worldGroupLabel(row.world);
      totals.set(group, (totals.get(group) || 0) + 1);
    });

    metric.topRows.forEach((row) => {
      const group = worldGroupLabel(row.world);
      selected.set(group, (selected.get(group) || 0) + 1);
    });

    return [...totals.entries()]
      .map(([group, total]) => ({
        group,
        total,
        count: selected.get(group) || 0,
        share: ratio(selected.get(group) || 0, total)
      }))
      .sort((a, b) => b.share - a.share || b.count - a.count);
  }

  function renderServerChart(metric) {
    const rows = worldRows(metric);

    createChart("server", "serverChart", {
      type: "bar",
      data: {
        labels: rows.map((row) => row.group),
        datasets: [{
          label: "월드 상위 100위 내 점유율",
          data: rows.map((row) => row.share),
          backgroundColor: "rgba(241,208,107,.7)",
          borderRadius: 7
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: "y",
        plugins: {
          legend: {display: false},
          tooltip: {
            callbacks: {
              label: (context) => {
                const row = rows[context.dataIndex];
                return `${pct(row.share)} · ${fmt(row.count)}명 / ${fmt(row.total)}명`;
              }
            }
          }
        },
        scales: {
          x: {beginAtZero: true, ticks: {callback: (value) => `${value}%`}},
          y: {grid: {display: false}}
        }
      }
    });
  }

  function normalizeGuild(item) { return {world:String(item.world||item.server||""),guild:String(item.guild_name||item.guildName||item.guild||"-").trim()||"-",serverRank:safeNumber(item.ranking||item.rank),memberCount:safeNumber(item.guild_member_count||item.guildMemberCount)}; }
  function normalizeGuildScore(item) { return {world:String(item.world||item.server||""),guild:String(item.guild_name||item.guildName||item.guild||"-").trim()||"-",labRank:safeNumber(item.rank),score:safeNumber(item.score)}; }
  function guildKey(world,guild){return `${world}|||${guild}`;}
  function findGuildRecord(world,guild){return state.guildRows.find((item)=>item.world===world&&item.guild===guild)||null;}

  function guildRows(metric) {
    const totals=new Map(), selected=new Map();
    const rankMap=new Map(state.guildRows.map((r)=>[guildKey(r.world,r.guild),r]));
    const scoreMap=new Map(state.guildScoreRows.map((r)=>[guildKey(r.world,r.guild),r]));
    state.classRows.forEach((r)=>{if(r.guild!=="-"){const k=guildKey(r.world,r.guild);totals.set(k,(totals.get(k)||0)+1);}});
    metric.rows.forEach((r)=>{if(r.guild!=="-"){const k=guildKey(r.world,r.guild);selected.set(k,(selected.get(k)||0)+1);}});
    const rows=[...selected.entries()].map(([k,count])=>{const [world,guild]=k.split("|||");const ri=rankMap.get(k)||{},si=scoreMap.get(k)||{};const total=ri.memberCount||totals.get(k)||count;return {world,guild,count,total,share:ratio(count,total),serverRank:ri.serverRank||0,labRank:si.labRank||0};});
    const sorters={count:(a,b)=>b.count-a.count||b.share-a.share,share:(a,b)=>b.share-a.share||b.count-a.count,serverRank:(a,b)=>(a.serverRank||9999)-(b.serverRank||9999)||b.count-a.count,labRank:(a,b)=>(a.labRank||999999)-(b.labRank||999999)||b.count-a.count};
    return rows.sort(sorters[state.guildSort]||sorters.count).slice(0,20);
  }

  function renderGuildTable(metric) {
    state.activeMetric=metric; const rows=guildRows(metric), body=$("guildTableBody");
    body.innerHTML=rows.length?rows.map((row,index)=>`<tr><td>${index+1}</td><td>${escapeHtml(serverLabel(row.world))}</td><td><button class="guild-detail-link" type="button" data-world="${escapeHtml(row.world)}" data-guild="${escapeHtml(row.guild)}">${escapeHtml(row.guild)}</button></td><td class="guild-rank-cell">${row.serverRank?`${fmt(row.serverRank)}위`:"-"}<small>${row.labRank?`연구소 ${fmt(row.labRank)}위`:"연구소 -"}</small></td><td>${fmt(row.count)}명</td><td>${pct(row.share)}</td><td><button class="guild-view-button" type="button" data-world="${escapeHtml(row.world)}" data-guild="${escapeHtml(row.guild)}">보기</button></td></tr>`).join(""):'<tr><td class="empty-row" colspan="7">표시할 결사 데이터가 없습니다.</td></tr>';
    body.querySelectorAll("[data-world][data-guild]").forEach((button)=>button.addEventListener("click",()=>openGuildModal(button.dataset.world,button.dataset.guild)));
  }

  function openGuildModal(world,guild){const record=findGuildRecord(world,guild)||{world,guild};document.dispatchEvent(new CustomEvent("kkokko:open-guild-members",{detail:record}));}

  function rankText(value, values, highText, midText, lowText) {
    const sorted = [...values].sort((a, b) => b - a);
    const rank = sorted.indexOf(value) + 1;
    if (rank <= 2) return highText;
    if (rank >= 6) return lowText;
    return midText;
  }

  function renderReports(metric) {
    const strongestWorld = worldRows(metric)[0];
    const reports = [
      [
        "상위권 분포",
        `${metric.name}는 서버별 상위 100위 데이터에서 ${fmt(metric.topCount)}명, ${pct(metric.topShare)}를 차지합니다. ${rankText(metric.topCount, state.metrics.map((item) => item.topCount), "상위권 포함 인원이 많은 편입니다.", "상위권 포함 인원이 중간 수준입니다.", "상위권 포함 인원이 상대적으로 적은 편입니다.")}`
      ],
      [
        "레벨·토벌",
        `${LEVEL_MIN}레벨 이상 ${fmt(metric.levelRows.length)}명의 평균 레벨은 ${fmt(metric.detailAvgLevel, 2)}, 토벌 ${GRADE_MIN} 이상 ${fmt(metric.gradeRows.length)}명의 평균 토벌은 ${fmt(metric.detailAvgGrade, 2)}입니다.`
      ],
      [
        "월드별 경향",
        strongestWorld
          ? `${strongestWorld.group} 월드의 상위 100위권에서 ${metric.name} 점유율이 ${pct(strongestWorld.share)}로 가장 높게 확인됩니다.`
          : "월드별 분포를 계산할 데이터가 없습니다."
      ],
      [
        "해석 안내",
        "이 결과는 랭킹에 노출된 캐릭터 구성의 상대 비교이며, 실제 전투 성능·조작 난이도·파티 역할을 직접 평가한 수치는 아닙니다."
      ]
    ];

    $("classReportList").innerHTML = reports.map(([title, text]) => `
      <article class="class-report-item">
        <strong>${title}</strong>
        <p>${text}</p>
      </article>
    `).join("");
    $("selectedClassDescription").textContent = reports[0][1];
  }

  function renderSelected(metric) {
    $("selectedClassSection").hidden = false;
    $("selectedClassName").textContent = metric.name;
    $("selectedClassBadge").textContent = metric.name;
    renderProfile(metric);
    renderDistribution(metric);
    renderServerChart(metric);
    renderGuildTable(metric);
    renderReports(metric);
  }

  function clearSelectedCharts() {
    ["profile", "level", "grade", "server"].forEach(destroyChart);
  }

  function selectClass(code) {
    state.selected = code;
    renderTabs();
    const metric = state.metrics.find((item) => item.code === code) || null;
    renderSummary(metric);
    renderPopulationChart(metric);
    renderShareChart(metric);

    if (metric) {
      renderSelected(metric);
      $("selectedClassSection").scrollIntoView({behavior: "smooth", block: "start"});
    } else {
      $("selectedClassSection").hidden = true;
      clearSelectedCharts();
    }
  }

  function bindGuildSort(){document.querySelectorAll("[data-guild-sort]").forEach((button)=>button.addEventListener("click",()=>{state.guildSort=button.dataset.guildSort||"count";document.querySelectorAll("[data-guild-sort]").forEach((item)=>item.classList.toggle("active",item===button));if(state.activeMetric)renderGuildTable(state.activeMetric);}));}

  async function init() {
    try {
      chartDefaults();
      bindGuildSort();
      const [classData, overallData, guildData, guildScoreData] = await Promise.all([
        fetchFirst(CLASS_URLS), fetchFirst(OVERALL_URLS), fetchFirst(GUILD_URLS), fetchFirst(GUILD_SCORE_URLS)
      ]);

      state.classRows = (classData.rankings || classData.data || [])
        .map(normalize)
        .filter((row) => CLASS_ORDER.includes(row.classCode));
      state.overallRows = (overallData.rankings || overallData.data || [])
        .map(normalize)
        .filter((row) => CLASS_ORDER.includes(row.classCode));
      state.guildRows=(guildData.rankings||guildData.data||[]).map(normalizeGuild);
      state.guildScoreRows=(guildScoreData.rankings||guildScoreData.data||[]).map(normalizeGuildScore);
      state.metadata = classData.metadata || overallData.metadata || {};

      buildMetrics();
      $("classUpdatedAt").textContent = state.metadata.extracted_at_text || state.metadata.extracted_at || "-";
      renderTabs();
      renderSummary();
      renderPopulationChart();
      renderShareChart();
      renderComparisonTable();
      $("classAnalysisContent").hidden = false;
      $("classStatus").textContent = `${fmt(state.overallRows.length)}명의 서버 상위 100위 데이터와 클래스별 상세 랭킹 데이터를 불러왔습니다.`;
      $("classStatus").classList.add("success");
    } catch (error) {
      console.error("클래스 분석 로드 오류", error);
      $("classStatus").textContent = "클래스 분석 데이터를 불러오지 못했습니다. JSON 경로와 파일명을 확인해주세요.";
      $("classStatus").classList.add("error");
    }
  }

  if ($("classTabs")) init();
})();
