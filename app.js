(function () {
  "use strict";
  const A = window.ActivityQR;
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const form = $("#generator-form");
  const urlInput = $("#activity-url");
  const titleInput = $("#activity-title");
  let active = null;
  let toastTimer;
  let storage = null;
  let history = [];
  try {
    storage = window.localStorage;
    history = A.readHistory(storage);
    const probe = "__activity_qr_probe__";
    storage.setItem(probe, "1");
    storage.removeItem(probe);
  } catch {
    storage = null;
  }

  function toast(message) {
    clearTimeout(toastTimer);
    const node = $("#toast");
    node.textContent = message;
    node.hidden = false;
    toastTimer = setTimeout(() => {
      node.hidden = true;
    }, 3200);
  }
  function updateCounts() {
    $$("[data-count]").forEach((node) => {
      node.textContent = history.length;
    });
  }
  function persistHistory() {
    if (storage) {
      try {
        storage.setItem(A.HISTORY_KEY, JSON.stringify(history));
      } catch {
        storage = null;
        toast("浏览器暂时无法保存，历史记录仅在本次页面中保留。");
      }
    }
    updateCounts();
    $("#storage-notice").hidden = !!storage;
  }
  function clearError() {
    $("#url-error").hidden = true;
    urlInput.removeAttribute("aria-invalid");
  }
  function showError(message) {
    $("#url-error").textContent = message;
    $("#url-error").hidden = false;
    urlInput.setAttribute("aria-invalid", "true");
    urlInput.focus();
  }
  function createQR(url) {
    if (typeof window.qrcode !== "function")
      throw new Error("二维码组件加载失败，请刷新页面后重试。");
    const qr = window.qrcode(0, "M");
    qr.addData(url, "Byte");
    qr.make();
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1200;
    const context = canvas.getContext("2d");
    if (!context)
      throw new Error("当前浏览器不支持绘制二维码，请换用系统浏览器。");
    const count = qr.getModuleCount();
    const cell = Math.floor(1200 / (count + 8));
    const offset = Math.floor((1200 - count * cell) / 2);
    context.fillStyle = "#fff";
    context.fillRect(0, 0, 1200, 1200);
    context.fillStyle = "#000";
    for (let row = 0; row < count; row++)
      for (let col = 0; col < count; col++) {
        if (qr.isDark(row, col))
          context.fillRect(
            offset + col * cell,
            offset + row * cell,
            cell,
            cell,
          );
      }
    return canvas;
  }
  function generate(activity, save = true, scroll = false) {
    const inCanvas = createQR(activity.in),
      outCanvas = createQR(activity.out);
    $("#qr-in").getContext("2d").drawImage(inCanvas, 0, 0);
    $("#qr-out").getContext("2d").drawImage(outCanvas, 0, 0);
    active = activity;
    $("#result-title").textContent = A.displayTitle(activity);
    $("#result-id").textContent =
      activity.id.slice(0, 8) + "…" + activity.id.slice(-8);
    $("#result-id").title = activity.id;
    $("#preview-empty").hidden = true;
    $("#result").hidden = false;
    $("#preview-status").textContent = "已生成";
    $("#preview-status").classList.add("ready");
    if (save) {
      history = A.upsertHistory(history, activity);
      persistHistory();
    }
    if (scroll && window.matchMedia("(max-width: 760px)").matches) {
      $(".preview-panel").scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
        block: "start",
      });
    }
  }
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    clearError();
    const button = $("#generate-button");
    try {
      const activity = {
        ...A.parseActivity(urlInput.value),
        title: A.normalizeTitle(titleInput.value),
      };
      button.disabled = true;
      generate(activity, true, true);
      toast(
        storage
          ? "签到码、签退码已生成，并存入本机历史。"
          : "签到码、签退码已生成。",
      );
    } catch (error) {
      showError(error.message);
    } finally {
      button.disabled = false;
    }
  });
  urlInput.addEventListener("input", clearError);
  $("#example-button").addEventListener("click", () => {
    urlInput.value = A.EXAMPLE;
    titleInput.value = "示例活动";
    clearError();
    urlInput.focus();
    toast("已填入示例链接，点击生成即可体验。");
  });
  $("#paste-button").addEventListener("click", async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) {
        toast("剪贴板为空，请先复制活动链接。");
        return;
      }
      urlInput.value = text.trim();
      clearError();
      toast("链接已粘贴。");
    } catch {
      toast("无法读取剪贴板，请长按输入框粘贴链接。");
      urlInput.focus();
    }
  });
  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      toast("已复制。");
      return;
    } catch {}
    const helper = document.createElement("textarea");
    helper.value = text;
    helper.style.cssText =
      "position:fixed;top:0;left:0;opacity:0;pointer-events:none";
    document.body.appendChild(helper);
    helper.select();
    let success = false;
    try {
      success = document.execCommand("copy");
    } catch {}
    helper.remove();
    toast(success ? "已复制。" : "复制失败，请使用下方文本手动复制。");
    if (!success) window.prompt("复制以下内容", text);
  }
  $$("[data-copy]").forEach((button) =>
    button.addEventListener("click", () => {
      if (active) copy(active[button.dataset.copy]);
    }),
  );
  $("#copy-id").addEventListener("click", () => {
    if (active) copy(active.id);
  });
  $$("[data-save]").forEach((button) =>
    button.addEventListener("click", () => {
      if (!active) return;
      const type = button.dataset.save,
        label = type === "in" ? "签到" : "签退";
      const png = $("#qr-" + type).toDataURL("image/png");
      $("#image-dialog-title").textContent = "保存" + label + "二维码";
      $("#download-preview").src = png;
      $("#download-preview").alt =
        A.displayTitle(active) + " · " + label + "二维码";
      const link = $("#download-link");
      link.href = png;
      link.download =
        label +
        "-" +
        (active.title || "活动").replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_") +
        "-" +
        active.id.slice(0, 8) +
        ".png";
      $("#image-dialog").showModal();
    }),
  );
  $$("[data-close-dialog]").forEach((button) =>
    button.addEventListener("click", () =>
      $("#" + button.dataset.closeDialog).close(),
    ),
  );
  $$("dialog").forEach((dialog) =>
    dialog.addEventListener("click", (event) => {
      if (event.target !== dialog) return;
      const box = dialog.getBoundingClientRect();
      if (
        event.clientX < box.left ||
        event.clientX > box.right ||
        event.clientY < box.top ||
        event.clientY > box.bottom
      )
        dialog.close();
    }),
  );
  function reset() {
    active = null;
    form.reset();
    clearError();
    $("#result").hidden = true;
    $("#preview-empty").hidden = false;
    $("#preview-status").textContent = "等待生成";
    $("#preview-status").classList.remove("ready");
    urlInput.focus();
  }
  $("#reset-button").addEventListener("click", reset);

  const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  function icon(name) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "icon");
    svg.setAttribute("aria-hidden", "true");
    const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
    use.setAttribute("href", "#i-" + name);
    svg.appendChild(use);
    return svg;
  }
  function renderHistory() {
    const query = $("#history-search").value.trim().toLowerCase();
    const visible = history.filter((item) =>
      (item.title + " " + item.id).toLowerCase().includes(query),
    );
    $("#history-total").textContent = history.length;
    $("#clear-history").disabled = history.length === 0;
    $("#storage-notice").hidden = !!storage;
    const list = $("#history-list");
    list.replaceChildren();
    for (const item of visible) {
      const row = document.createElement("article");
      row.className = "history-row";
      const mark = document.createElement("span");
      mark.className = "history-item-icon";
      mark.appendChild(icon("qr"));
      const info = document.createElement("div");
      info.className = "history-item-info";
      const title = document.createElement("h3");
      title.textContent = A.displayTitle(item);
      title.title = title.textContent;
      const meta = document.createElement("p");
      const date = document.createElement("time");
      date.dateTime = new Date(item.createdAt).toISOString();
      date.textContent = dateFormatter.format(item.createdAt);
      const id = document.createElement("code");
      id.textContent = item.id.slice(0, 8) + "…" + item.id.slice(-8);
      id.title = item.id;
      meta.append(date, id);
      info.append(title, meta);
      const reopen = document.createElement("button");
      reopen.type = "button";
      reopen.className = "history-reopen";
      reopen.append(document.createTextNode("再次使用"), icon("arrow"));
      reopen.setAttribute("aria-label", "再次使用：" + A.displayTitle(item));
      reopen.addEventListener("click", () => {
        try {
          const activity = {
            ...A.parseActivity(A.ORIGIN + A.ACTIVITY_PATH + "?id=" + item.id),
            title: item.title,
          };
          urlInput.value = activity.source;
          titleInput.value = item.title;
          clearError();
          generate(activity);
          location.hash = "home";
          toast("已恢复该活动的签到码和签退码。");
        } catch (error) {
          toast(error.message);
        }
      });
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "icon-button";
      remove.setAttribute("aria-label", "删除记录：" + A.displayTitle(item));
      remove.appendChild(icon("trash"));
      remove.addEventListener("click", () => {
        history = history.filter((entry) => entry.id !== item.id);
        persistHistory();
        renderHistory();
        toast("这条记录已删除。");
      });
      row.append(mark, info, reopen, remove);
      list.appendChild(row);
    }
    $("#history-empty").hidden = visible.length > 0;
    $("#history-empty-title").textContent = query
      ? "没有找到这个活动"
      : "第一张码，从这里开始";
    $("#history-empty-text").textContent = query
      ? "换个名称或活动 ID 试试。"
      : "生成过的活动会自动出现在这里，最多保留 50 条。";
    $("#history-start").hidden = !!query;
  }
  $("#history-search").addEventListener("input", renderHistory);
  $("#clear-history").addEventListener("click", () => {
    if (history.length) $("#confirm-dialog").showModal();
  });
  $("#confirm-clear").addEventListener("click", () => {
    history = [];
    persistHistory();
    renderHistory();
    $("#confirm-dialog").close();
    toast("历史记录已清空。");
  });
  function route() {
    const isHistory = location.hash === "#history";
    $("#home-view").hidden = isHistory;
    $("#history-view").hidden = !isHistory;
    $$("[data-nav]").forEach((link) => {
      const selected = link.dataset.nav === (isHistory ? "history" : "home");
      link.classList.toggle("active", selected);
      if (selected) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
    document.title = isHistory ? "历史记录 · 码上" : "码上 · 活动二维码助手";
    if (isHistory) renderHistory();
    window.scrollTo(0, 0);
  }
  window.addEventListener("hashchange", route);
  updateCounts();
  route();
})();
