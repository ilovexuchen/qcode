const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs/promises");
const { spawn } = require("node:child_process");
const A = require("../core.js");
const root = path.resolve(__dirname, "..");
const output = path.join(root, "test-results");
const base = process.env.BASE_URL || "http://127.0.0.1:4173/";
const server = process.env.BASE_URL
  ? null
  : spawn(process.execPath, [path.join(root, "scripts/serve.cjs")], {
      stdio: "pipe",
    });
let browser;
const failures = [];
async function check(name, fn) {
  try {
    await fn();
    console.log("PASS", name);
  } catch (error) {
    failures.push(name);
    console.error("FAIL", name, error.message);
  }
}
(async () => {
  await fs.mkdir(output, { recursive: true });
  if (server)
    await new Promise((resolve, reject) => {
      server.stdout.once("data", resolve);
      server.once("error", reject);
      server.once("exit", (code) => reject(new Error("server exit " + code)));
    });
  browser = await chromium.launch({ channel: "msedge", headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1050 },
    acceptDownloads: true,
  });
  const page = await context.newPage();
  const errors = [];
  const externalRequests = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (
      !request.url().startsWith(new URL(base).origin) &&
      !/^(data:|blob:)/.test(request.url())
    )
      externalRequests.push(request.url());
  });
  await page.goto(base);
  await page.waitForFunction(() => !!window.ActivityQR);
  await page.screenshot({
    path: path.join(output, "desktop-empty.png"),
    fullPage: true,
  });
  await check("空输入给出可读错误", async () => {
    await page.locator("#generate-button").click();
    await page.locator("#url-error").waitFor({ state: "visible" });
    assert.match(await page.locator("#url-error").textContent(), /粘贴/);
  });
  await check("示例填充并生成两个码", async () => {
    await page.locator("#example-button").click();
    await page.locator("#generate-button").click();
    await page.locator("#result").waitFor({ state: "visible" });
    assert.equal(await page.locator("#result-title").textContent(), "示例活动");
  });
  await page.addScriptTag({ path: require.resolve("jsqr") });
  await check("解码签到和签退二维码，校验完整链接", async () => {
    const decoded = await page.evaluate(() =>
      ["in", "out"].map((type) => {
        const canvas = document.getElementById("qr-" + type);
        const pixels = canvas
          .getContext("2d")
          .getImageData(0, 0, canvas.width, canvas.height);
        const result = jsQR(pixels.data, pixels.width, pixels.height);
        return {
          type,
          data: result?.data,
          corner: [...pixels.data.slice(0, 4)],
        };
      }),
    );
    for (const result of decoded) {
      assert.equal(result.data, A.parseActivity(A.EXAMPLE)[result.type]);
      assert.deepEqual(result.corner, [255, 255, 255, 255]);
    }
  });
  await check("签到、签退链接可复制，活动链接可从剪贴板粘贴", async () => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    for (const type of ["in", "out"]) {
      await page.locator('[data-copy="' + type + '"]').click();
      assert.equal(
        await page.evaluate(() => navigator.clipboard.readText()),
        A.parseActivity(A.EXAMPLE)[type],
      );
    }
    await page.evaluate((url) => navigator.clipboard.writeText(url), A.EXAMPLE);
    await page.locator("#activity-url").fill("");
    await page.locator("#paste-button").click();
    await page.waitForFunction(
      (url) => document.querySelector("#activity-url").value === url,
      A.EXAMPLE,
    );
  });
  await check("PNG 图片可下载且尺寸为 1200 × 1200", async () => {
    await page.locator('[data-save="in"]').click();
    const pending = page.waitForEvent("download");
    await page.locator("#download-link").click();
    const download = await pending;
    const file = path.join(output, download.suggestedFilename());
    await download.saveAs(file);
    const bytes = await fs.readFile(file);
    assert.equal(bytes.subarray(1, 4).toString(), "PNG");
    assert.equal(bytes.readUInt32BE(16), 1200);
    assert.equal(bytes.readUInt32BE(20), 1200);
    await page.locator('[data-close-dialog="image-dialog"]').click();
  });
  await page.locator("#toast").waitFor({ state: "hidden" });
  await page.screenshot({
    path: path.join(output, "desktop-result.png"),
    fullPage: true,
  });
  await check("历史可检索、刷新后保留且能恢复", async () => {
    await page.goto(base + "#history");
    assert.equal(await page.locator(".history-row").count(), 1);
    await page.reload();
    assert.equal(await page.locator(".history-row").count(), 1);
    await page.locator("#history-search").fill("missing");
    assert.equal(await page.locator(".history-row").count(), 0);
    assert.match(
      await page.locator("#history-empty-title").textContent(),
      /没有/,
    );
    await page.locator("#history-search").fill("示例");
    await page.locator(".history-reopen").click();
    await page.locator("#result").waitFor({ state: "visible" });
  });
  await check("活动名称使用纯文本显示", async () => {
    await page.locator("#activity-title").fill("<img src=x onerror=alert(1)>");
    await page.locator("#generate-button").click();
    assert.equal(await page.locator("#result-title img").count(), 0);
    assert.match(await page.locator("#result-title").textContent(), /<img/);
    await page.locator("#activity-title").fill("周末志愿服务活动");
    await page.locator("#generate-button").click();
  });
  await check("320–430 像素手机宽度无横向溢出", async () => {
    for (const width of [320, 360, 390, 430]) {
      await page.setViewportSize({ width, height: 844 });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
        "overflow at " + width,
      );
    }
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator("#toast").waitFor({ state: "hidden" });
  await page.screenshot({
    path: path.join(output, "mobile-result.png"),
    fullPage: true,
  });
  await page.locator('.mobile-nav [data-nav="history"]').click();
  await page.locator("#history-search").fill("");
  await page.screenshot({
    path: path.join(output, "mobile-history.png"),
    fullPage: true,
  });
  await check("清空前可取消，确认后记录移除", async () => {
    await page.locator("#clear-history").click();
    await page.locator('[data-close-dialog="confirm-dialog"]').click();
    assert.equal(await page.locator(".history-row").count(), 1);
    await page.locator("#clear-history").click();
    await page.locator("#confirm-clear").click();
    assert.equal(await page.locator(".history-row").count(), 0);
    await page.reload();
    assert.equal(await page.locator(".history-row").count(), 0);
  });
  await check("返回主页后可重新开始生成", async () => {
    await page.locator('.mobile-nav [data-nav="home"]').click();
    await page.locator("#example-button").click();
    await page.locator("#generate-button").click();
    await page.locator("#reset-button").click();
    assert.equal(await page.locator("#activity-url").inputValue(), "");
    assert.equal(await page.locator("#preview-empty").isVisible(), true);
    await page.locator("#toast").waitFor({ state: "hidden" });
    await page.screenshot({
      path: path.join(output, "mobile-empty.png"),
      fullPage: true,
    });
  });
  await check("无脚本错误或第三方数据请求", async () => {
    assert.deepEqual(errors, []);
    assert.deepEqual(externalRequests, []);
  });
  await check("浏览器禁用存储时仍能生成并说明临时历史", async () => {
    const blocked = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    await blocked.addInitScript(() => {
      Object.defineProperty(window, "localStorage", {
        get() {
          throw new Error("disabled");
        },
      });
    });
    const p = await blocked.newPage();
    await p.goto(base);
    await p.locator("#example-button").click();
    await p.locator("#generate-button").click();
    await p.locator("#result").waitFor({ state: "visible" });
    await p.goto(base + "#history");
    assert.equal(await p.locator("#storage-notice").isVisible(), true);
    assert.equal(await p.locator(".history-row").count(), 1);
    await blocked.close();
  });
  await check("损坏历史不影响网页启动", async () => {
    const corrupt = await browser.newContext();
    await corrupt.addInitScript(
      (key) => localStorage.setItem(key, "{broken"),
      A.HISTORY_KEY,
    );
    const p = await corrupt.newPage();
    await p.goto(base);
    await p.locator("#example-button").click();
    await p.locator("#generate-button").click();
    assert.equal(await p.locator("#result").isVisible(), true);
    await corrupt.close();
  });
  await context.close();
})()
  .catch((error) => {
    console.error(error);
    failures.push("setup");
  })
  .finally(async () => {
    if (browser) await browser.close();
    if (server) server.kill();
    if (failures.length) {
      console.error("Failed:", failures.join(", "));
      process.exitCode = 1;
    } else console.log("All browser checks passed.");
  });
