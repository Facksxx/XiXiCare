# XiXiCare

简约的宝宝喂养、睡眠、尿布、成长、疫苗和过敏排查记录应用。

## 开发

```bash
npm ci
npm run dev
```

## APK 与版本

- `npm run apk`：自动递增补丁版本，构建并覆盖根目录 `XiXiCare.apk`。
- `npm run apk:ci`：使用当前版本构建，不递增版本，供 CI 使用。
- `npm run release:apk`：要求工作区已提交；自动打包、提交版本和 APK、创建版本标签并推送。

版本采用 `主版本.次版本.补丁版本`。普通打包自动增加补丁版本；不兼容改动应手动提升主版本，新功能可手动提升次版本。推送 `v*.*.*` 标签后，GitHub Actions 会创建 Release 并上传 `XiXiCare.apk`。
