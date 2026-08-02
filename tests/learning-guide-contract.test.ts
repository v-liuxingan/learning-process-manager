import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

function readRepoFile(...segments: string[]): string {
  return fs.readFileSync(path.join(process.cwd(), ...segments), 'utf-8');
}

describe('learning guide orientation contract', () => {
  it('requires a minimal mental model before the course route', () => {
    const template = readRepoFile('templates', 'project', 'README.md');
    const initialization = readRepoFile(
      'skills',
      'learning-guide',
      'references',
      'project-initialization.md',
    );
    const quality = readRepoFile(
      'skills',
      'learning-guide',
      'references',
      'quality-standards.md',
    );

    for (const requiredField of [
      '一句话定义',
      '核心问题',
      '整体运行图景',
      '相邻概念对比',
      '它不是什么',
      '适用边界',
    ]) {
      expect(template).toContain(requiredField);
    }

    expect(initialization).toContain('建立学习对象的最小心智模型');
    expect(quality).toContain('学习对象定向与路线总览缺一不可');
  });

  it('lets explicit restart intent override the persisted resume entry without resetting data', () => {
    const guide = readRepoFile('skills', 'learning-guide', 'SKILL.md');
    const playbook = readRepoFile(
      'skills',
      'learning-guide',
      'references',
      'teaching-playbook.md',
    );
    const cliSkill = readRepoFile('skills', 'learning-cli', 'SKILL.md');

    expect(guide).toContain('即使 CLI 返回 `resume`');
    expect(guide).toContain('不得从“重新开始学习”推断为清空数据');
    expect(playbook).toContain('project_overview → unit_overview → diagnostic');
    expect(cliSkill).toContain('CLI 不解析用户自然语言');
  });
});
