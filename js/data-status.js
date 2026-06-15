(() => {
  "use strict";

  const badge = document.getElementById(
    "mainDataStatus"
  );

  const text = document.getElementById(
    "mainDataStatusText"
  );

  if (!badge || !text) {
    return;
  }

  const sources = [
    {
      url: "./data/Who_are_you_class.json",
      required: true,
      type: "class"
    },
    {
      url: "./data/Who_are_you_guild.json",
      required: true,
      type: "guild"
    },
    {
      url: "./data/Who_are_you.json",
      required: false,
      type: "overall"
    }
  ];

  function setState(
    state,
    message
  ) {
    badge.classList.remove(
      "loading",
      "normal",
      "partial",
      "error"
    );

    badge.classList.add(state);
    text.textContent = message;
  }

  async function checkSource(source) {
    const response = await fetch(
      source.url,
      {
        cache: "no-store"
      }
    );

    if (!response.ok) {
      return {
        ...source,
        ok: false
      };
    }

    const raw = await response.text();

    if (!raw.trim()) {
      return {
        ...source,
        ok: false
      };
    }

    const data = JSON.parse(raw);

    let count = 0;
    let updatedAt = "";

    if (Array.isArray(data)) {
      count = data.length;
    } else if (
      Array.isArray(data?.rankings)
    ) {
      count = data.rankings.length;

      updatedAt =
        data.metadata
          ?.extracted_at_text ||
        data.metadata
          ?.extracted_at ||
        "";
    }

    return {
      ...source,
      ok: count > 0,
      count,
      updatedAt
    };
  }

  Promise.all(
    sources.map((source) => {
      return checkSource(source)
        .catch(() => {
          return {
            ...source,
            ok: false
          };
        });
    })
  ).then((results) => {
    const requiredResults =
      results.filter(
        (item) => item.required
      );

    const requiredOk =
      requiredResults.every(
        (item) => item.ok
      );

    const anyOk =
      results.some(
        (item) => item.ok
      );

    const optionalMissing =
      results.some(
        (item) =>
          !item.required &&
          !item.ok
      );

    const updatedAt =
      results.find(
        (item) =>
          item.type === "class"
      )?.updatedAt || "";

    if (requiredOk && !optionalMissing) {
      setState(
        "normal",
        updatedAt
          ? `최신 업데이트 완료 · ${updatedAt}`
          : "최신 데이터 적용 완료"
      );

      return;
    }

    if (requiredOk && optionalMissing) {
      setState(
        "partial",
        "일부 데이터 확인 필요"
      );

      return;
    }

    if (anyOk) {
      setState(
        "partial",
        "일부 데이터 확인 필요"
      );

      return;
    }

    setState(
      "error",
      "데이터를 불러올 수 없음"
    );
  });
})();
