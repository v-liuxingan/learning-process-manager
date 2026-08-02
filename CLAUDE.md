# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 常用命令

```bash
# 构建
npm run build          # tsup 编译到 dist/
npm run dev            # 监听模式构建

# 类型检查与测试
npm run typecheck      # tsc --noEmit
npm run test           # vitest

# 其他
npm run lint           # eslint src/
npm run clean          # rimraf dist
```

## 安装与全局使用

```bash
npm install
npm run build
npm link               # 注册全局 `learn` 命令
```

## 架构概述

这是一个学习进度管理 CLI 工具，支持 FSRS 和艾宾浩斯间隔重复算法。

### 核心模块

| 路径 | 职责 |
|------|------|
| `src/cli.ts` | Commander 程序入口，注册所有子命令 |
| `src/commands/` | 各 CLI 子命令实现 (new, list, progress, session, review, flashcard, stats) |
| `src/lib/project.ts` | `ProjectManager` - 项目元数据 CRUD，索引文件管理 |
| `src/lib/learning-unit.ts` | `LearningUnitManager` - 单元依赖、证据与状态迁移 |
| `src/lib/teaching-entry.ts` | 首次课程、新单元和续学导览状态推导 |
| `src/lib/spaced-repetition.ts` | `SpacedRepetitionManager` - FSRS/艾宾浩斯算法，`ReviewIndexManager` - 复习索引 |
| `src/types/` | TypeScript 类型定义 (project, review, config, common) |

### 数据存储

- **项目索引**: 默认位于当前用户应用数据目录的 `learning-process-manager/learning-projects.json`，也可通过配置项 `indexPath` 或环境变量 `LEARN_INDEX_PATH` 覆盖
- **项目目录**: 默认位于当前用户应用数据目录的 `learning-process-manager/projects/<name>/`，也可通过配置项 `defaultProjectsDir`、环境变量 `LEARN_PROJECTS_DIR` 或 `learn new --path` 覆盖
  - `README.md` - 学习路线图
  - `progress.md` - 学习进度追踪
  - `learning-units.json` - CLI 管理的学习单元、依赖与证据索引
  - `notes/`, `knowledge/`, `flashcards/`, `projects/`, `resources/`
  - `reviews/review-index.json` - 可复习内容索引

### 复习内容类型

`ReviewableType`: `note` | `knowledge-point` | `project` | `flashcard`

两种存储方式:
- **inline**: 直接存储内容（传统闪卡）
- **reference**: 只存储文档路径，复习时动态读取

### CLI 命令模式

所有命令支持 `--json` 全局选项输出 JSON 格式（供 Agent 使用）:

```bash
learn new <主题> [--path <路径>] [--topics <数量>]
learn list [--json]
learn progress [项目名] [--stage <阶段>] [--json]
learn status [项目名] [--limit <数量>] [--json]
learn unit add/list/next/evidence/transition ...
learn session start --project <项目名> [--unit <单元ID>]
learn session end --project <项目名> --duration <分钟> --summary "<摘要>"
learn review [项目名] [--due] [--overdue] [--type <类型>] [--limit <数量>] [--json]
learn flashcard create --project <项目名> --front "<问题>" --back "<答案>"
learn flashcard add-note --project <项目名> --file <笔记路径> --title "<标题>"
learn stats [--week] [--month] [--json]
learn init [--json]
learn config get [配置项] [--json]
learn doctor [--json]
```

`learn status` 与 `learn session start` 的 JSON 返回 `data.teachingEntry`，用于在诊断前区分课程总览、单元导览和续学定位；它是基于历史的默认入口，导览不会自动推进单元掌握状态。课程总览先建立学习对象的最小心智模型；用户明确要求重新开始时，教学 Agent 覆盖默认 `resume`，但不清空进度。

### 关键类型

- `ProjectMeta`: 项目元数据 (name, path, topic, stage, progress, totalHours, etc.)
- `ReviewableItem`: 可复习内容项 (id, type, title, storageType, content/reference, review state)
- `ReviewState`: 复习状态，包含 FSRS 或艾宾浩斯算法数据
- `LearningUnit`: 学习单元、前置依赖、状态和能力证据

### 学习阶段

`LearningStage`: `novice` → `beginner` → `intermediate` → `advanced` → `master`

### 间隔重复算法

- **FSRS** (默认): 基于 ts-fsrs 库，根据评分动态调整间隔
- **艾宾浩斯**: 固定间隔 [0.5, 1, 3, 7, 14, 30, 90] 天
