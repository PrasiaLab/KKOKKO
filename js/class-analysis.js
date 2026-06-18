(() => {
  "use strict";

  const CLASS_URLS = ["./data/Who_are_you_class.json", "./Who_are_you_class.json"];
  const OVERALL_URLS = ["./data/Who_are_you.json", "./Who_are_you.json"];
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
    metadata: null
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

  function minMaxScore(value, values) {
    const safeValues = values.filter(Number.isFinite);
    const min = Math.min(...safeValues);
    const maxValue = Math.max(...safeValues);
    if (maxValue === min) return 50;
    return Math.round((value - min) / (maxValue - min) * 100);
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
      topCount: minMaxScore(metric.topCount, state.metrics.map((item) => item.topCount)),
      topAvgLevel: minMaxScore(metric.topAvgLevel, state.metrics.map((item) => item.topAvgLevel)),
      topAvgGrade: minMaxScore(metric.topAvgGrade, state.metrics.map((item) => item.topAvgGrade)),
      highLevel: minMaxScore(metric.highLevelRatio, state.metrics.map((item) => item.highLevelRatio)),
      highGrade: minMaxScore(metric.highGradeRatio, state.metrics.map((item) => item.highGradeRatio))
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

  function guildRows(metric) {
    const totals = new Map();
    const selected = new Map();

    state.classRows.forEach((row) => {
      if (row.guild !== "-") {
        const key = `${row.world}|||${row.guild}`;
        totals.set(key, (totals.get(key) || 0) + 1);
      }
    });

    metric.rows.forEach((row) => {
      if (row.guild !== "-") {
        const key = `${row.world}|||${row.guild}`;
        selected.set(key, (selected.get(key) || 0) + 1);
      }
    });

    return [...selected.entries()]
      .map(([key, count]) => {
        const [world, guild] = key.split("|||");
        const total = totals.get(key) || count;
        return {world, guild, count, total, share: ratio(count, total)};
      })
      .sort((a, b) => b.count - a.count || b.share - a.share)
      .slice(0, 20);
  }

  function renderGuildTable(metric) {
    const rows = guildRows(metric);
    const body = $("guildTableBody");

    body.innerHTML = rows.length ? rows.map((row, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${escapeHtml(serverLabel(row.world))}</td>
        <td>
          <button
            class="guild-detail-link"
            type="button"
            data-world="${escapeHtml(row.world)}"
            data-guild="${escapeHtml(row.guild)}"
          >${escapeHtml(row.guild)}</button>
        </td>
        <td>${fmt(row.count)}명</td>
        <td>${pct(row.share)}</td>
        <td>
          <button
            class="guild-view-button"
            type="button"
            data-world="${escapeHtml(row.world)}"
            data-guild="${escapeHtml(row.guild)}"
          >보기</button>
        </td>
      </tr>
    `).join("") : '<tr><td class="empty-row" colspan="6">표시할 결사 데이터가 없습니다.</td></tr>';

    body.querySelectorAll("[data-world][data-guild]").forEach((button) => {
      button.addEventListener("click", () => openGuildModal(
        button.dataset.world,
        button.dataset.guild,
        metric.code
      ));
    });
  }

  function openGuildModal(world, guild, selectedClassCode) {
    const rows = state.classRows
      .filter((row) => row.world === world && row.guild === guild)
      .sort((a, b) => {
        const selectedDiff = Number(b.classCode === selectedClassCode) - Number(a.classCode === selectedClassCode);
        return selectedDiff || b.level - a.level || b.grade - a.grade || a.name.localeCompare(b.name, "ko");
      });

    const selectedCount = rows.filter((row) => row.classCode === selectedClassCode).length;
    $("classGuildModalTitle").textContent = guild;
    $("classGuildModalSub").textContent = `${serverLabel(world)} · 랭킹 확인 ${fmt(rows.length)}명 · ${classLabel(selectedClassCode)} ${fmt(selectedCount)}명`;
    $("classGuildMemberBody").innerHTML = rows.length ? rows.map((row) => `
      <tr class="${row.classCode === selectedClassCode ? "selected-class-member" : ""}">
        <td>${escapeHtml(row.name)}</td>
        <td>${escapeHtml(classLabel(row.classCode))}</td>
        <td>${fmt(row.level)}</td>
        <td>${fmt(row.grade)}</td>
      </tr>
    `).join("") : '<tr><td class="empty-row" colspan="4">확인 가능한 결사원이 없습니다.</td></tr>';

    const modal = $("classGuildModal");
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
  }

  function closeGuildModal() {
    const modal = $("classGuildModal");
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
  }

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

  function bindModal() {
    $("classGuildModalClose")?.addEventListener("click", closeGuildModal);
    $("classGuildModal")?.addEventListener("click", (event) => {
      if (event.target === $("classGuildModal")) closeGuildModal();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeGuildModal();
    });
  }

  async function init() {
    try {
      chartDefaults();
      bindModal();
      const [classData, overallData] = await Promise.all([
        fetchFirst(CLASS_URLS),
        fetchFirst(OVERALL_URLS)
      ]);

      state.classRows = (classData.rankings || classData.data || [])
        .map(normalize)
        .filter((row) => CLASS_ORDER.includes(row.classCode));
      state.overallRows = (overallData.rankings || overallData.data || [])
        .map(normalize)
        .filter((row) => CLASS_ORDER.includes(row.classCode));
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

  init();
})();
