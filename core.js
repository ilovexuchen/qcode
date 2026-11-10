(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ActivityQR = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const ORIGIN = "https://dekt.scu.edu.cn";
  const ACTIVITY_PATH = "/ccylmp/pages/main/activity/activity-detail";
  const SIGN_PATH = "/ccylmp/pages/main/index/signing";
  const HISTORY_KEY = "activity-qr-history-v1";
  const ID_PATTERN = /^[a-f\d]{32}$/i;
  const EXAMPLE =
    ORIGIN + ACTIVITY_PATH + "?id=affe77ffa62a6dae1c323b2e76d541b1";

  function parseActivity(input) {
    const text = String(input || "").trim();
    if (!text) throw new Error("请先粘贴活动详情链接。");
    let url;
    try {
      url = new URL(text);
    } catch {
      throw new Error("这还不是完整链接，请从 https:// 开始粘贴。");
    }
    if (url.origin !== ORIGIN || url.username || url.password) {
      throw new Error("请使用 dekt.scu.edu.cn 的 HTTPS 活动链接。");
    }
    const pathname = url.pathname.replace(/\/$/, "");
    if (pathname !== ACTIVITY_PATH && pathname !== SIGN_PATH) {
      throw new Error("链接路径不正确，请粘贴活动详情页或签到、签退页链接。");
    }
    const ids = url.searchParams.getAll("id");
    if (ids.length !== 1 || !ID_PATTERN.test(ids[0])) {
      throw new Error("链接需要包含唯一的 32 位活动 ID，请检查是否复制完整。");
    }
    const id = ids[0];
    return {
      id,
      source: ORIGIN + ACTIVITY_PATH + "?id=" + id,
      in: makeSigningUrl(id, "in"),
      out: makeSigningUrl(id, "out"),
    };
  }
  function makeSigningUrl(id, type) {
    if (!ID_PATTERN.test(id) || !["in", "out"].includes(type))
      throw new Error("无效的活动 ID 或签到类型。");
    return ORIGIN + SIGN_PATH + "?id=" + id + "&type=" + type + "&state=1";
  }
  function normalizeTitle(title) {
    return String(title || "")
      .trim()
      .slice(0, 40);
  }
  function sanitizeHistory(value) {
    if (!Array.isArray(value)) return [];
    const seen = new Set();
    return value
      .filter((item) => {
        if (
          !item ||
          typeof item.id !== "string" ||
          !ID_PATTERN.test(item.id) ||
          seen.has(item.id.toLowerCase()) ||
          !Number.isFinite(item.createdAt) ||
          item.createdAt <= 0 ||
          item.createdAt > 8640000000000000
        )
          return false;
        seen.add(item.id.toLowerCase());
        return true;
      })
      .map((item) => ({
        id: item.id,
        title: normalizeTitle(item.title),
        createdAt: item.createdAt,
      }))
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 50);
  }
  function readHistory(storage) {
    try {
      return sanitizeHistory(JSON.parse(storage.getItem(HISTORY_KEY) || "[]"));
    } catch {
      return [];
    }
  }
  function upsertHistory(history, activity, now = Date.now()) {
    const old = history.find(
      (item) => item.id.toLowerCase() === activity.id.toLowerCase(),
    );
    return sanitizeHistory([
      {
        id: activity.id,
        title: normalizeTitle(activity.title) || old?.title || "",
        createdAt: now,
      },
      ...history.filter(
        (item) => item.id.toLowerCase() !== activity.id.toLowerCase(),
      ),
    ]);
  }
  function displayTitle(activity) {
    return activity.title || "未命名活动";
  }
  return {
    ORIGIN,
    ACTIVITY_PATH,
    SIGN_PATH,
    HISTORY_KEY,
    EXAMPLE,
    parseActivity,
    makeSigningUrl,
    normalizeTitle,
    sanitizeHistory,
    readHistory,
    upsertHistory,
    displayTitle,
  };
});
