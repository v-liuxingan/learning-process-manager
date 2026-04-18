import { cosmiconfigSync } from 'cosmiconfig';
import { z } from 'zod';
import { UserSettingsSchema, type UserSettings } from '../types/index.js';

const MODULE_NAME = 'learning-cli';

/**
 * 默认用户设置
 */
const DEFAULT_USER_SETTINGS: UserSettings = {
  defaultProjectsDir: './learning-projects',
  reviewAlgorithm: 'fsrs',
  ebbinghausIntervals: [0.5, 1, 3, 7, 14, 30, 90],
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
};

/**
 * 配置加载器
 */
export class ConfigLoader {
  private config: UserSettings;

  constructor(overrides?: Partial<UserSettings>) {
    this.config = this.loadConfig(overrides);
  }

  /**
   * 加载配置（合并多层配置）
   * 优先级：CLI 参数 > 项目本地配置 > 用户全局配置 > 默认配置
   */
  private loadConfig(overrides?: Partial<UserSettings>): UserSettings {
    const explorer = cosmiconfigSync(MODULE_NAME, {
      searchPlaces: [
        '.learning-clirc',
        '.learning-clirc.json',
        '.learning-clirc.yaml',
        '.learning-clirc.yml',
        'package.json',
      ],
    });

    const result = explorer.search();
    const fileConfig = result?.config ?? {};

    // 合并配置
    const merged = {
      ...DEFAULT_USER_SETTINGS,
      ...fileConfig,
      ...overrides,
    };

    // 验证配置
    return UserSettingsSchema.parse(merged);
  }

  /**
   * 获取当前配置
   */
  getConfig(): UserSettings {
    return this.config;
  }

  /**
   * 获取默认项目目录
   */
  getDefaultProjectsDir(): string {
    return this.config.defaultProjectsDir;
  }

  /**
   * 获取复习算法
   */
  getReviewAlgorithm(): 'fsrs' | 'ebbinghaus' {
    return this.config.reviewAlgorithm;
  }

  /**
   * 获取艾宾浩斯间隔
   */
  getEbbinghausIntervals(): number[] {
    return this.config.ebbinghausIntervals;
  }

  /**
   * 获取时区
   */
  getTimezone(): string {
    return this.config.timezone;
  }

  /**
   * 更新配置
   */
  updateConfig(updates: Partial<UserSettings>): void {
    this.config = UserSettingsSchema.parse({
      ...this.config,
      ...updates,
    });
  }
}

/**
 * 全局配置加载器实例
 */
let globalConfigLoader: ConfigLoader | null = null;

/**
 * 获取全局配置加载器
 */
export function getConfigLoader(overrides?: Partial<UserSettings>): ConfigLoader {
  if (!globalConfigLoader || overrides) {
    globalConfigLoader = new ConfigLoader(overrides);
  }
  return globalConfigLoader;
}

/**
 * 重置全局配置加载器（用于测试）
 */
export function resetConfigLoader(): void {
  globalConfigLoader = null;
}
