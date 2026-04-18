import fs from 'fs';
import path from 'path';
import os from 'os';
import type {
  ProjectMeta,
  ProjectIndex,
  UserSettings,
  LearningStage,
} from '../types/index.js';
import { DEFAULT_PROJECT_INDEX, DEFAULT_SETTINGS, STAGE_INFO } from '../types/index.js';

/**
 * 项目索引文件路径
 */
const PROJECT_INDEX_PATH = path.join(os.homedir(), '.claude', 'learning-projects.json');

/**
 * 确保目录存在
 */
function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * 项目管理器
 */
export class ProjectManager {
  private indexPath: string;
  private index: ProjectIndex;

  constructor(indexPath?: string) {
    this.indexPath = indexPath ?? PROJECT_INDEX_PATH;
    this.index = this.loadIndex();
  }

  /**
   * 加载项目索引
   */
  private loadIndex(): ProjectIndex {
    if (fs.existsSync(this.indexPath)) {
      try {
        const content = fs.readFileSync(this.indexPath, 'utf-8');
        const parsed = JSON.parse(content);
        return {
          ...DEFAULT_PROJECT_INDEX,
          ...parsed,
          settings: {
            ...DEFAULT_SETTINGS,
            ...parsed.settings,
          },
        };
      } catch {
        return { ...DEFAULT_PROJECT_INDEX };
      }
    }
    return { ...DEFAULT_PROJECT_INDEX };
  }

  /**
   * 保存项目索引
   */
  private saveIndex(): void {
    ensureDir(path.dirname(this.indexPath));
    fs.writeFileSync(this.indexPath, JSON.stringify(this.index, null, 2), 'utf-8');
  }

  /**
   * 获取所有项目
   */
  getAllProjects(): ProjectMeta[] {
    return this.index.projects;
  }

  /**
   * 获取项目（按名称）
   */
  getProject(name: string): ProjectMeta | undefined {
    return this.index.projects.find((p) => p.name === name);
  }

  /**
   * 获取项目（按路径）
   */
  getProjectByPath(projectPath: string): ProjectMeta | undefined {
    return this.index.projects.find((p) => p.path === projectPath);
  }

  /**
   * 创建新项目
   */
  createProject(options: {
    name: string;
    topic: string;
    path?: string;
    topicsTotal?: number;
  }): ProjectMeta {
    const { name, topic, topicsTotal = 0 } = options;

    // 检查项目是否已存在
    if (this.getProject(name)) {
      throw new Error(`项目 "${name}" 已存在`);
    }

    const now = new Date().toISOString();
    const projectPath = options.path ?? path.join(this.index.settings.defaultProjectsDir, name);

    const project: ProjectMeta = {
      name,
      path: projectPath,
      topic,
      stage: 'novice',
      progress: 0,
      totalHours: 0,
      lastStudyDate: '',
      nextReviewDate: '',
      topicsCompleted: 0,
      topicsTotal,
      createdAt: now,
      updatedAt: now,
    };

    // 创建项目目录结构
    this.createProjectDirectory(projectPath);

    // 添加到索引
    this.index.projects.push(project);
    this.saveIndex();

    return project;
  }

  /**
   * 创建项目目录结构
   */
  private createProjectDirectory(projectPath: string): void {
    const dirs = [
      'notes',
      'knowledge',
      'flashcards',
      'projects',
      'resources',
      'reviews',
    ];

    ensureDir(projectPath);
    dirs.forEach((dir) => {
      ensureDir(path.join(projectPath, dir));
    });

    // 创建基础文件
    const readmePath = path.join(projectPath, 'README.md');
    if (!fs.existsSync(readmePath)) {
      fs.writeFileSync(readmePath, this.generateReadmeTemplate(), 'utf-8');
    }

    const progressPath = path.join(projectPath, 'progress.md');
    if (!fs.existsSync(progressPath)) {
      fs.writeFileSync(progressPath, this.generateProgressTemplate(), 'utf-8');
    }

    const reviewIndexPath = path.join(projectPath, 'reviews', 'review-index.json');
    if (!fs.existsSync(reviewIndexPath)) {
      fs.writeFileSync(
        reviewIndexPath,
        JSON.stringify({ projectId: path.basename(projectPath), items: [] }, null, 2),
        'utf-8'
      );
    }
  }

