# Learning Process Manager

学习进度管理 CLI 工具，用于创建学习项目、记录学习会话、管理闪卡和复习材料，并通过 FSRS 或艾宾浩斯间隔重复算法安排复习。

## 功能概览

- 创建和维护学习项目元数据
- 记录学习会话、学习时长、阶段和摘要
- 管理传统闪卡，以及引用式笔记、知识点、实践项目复习项
- 查询待复习、过期复习内容，并提交复习评分
- 输出人类可读文本、JSON 或 porcelain 格式，方便 Agent 和脚本集成
- 通过文件锁和原子写入保护项目索引、复习索引、复习历史和会话历史

## 环境要求

- Node.js >= 18
- npm

## 安装

发布到 npm 后，普通用户可以全局安装：

```bash
npm install -g learning-process-manager
learn init
learn doctor
```

自测或跨平台测试时，可以从发布附件或其他下载地址拿到 `.tgz` 包后安装：

```bash
npm install -g ./learning-process-manager-1.0.0.tgz
learn init
learn doctor
```

本地开发安装：

```bash
npm install
npm run build
npm link
```

完成后会注册全局 `learn` 命令。

## 常用开发命令

```bash
npm run build        # 编译到 dist/
npm run dev          # 监听模式构建
npm run typecheck    # TypeScript 类型检查
npm run test:run     # Vitest 单元测试
npm run test:e2e     # 构建后 CLI 端到端测试
npm run lint         # ESLint
npm run verify       # lint/typecheck/test/build/audit/pack 全量检查
npm run pack:dry-run # 检查 npm 包内容
npm run clean        # 清理 dist/
```

## 快速开始

```bash
learn init
learn new "JVM 深入理解" --topics 12
learn list
learn session start --project "jvm-深入理解"
learn session end --project "jvm-深入理解" --duration 45 --summary "学习类加载机制"
learn flashcard create --project "jvm-深入理解" --front "什么是双亲委派模型？" --back "类加载器优先委托父加载器加载类。"
learn review "jvm-深入理解" --due
learn review-submit <content-id> good --project "jvm-深入理解"
learn stats --json
```

如果命令写入了非预期目录，先运行 `learn doctor` 查看当前索引路径、项目目录和配置来源。

## CLI 命令

全局选项：

```bash
learn --json       # 输出 JSON，供 Agent 或脚本使用
learn --porcelain  # 输出机器可解析文本
learn --quiet      # 最小输出
```

主要命令：

```bash
learn new <主题> [--path <路径>] [--topics <数量>]
learn list [--json] [--porcelain]
learn progress [项目名] [--stage <阶段>] [--json]
learn session start --project <项目名>
learn session end --project <项目名> --duration <分钟> --summary "<摘要>" [--stage <阶段>]
learn review [项目名] [--due] [--overdue] [--type <类型>] [--limit <数量>] [--json]
learn review-submit <content-id> <again|hard|good|easy> --project <项目名> [--json]
learn flashcard create --project <项目名> --front "<问题>" --back "<答案>"
learn flashcard add-note --project <项目名> --file <笔记路径> --title "<标题>"
learn flashcard add-knowledge --project <项目名> --file <笔记路径> --title "<标题>" [--start <行>] [--end <行>]
learn flashcard add-project --project <项目名> --dir <路径> --title "<标题>"
learn flashcard list-all --project <项目名> [--type <类型>] [--json]
learn stats [--week] [--month] [--json]
learn init [--json]
learn config get [配置项] [--json]
learn doctor [--json]
```

## 数据存储

默认项目索引会保存在当前用户的应用数据目录中：

```text
Windows: %APPDATA%\learning-process-manager\learning-projects.json
macOS: ~/Library/Application Support/learning-process-manager/learning-projects.json
Linux: ${XDG_DATA_HOME:-~/.local/share}/learning-process-manager/learning-projects.json
```

默认项目目录：

```text
<应用数据目录>/projects/<project-name>/
```

每个学习项目包含：

```text
README.md
progress.md
notes/
knowledge/
flashcards/
projects/
resources/
reviews/
  review-index.json
  review-history.json
  session-history.json
```

说明：

- `review-index.json` 保存可复习内容索引。
- `review-history.json` 保存复习提交记录。
- `session-history.json` 保存 `learn session end` 生成的学习会话记录，`learn stats` 的周/月统计基于该文件计算。

## 配置

项目支持通过 `cosmiconfig` 加载配置，搜索文件包括：

```text
.learning-clirc
.learning-clirc.json
.learning-clirc.yaml
.learning-clirc.yml
package.json
```

常用配置项：

```json
{
  "indexPath": "D:/Learning/docs/learning-projects.json",
  "defaultProjectsDir": "D:/Learning/projects",
  "reviewAlgorithm": "fsrs",
  "ebbinghausIntervals": [0.5, 1, 3, 7, 14, 30, 90],
  "timezone": "Asia/Shanghai"
}
```

如果存在显式配置，`learn new` 会使用配置中的 `defaultProjectsDir` 作为默认项目目录；也可以通过 `learn new --path <路径>` 覆盖单个项目路径。`indexPath` 控制全局项目索引文件位置，和 `defaultProjectsDir` 是两个独立概念。

也可以用环境变量覆盖路径：

```bash
LEARN_HOME=/path/to/learning-data
LEARN_INDEX_PATH=/path/to/learning-projects.json
LEARN_PROJECTS_DIR=/path/to/projects
```

首次使用可运行 `learn init` 创建索引文件；路径排查可运行 `learn doctor`；查看有效配置可运行 `learn config get --json`。

## 复习模型

复习内容类型：

- `note`
- `knowledge-point`
- `project`
- `flashcard`

存储方式：

- `inline`: 直接存储问题和答案，适合传统闪卡。
- `reference`: 只保存文档路径、章节或行号，复习时动态读取源文档。

评分：

- `again`
- `hard`
- `good`
- `easy`

默认算法是 FSRS，基于 `ts-fsrs` 动态调整下一次复习时间。也支持艾宾浩斯固定间隔策略。

## 项目结构

```text
src/
  cli.ts                       # Commander 程序入口
  bin/learn.ts                 # learn 可执行入口
  commands/                    # CLI 子命令
  config/                      # 配置加载
  lib/
    project.ts                 # 项目索引和元数据管理
    spaced-repetition.ts       # FSRS/艾宾浩斯和复习索引
    file-utils.ts              # 文件锁与原子写入
    session-history.ts         # 学习会话历史
  types/                       # 类型定义
templates/                     # 新学习项目模板
tests/                         # Vitest 测试
```

## 验证

```bash
npm run typecheck
npm run build
npm run test -- --run
```

## 许可证

MIT
