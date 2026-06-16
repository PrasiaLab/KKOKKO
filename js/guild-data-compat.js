(() => {
  "use strict";

  const originalJson = Response.prototype.json;

  Response.prototype.json = async function patchedJson() {
    const data = await originalJson.call(this);

    if (
      String(this.url || "").includes("Who_are_you_guild.json") &&
      data &&
      !Array.isArray(data) &&
      Array.isArray(data.rankings)
    ) {
      return data.rankings;
    }

    return data;
  };
})();
