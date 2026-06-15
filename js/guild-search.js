(() => {
  "use strict";

  const GUILD_DATA_URL = "./data/Who_are_you_guild.json";
  const CHARACTER_DATA_URL = "./data/Who_are_you.json";

  const SERVER_NAMES = window.PRASIA_MAPPINGS?.servers || {};
  const CLASS_NAMES = window.PRASIA_MAPPINGS?.classes || {};

  const form = document.getElementById("guildSearchForm");
  const input = document.getElementById("guildSearchInput");
  const button = document.getElementById("guildSearchButton");
  const status = document.getElementById("guildSearchStatus");
  const resultWrap = document.getElementById("guildResultWrap");
  const resultCount = document.getElementById("guildResultCount");
  const resultBody = document.getElementById("guildResultBody");

  const memberModal = document.getElementById("guildMemberModal");
  const memberModalTitle = document.getElementById("guildMemberModalTitle");
  const memberModalSub = document.getElementById("guildMemberModalSub");
  const memberMessage = document.getElementById("guildMemberMessage");
  const memberTableWrap = document.getElementById("guildMemberTableWrap");
  const memberBody = document.getElementById("guildMemberBody");
  const memberClose = document.getElementById("guildMemberModalClose");

  if (!form || !input || !resultBody || !memberModal) {
    return;
  }

  let guildData = null;
  let characterData = null;

  function normalizeText(value) {
    return String(value ?? "")
      .normalize("NFKC")
      .trim()
      .toLocaleLowerCase("en-US");
  }

  function getFirst(source, keys, fallback = "") {
    if (!source || typeof source !== "object") {
      return fallback;
    }

    for (const key of keys) {
      const value = source[key];

      if (value !== undefined && value !== null && value !== "") {
        return value;
      }
    }

    return fallback;
  }

  function toArray(value) {
    if (Array.isArray(value)) {
      return value;
    }

    if (value && Array.isArray(value.data)) {
      return value.data;
    }

    if (value && Array.isArray(value.items)) {
      return value.items;
    }

    if (value && Array.isArray(value.list)) {
      return value.list;
    }

    return [];
  }

  async function fetchJson(url) {
    const response = await fetch(url, {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`${url} 불러오기 실패 (${response.status})`);
    }

    const text = await response.text();

    if (!text.trim()) {
      return [];
    }

    return JSON.parse(text);
  }

  async function loadData() {
    if (guildData && characterData) {
      return;
    }

    const [guildJson, characterJson] = await Promise.all([
      fetchJson(GUILD_DATA_URL),
      fetchJson(CHARACTER_DATA_URL)
    ]);

    guildData = toArray(guildJson);
    characterData = toArray(characterJson);
  }

  function getGuildName(item) {
    return getFirst(item, [
      "guild_name",
      "guildName",
      "guild",
      "guild_nm",
      "clan_name",
      "clanName"
    ]);
  }

  function getGuildWorld(item) {
    return getFirst(item, [
      "world",
      "server",
      "server_name",
      "serverName",
      "world_name",
      "worldName",
      "world_id",
      "worldId"
    ]);
  }

  function getCharacterWorld(item) {
    return getFirst(item, [
      "world",
      "server",
      "server_name",
      "serverName",
      "world_name",
      "worldName",
      "world_id",
      "worldId"
    ]);
  }

  /*
   * JSON의 world 값이 "2-1"처럼 들어오면
   * 공통 서버 매핑을 사용해 "론도01"로 출력합니다.
   */
  function displayServerName(worldValue) {
    const worldCode = String(worldValue ?? "").trim();

    if (!worldCode) {
      return "알 수 없음";
    }

    return SERVER_NAMES[worldCode] || worldCode;
  }

  function sameWorld(guild, character) {
    const guildWorld = normalizeText(getGuildWorld(guild));
    const characterWorld = normalizeText(getCharacterWorld(character));

    if (!guildWorld || !characterWorld) {
      return true;
    }

    return guildWorld === characterWorld;
  }

  function findRankedMembers(guild) {
    const targetGuild = normalizeText(getGuildName(guild));

    return characterData
      .filter((character) => {
        const characterGuild = normalizeText(getGuildName(character));

        return characterGuild === targetGuild && sameWorld(guild, character);
      })
      .map((character) => {
        return {
          nickname: getFirst(
            character,
            [
              "gc_name",
              "gcName",
              "character_name",
              "characterName",
              "nickname",
              "name"
            ],
            "알 수 없음"
          ),

          raidLevel: getFirst(
            character,
            [
              "raid_level",
              "raidLevel",
              "grade",
              "subjugation_level",
              "subjugationLevel",
              "boss_level",
              "bossLevel"
            ],
            "-"
          ),

          className: getFirst(
            character,
            [
              "class_name",
              "className",
              "class",
              "job",
              "job_name",
              "jobName"
            ],
            "-"
          ),

          level: getFirst(
            character,
            [
              "level",
              "character_level",
              "characterLevel",
              "lv"
            ],
            "-"
          )
        };
      })
      .sort((a, b) => {
        const raidDifference =
          Number(b.raidLevel || 0) - Number(a.raidLevel || 0);

        if (raidDifference !== 0) {
          return raidDifference;
        }

        return Number(b.level || 0) - Number(a.level || 0);
      });
  }

  function formatClassName(value) {
    const classCode = String(value ?? "").trim();

    if (!classCode) {
      return "-";
    }

    return CLASS_NAMES[classCode] || classCode;
  }

  function setStatus(message, type = "") {
    status.textContent = message;
    status.className = "guild-search-status";

    if (type) {
      status.classList.add(type);
    }
  }

  function clearResults() {
    resultBody.innerHTML = "";
    resultWrap.hidden = true;
    resultCount.textContent = "0개";
  }

  function createCell(text, className = "") {
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
          "guildMemberCount",
          "member_count",
          "memberCount"
        ],
        0
      );

      const maxMemberCount = getFirst(
        guild,
        [
          "max_guild_member_count",
          "maxGuildMemberCount",
          "max_member_count",
          "maxMemberCount"
        ],
        "-"
      );

      row.appendChild(
        createCell(displayServerName(getGuildWorld(guild)))
      );

      row.appendChild(
        createCell(getGuildName(guild), "guild-name-cell")
      );

      row.appendChild(
        createCell(
          getFirst(
            guild,
            [
              "guild_master",
              "guildMaster",
              "master_name",
              "masterName",
              "leader_name",
              "leaderName"
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
              "guildLevel",
              "level"
            ],
            "-"
          )
        )
      );

      const actionCell = document.createElement("td");
      const viewButton = document.createElement("button");

      viewButton.type = "button";
      viewButton.className = "guild-view-button";
      viewButton.textContent = "보기";

      viewButton.addEventListener("click", () => {
        openMemberModal(guild);
      });

      actionCell.appendChild(viewButton);
      row.appendChild(actionCell);
      resultBody.appendChild(row);
    });

    resultCount.textContent = `${guilds.length}개`;
    resultWrap.hidden = false;
  }

  function openMemberModal(guild) {
    const members = findRankedMembers(guild);
    const guildName = getGuildName(guild);
    const serverName = displayServerName(getGuildWorld(guild));

    memberModalTitle.textContent = guildName || "결사 멤버";
    memberModalSub.textContent =
      `${serverName} · 랭킹 데이터에 존재하는 멤버 ${members.length}명`;

    memberBody.innerHTML = "";

    if (!members.length) {
      memberMessage.hidden = false;
      memberMessage.textContent =
        "랭킹 데이터에서 해당 결사 소속 멤버를 찾지 못했습니다. " +
        "홈페이지 랭킹 기반으로 해당 멤버가 개인 랭킹에 포함되지 않았을 수 있습니다.";

      memberTableWrap.hidden = true;
    } else {
      memberMessage.hidden = true;
      memberTableWrap.hidden = false;

      members.forEach((member) => {
        const row = document.createElement("tr");

        row.appendChild(
          createCell(member.nickname)
        );

        row.appendChild(
          createCell(member.raidLevel, "guild-member-raid")
        );

        row.appendChild(
          createCell(
            formatClassName(member.className),
            "guild-member-job"
          )
        );

        row.appendChild(
          createCell(member.level)
        );

        memberBody.appendChild(row);
      });
    }

    memberModal.classList.add("open");
    memberModal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function closeMemberModal() {
    memberModal.classList.remove("open");
    memberModal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  async function searchGuilds() {
    const keyword = normalizeText(input.value);

    clearResults();

    if (!keyword) {
      setStatus("조회할 결사명을 입력해주세요.", "error");
      input.focus();
      return;
    }

    button.disabled = true;
    button.textContent = "조회 중";
    setStatus("결사 데이터를 불러오는 중입니다.");

    try {
      await loadData();

      if (!guildData.length) {
        setStatus(
          "조회할 결사 데이터가 없습니다.",
          "error"
        );
        return;
      }

      const matches = guildData.filter((guild) => {
        return normalizeText(getGuildName(guild)) === keyword;
      });

      if (!matches.length) {
        setStatus(
          `‘${input.value.trim()}’와 일치하는 결사를 찾지 못했습니다.`,
          "error"
        );
        return;
      }

      matches.sort((a, b) => {
        const worldCompare = String(getGuildWorld(a)).localeCompare(
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
                "guildLevel",
                "level"
              ],
              0
            )
          ) -
          Number(
            getFirst(
              a,
              [
                "guild_level",
                "guildLevel",
                "level"
              ],
              0
            )
          )
        );
      });

      renderResults(matches);

      setStatus(
        `대소문자를 구분하지 않고 ‘${input.value.trim()}’와 일치하는 결사를 조회했습니다.`,
        "success"
      );
    } catch (error) {
      console.error(error);

      setStatus(
        "결사 데이터를 불러오지 못했습니다. JSON 파일 경로와 형식을 확인해주세요.",
        "error"
      );
    } finally {
      button.disabled = false;
      button.textContent = "조회";
    }
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    searchGuilds();
  });

  memberClose.addEventListener("click", closeMemberModal);

  memberModal.addEventListener("click", (event) => {
    if (event.target === memberModal) {
      closeMemberModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (
      event.key === "Escape" &&
      memberModal.classList.contains("open")
    ) {
      closeMemberModal();
    }
  });
})();
