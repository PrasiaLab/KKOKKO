(() => {
  const form = document.getElementById("nicknameSearchForm");
  const input = document.getElementById("nicknameSearchInput");
  const status = document.getElementById("nicknameSearchStatus");
  const panel = document.getElementById("nicknameResultPanel");
  const title = document.getElementById("nicknameResultTitle");
  const count = document.getElementById("nicknameResultCount");
  const tbody = document.getElementById("nicknameResultBody");

  if (!form || !input || !status || !panel || !title || !count || !tbody) {
    return;
  }

  const DATA_URLS = {
    classRanking: "./data/Who_are_you_class.json",
    guildRanking: "./data/Who_are_you_guild.json",
    guildScoreRanking: "./data/Who_are_you_guild_score.json",
  };

  const serverMap = window.PRASIA_MAPPINGS?.servers || {};
  let dataPromise = null;

  function normalizeText(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function normalizeKey(value) {
    return normalizeText(value).toLowerCase();
  }

  function formatServer(world) {
    const code = normalizeText(world);
    const name = serverMap[code];
    return name ? `${name} (${code})` : code || "-";
  }

  function formatNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number.toLocaleString("ko-KR") : "-";
  }

  function setStatus(message, options = {}) {
    status.classList.toggle("error", Boolean(options.error));
    status.innerHTML = message;
  }

  function isValidNickname(value) {
    return /^[가-힣]{1,10}$/.test(value) || /^[A-Za-z]{1,10}$/.test(value);
  }

  async function fetchJson(url) {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`${url} HTTP ${response.status}`);
    }
    return response.json();
  }

  function makeGuildKey(world, guildName) {
    return `${normalizeText(world)}::${normalizeKey(guildName)}`;
  }

  function buildGuildMasterMap(...guildDataList) {
    const masters = new Map();

    guildDataList.forEach((data) => {
      const rankings = Array.isArray(data?.rankings) ? data.rankings : [];

      rankings.forEach((guild) => {
        const world = normalizeText(guild?.world);
        const guildName = normalizeText(guild?.guild_name || guild?.guildName || guild?.name);
        const master = normalizeText(guild?.guild_master || guild?.guildMaster || guild?.master);

        if (!world || !guildName || !master) {
          return;
        }

        const key = makeGuildKey(world, guildName);
        if (!masters.has(key)) {
          masters.set(key, master);
        }
      });
    });

    return masters;
  }

  async function loadData() {
    if (dataPromise) {
      return dataPromise;
    }

    dataPromise = Promise.all([
      fetchJson(DATA_URLS.classRanking),
      fetchJson(DATA_URLS.guildScoreRanking).catch(() => ({ rankings: [] })),
      fetchJson(DATA_URLS.guildRanking).catch(() => ({ rankings: [] })),
    ]).then(([classData, guildScoreData, guildData]) => {
      const characters = Array.isArray(classData?.rankings) ? classData.rankings : [];
      const guildMasters = buildGuildMasterMap(guildScoreData, guildData);
      const extractedAt = classData?.metadata?.extracted_at_text || classData?.metadata?.extracted_at || "";

      return { characters, guildMasters, extractedAt };
    }).catch((error) => {
      dataPromise = null;
      throw error;
    });

    return dataPromise;
  }

  function getGuildMaster(character, guildMasters) {
    const guildName = normalizeText(character?.guild || character?.guild_name);
    if (!guildName || guildName === "-") {
      return "-";
    }

    return guildMasters.get(makeGuildKey(character?.world, guildName)) || "-";
  }

  function toResult(character, guildMasters) {
    return {
      world: normalizeText(character?.world),
      server: formatServer(character?.world),
      name: normalizeText(character?.name),
      level: Number(character?.level),
      grade: Number(character?.grade),
      guild: normalizeText(character?.guild || character?.guild_name) || "-",
      guildMaster: getGuildMaster(character, guildMasters),
      ranking: Number(character?.ranking),
    };
  }

  function sortResults(a, b) {
    return (b.level || 0) - (a.level || 0)
      || (b.grade || 0) - (a.grade || 0)
      || String(a.world).localeCompare(String(b.world), "ko-KR")
      || (a.ranking || 999999) - (b.ranking || 999999);
  }

  function renderResults(nickname, results, extractedAt) {
    tbody.replaceChildren();

    if (!results.length) {
      panel.hidden = true;
      setStatus(`검색한 닉네임 <strong>‘${nickname}’</strong>은 현재 랭킹 데이터에서 확인되지 않습니다.`);
      return;
    }

    const fragment = document.createDocumentFragment();

    results.forEach((item) => {
      const row = document.createElement("tr");

      const cells = [
        ["server-cell", item.server],
        ["name-cell", item.name || "-"],
        ["level-cell", formatNumber(item.level)],
        ["grade-cell", formatNumber(item.grade)],
        ["guild-cell", item.guild || "-"],
        ["master-cell", item.guildMaster || "-"],
      ];

      cells.forEach(([className, text]) => {
        const cell = document.createElement("td");
        cell.className = className;
        cell.textContent = text;
        row.appendChild(cell);
      });

      fragment.appendChild(row);
    });

    tbody.appendChild(fragment);
    title.textContent = `‘${nickname}’ 검색 결과`;
    count.textContent = `${results.length.toLocaleString("ko-KR")}건`;
    panel.hidden = false;

    const timeText = extractedAt ? ` · 데이터 기준 ${extractedAt}` : "";
    setStatus(`<strong>‘${nickname}’</strong> 닉네임은 현재 랭킹 데이터에서 <span class="count">${results.length.toLocaleString("ko-KR")}</span>건 확인됩니다${timeText}.`);
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const nickname = input.value.trim();

    if (!nickname) {
      panel.hidden = true;
      setStatus("닉네임을 입력해 주세요.", { error: true });
      input.focus();
      return;
    }

    if (!isValidNickname(nickname)) {
      panel.hidden = true;
      setStatus("정확한 닉네임을 입력해 주세요. 한글 또는 영문으로 최대 10자까지 입력할 수 있으며, 한글과 영문은 함께 사용할 수 없습니다.", { error: true });
      input.focus();
      return;
    }

    setStatus("랭킹 데이터를 확인하고 있습니다.");

    try {
      const { characters, guildMasters, extractedAt } = await loadData();
      const target = normalizeKey(nickname);
      const results = characters
        .filter((character) => normalizeKey(character?.name) === target)
        .map((character) => toResult(character, guildMasters))
        .sort(sortResults);

      renderResults(nickname, results, extractedAt);
    } catch (error) {
      console.error("닉네임 검색 데이터를 불러오지 못했습니다.", error);
      panel.hidden = true;
      setStatus("랭킹 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.", { error: true });
    }
  });
})();
