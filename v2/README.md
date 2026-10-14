# GEO Platform V2

这是从旧版单文件原型独立出来的全新项目骨架。所有 V2 代码都位于 `v2/`，旧版 `main`、现有页面和分享链接不做修改。

## 技术结构

- Web：React + Vite + TypeScript
- API：Fastify + TypeScript
- 业务规则：共享 Domain 包，统一维护任务类型、状态与流转
- 数据库目标：PostgreSQL（下一阶段接入）
- 包管理：pnpm workspace

## 本地启动

```bash
cd v2
pnpm install
pnpm dev
```

Web 默认运行在 http://localhost:5173，API 默认运行在 http://localhost:3001。

## 已固化的业务原则

- 任务类型只有：技术修复、官网内容、外部内容。
- 技术修复由官网直接处理，不进入 Brief 与内容审核。
- Agent 自主模式下，官网内容和外部内容由客户审核。
- 代运营模式下，内容类任务先由运营审核，生成 Brief 后再按内容流程推进。
- 官网内容最终进入官网核验；外部内容最终确认后流程完成并可复制。
- 不存在 Re-check、已恢复或仍存在流程。
- 已忽略是终止状态，不自动恢复。
- 一个问题对应一个 Brief，禁止自动合并问题。
