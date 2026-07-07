---
name: learning-cli
description: 管理本地学习项目的 learning-process-manager CLI。用于用户想创建或列出学习项目、记录学习会话、查看学习进度、管理闪卡或引用式复习项、执行 FSRS 或艾宾浩斯间隔重复复习，或提到“学习进度”、“复习计划”、“闪卡”、“间隔重复”、“learning”等场景。
---

# Learning CLI

使用本技能操作此仓库提供的本地 `learn` 命令：

```bash
npm install
npm run build
npm link
```

如果当前工作目录不是仓库根目录，先切换到当前安装或克隆的 `learning-process-manager` 仓库目录；不要假设固定的本机路径。

当输出需要被 Agent 或脚本继续处理时，优先使用 `--json`。面向用户展示时，可以使用普通文本输出。

## 核心流程

1. 用 `learn list --json` 获取项目列表。
2. 用 `learn progress [project] --json` 查看学习进度。
3. 用 `learn session start|end` 开始或结束学习会话。
4. 用 `learn flashcard ...` 添加可复习内容。
5. 用 `learn review ... --json` 查询待复习或过期复习项。
6. 用户完成复习后，用 `learn review-submit <id> <rating> --project <project>` 提交结果。

复习评分只能使用：`again`、`hard`、`good`、`easy`。

学习阶段只能使用：`novice`、`beginner`、`intermediate`、`advanced`、`master`。

复习项类型只能使用：`note`、`knowledge-point`、`project`、`flashcard`。

## 命令

### 项目管理

```bash
learn new <topic> [--path <path>] [--topics <count>] [--json]
learn list [--json] [--porcelain]
learn progress [project] [--stage <stage>] [--json]
learn stats [--week] [--month] [--json]
learn init [--json]
learn config get [key] [--json]
learn doctor [--json]
```

使用 `learn new` 创建项目目录结构并注册项目元数据。如果未提供 `--path`，CLI 会使用当前有效配置中的 `defaultProjectsDir`。项目索引路径 `indexPath` 和项目目录默认值 `defaultProjectsDir` 是两个概念，不要混用。

配置文件由 `cosmiconfig` 加载，常见位置包括 `.learning-clirc`、`.learning-clirc.json`、`.learning-clirc.yaml`、`.learning-clirc.yml` 和 `package.json`。常用配置项包括 `indexPath`、`defaultProjectsDir`、`reviewAlgorithm`、`ebbinghausIntervals`、`timezone`。也可以用 `LEARN_HOME`、`LEARN_INDEX_PATH`、`LEARN_PROJECTS_DIR` 覆盖路径。路径排查优先运行 `learn doctor --json`。

### 学习会话

```bash
learn session start --project <project> [--json]
learn session end --project <project> --duration <minutes> --summary "<summary>" [--note "<note>"] [--stage <stage>] [--json]
```

在真实学习结束后使用 `session end`。它会更新总学习时长和 `lastStudyDate`，并写入 `reviews/session-history.json`；如果提供 `--stage`，也会更新学习阶段。`learn stats --week/--month` 基于会话历史计算周/月学习时长。

### 复习队列

```bash
learn review [project] [--due] [--overdue] [--type <type>] [--limit <count>] [--json]
learn review-submit <content-id> <rating> --project <project> [--json]
```

使用 `--due` 查看当前应复习内容，使用 `--overdue` 查看过期内容。使用 `--type` 在向用户提问前缩小复习范围。CLI 暴露了 `--strategy` 选项，但当前没有单独实现自动过期处理动作；除非已经运行 `review-submit`，不要声称复习项已被重新调度。

### 闪卡与引用式复习项

```bash
learn flashcard create --project <project> --front "<question>" --back "<answer>" [--tags "tag1,tag2"] [--json]
learn flashcard list --project <project> [--due] [--json]

learn flashcard add-note --project <project> --file <relative-note-path> [--title "<title>"] [--section <anchor>] [--tags "tag1,tag2"] [--json]
learn flashcard add-knowledge --project <project> --file <relative-note-path> --title "<title>" [--start <line>] [--end <line>] [--tags "tag1,tag2"] [--json]
learn flashcard add-project --project <project> --dir <relative-project-dir> --title "<title>" [--tags "tag1,tag2"] [--json]
learn flashcard list-all --project <project> [--type <type>] [--json]
```

使用 `create` 创建传统内联闪卡。使用 `add-note`、`add-knowledge`、`add-project` 创建引用式复习项；这些命令只保存路径和元数据，复习时由 Agent 读取引用内容。

传给 `--file` 和 `--dir` 的路径都相对于学习项目根目录。

## Agent 复习流程

帮助用户复习时：

1. 运行 `learn review [project] --due --json`。
2. 根据用户范围或 `--limit` 选择一小批复习项。
3. 对内联闪卡，展示正面问题，并用存储的背面答案对照。
4. 对引用式复习项，读取项目目录下的引用文件或指定行范围，再基于当前内容提出针对性问题。
5. 询问用户回忆效果，并映射为 `again`、`hard`、`good` 或 `easy`。
6. 运行 `learn review-submit <item-id> <rating> --project <project> --json`。
7. 总结下次复习时间和建议的下一步动作。

不要伪造复习结果。只有在用户实际回答后，或用户明确指定评分时，才提交评分。

## 数据布局

默认项目索引存放在当前用户的应用数据目录：

```text
Windows: %APPDATA%\learning-process-manager\learning-projects.json
macOS: ~/Library/Application Support/learning-process-manager/learning-projects.json
Linux: ${XDG_DATA_HOME:-~/.local/share}/learning-process-manager/learning-projects.json
```

每个项目包含：

```text
README.md
progress.md
notes/
knowledge/
flashcards/deck.json
projects/
resources/
reviews/review-index.json
reviews/review-history.json
reviews/session-history.json
```

`reviews/review-index.json` 保存 `ReviewableItem` 条目。`storageType: "inline"` 表示直接存储问题和答案；`storageType: "reference"` 表示存储文档路径，以及可选的章节或行号范围。

`reviews/review-history.json` 保存复习提交记录。`reviews/session-history.json` 保存学习会话记录。项目索引、复习索引、复习历史和会话历史写入使用文件锁和原子写入；并发 Agent 仍应优先通过 CLI 操作，不要手工编辑这些 JSON 文件。

## 输出约定

JSON 响应通常使用以下结构：

```json
{
  "version": "1.0",
  "timestamp": "2026-04-12T10:30:00.000Z",
  "command": "review",
  "status": "success",
  "data": {},
  "context": {
    "nextActions": []
  }
}
```

启用 JSON 时，错误信息读取 `error.message`。如果命令以非 JSON 形式失败，向用户摘要控制台错误，并建议最小的下一条诊断命令。

## 使用边界

- 从当前安装或克隆的 `learning-process-manager` 仓库根目录运行开发命令；不要假设固定的本机路径。
- 优先使用 `learn list --json` 返回的项目名，不要猜测项目名。
- 生成笔记、提问和复习提示时，必须以引用文件内容为依据。
- 除非 CLI 无法完成所需操作，或用户明确要求直接修复数据文件，否则不要手工编辑项目数据文件。
- 修改 TypeScript 代码后运行 `npm run typecheck`、`npm run build` 和 `npm run test -- --run`。
