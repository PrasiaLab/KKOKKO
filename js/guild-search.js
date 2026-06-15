(() => {
  "use strict";

  const GUILD_DATA_URL =
    "./data/Who_are_you_guild.json";

  /*
   * 결사 자체 조회는 길드 랭킹 데이터,
   * 보기 팝업의 멤버는 클래스별 랭킹 데이터를 참조합니다.
   */
  const MEMBER_DATA_URL =
    "./data/Who_are_you_class.json";

  const mappings =
    window.PRASIA_MAPPINGS || {};

  const serverNames =
    mappings.servers || {};

  const classNames =
    mappings.classes || {};

  const form = document.getElementById(
    "guildSearchForm"
  );

  const input = document.getElementById(
    "guildSearchInput"
  );

  const button = document.getElementById(
    "guildSearchButton"
  );

  const status = document.getElementById(
    "guildSearchStatus"
  );

  const resultWrap = document.getElementById(
    "guildResultWrap"
  );

  const resultCount = document.getElementById(
    "guildResultCount"
  );

  const resultBody = document.getElementById(
    "guildResultBody"
  );

  const memberModal = document.getElementById(
    "guildMemberModal"
  );

  const memberModalTitle = document.getElementById(
    "guildMemberModalTitle"
  );

  const memberModalSub = document.getElementById(
    "guildMemberModalSub"
  );

  const memberMessage = document.getElementById(
    "guildMemberMessage"
  );

  const memberTableWrap = document.getElementById(
    "guildMemberTableWrap"
  );

  const memberBody = document.getElementById(
    "guildMemberBody"
  );

  const memberClose = document.getElementById(
    "guildMemberModalClose"
  );

  if (
    !form ||
    !input ||
    !resultBody ||
    !memberModal
  ) {
    return;
  }

  let guildData = null;
  let memberRankings = null;
  let memberClassMap = {};

  function normalizeText(value) {
    return String(value ?? "")
      .normalize("NFKC")
      .trim()
      .toLocaleLowerCase("en-US");
  }

  function getFirst(
    source,
    keys,
    fallback = ""
  ) {
    if (
      !source ||
      typeof source !== "object"
    ) {
      return fallback;
    }

    for (const key of keys) {
      const value = source[key];

      if (
        value !== undefined &&
        value !== null &&
        value !== ""
      ) {
        return value;
      }
    }

    return fallback;
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

    return response.json();
  }

  async function loadGuildData() {
    if (guildData) {
      return;
    }

    const data = await fetchJson(
      GUILD_DATA_URL
    );

    guildData = Array.isArray(data)
      ? data
      : [];
  }

  async function loadMemberData() {
    if (memberRankings) {
      return;
    }

    const data = await fetchJson(
      MEMBER_DATA_URL
    );

    memberRankings = Array.isArray(
      data?.rankings
    )
      ? data.rankings
      : [];

    memberClassMap =
      data?.class_map || {};
  }

  function getGuildName(item) {
    return getFirst(item, [
      "guild_name",
      "guildName",
      "guild"
    ]);
  }

  function getGuildWorld(item) {
    return getFirst(item, [
      "world",
      "server",
      "world_id",
      "worldId"
    ]);
  }

  function formatServerName(value) {
    const raw = String(value ?? "").trim();

    return serverNames[raw] || raw || "-";
  }

  function formatClassName(item) {
    const code = String(
      item.class ||
      item.ranking_class_code ||
      ""
    ).trim();

    const lower = code.toLowerCase();

    return (
      item.ranking_class_name ||
      classNames[code] ||
      memberClassMap[lower] ||
      code ||
      "-"
    );
  }

  function findRankedMembers(guild) {
    const targetWorld = normalizeText(
      getGuildWorld(guild)
    );

    const targetGuild = normalizeText(
      getGuildName(guild)
    );

    const unique = new Map();

    memberRankings.forEach((member) => {
      const sameWorld =
        normalizeText(member.world) ===
        targetWorld;

      const sameGuild =
        normalizeText(member.guild) ===
        targetGuild;

      if (!sameWorld || !sameGuild) {
        return;
      }

      const uniqueKey = [
        normalizeText(member.world),
        normalizeText(member.name)
      ].join("|");

      if (!unique.has(uniqueKey)) {
        unique.set(uniqueKey, {
          nickname: member.name || "-",
          grade: Number(member.grade) || 0,
          className: formatClassName(member),
          level: Number(member.level) || 0
        });
      }
    });

    return Array.from(unique.values())
      .sort((a, b) => {
        if (b.level !== a.level) {
          return b.level - a.level;
        }

        if (b.grade !== a.grade) {
          return b.grade - a.grade;
        }

        return a.nickname.localeCompare(
          b.nickname,
          "ko"
        );
      });
  }

  function setStatus(
    message,
    type = ""
  ) {
    status.textContent = message;
    status.className =
      "guild-search-status";

    if (type) {
      status.classList.add(type);
    }
  }

  function clearResults() {
    resultBody.innerHTML = "";
    resultWrap.hidden = true;
    resultCount.textContent = "0개";
  }

  function createCell(
    text,
    className = ""
  ) {
    const cell = document.createElement("td");

    cell.textContent = String(text ?? "-");

    if (className) {
      cell.className = className;
    }

    return cell;
  }

  function renderResults(guilds) {
    resultBody.innerHTML = "";

    guilds.forEach((guild) => {
      const row = document.createElement("tr");

      const memberCount = getFirst(
        guild,
        [
          "guild_member_count",
          "guildMemberCount"
        ],
        0
      );

      const maxMemberCount = getFirst(
        guild,
        [
          "max_guild_member_count",
          "maxGuildMemberCount"
        ],
        "-"
      );

      row.appendChild(
        createCell(
          formatServerName(
            getGuildWorld(guild)
          )
        )
      );

      row.appendChild(
        createCell(
          getGuildName(guild),
          "guild-name-cell"
        )
      );

      row.appendChild(
        createCell(
          getFirst(
            guild,
            [
              "guild_master",
              "guildMaster"
            ],
            "-"
          )
        )
      );

      row.appendChild(
        createCell(
          `${memberCount} / ${maxMemberCount}`,
          "guild-member-count"
        )
      );

      row.appendChild(
        createCell(
          getFirst(
            guild,
            [
              "guild_level",
              "guildLevel"
            ],
            "-"
          )
        )
      );

      const actionCell =
        document.createElement("td");

      const viewButton =
        document.createElement("button");

      viewButton.type = "button";
      viewButton.className =
        "guild-view-button";
      viewButton.textContent = "보기";

      viewButton.addEventListener(
        "click",
        () => {
          openMemberModal(guild);
        }
      );

      actionCell.appendChild(viewButton);
      row.appendChild(actionCell);
      resultBody.appendChild(row);
    });

    resultCount.textContent =
      `${guilds.length}개`;

    resultWrap.hidden = false;
  }

  async function openMemberModal(guild) {
    const guildName = getGuildName(guild);
    const serverName = formatServerName(
      getGuildWorld(guild)
    );

    memberModalTitle.textContent =
      guildName || "결사 멤버";

    memberModalSub.textContent =
      `${serverName} · 멤버 데이터를 불러오는 중`;

    memberBody.innerHTML = "";
    memberTableWrap.hidden = true;
    memberMessage.hidden = false;
    memberMessage.textContent =
      "멤버 정보를 불러오는 중입니다.";

    memberModal.classList.add("open");
    memberModal.setAttribute(
      "aria-hidden",
      "false"
    );

    document.body.style.overflow = "hidden";

    try {
      await loadMemberData();

      const members =
        findRankedMembers(guild);

      memberModalSub.textContent =
        `${serverName} · 랭킹에 존재하는 멤버 ${members.length}명`;

      memberBody.innerHTML = "";

      if (!members.length) {
        memberMessage.hidden = false;
        memberMessage.textContent =
          "랭킹 데이터에서 해당 결사 소속 멤버를 찾지 못했습니다.";

        memberTableWrap.hidden = true;
        return;
      }

      memberMessage.hidden = true;
      memberTableWrap.hidden = false;

      members.forEach((member) => {
        const row =
          document.createElement("tr");

        row.appendChild(
          createCell(member.nickname)
        );

        row.appendChild(
          createCell(
            member.grade,
            "guild-member-raid"
          )
        );

        row.appendChild(
          createCell(
            member.className,
            "guild-member-job"
          )
        );

        row.appendChild(
          createCell(member.level)
        );

        memberBody.appendChild(row);
      });
    } catch (error) {
      console.error(error);

      memberModalSub.textContent =
        `${serverName} · 멤버 정보`;

      memberMessage.hidden = false;
      memberMessage.textContent =
        "멤버 정보를 불러오지 못했습니다.";

      memberTableWrap.hidden = true;
    }
  }

  function closeMemberModal() {
    memberModal.classList.remove("open");
    memberModal.setAttribute(
      "aria-hidden",
      "true"
    );

    document.body.style.overflow = "";
  }

  async function searchGuilds() {
    const keyword = normalizeText(
      input.value
    );

    clearResults();

    if (!keyword) {
      setStatus(
        "조회할 결사명을 입력해주세요.",
        "error"
      );

      input.focus();
      return;
    }

    button.disabled = true;
    button.textContent = "조회 중";

    setStatus(
      "결사 데이터를 불러오는 중입니다."
    );

    try {
      await loadGuildData();

      if (!guildData.length) {
        setStatus(
          "표시할 결사 데이터가 없습니다.",
          "error"
        );

        return;
      }

      const matches = guildData.filter(
        (guild) => {
          return (
            normalizeText(
              getGuildName(guild)
            ) === keyword
          );
        }
      );

      if (!matches.length) {
        setStatus(
          `‘${input.value.trim()}’와 일치하는 결사를 찾지 못했습니다.`,
          "error"
        );

        return;
      }

      matches.sort((a, b) => {
        const worldCompare = String(
          getGuildWorld(a)
        ).localeCompare(
          String(getGuildWorld(b)),
          "ko",
          {
            numeric: true
          }
        );

        if (worldCompare !== 0) {
          return worldCompare;
        }

        return (
          Number(
            getFirst(
              b,
              [
                "guild_level",
                "guildLevel"
              ],
              0
            )
          ) -
          Number(
            getFirst(
              a,
              [
                "guild_level",
                "guildLevel"
              ],
              0
            )
          )
        );
      });

      renderResults(matches);

      setStatus(
        `‘${input.value.trim()}’와 일치하는 결사를 조회했습니다.`,
        "success"
      );
    } catch (error) {
      console.error(error);

      setStatus(
        "결사 데이터를 불러오지 못했습니다.",
        "error"
      );
    } finally {
      button.disabled = false;
      button.textContent = "조회";
    }
  }

  form.addEventListener(
    "submit",
    (event) => {
      event.preventDefault();
      searchGuilds();
    }
  );

  memberClose.addEventListener(
    "click",
    closeMemberModal
  );

  memberModal.addEventListener(
    "click",
    (event) => {
      if (event.target === memberModal) {
        closeMemberModal();
      }
    }
  );

  document.addEventListener(
    "keydown",
    (event) => {
      if (
        event.key === "Escape" &&
        memberModal.classList.contains("open")
      ) {
        closeMemberModal();
      }
    }
  );
})();
