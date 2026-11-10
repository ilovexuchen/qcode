const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const upstream = path.resolve(
  path.dirname(require.resolve("qrcode-generator")),
  "..",
);
fs.mkdirSync(path.join(root, "vendor"), { recursive: true });
for (const [source, target] of [["dist/qrcode.js", "qrcode.js"]]) {
  fs.copyFileSync(
    path.join(upstream, source),
    path.join(root, "vendor", target),
  );
}
console.log("QR library and license copied.");
