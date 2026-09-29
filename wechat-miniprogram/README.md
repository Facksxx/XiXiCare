# XIXI CARE 微信小程序

原生 WXML/WXSS/JS 工程。已在微信开发者工具以 AppID `wx50a8311e9a443408` 打开。

- 首次进入必须主动勾选隐私政策；未勾选时入口禁用。政策全文作为本地页面展示，设置中可再次查看并撤回同意。
- 支持多宝宝、本地护理记录（喂养、睡眠、尿布、体征）、记录列表、图表、喂养指南及疫苗计划。
- 首页、记录、指南、疫苗、统计采用微信原生 `tabBar`；日期和时间使用原生 `picker`，隐私同意页独立于业务页面。界面去除了装饰性表情、英文引导语和重复副标题。
- 按需求移除导入/导出、疫苗价格表手动同步、声音包下载及音乐播放。
- 小程序支持通过相同存档码和验证生日连接安卓版云存档，使用相同的 PBKDF2/AES-GCM 加密格式并自动同步。手动“拉取云存档”会先解密和核对宝宝资料，再以云端内容恢复本机页面，并显示宝宝与记录数量；本机旧数据保留在 `xixicare_before_cloud_restore_v1` 本地备份中。这一步不会上传本机测试数据，也不会因为填错生日新建空存档。正式上线前仍需配置微信小程序隐私指引并提审。

开发者工具工程位于 `/Users/facksxx/WeChatProjects/XIXI CARE`；仓库内此目录为可追踪源码副本。

## 视觉规范（2026-09-18 重做）

界面统一为「清新温暖」风格，全局样式集中在 `app.wxss`，页面级样式在 `pages/index/index.wxss`（其余页面 `@import` 它）。

- 配色：页面底色 `#fffbf7`＋顶部暖色渐变，卡片纯白；主色暖橘 `#de7f4b`，辅色鼠尾草绿 `#6fa48f`，文字 `#443830 / #7e6e62 / #a3968a`，描边 `#f4e9de`。
- 排版基准：卡片左右内边距 32rpx，行高与控件高度取 88rpx 的整数倍（控件 88rpx、主按钮 96rpx、图标底座 76rpx、列表行 108rpx），保证各卡片内部左边缘与行首对齐。
- 设置页图标与原 App `src/components/Settings.tsx` 同款 lucide 图标：宝宝管理 `users`、云存档 `cloud`、隐私政策 `shield-check`、数据存储 `database`。tabBar 五个图标对应 `house / notebook-text / book-open / syringe / chart-no-axes-column-increasing`。
- 图标由 `scripts/make_icons.mjs` 生成（lucide 几何 + `@resvg/resvg-wasm` 渲染 PNG，避免小程序 SVG 兼容问题）。改图标只需改脚本再执行：`node wechat-miniprogram/scripts/make_icons.mjs`。
- 视觉核验：`tmp/preview/gen_preview.py` 把 WXSS 转成 CSS 并拼出各屏静态预览，配合 Chrome 无头截图逐屏核对对齐。

## 域名与运行检查

此前开发者工具缓存了旧域名列表，导致 `request:fail url not in domain list`。2026-09-18 已在“详情 → 项目配置 → 域名信息”刷新，重新打开工程后在小程序内点击“检测连接”，显示“云存档服务连接正常”。拉取流程使用模拟加密存档验证了恢复数量、旧本机数据备份和无 PUT 上传。真机及与安卓版同一真实存档的双向变更仍需独立验证。

开发者工具已改用独立测试宝宝和独立测试存档，自动同步默认关闭；后续联调不得使用生产存档身份。测试存档已完成创建并通过元数据只读检查。
