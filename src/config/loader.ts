import { cosmiconfigSync } from 'cosmiconfig';
import os from 'os';
import path from 'path';
import { UserSettingsSchema, type UserSettings } from '../types/index.js';

const MODULE_NAME = 'learning-cli';
const APP_DIR_NAME = 'learning-process-manager';

export function getDefaultDataDir(): string {
  if (process.env.LEARN_HOME) {
    return path.resolve(process.env.LEARN_HOME);
  }

  if (process.platform === 'win32') {
    return path.join(process.env.APPDATA ?? path.join(os.homedir(), 'AppData', 'Roaming'), APP_DIR_NAME);
  }

  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', APP_DIR_NAME);
  }

  return path.join(process.env.XDG_DATA_HOME ?? path.join(os.homedir(), '.local', 'share'), APP_DIR_NAME);
}

export function getDefaultIndexPath(): string {
  return path.join(getDefaultDataDir(), 'learning-projects.json');
}

export function getDefaultProjectsDir(): string {
  return path.join(getDefaultDataDir(), 'projects');
}

/**
 * 默认用户设置
 */
function getDefaultUserSettings(): UserSettings {
  return {
    indexPath: getDefaultIndexPath(),
    defaultProjectsDir: getDefaultProjectsDir(),
    reviewAlgorithm: 'fsrs',
    ebbinghausIntervals: [0.5, 1, 3, 7, 14, 30, 90],
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}

/**
 * 配置加载器
 */
export class ConfigLoader {
  private config: UserSettings;
  private configFilePath?: string;
  private hasOverrides: boolean;

  constructor(overrides?: Partial<UserSettings>) {
    this.hasOverrides = overrides !== undefined && Object.keys(overrides).length > 0;
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
    this.configFilePath = result?.filepath;
    const envConfig = this.loadEnvConfig();
    const defaultUserSettings = getDefaultUserSettings();

    // 合并配置
    const merged = {
      ...defaultUserSettings,
      ...fileConfig,
      ...envConfig,
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

  hasConfigFile(): boolean {
    return this.configFilePath !== undefined;
  }

  hasExplicitConfig(): boolean {
    return this.hasConfigFile() || this.hasOverrides;
  }

  getConfigFilePath(): string | undefined {
    return this.configFilePath;
  }

  /**
   * 获取默认项目目录
   */
  getDefaultProjectsDir(): string {
    return this.config.defaultProjectsDir;
  }

  getIndexPath(): string {
    return this.config.indexPath;
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

  private loadEnvConfig(): Partial<UserSettings> {
    const envConfig: Partial<UserSettings> = {};

    if (process.env.LEARN_INDEX_PATH) {
      envConfig.indexPath = path.resolve(process.env.LEARN_INDEX_PATH);
    }

    if (process.env.LEARN_PROJECTS_DIR) {
      envConfig.defaultProjectsDir = path.resolve(process.env.LEARN_PROJECTS_DIR);
    }

    return envConfig;
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
