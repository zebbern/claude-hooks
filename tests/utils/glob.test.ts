import { describe, it, expect } from 'vitest';
import { globToRegex } from '../../src/utils/glob.js';

describe('globToRegex', () => {
  describe('* wildcard', () => {
    it('matches any characters within a single segment by default', () => {
      const re = globToRegex('*.ts');
      expect(re.test('index.ts')).toBe(true);
      expect(re.test('foo.ts')).toBe(true);
    });

    it('does not cross directory boundaries by default', () => {
      const re = globToRegex('*.ts');
      expect(re.test('src/index.ts')).toBe(false);
    });

    it('crosses directory boundaries when crossDirectories is true', () => {
      const re = globToRegex('*.ts', { crossDirectories: true });
      expect(re.test('src/index.ts')).toBe(true);
      expect(re.test('a/b/c.ts')).toBe(true);
    });
  });

  describe('? single-char wildcard', () => {
    it('matches exactly one character', () => {
      const re = globToRegex('file?.ts');
      expect(re.test('file1.ts')).toBe(true);
      expect(re.test('fileA.ts')).toBe(true);
    });

    it('does not match zero characters', () => {
      const re = globToRegex('file?.ts');
      expect(re.test('file.ts')).toBe(false);
    });

    it('does not match multiple characters', () => {
      const re = globToRegex('file?.ts');
      expect(re.test('file12.ts')).toBe(false);
    });

    it('does not match / by default', () => {
      const re = globToRegex('file?ts');
      expect(re.test('file/ts')).toBe(false);
    });

    it('matches / when crossDirectories is true', () => {
      const re = globToRegex('file?ts', { crossDirectories: true });
      expect(re.test('file/ts')).toBe(true);
    });
  });

  describe('** globstar', () => {
    it('matches any depth of path segments', () => {
      const re = globToRegex('src/**/*.ts');
      expect(re.test('src/index.ts')).toBe(true);
      expect(re.test('src/utils/helper.ts')).toBe(true);
      expect(re.test('src/a/b/c/d.ts')).toBe(true);
    });

    it('matches zero segments after **/', () => {
      const re = globToRegex('**/*.ts');
      expect(re.test('index.ts')).toBe(true);
      expect(re.test('src/index.ts')).toBe(true);
    });
  });

  describe('special character escaping', () => {
    it('escapes dots in patterns', () => {
      const re = globToRegex('*.ts');
      expect(re.test('xts')).toBe(false); // dot should not match any char
      expect(re.test('x.ts')).toBe(true);
    });

    it('handles .env* pattern', () => {
      const re = globToRegex('.env*');
      expect(re.test('.env')).toBe(true);
      expect(re.test('.env.local')).toBe(true);
      expect(re.test('.env.production')).toBe(true);
    });
  });

  describe('src/**/*.ts pattern', () => {
    it('matches TypeScript files at any depth under src/', () => {
      const re = globToRegex('src/**/*.ts');
      expect(re.test('src/index.ts')).toBe(true);
      expect(re.test('src/utils/text.ts')).toBe(true);
      expect(re.test('src/a/b/c.ts')).toBe(true);
    });

    it('does not match non-.ts files', () => {
      const re = globToRegex('src/**/*.ts');
      expect(re.test('src/index.js')).toBe(false);
    });

    it('does not match files outside src/', () => {
      const re = globToRegex('src/**/*.ts');
      expect(re.test('lib/index.ts')).toBe(false);
    });
  });

  describe('anchoring', () => {
    it('anchors pattern to full string (start and end)', () => {
      const re = globToRegex('foo');
      expect(re.test('foo')).toBe(true);
      expect(re.test('foobar')).toBe(false);
      expect(re.test('barfoo')).toBe(false);
    });
  });

  describe('case sensitivity', () => {
    it('is case-insensitive', () => {
      const re = globToRegex('README.md');
      expect(re.test('readme.md')).toBe(true);
      expect(re.test('README.MD')).toBe(true);
      expect(re.test('Readme.Md')).toBe(true);
    });
  });

  describe('regex metacharacter escaping', () => {
    it('treats parentheses as literals', () => {
      const re = globToRegex('file(v1).txt');
      expect(re.test('file(v1).txt')).toBe(true);
      // Without escaping, () would be a capture group and match without parens
      expect(re.test('filev1.txt')).toBe(false);
    });

    it('treats pipe as literal', () => {
      const re = globToRegex('data|backup.log');
      // Pipe is literal, so the whole pattern must match
      expect(re.test('data|backup.log')).toBe(true);
      // If pipe were regex alternation, "backup.log" alone would match
      expect(re.test('backup.log')).toBe(false);
    });

    it('treats plus as literal', () => {
      const re = globToRegex('C++');
      expect(re.test('C++')).toBe(true);
      // If + were regex quantifier, "CCC" might match
      expect(re.test('CCC')).toBe(false);
    });

    it('treats braces as literals', () => {
      const re = globToRegex('config{prod}');
      expect(re.test('config{prod}')).toBe(true);
      expect(re.test('configprod')).toBe(false);
    });

    it('treats caret and dollar as literals', () => {
      const re = globToRegex('^start$');
      expect(re.test('^start$')).toBe(true);
      expect(re.test('start')).toBe(false);
    });
  });
});
