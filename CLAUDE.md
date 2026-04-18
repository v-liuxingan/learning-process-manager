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
| `src/lib/spaced-repetition.ts` | `SpacedRepetitionManager` - FSRS/艾宾浩斯算法，`ReviewIndexManager` - 复习索引 |
| `src/types/` | TypeScript 类型定义 (project, review, config, common) |

### 数据存储

- **项目索引**: `~/.claude/learning-projects.json` - 所有项目元数据和用户设置
- **项目目录**: `./learning-projects/<name>/` - 每个学习项目的笔记、闪卡、复习记录
  - `README.md` - 学习路线图
  - `progress.md` - 学习进度追踪
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
learn session start --project <项目名>
learn session end --project <项目名> --duration <分钟> --summary "<摘要>"
learn review [项目名] [--due] [--overdue] [--type <类型>] [--limit <数量>] [--json]
learn flashcard create --project <项目名> --front "<问题>" --back "<答案>"
learn flashcard add-note --project <项目名> --file <笔记路径> --title "<标题>"
learn stats [--week] [--month] [--json]
```

### 关键类型

- `ProjectMeta`: 项目元数据 (name, path, topic, stage, progress, totalHours, etc.)
- `ReviewableItem`: 可复习内容项 (id, type, title, storageType, content/reference, review state)
- `ReviewState`: 复习状态，包含 FSRS 或艾宾浩斯算法数据

### 学习阶段

`LearningStage`: `novice` → `beginner` → `intermediate` → `advanced` → `master`

### 间隔重复算法

- **FSRS** (默认): 基于 ts-fsrs 库，根据评分动态调整间隔
- **艾宾浩斯**: 固定间隔 [0.5, 1, 3, 7, 14, 30, 90] 天
