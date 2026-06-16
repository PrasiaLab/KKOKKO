(() => {
  "use strict";

  const originalFetch = window.fetch.bind(window);

  window.fetch = async function patchedFetch(input, init) {
    const url =
      typeof input === "string"
        ? input
        : input?.url || "";

    const response = await originalFetch(input, init);

    if (
      !url.includes("Who_are_you_guild.json") ||
      !response.ok
    ) {
      return response;
    }

    const cloned = response.clone();
    const data = await cloned.json();

    /*
     * 구형 결사 조회 코드는 JSON 최상단이 배열이라고 가정합니다.
     * 현재 자동 갱신 JSON은 { metadata, rankings } 구조이므로,
     * 결사 조회 스크립트에 rankings 배열만 전달합니다.
     */
    if (
      data &&
      !Array.isArray(data) &&
      Array.isArray(data.rankings)
    ) {
      return new Response(
        JSON.stringify(data.rankings),
        {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers
        }
      );
    }

    return response;
  };
})();
