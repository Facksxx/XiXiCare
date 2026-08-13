# XIXI CARE 商店离线版

这是从主版本独立出来的应用商店上架版本，不参与主版本发布。

## 离线特性

- 不声明 Android 网络权限和应用内安装权限
- 不检查或下载应用更新
- 不包含 Gitee、GitHub 或其他外部服务地址
- 12 首睡眠声音全部随 APK 内置
- 保留本地数据记录、统计、导入导出和自定义本地音频
- 设置页提供作者微信：Facksxx

## 构建

```bash
npm install
npm run apk:ci
```

构建产物为根目录下的 `XIXI-CARE-Offline.apk`。
