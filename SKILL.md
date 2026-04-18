---
name: learning-cli
description: 学习进度管理 CLI 工具。用于创建学习项目、追踪进度、管理间隔重复复习。触发词："学习进度"、"复习计划"、"闪卡"、"间隔重复"、"learning"。
version: 1.1.0
---

# Learning Process Manager

学习进度管理 CLI 工具，支持 FSRS 和艾宾浩斯间隔重复算法。

## 安装

```bash
cd E:/develop/projects/AiProjects/learning-process-manager
npm install
npm run build
npm link
```

## 核心命令

### 项目管理

```bash
# 创建新学习项目
learn new <主题> [--path <路径>] [--topics <数量>]

# 列出所有学习项目
learn list [--json] [--porcelain]

# 查看学习进度
learn progress [项目名] [--stage <阶段>] [--json]
```

### 学习会话

```bash
# 开始学习会话
learn session start --project <项目名>

# 结束学习会话
learn session end --project <项目名> --duration <分钟> --summary "<摘要>" [--note "<笔记>"] [--stage <阶段>]

# 选项说明：
# -d, --duration    学习时长（分钟）
# -s, --summary     学习摘要
# -n, --note        学习笔记
# --stage           更新学习阶段 (novice/beginner/intermediate/advanced/master)
```

### 复习管理

```bash
# 查看待复习内容
learn review [项目名] [--due] [--overdue] [--type <类型>] [--limit <数量>] [--strategy <策略>] [--json]

# 选项说明：
# --due          仅显示待复习内容
# --overdue      仅显示过期内容
# --type         按类型筛选 (note/knowledge-point/project/flashcard)
# --limit        限制返回数量
# --strategy     过期处理策略 (reset/reschedule/continue/auto)
# --json         输出 JSON 格式

# 提交复习结果
learn review-submit <内容ID> <评分> --project <项目名>

# 评分选项: again | hard | good | easy
```

### 闪卡管理

```bash
# 传统方式：创建闪卡（存储内容）
learn flashcard create --project <项目名> --front "<问题>" --back "<答案>" [--tags "<标签>"]

# 引用式：添加笔记到复习计划（复习时 LLM 动态读取）
learn flashcard add-note --project <项目名> --file <笔记路径> --title "<标题>" [--tags "<标签>"]

# 引用式：添加知识点（可指定行范围）
learn flashcard add-knowledge --project <项目名> --file <笔记路径> --title "<标题>" [--start 1] [--end 10] [--tags "<标签>"]

# 引用式：添加实践项目
learn flashcard add-project --project <项目名> --dir <项目目录> --title "<标题>" [--tags "<标签>"]

# 列出闪卡（传统）
learn flashcard list --project <项目名> [--due]

# 列出所有复习项（包括笔记、知识点、项目）
learn flashcard list-all --project <项目名> [--type <类型>] [--json]
# --type 可选: note/knowledge-point/project/flashcard
```

## 引用式复习系统

**核心理念**：复习时只存储**文档引用**，由 Agent/LLM 在复习时动态读取内容。

### 优势

| 方面 | 传统闪卡 | 引用式复习 |
|------|----------|------------|
| **存储** | 存储提取的内容 | 只存储文档路径 |
| **格式限制** | 必须符合特定格式 | 无限制 |
| **生成** | 预处理提取 | 复习时动态生成 |
| **更新** | 笔记更新需重新生成 | 自动同步 |

### 复习内容类型

| 类型 | 命令 | 复习方式 |
|------|------|----------|
| `note` | `add-note` | LLM 读取笔记，提问检验理解 |
| `knowledge-point` | `add-knowledge` | LLM 聚焦知识点，深入考察 |
| `project` | `add-project` | LLM 检查实践完成度 |
| `flashcard` | `create` | 传统闪卡测试 |

### Agent 复习流程

```
1. Agent 调用 learn review --due --json
   ↓
2. 收到待复习项目列表（包含文档引用）
   ↓
3. Agent 读取 referenced document
   ↓
4. LLM 动态生成问题，检验用户理解
   ↓
5. 提交评分: learn review-submit <id> <rating>
   ↓
6. 更新复习状态
```

## 统计

```bash
# 查看学习统计
learn stats [--week] [--month] [--json]
```

## v1.1.0 新增功能

### 按类型筛选复习内容

```bash
# 仅查看笔记类型的复习项
learn review --due --type note

# 仅查看知识点类型
learn review --due --type knowledge-point

# 仅查看实践项目
learn review --due --type project

# 仅查看闪卡
learn review --due --type flashcard
```

### 限制复习数量

```bash
# 限制返回 5 条待复习内容
learn review --due --limit 5
```

### 标签支持

```bash
# 添加标签到复习项
learn flashcard add-note --project jvm --file notes/gc.md --title "GC算法" --tags "gc,memory,performance"

# 标签可用于筛选和组织复习内容
```

### JSON 输出增强

