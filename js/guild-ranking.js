(() => {
  "use strict";

  const SCORE_URL = "./data/Who_are_you_guild_score.json";
  const MEMBER_URL = "./data/Who_are_you_class.json";
  const DEFAULT_PAGE_SIZE = 50;

  const CLASS_ORDER = [
    "심연추방자",
    "집행관",
    "태양감시자",
    "주문각인사",
    "환영검사",
    "야만투사",
    "향사수"
  ];

  const state = {
    rankings: [],
    members: [],
    classMap: {},
    filtered: [],
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    query: "",
    server: "all",
    activeMembers: [],
    activeFilter: null
  };

  const $ = (id) => document.getElementById(id);

  function normalize(value) {
    return String(value ?? "")
      .normalize("NFKC")
      .trim()
      .toLocaleLowerCase("en-US");
  }

  function number(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function formatNumber(value) {
    return number(value).toLocaleString("ko-KR");
  }

  function serverName(world) {
    const mappings = window.PRASIA_MAPPINGS || {};
    return mappings.servers?.[String(world)] || String(world || "-");
  }

  function className(member) {
    const code = String(
      member.ranking_class_code ||
      member.class ||
      ""
    ).trim();

    const mappings = window.PRASIA_MAPPINGS || {};
    const lower = code.toLowerCase();

    return (
      member.ranking_class_name ||
      mappings.classes?.[code] ||
      mappings.classes?.[lower] ||
      state.classMap?.[lower] ||
      code ||
      "-"
    );
  }

  function changeInfo(value, isNew = false) {
    if (isNew || value === null || value === undefined) {
      return {
        className: "new",
        text: "NEW"
      };
    }

    const amount = number(value);

    if (amount > 0) {
      return {
        className: "up",
        text: `▲ ${formatNumber(amount)}`
      };
    }

    if (amount < 0) {
      return {
        className: "down",
        text: `▼ ${formatNumber(Math.abs(amount))}`
      };
    }

    return {
      className: "same",
      text: "-"
    };
  }

  function rankingMarkup() {
    return `
      <div class="page-heading simple guild-ranking-heading">
        <div>
          <p class="eyebrow">GUILD RANKING</p>
          <h1>결사 순위</h1>
          <p class="page-description">
            결사원 레벨별 점수를 합산해 전체 서버 결사 순위를 제공합니다.
          </p>
        </div>

        <div class="guild-ranking-updated">
          <span>자료 갱신 시간</span>
          <strong id="guildRankingUpdatedAt">불러오는 중</strong>
        </div>
      </div>

      <section class="content-panel guild-ranking-panel">
        <div class="guild-ranking-toolbar">
          <label class="guild-ranking-search">
            <span>결사명 검색</span>
            <input
              id="guildRankingSearchInput"
              type="search"
              placeholder="결사명을 입력하세요"
              autocomplete="off"
              spellcheck="false"
            >
          </label>

          <label class="guild-ranking-select">
            <span>서버</span>
            <select id="guildRankingServerSelect">
              <option value="all">전체 서버</option>
            </select>
          </label>

          <label class="guild-ranking-select">
            <span>표시 개수</span>
            <select id="guildRankingPageSize">
              <option value="25">25개</option>
              <option value="50" selected>50개</option>
              <option value="100">100개</option>
              <option value="all">전체</option>
            </select>
          </label>
        </div>

        <div class="guild-ranking-guide">
          <span class="guild-ranking-legend up">▲ 상승</span>
          <span class="guild-ranking-legend down">▼ 하락</span>
          <span class="guild-ranking-legend new">NEW 신규</span>
          <span class="guild-ranking-legend same">- 변동 없음</span>
          <small>주식시장 색상 기준: 상승은 붉은색, 하락은 파란색입니다.</small>
        </div>

        <div
          class="guild-ranking-status"
          id="guildRankingStatus"
          role="status"
        >
          결사 순위 데이터를 불러오는 중입니다.
        </div>

        <div id="guildRankingContent" hidden>
          <div class="guild-ranking-summary">
            <div>
              <span>검색 결과</span>
              <strong id="guildRankingCount">0개</strong>
            </div>
            <p>
              결사명을 누르면 직업 구성, 토벌 등급, 레벨 분포와
              소속 결사원을 확인할 수 있습니다.
            </p>
          </div>

          <div class="guild-ranking-table-scroll">
            <table class="guild-ranking-table">
              <thead>
                <tr>
                  <th>순위</th>
                  <th>결사명</th>
                  <th>결사장</th>
                  <th>인원</th>
                  <th>서버명</th>
                  <th>총점</th>
                  <th>점수 변동폭</th>
                  <th>순위 변동</th>
                </tr>
              </thead>
              <tbody id="guildRankingBody"></tbody>
            </table>
          </div>

          <div class="guild-ranking-pagination" id="guildRankingPagination">
            <button id="guildRankingPrev" type="button">◀ 이전</button>
            <span id="guildRankingPageInfo">1 / 1</span>
            <button id="guildRankingNext" type="button">다음 ▶</button>
          </div>
        </div>
      </section>
    `;
  }

  function modalMarkup() {
    return `
      <div
        class="guild-member-modal guild-ranking-member-modal"
        id="guildRankingMemberModal"
        aria-hidden="true"
      >
        <div
          class="guild-member-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="guildRankingMemberTitle"
        >
          <div class="guild-member-header">
            <div>
              <span class="modal-kicker">GUILD RANKING MEMBERS</span>
              <strong id="guildRankingMemberTitle">결사 멤버</strong>
              <p id="guildRankingMemberSub"></p>
            </div>

            <button
              class="guild-member-close"
              id="guildRankingMemberClose"
              type="button"
              aria-label="닫기"
            >
              ✕
            </button>
          </div>

          <div class="guild-member-body">
            <section
              class="guild-popup-statistics"
              id="guildRankingPopupStatistics"
              hidden
            >
              <div class="guild-stat-overview">
                <section class="guild-stat-card">
                  <div class="guild-stat-card-heading">
                    <div>
                      <span>CLASS</span>
                      <h3>직업 구성</h3>
                    </div>
                    <strong id="guildRankingClassTotal">0명</strong>
                  </div>
                  <div
                    class="guild-stat-list"
                    id="guildRankingClassStats"
                  ></div>
                </section>

                <section class="guild-stat-card">
                  <div class="guild-stat-card-heading">
                    <div>
                      <span>RAID</span>
                      <h3>토벌 등급</h3>
                    </div>
                    <strong id="guildRankingGradeTotal">0명</strong>
                  </div>
                  <div
                    class="guild-stat-list"
                    id="guildRankingGradeStats"
                  ></div>
                </section>

                <section class="guild-stat-card">
                  <div class="guild-stat-card-heading">
                    <div>
                      <span>LEVEL</span>
                      <h3>레벨 분포</h3>
                    </div>
                    <strong id="guildRankingLevelTotal">0명</strong>
                  </div>
                  <div
                    class="guild-stat-list"
                    id="guildRankingLevelStats"
                  ></div>
                </section>
              </div>

              <div class="guild-stat-filter-bar">
                <span id="guildRankingFilterLabel">
                  전체 결사원 · 0명
                </span>
                <button
                  class="guild-stat-reset"
                  id="guildRankingFilterReset"
                  type="button"
                >
                  필터 해제
                </button>
              </div>
            </section>

            <div
              class="guild-member-message"
              id="guildRankingMemberMessage"
            ></div>

            <div
              class="guild-member-table-scroll"
              id="guildRankingMemberTableWrap"
              hidden
            >
              <table class="guild-member-table">
                <thead>
                  <tr>
                    <th>닉네임</th>
                    <th>토벌레벨</th>
                    <th>직업</th>
                    <th>레벨</th>
                  </tr>
                </thead>
                <tbody id="guildRankingMemberBody"></tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  async function fetchJson(url) {
    const response = await fetch(`${url}?ts=${Date.now()}`, {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return response.json();
  }

  function setStatus(message, type = "") {
    const target = $("guildRankingStatus");
    target.textContent = message;
    target.className = "guild-ranking-status";

    if (type) {
      target.classList.add(type);
    }
  }

  function buildServerOptions() {
    const select = $("guildRankingServerSelect");
    const worlds = [...new Set(
      state.rankings
        .map((item) => String(item.world || ""))
        .filter(Boolean)
    )].sort((a, b) => a.localeCompare(b, "ko", { numeric: true }));

    worlds.forEach((world) => {
      const option = document.createElement("option");
      option.value = world;
      option.textContent = serverName(world);
      select.appendChild(option);
    });
  }

  function applyFilters() {
    const query = normalize(state.query);

    state.filtered = state.rankings.filter((item) => {
      const matchesQuery =
        !query ||
        normalize(item.guild_name).includes(query) ||
        normalize(item.guild_master).includes(query);

      const matchesServer =
        state.server === "all" ||
        String(item.world) === state.server;

      return matchesQuery && matchesServer;
    });

    state.page = 1;
    renderTable();
  }

  function renderTable() {
    const body = $("guildRankingBody");
    const total = state.filtered.length;
    const size =
      state.pageSize === "all"
        ? Math.max(total, 1)
        : number(state.pageSize) || DEFAULT_PAGE_SIZE;

    const totalPages = Math.max(1, Math.ceil(total / size));
    state.page = Math.min(state.page, totalPages);

    const start = (state.page - 1) * size;
    const visible = state.filtered.slice(start, start + size);

    body.innerHTML = "";

    if (!visible.length) {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td colspan="8" class="guild-ranking-empty">
          조건에 맞는 결사가 없습니다.
        </td>
      `;
      body.appendChild(row);
    }

    visible.forEach((item) => {
      const scoreChange = changeInfo(
        item.score_change,
        Boolean(item.is_new)
      );

      const rankChange = changeInfo(
        item.rank_change,
        Boolean(item.is_new)
      );

      const row = document.createElement("tr");

      if (number(item.rank) <= 3) {
        row.classList.add(`top-${number(item.rank)}`);
      }

      row.innerHTML = `
        <td class="guild-ranking-rank">
          ${formatNumber(item.rank)}
        </td>
        <td>
          <button
            class="guild-ranking-name"
            type="button"
          >
            ${escapeHtml(item.guild_name || "-")}
          </button>
        </td>
        <td>${escapeHtml(item.guild_master || "-")}</td>
        <td>
          <strong>${formatNumber(item.guild_member_count)}명</strong>
          <small>반영 ${formatNumber(item.ranked_member_count)}명</small>
        </td>
        <td>${escapeHtml(serverName(item.world))}</td>
        <td class="guild-ranking-score">
          ${formatNumber(item.score)}
        </td>
        <td>
          <span class="guild-ranking-change ${scoreChange.className}">
            ${scoreChange.text}
          </span>
        </td>
        <td>
          <span class="guild-ranking-change ${rankChange.className}">
            ${rankChange.text}
          </span>
        </td>
      `;

      row
        .querySelector(".guild-ranking-name")
        .addEventListener("click", () => {
          openMemberModal(item);
        });

      body.appendChild(row);
    });

    $("guildRankingCount").textContent = `${formatNumber(total)}개`;
    $("guildRankingPageInfo").textContent =
      `${state.page} / ${totalPages}`;

    $("guildRankingPrev").disabled = state.page <= 1;
    $("guildRankingNext").disabled = state.page >= totalPages;

    $("guildRankingPagination").hidden =
      state.pageSize === "all" || totalPages <= 1;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function uniqueGuildMembers(guild) {
    const targetWorld = normalize(guild.world);
    const targetGuild = normalize(guild.guild_name);
    const unique = new Map();

    state.members.forEach((member) => {
      if (
        normalize(member.world) !== targetWorld ||
        normalize(member.guild) !== targetGuild
      ) {
        return;
      }

      const key = `${targetWorld}|${normalize(member.name)}`;

      if (!unique.has(key)) {
        unique.set(key, {
          nickname: member.name || "-",
          grade: number(member.grade),
          className: className(member),
          level: number(member.level)
        });
      }
    });

    return [...unique.values()].sort((a, b) => {
      if (b.level !== a.level) {
        return b.level - a.level;
      }

      if (b.grade !== a.grade) {
        return b.grade - a.grade;
      }

      return a.nickname.localeCompare(b.nickname, "ko");
    });
  }

  function countBy(items, getter) {
    const result = new Map();

    items.forEach((item) => {
      const key = String(getter(item));
      result.set(key, (result.get(key) || 0) + 1);
    });

    return result;
  }

  function classStats() {
    const counts = countBy(
      state.activeMembers,
      (member) => member.className
    );

    return CLASS_ORDER.map((name) => ({
      key: name,
      label: name,
      count: counts.get(name) || 0
    }));
  }

  function numericStats(mode) {
    const getter =
      mode === "grade"
        ? (member) => member.grade
        : (member) => member.level;

    const counts = countBy(state.activeMembers, getter);

    const sorted = [...counts.entries()]
      .map(([key, count]) => ({
        key,
        count
      }))
      .sort((a, b) => number(b.key) - number(a.key));

    const visible = sorted.slice(0, 6);
    const remaining = sorted.slice(6);

    const result = visible.map((item) => ({
      key: item.key,
      label:
        mode === "grade"
          ? `토벌 ${item.key}`
          : `Lv.${item.key}`,
      count: item.count
    }));

    if (remaining.length) {
      result.push({
        key: "__other__",
        label: "기타",
        count: remaining.reduce(
          (sum, item) => sum + item.count,
          0
        ),
        values: remaining.map((item) => String(item.key))
      });
    }

    return result;
  }

  function matchesFilter(member, mode, item) {
    if (mode === "class") {
      return member.className === item.key;
    }

    const value =
      mode === "grade"
        ? String(member.grade)
        : String(member.level);

    if (item.key === "__other__") {
      return item.values.includes(value);
    }

    return value === String(item.key);
  }

  function renderStatList(targetId, items, mode) {
    const target = $(targetId);
    target.innerHTML = "";

    const maximum = Math.max(
      1,
      ...items.map((item) => item.count)
    );

    items.forEach((item) => {
      const ratio = state.activeMembers.length
        ? (item.count / state.activeMembers.length) * 100
        : 0;

      const width = (item.count / maximum) * 100;
      const button = document.createElement("button");

      button.type = "button";
      button.className = "guild-stat-item";
      button.dataset.mode = mode;
      button.dataset.key = String(item.key);

      if (!item.count) {
        button.classList.add("zero");
        button.disabled = true;
      }

      button.innerHTML = `
        <span class="guild-stat-item-top">
          <span class="guild-stat-item-label">
            ${escapeHtml(item.label)}
          </span>
          <span class="guild-stat-item-numbers">
            <strong>${item.count}명</strong>
            <small>${ratio.toFixed(1)}%</small>
          </span>
        </span>
        <span class="guild-stat-line">
          <span
            class="guild-stat-line-fill"
            style="width: ${item.count ? width.toFixed(2) : 0}%;"
          ></span>
        </span>
      `;

      if (item.count) {
        button.addEventListener("click", () => {
          state.activeFilter = {
            mode,
            item
          };

          document
            .querySelectorAll(
              "#guildRankingMemberModal .guild-stat-item"
            )
            .forEach((targetButton) => {
              targetButton.classList.toggle(
                "active",
                targetButton === button
              );
            });

          updateMemberFilter();
        });
      }

      target.appendChild(button);
    });
  }

  function updateMemberFilter() {
    const members = state.activeFilter
      ? state.activeMembers.filter((member) => {
          return matchesFilter(
            member,
            state.activeFilter.mode,
            state.activeFilter.item
          );
        })
      : state.activeMembers;

    $("guildRankingFilterLabel").textContent =
      state.activeFilter
        ? `현재 필터: ${state.activeFilter.item.label} · ${members.length}명`
        : `전체 결사원 · ${members.length}명`;

    $("guildRankingFilterReset").disabled =
      !state.activeFilter;

    renderMemberRows(members);
  }

  function renderMemberRows(members) {
    const body = $("guildRankingMemberBody");
    body.innerHTML = "";

    if (!members.length) {
      body.innerHTML = `
        <tr>
          <td colspan="4" class="guild-ranking-empty">
            해당 조건의 결사원이 없습니다.
          </td>
        </tr>
      `;
      return;
    }

    members.forEach((member) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${escapeHtml(member.nickname)}</td>
        <td class="guild-member-raid">${formatNumber(member.grade)}</td>
        <td class="guild-member-job">${escapeHtml(member.className)}</td>
        <td>${formatNumber(member.level)}</td>
      `;
      body.appendChild(row);
    });
  }

  function renderAllStats() {
    const total = state.activeMembers.length;

    $("guildRankingClassTotal").textContent = `${total}명`;
    $("guildRankingGradeTotal").textContent = `${total}명`;
    $("guildRankingLevelTotal").textContent = `${total}명`;

    renderStatList(
      "guildRankingClassStats",
      classStats(),
      "class"
    );

    renderStatList(
      "guildRankingGradeStats",
      numericStats("grade"),
      "grade"
    );

    renderStatList(
      "guildRankingLevelStats",
      numericStats("level"),
      "level"
    );

    updateMemberFilter();
  }

  function openMemberModal(guild) {
    const modal = $("guildRankingMemberModal");
    const members = uniqueGuildMembers(guild);
    const worldLabel = serverName(guild.world);

    $("guildRankingMemberTitle").textContent =
      guild.guild_name || "결사 멤버";

    $("guildRankingMemberSub").textContent =
      `${worldLabel} · 랭킹에 존재하는 멤버 ${members.length}명`;

    state.activeMembers = members;
    state.activeFilter = null;

    $("guildRankingMemberMessage").hidden = Boolean(members.length);
    $("guildRankingMemberMessage").textContent =
      members.length
        ? ""
        : "랭킹 데이터에서 해당 결사 소속 멤버를 찾지 못했습니다.";

    $("guildRankingPopupStatistics").hidden = !members.length;
    $("guildRankingMemberTableWrap").hidden = !members.length;

    if (members.length) {
      renderAllStats();
    }

    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function closeMemberModal() {
    const modal = $("guildRankingMemberModal");
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  function bindEvents() {
    $("guildRankingSearchInput").addEventListener("input", (event) => {
      state.query = event.target.value;
      applyFilters();
    });

    $("guildRankingServerSelect").addEventListener("change", (event) => {
      state.server = event.target.value;
      applyFilters();
    });

    $("guildRankingPageSize").addEventListener("change", (event) => {
      state.pageSize = event.target.value;
      state.page = 1;
      renderTable();
    });

    $("guildRankingPrev").addEventListener("click", () => {
      if (state.page > 1) {
        state.page -= 1;
        renderTable();
      }
    });

    $("guildRankingNext").addEventListener("click", () => {
      state.page += 1;
      renderTable();
    });

    $("guildRankingMemberClose").addEventListener(
      "click",
      closeMemberModal
    );

    $("guildRankingMemberModal").addEventListener(
      "click",
      (event) => {
        if (event.target === $("guildRankingMemberModal")) {
          closeMemberModal();
        }
      }
    );

    $("guildRankingFilterReset").addEventListener(
      "click",
      () => {
        state.activeFilter = null;

        document
          .querySelectorAll(
            "#guildRankingMemberModal .guild-stat-item.active"
          )
          .forEach((item) => {
            item.classList.remove("active");
          });

        updateMemberFilter();
      }
    );

    document.addEventListener("keydown", (event) => {
      if (
        event.key === "Escape" &&
        $("guildRankingMemberModal")?.classList.contains("open")
      ) {
        closeMemberModal();
      }
    });
  }

  async function initialize() {
    const page = $("guild-ranking");

    if (!page) {
      return;
    }

    page.innerHTML = rankingMarkup();
    document.body.insertAdjacentHTML("beforeend", modalMarkup());
    bindEvents();

    try {
      const [scoreDocument, memberDocument] = await Promise.all([
        fetchJson(SCORE_URL),
        fetchJson(MEMBER_URL)
      ]);

      state.rankings = Array.isArray(scoreDocument?.rankings)
        ? scoreDocument.rankings
        : [];

      state.members = Array.isArray(memberDocument?.rankings)
        ? memberDocument.rankings
        : [];

      state.classMap = memberDocument?.class_map || {};
      state.filtered = [...state.rankings];

      $("guildRankingUpdatedAt").textContent =
        scoreDocument?.metadata?.extracted_at_text ||
        scoreDocument?.metadata?.extracted_at ||
        "-";

      if (!state.rankings.length) {
        setStatus(
          "표시할 결사 순위 데이터가 없습니다. 먼저 전체 데이터 갱신을 실행해주세요.",
          "error"
        );
        return;
      }

      buildServerOptions();
      renderTable();

      $("guildRankingContent").hidden = false;
      setStatus(
        `전체 ${formatNumber(state.rankings.length)}개 결사 순위를 불러왔습니다.`,
        "success"
      );
    } catch (error) {
      console.error("결사 순위 로드 오류", error);

      setStatus(
        "결사 순위 데이터를 불러오지 못했습니다. Who_are_you_guild_score.json 생성 여부를 확인해주세요.",
        "error"
      );
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize);
  } else {
    initialize();
  }
})();
