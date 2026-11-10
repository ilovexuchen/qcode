# 码上 · 活动二维码助手

手机优先的四川大学第二课堂活动二维码生成器。无需账户、服务器或数据库，所有转换和二维码绘制在浏览器本地完成。

**在线网页：** https://genshinstartmoonlight.github.io/activity-qr-generator/

**代码仓库：** https://github.com/genshinstartmoonlight/activity-qr-generator

## 使用

1. 粘贴 `https://dekt.scu.edu.cn/ccylmp/pages/main/activity/activity-detail?id=活动ID`。
2. 可选填写活动名称，点击「生成签到 / 签退码」。
3. 分别保存签到、签退 PNG；手机可在预览窗口长按保存图片。
4. 在「历史记录」搜索、再次使用或删除已生成的活动。清空全部记录前会要求确认。

支持直接粘贴已有的签到或签退链接。链接必须为指定平台的 HTTPS 链接，包含唯一的 32 位十六进制 ID。

## 转换规则

同一输入活动 ID 分别生成：

```text
https://dekt.scu.edu.cn/ccylmp/pages/main/index/signing?id=活动ID&type=in&state=1
https://dekt.scu.edu.cn/ccylmp/pages/main/index/signing?id=活动ID&type=out&state=1
```

需求文档的两个示例中出现了不同的 ID；实现以输入链接的活动 ID 为准，两种输出均保留这个 ID，不使用写死的示例 ID。

下载图为纯白底黑色二维码，1200 × 1200 像素，采用 M 级纠错、整数像素模块和至少 4 模块的空白边界。不把标题、装饰或图标写入二维码图片，符合文档图片的形式。

## 本地运行

网站运行资源已经包含在仓库里。可直接用浏览器打开 `index.html`；推荐通过本地服务器访问，以获得更可靠的剪贴板等功能：

```sh
npm ci
npm run dev
```

浏览器打开 `http://127.0.0.1:4173/`。开发服务器仅监听本机。

## 测试

```sh
npm test
npm run test:e2e
```

浏览器测试使用本机 Microsoft Edge 的无头模式，需要已安装 Microsoft Edge。测试包括完整二维码解码、PNG 下载、剪贴板操作、历史持久化与搜索、清空确认、无存储环境、损坏记录，以及 320 / 360 / 390 / 430 像素宽度的横向溢出检查。截图和下载样本位于 `test-results/`，不进入 Git。

可通过 `BASE_URL` 环境变量对已发布网页运行相同的浏览器测试；测试只操作测试浏览器自身的本机记录，不访问第二课堂平台。

## 发布与维护

GitHub Pages 使用 `main` 分支的根目录，通过 `.nojekyll` 按静态文件发布。修改代码并推送到 `main` 后会更新网页，无需构建步骤。所有资源使用相对路径，可部署到 GitHub Pages 项目子路径。

- `index.html`：页面结构、导航、图片预览和确认窗口
- `styles.css`：手机与桌面样式
- `core.js`：链接校验、转换和历史数据处理
- `app.js`：二维码绘制和页面交互
- `vendor/qrcode.js`：固定版本的本地二维码依赖
- `tests/`：单元测试和浏览器测试
- `scripts/`：开发服务器与依赖复制工具

`qrcode-generator` 固定为 2.0.4，采用 MIT 许可证，版权声明与许可位于 `vendor/qrcode-LICENSE.txt`。更新依赖后运行 `npm run vendor` 同步浏览器文件。

## 记录与使用边界

- 最多保存 50 个活动，重复生成同一活动会将记录更新到最近位置。
- 历史记录仅保存在当前浏览器的 localStorage，不会跨设备同步；清理浏览器数据会移除历史。
- 禁用存储或写入失败时，生成二维码仍可使用，页面会说明历史仅临时保存。
- 手机系统或微信等内置浏览器可能限制下载或剪贴板权限，图片预览提供长按保存方式；必要时使用系统浏览器。
- 这是独立辅助工具，只转换链接，不执行签到或签退，也不绕过登录、活动状态、地点或其他权限检查。是否能完成签到/签退由原平台决定。
- 网页无统计、广告或第三方请求，访问 GitHub Pages 时仍会正常请求网站静态资源。

原始需求文档保留在本地文件夹，已通过 `.gitignore` 排除，不上传到公开仓库。