所有命令均支持 `--json` 全局选项，输出标准化 JSON 格式：

```json
{
  "version": "1.0",
  "timestamp": "2026-04-12T10:30:00Z",
  "command": "progress",
  "status": "success",
  "data": { ... },
  "context": {
    "nextActions": ["建议操作1", "建议操作2"]
  }
}
```

## Agent 集成模式

### 1. 查询进度

当用户询问学习进度时：

```bash
learn progress --json
```

输出示例：
```json
{
  "version": "1.0",
  "timestamp": "2026-04-12T10:30:00Z",
  "command": "progress",
  "status": "success",
  "data": {
    "name": "TypeScript Deep Dive",
    "stage": "intermediate",
    "progress": 65,
    "totalHours": 45.5,
    "topicsCompleted": 7,
    "topicsTotal": 10
  },
  "context": {
    "project": "TypeScript Deep Dive",
    "stage": "intermediate",
    "nextActions": [
      "复习 5 项待复习内容",
      "继续学习下一主题"
    ]
  }
}
```

### 2. 查看待复习

当用户询问需要复习的内容时：

```bash
learn review --due --json
```

### 3. 创建学习项目

当用户想要开始新的学习时：

```bash
learn new "学习主题" --json
```

### 4. 记录学习会话

当用户完成学习后：

```bash
learn session end --project <项目名> --duration <分钟> --summary "<摘要>"
```

### 5. 复习过期处理

当有过期复习内容时：

```bash
# 查看过期内容
learn review --overdue --json

# 自动处理过期内容
# - 严重过期(>30天): 重置为新内容
# - 中度过期(7-30天): 重新调度
# - 轻度过期(1-7天): 继续复习
```

## 复习系统设计

### 复习内容类型

| 类型 | 复习方式 | 说明 |
|------|----------|------|
| `note` | 重读笔记摘要 | 阅读笔记核心内容 |
| `knowledge-point` | 闪卡测试 | 知识点记忆测试 |
| `project` | 实践练习 | 重新实现项目 |
| `flashcard` | 闪卡测试 | 纯记忆测试 |

### 间隔重复算法

支持两种算法：

1. **FSRS (推荐)**: 基于认知科学的现代算法，更准确预测记忆状态
2. **艾宾浩斯**: 固定间隔 (12h, 1d, 3d, 7d, 14d, 30d, 90d)

### 过期处理策略

| 策略 | 适用场景 | 行为 |
|------|----------|------|
| `reset` | 严重过期(>30天) | 重置为新内容 |
| `reschedule` | 中度过期(7-30天) | 重新计算复习时间 |
| `continue` | 轻度过期(1-7天) | 继续复习 |
| `auto` | 混合情况 | 自动分类处理 |

## 与其他技能的集成

### 与 learning-system 技能

- learning-system 提供方法论（费曼技巧、康奈尔笔记等）
- 本工具提供进度管理和复习调度
- 两者可配合使用

### 与 learning-guide 技能

- learning-guide 提供学习引导和教学
- 本工具管理学习进度
- learning-guide 结束时可调用本工具更新进度

## 数据文件位置

| 文件 | 位置 | 说明 |
|------|------|------|
| 项目索引 | `~/.claude/learning-projects.json` | 所有项目元数据 |
| 用户配置 | `~/.learning-cli/config.json` | 用户偏好设置 |
| 项目数据 | `<项目路径>/` | 笔记、闪卡、复习记录 |

## 项目目录结构

```
[project-name]/
├── README.md              # 学习路线图
├── progress.md            # 学习进度追踪
├── notes/                 # 康奈尔笔记
├── knowledge/             # 知识点
├── flashcards/            # 闪卡
│   └── deck.json
├── projects/              # 实践项目
├── resources/             # 学习资源
└── reviews/
    ├── review-index.json  # 复习内容索引
    ├── spaced-repetition.md  # 复习计划表
    └── review-history.json   # 复习历史
```

## 使用示例

### 开始新学习

```bash
# 1. 创建项目
learn new "TypeScript 高级类型"

# 2. 开始学习会话
learn session start --project typescript-高级类型

# 3. ... 学习过程 ...

# 4. 结束学习会话
learn session end --project typescript-高级类型 --duration 60 --summary "学习了条件类型和映射类型" --stage beginner

# 5. 添加笔记到复习计划
learn flashcard add-note --project typescript-高级类型 --file notes/01-conditional-types.md --title "条件类型"

# 6. 添加知识点（指定行范围）
learn flashcard add-knowledge --project typescript-高级类型 --file notes/01-conditional-types.md --title "条件类型语法" --start 5 --end 15
```

### 复习流程

```bash
# 1. 查看待复习内容
learn review --due

# 2. 进行复习（交互式）
# 显示闪卡正面 -> 用户思考 -> 显示背面 -> 用户评分

# 3. 提交结果
learn review-submit fc-001 good --project typescript-高级类型

# 4. 查看进度
learn progress typescript-高级类型
```
