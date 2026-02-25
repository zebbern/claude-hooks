import { describe, it, expect } from 'vitest';
import { HELP_TOPICS, formatTopicList, getTopicContent } from '../../src/help-topics.js';

describe('help-topics', () => {
  describe('HELP_TOPICS', () => {
    it('contains all expected topics', () => {
      expect(HELP_TOPICS.has('hooks')).toBe(true);
      expect(HELP_TOPICS.has('presets')).toBe(true);
      expect(HELP_TOPICS.has('config')).toBe(true);
      expect(HELP_TOPICS.has('security')).toBe(true);
      expect(HELP_TOPICS.has('vscode')).toBe(true);
    });

    it('has exactly 5 topics', () => {
      expect(HELP_TOPICS.size).toBe(5);
    });

    it('each topic has name, summary, and content', () => {
      for (const topic of HELP_TOPICS.values()) {
        expect(topic.name).toBeTruthy();
        expect(topic.summary).toBeTruthy();
        expect(topic.content).toBeTruthy();
        expect(topic.content.length).toBeGreaterThan(50);
      }
    });
  });

  describe('getTopicContent', () => {
    it('returns content for a valid topic', () => {
      const content = getTopicContent('hooks');
      expect(content).toBeTruthy();
      expect(content).toContain('PreToolUse');
      expect(content).toContain('PostToolUse');
      expect(content).toContain('SessionStart');
    });

    it('returns content for presets topic with all preset names', () => {
      const content = getTopicContent('presets');
      expect(content).toBeTruthy();
      expect(content).toContain('minimal');
      expect(content).toContain('security');
      expect(content).toContain('quality');
      expect(content).toContain('full');
    });

    it('returns content for config topic', () => {
      const content = getTopicContent('config');
      expect(content).toBeTruthy();
      expect(content).toContain('claude-hooks.config.json');
    });

    it('returns content for security topic with guard names', () => {
      const content = getTopicContent('security');
      expect(content).toBeTruthy();
      expect(content).toContain('command-guard');
      expect(content).toContain('file-guard');
      expect(content).toContain('secret-leak-guard');
    });

    it('returns content for vscode topic', () => {
      const content = getTopicContent('vscode');
      expect(content).toBeTruthy();
      expect(content).toContain('VS Code');
      expect(content).toContain('.github/hooks');
    });

    it('returns null for unknown topic', () => {
      const content = getTopicContent('nonexistent');
      expect(content).toBeNull();
    });
  });

  describe('formatTopicList', () => {
    it('lists all available topics', () => {
      const output = formatTopicList();
      expect(output).toContain('hooks');
      expect(output).toContain('presets');
      expect(output).toContain('config');
      expect(output).toContain('security');
      expect(output).toContain('vscode');
    });

    it('includes usage hint', () => {
      const output = formatTopicList();
      expect(output).toContain('claude-hooks help <topic>');
    });

    it('includes topic summaries', () => {
      const output = formatTopicList();
      for (const topic of HELP_TOPICS.values()) {
        expect(output).toContain(topic.summary);
      }
    });
  });
});