  /**
   * 生成 README 模板
   */
  private generateReadmeTemplate(): string {
    return `# 学习项目

## 学习目标

- [ ] 目标 1
- [ ] 目标 2

## 学习路线

1. 基础概念
2. 核心原理
3. 实践应用
4. 深入理解

## 学习资源

- [资源名称](链接)

## 进度里程碑

| 里程碑 | 目标日期 | 状态 |
|--------|----------|------|
| 基础掌握 | - | 🌱 进行中 |
| 独立实践 | - | ⏳ 待开始 |
| 深入理解 | - | ⏳ 待开始 |

## 学习笔记索引

<!-- 由 CLI 自动维护 -->

## 复习记录

<!-- 由 CLI 自动维护 -->
`;
  }

  /**
   * 生成进度模板
   */
  private generateProgressTemplate(): string {
    return `# 学习进度追踪

## 📅 学习记录

<!-- 新的学习记录将添加在此处 -->

## 📊 总体进度

| 学习主题 | 状态 | 开始日期 | 预计完成 | 实际完成 | 掌握程度 |
| -------- | ---- | -------- | -------- | -------- | -------- |
<!-- 进度表格由 CLI 自动维护 -->

## 🎯 下一阶段目标

<!-- 待填写 -->

## 💡 学习心得

<!-- 待填写 -->

## 🧠 费曼技巧练习

<!-- 用简单语言解释核心概念 -->
`;
  }

  /**
   * 更新项目
   */
  updateProject(name: string, updates: Partial<ProjectMeta>): ProjectMeta {
    const index = this.index.projects.findIndex((p) => p.name === name);
    if (index === -1) {
      throw new Error(`项目 "${name}" 不存在`);
    }

    const project = this.index.projects[index];
    this.index.projects[index] = {
      ...project,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    this.saveIndex();
    return this.index.projects[index];
  }

  /**
   * 删除项目
   */
  deleteProject(name: string): boolean {
    const index = this.index.projects.findIndex((p) => p.name === name);
    if (index === -1) {
      return false;
    }

    this.index.projects.splice(index, 1);
    this.saveIndex();
    return true;
  }

  /**
   * 获取用户设置
   */
  getSettings(): UserSettings {
    return this.index.settings;
  }

  /**
   * 更新用户设置
   */
  updateSettings(updates: Partial<UserSettings>): UserSettings {
    this.index.settings = {
      ...this.index.settings,
      ...updates,
    };
    this.saveIndex();
    return this.index.settings;
  }

  /**
   * 更新学习进度
   */
  updateProgress(name: string, options: {
    duration?: number;
    topicsCompleted?: number;
    stage?: LearningStage;
  }): ProjectMeta {
    const project = this.getProject(name);
    if (!project) {
      throw new Error(`项目 "${name}" 不存在`);
    }

    const updates: Partial<ProjectMeta> = {
      lastStudyDate: new Date().toISOString(),
    };

    if (options.duration) {
      updates.totalHours = project.totalHours + options.duration / 60;
    }

    if (options.topicsCompleted !== undefined) {
      updates.topicsCompleted = options.topicsCompleted;
      if (project.topicsTotal > 0) {
        updates.progress = Math.round((options.topicsCompleted / project.topicsTotal) * 100);
      }
    }

    if (options.stage) {
      updates.stage = options.stage;
    }

    return this.updateProject(name, updates);
  }

  /**
   * 获取项目统计
   */
  getStats(): {
    totalProjects: number;
    totalHours: number;
    activeProjects: number;
    byStage: Record<LearningStage, number>;
  } {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const byStage: Record<LearningStage, number> = {
      novice: 0,
      beginner: 0,
      intermediate: 0,
      advanced: 0,
      master: 0,
    };

    let totalHours = 0;
    let activeProjects = 0;

    for (const project of this.index.projects) {
      byStage[project.stage]++;
      totalHours += project.totalHours;

      if (project.lastStudyDate && new Date(project.lastStudyDate) >= sevenDaysAgo) {
        activeProjects++;
      }
    }

    return {
      totalProjects: this.index.projects.length,
      totalHours,
      activeProjects,
      byStage,
    };
  }
}

/**
 * 全局项目管理器实例
 */
let globalProjectManager: ProjectManager | null = null;

/**
 * 获取全局项目管理器
 */
export function getProjectManager(): ProjectManager {
  if (!globalProjectManager) {
    globalProjectManager = new ProjectManager();
  }
  return globalProjectManager;
}

/**
 * 重置全局项目管理器（用于测试）
 */
export function resetProjectManager(): void {
  globalProjectManager = null;
}
