(() => {
  "use strict";

  const CLASS_DATA_URL =
    "./data/Who_are_you_class.json";

  const OVERALL_DATA_URL =
    "./data/Who_are_you.json";

  const PAGE_SIZE = 100;
  const MAX_PAGES = 10;
  const MAX_ITEMS =
    PAGE_SIZE * MAX_PAGES;

  const mappings =
    window.PRASIA_MAPPINGS || {};

  const serverNames =
    mappings.servers || {};

  const classNames =
    mappings.classes || {};

  const tabs = Array.from(
    document.querySelectorAll(
      "[data-stat-mode]"
    )
  );

  const updatedAt = document.getElementById(
    "statisticsUpdatedAt"
  );

  const status = document.getElementById(
    "statisticsStatus"
  );

  const content = document.getElementById(
    "statisticsContent"
  );

  const modeLabel = document.getElementById(
    "statisticsModeLabel"
  );

  const totalCount = document.getElementById(
    "statisticsTotalCount"
  );

  const description = document.getElementById(
    "statisticsDescription"
  );

  const cardGrid = document.getElementById(
    "statisticsCardGrid"
  );

  const detailTitle = document.getElementById(
    "statisticsDetailTitle"
  );

  const detailCount = document.getElementById(
    "statisticsDetailCount"
  );

  const tableBody = document.getElementById(
    "statisticsTableBody"
  );

  const prevPageButton =
    document.getElementById(
      "statisticsPrevPage"
    );

  const nextPageButton =
    document.getElementById(
      "statisticsNextPage"
    );

  const pageInfo = document.getElementById(
    "statisticsPageInfo"
  );

  if (
    !cardGrid ||
    !tableBody ||
    !status ||
    !content
  ) {
    return;
  }

  let classRankings = [];
  let overallRankings = [];
  let classMap = {};
  let currentMode = "level";
  let currentList = [];
  let currentPage = 1;

  function setStatus(
    message,
    type = ""
  ) {
    status.textContent = message;
    status.className =
      "statistics-status";

    if (type) {
      status.classList.add(type);
    }
  }

  function toNumber(value) {
    const number = Number(value);

    return Number.isFinite(number)
      ? number
      : 0;
  }

  function formatClassName(value) {
    const raw = String(value ?? "").trim();
    const lower = raw.toLowerCase();

    return (
      classNames[raw] ||
      classMap[lower] ||
      raw ||
      "-"
    );
  }

  function formatServerName(value) {
    const raw = String(value ?? "").trim();

    return serverNames[raw] || raw || "-";
  }

  function toArray(data) {
    if (Array.isArray(data)) {
      return data;
    }

    if (Array.isArray(data?.rankings)) {
      return data.rankings;
    }

    if (Array.isArray(data?.data)) {
      return data.data;
    }

    if (Array.isArray(data?.items)) {
      return data.items;
    }

    return [];
  }

  function normalizeRanking(item) {
    const classCode =
      item.class ||
      item.class_name ||
      item.className ||
      item.ranking_class_code ||
      "-";

    return {
      name:
        item.name ||
        item.gc_name ||
        item.nickname ||
        "-",

      guild:
        item.guild ||
        item.guild_name ||
        "-",

      classCode,

      className:
        item.ranking_class_name ||
        formatClassName(classCode),

      level: toNumber(
        item.level ||
        item.character_level
      ),

      grade: toNumber(
        item.grade ||
        item.raid_level
      ),

      world:
        item.world ||
        item.server ||
        "-"
    };
  }

  async function fetchJson(url) {
    const response = await fetch(url, {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(
        "데이터를 불러오지 못했습니다."
      );
    }

    const text = await response.text();

    if (!text.trim()) {
      return null;
    }

    return JSON.parse(text);
  }

  async function loadData() {
    const classData = await fetchJson(
      CLASS_DATA_URL
    );

    classMap =
      classData?.class_map || {};

    classRankings = toArray(classData)
      .map(normalizeRanking);

    const extractedText =
      classData?.metadata
        ?.extracted_at_text ||
      classData?.metadata
        ?.extracted_at ||
      "-";

    updatedAt.textContent =
      extractedText;

    /*
     * 직업 통계는 클래스별 상위 100명 데이터가 아니라
     * 전체 랭킹 데이터를 기준으로 집계합니다.
     */
    try {
      const overallData =
        await fetchJson(
          OVERALL_DATA_URL
        );

      overallRankings =
        toArray(overallData)
          .map(normalizeRanking);
    } catch (error) {
      console.warn(
        "전체 랭킹 데이터를 불러오지 못했습니다.",
        error
      );

      overallRankings = [];
    }
  }

  function getSourceData(mode) {
    if (mode === "class") {
      return overallRankings;
    }

    return classRankings;
  }

  function getModeConfig(mode) {
    const configs = {
      level: {
        label: "레벨통계",
        description:
          "클래스별 랭킹 데이터를 기준으로 최고 레벨부터 10개 레벨을 표시합니다.",
        valueLabel: (value) =>
          `${value}레벨`
      },

      grade: {
        label: "토벌통계",
        description:
          "클래스별 랭킹 데이터를 기준으로 최고 토벌레벨부터 6개 단계를 표시합니다.",
        valueLabel: (value) =>
          `토벌 ${value}`
      },

      class: {
        label: "전체랭킹 직업 구성",
        description:
          "전체랭킹에 포함된 인원을 기준으로 직업별 인원과 비율을 표시합니다.",
        valueLabel: (value) =>
          formatClassName(value)
      }
    };

    return configs[mode] ||
      configs.level;
  }

  function getSummaryItems(mode) {
    const source = getSourceData(mode);

    if (!source.length) {
      return [];
    }

    if (mode === "level") {
      const highestLevel = Math.max(
        ...source.map(
          (item) => item.level
        )
      );

      return Array.from(
        {
          length: 10
        },
        (_, index) =>
          highestLevel - index
      ).filter(
        (value) => value >= 0
      );
    }

    if (mode === "grade") {
      const highestGrade = Math.max(
        ...source.map(
          (item) => item.grade
        )
      );

      return Array.from(
        {
          length: 6
        },
        (_, index) =>
          highestGrade - index
      ).filter(
        (value) => value >= 0
      );
    }

    const classes = new Map();

    source.forEach((item) => {
      const key =
        item.classCode ||
        item.className;

      if (!classes.has(key)) {
        classes.set(
          key,
          formatClassName(key)
        );
      }
    });

    return Array.from(
      classes.keys()
    ).sort((a, b) => {
      return formatClassName(a)
        .localeCompare(
          formatClassName(b),
          "ko"
        );
    });
  }

  function filterByValue(
    mode,
    value
  ) {
    const source = getSourceData(mode);

    if (mode === "level") {
      return source.filter(
        (item) =>
          item.level === Number(value)
      );
    }

    if (mode === "grade") {
      return source.filter(
        (item) =>
          item.grade === Number(value)
      );
    }

    return source.filter((item) => {
      return String(
        item.classCode ||
        item.className
      ) === String(value);
    });
  }

  function sortPeople(list) {
    return [...list].sort((a, b) => {
      if (b.level !== a.level) {
        return b.level - a.level;
      }

      if (b.grade !== a.grade) {
        return b.grade - a.grade;
      }

      return a.name.localeCompare(
        b.name,
        "ko"
      );
    });
  }

  function createCell(
    text,
    className = ""
  ) {
    const cell =
      document.createElement("td");

    cell.textContent =
      String(text ?? "-");

    if (className) {
      cell.className = className;
    }

    return cell;
  }

  function renderCards() {
    const config =
      getModeConfig(currentMode);

    const source =
      getSourceData(currentMode);

    const items =
      getSummaryItems(currentMode);

    const allCount = source.length;

    cardGrid.innerHTML = "";
    modeLabel.textContent =
      config.label;

    totalCount.textContent =
      `${allCount.toLocaleString()}명`;

    description.textContent =
      config.description;

    if (!allCount) {
      detailTitle.textContent =
        "대상자 목록";

      detailCount.textContent =
        "0명";

      currentList = [];
      renderTable();

      const empty =
        document.createElement("div");

      empty.className =
        "statistics-status error";

      empty.style.gridColumn =
        "1 / -1";

      empty.textContent =
        currentMode === "class"
          ? "전체랭킹 기준 직업 통계 데이터가 없습니다."
          : "표시할 통계 데이터가 없습니다.";

      cardGrid.appendChild(empty);
      return;
    }

    items.forEach(
      (value, index) => {
        const people =
          filterByValue(
            currentMode,
            value
          );

        const ratio =
          allCount
            ? (
                people.length /
                allCount
              ) * 100
            : 0;

        const card =
          document.createElement(
            "button"
          );

        card.type = "button";
        card.className =
          "statistics-card";

        card.dataset.value =
          String(value);

        if (index === 0) {
          card.classList.add(
            "active"
          );
        }

        card.innerHTML = `
          <span class="statistics-card-label">
            ${config.valueLabel(value)}
          </span>

          <span class="statistics-card-count">
            ${people.length.toLocaleString()}명
          </span>

          <span class="statistics-card-ratio">
            ${ratio.toFixed(2)}%
          </span>
        `;

        card.addEventListener(
          "click",
          () => {
            selectValue(value);
          }
        );

        cardGrid.appendChild(card);
      }
    );

    if (items.length) {
      selectValue(items[0]);
    }
  }

  function selectValue(value) {
    currentPage = 1;

    currentList = sortPeople(
      filterByValue(
        currentMode,
        value
      )
    ).slice(0, MAX_ITEMS);

    document
      .querySelectorAll(
        ".statistics-card"
      )
      .forEach((card) => {
        card.classList.toggle(
          "active",
          card.dataset.value ===
            String(value)
        );
      });

    const config =
      getModeConfig(currentMode);

    detailTitle.textContent =
      `${config.valueLabel(value)} 대상자`;

    detailCount.textContent =
      `${currentList.length.toLocaleString()}명`;

    renderTable();
  }

  function renderTable() {
    tableBody.innerHTML = "";

    const totalPages = Math.max(
      1,
      Math.min(
        MAX_PAGES,
        Math.ceil(
          currentList.length /
          PAGE_SIZE
        )
      )
    );

    if (currentPage > totalPages) {
      currentPage = totalPages;
    }

    const start =
      (currentPage - 1) *
      PAGE_SIZE;

    const pageItems =
      currentList.slice(
        start,
        start + PAGE_SIZE
      );

    if (!pageItems.length) {
      const row =
        document.createElement("tr");

      const cell =
        document.createElement("td");

      cell.colSpan = 6;
      cell.textContent =
        "해당하는 대상자가 없습니다.";

      cell.style.padding = "34px";
      cell.style.color =
        "var(--muted)";

      row.appendChild(cell);
      tableBody.appendChild(row);
    } else {
      pageItems.forEach((item) => {
        const row =
          document.createElement("tr");

        row.appendChild(
          createCell(
            item.name,
            "statistics-name"
          )
        );

        row.appendChild(
          createCell(item.guild)
        );

        row.appendChild(
          createCell(
            item.className,
            "statistics-class"
          )
        );

        row.appendChild(
          createCell(
            item.level,
            "statistics-level"
          )
        );

        row.appendChild(
          createCell(
            item.grade,
            "statistics-grade"
          )
        );

        row.appendChild(
          createCell(
            formatServerName(
              item.world
            )
          )
        );

        tableBody.appendChild(row);
      });
    }

    pageInfo.textContent =
      `${currentPage} / ${totalPages}`;

    prevPageButton.disabled =
      currentPage <= 1;

    nextPageButton.disabled =
      currentPage >= totalPages;
  }

  function changeMode(mode) {
    currentMode = mode;

    tabs.forEach((tab) => {
      const isActive =
        tab.dataset.statMode === mode;

      tab.classList.toggle(
        "active",
        isActive
      );

      tab.setAttribute(
        "aria-selected",
        String(isActive)
      );
    });

    renderCards();
  }

  tabs.forEach((tab) => {
    tab.addEventListener(
      "click",
      () => {
        changeMode(
          tab.dataset.statMode
        );
      }
    );
  });

  prevPageButton.addEventListener(
    "click",
    () => {
      if (currentPage > 1) {
        currentPage -= 1;
        renderTable();
      }
    }
  );

  nextPageButton.addEventListener(
    "click",
    () => {
      const totalPages = Math.max(
        1,
        Math.min(
          MAX_PAGES,
          Math.ceil(
            currentList.length /
            PAGE_SIZE
          )
        )
      );

      if (currentPage < totalPages) {
        currentPage += 1;
        renderTable();
      }
    }
  );

  loadData()
    .then(() => {
      if (!classRankings.length) {
        throw new Error(
          "데이터가 없습니다."
        );
      }

      status.hidden = true;
      content.hidden = false;
      changeMode("level");
    })
    .catch((error) => {
      console.error(error);

      updatedAt.textContent = "-";
      content.hidden = true;

      setStatus(
        "표시할 통계 데이터가 없습니다.",
        "error"
      );
    });
})();
