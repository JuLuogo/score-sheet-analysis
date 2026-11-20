# 部署到 EdgeOne Pages

本项目是纯静态 Vite 应用，构建产物在 `dist/`，不需要后端、数据库或 Edge Functions。

## 方式一：Git 部署（推荐）

1. 把代码推到 GitHub / Gitee / Coding。
2. 打开 [EdgeOne Pages 控制台](https://console.cloud.tencent.com/edgeone/makers)，选择「导入 Git 仓库」。
3. 选择仓库，框架会自动识别为 **Vite**，默认配置：
   - 构建命令：`npm run build`
   - 输出目录：`dist`
   - 安装命令：`npm install`（有 lockfile 时建议 `npm ci`）
4. 点击部署。之后向生产分支（默认 `main`）推送提交会自动触发新部署。

`edgeone.json` 已声明构建配置，会被自动读取：

```json
{
  "buildCommand": "npm run build",
  "installCommand": "npm ci",
  "outputDirectory": "./dist",
  "nodeVersion": "22.11.0"
}
```

> `nodeVersion` 建议使用 EdgeOne 预装版本之一：`20.18.0`、`22.11.0`（Vite 6 均兼容）。

## 方式二：CLI 直接上传

```bash
# 1. 安装并登录（首次）
npm i -g edgeone
edgeone login

# 2. 在项目根目录构建
npm ci
npm run build

# 3. 部署（-n 指定项目名，首次会自动创建）
edgeone pages deploy -n score-sheet-analysis
```

部署完成后控制台会输出访问地址（形如 `https://score-sheet-analysis.edgeone.app`）。

## 方式三：控制台直接上传

1. `npm ci && npm run build`
2. 在 EdgeOne Pages 控制台创建项目，选择「直接上传」
3. 把 `dist/` 目录整体上传

## 自定义域名 / HTTPS

项目部署后，在控制台「域名管理」中绑定自定义域名，按提示配置 CNAME 即可；EdgeOne 提供免费证书。

## 响应头与缓存

`edgeone.json` 中已配置：

- 全站：`X-Frame-Options: SAMEORIGIN`、`X-Content-Type-Options: nosniff`、`Referrer-Policy`
- `/assets/*`：一年强缓存（文件名带 hash，可安全长缓存）

## 本地验证部署产物

```bash
npm run build
npm run preview
# 打开 http://localhost:4173
# 可用 ?demo=1 检查完整流程，?demo=mapping 检查字段确认页
```

## 常见问题

**构建失败提示 Node 版本**：在控制台项目设置或 `edgeone.json` 里把 `nodeVersion` 改为 `22.11.0`。

**访问页面 404**：确认输出目录是 `dist`，且构建产物根目录含 `index.html`。

**导出的 Excel 打不开**：文件由浏览器 ExcelJS 生成，若浏览器拦截下载请允许本站下载；建议 Chrome / Edge 最新版。

**数据会不会上传**：不会。解析、计算、导出全部在浏览器本地完成，站点没有后端接口。

**能不能多人共用一份数据**：当前版本以本机浏览器为单位（localStorage）。如需多端共享，需要接入 Supabase / EdgeOne KV 等存储，属于后续扩展。


