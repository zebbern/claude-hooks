export interface GlobToRegexOptions {
  /**
   * When `true`, `*` matches any character including `/` (directory separators).
   * When `false` (default), `*` matches only within a single path segment (`[^/]*`).
   * `**` always matches across directories regardless of this option.
   */
  crossDirectories?: boolean;
}

/**
 * Converts a glob pattern to a RegExp.
 *
 * Supports `*`, `**`, `?`, and character classes `[]`.
 *
 * - `*` matches any characters within a segment (or any characters if `crossDirectories` is true).
 * - `**` matches any number of path segments (any depth).
 * - `?` matches a single character (respects `crossDirectories` for `/` exclusion).
 *
 * @param pattern - The glob pattern to convert.
 * @param options - Controls matching behavior.
 * @returns A case-insensitive RegExp anchored to the full string.
 */
export function globToRegex(pattern: string, options: GlobToRegexOptions = {}): RegExp {
  const { crossDirectories = false } = options;

  let regexStr = '^';
  let i = 0;
  while (i < pattern.length) {
    const ch = pattern[i]!;
    if (ch === '*' && pattern[i + 1] === '*') {
      // ** always crosses directories
      regexStr += '.*';
      i += 2;
      if (pattern[i] === '/') i++; // skip trailing slash after **
    } else if (ch === '*') {
      regexStr += crossDirectories ? '.*' : '[^/]*';
      i++;
    } else if (ch === '?') {
      regexStr += crossDirectories ? '.' : '[^/]';
      i++;
    } else if (ch === '.') {
      regexStr += '\\.';
      i++;
    } else if (ch === '[') {
      regexStr += '[';
      i++;
    } else if (ch === ']') {
      regexStr += ']';
      i++;
    } else {
      // Escape regex metacharacters that aren't glob syntax
      if (/[(){}|+^$\\]/.test(ch)) {
        regexStr += '\\' + ch;
      } else {
        regexStr += ch;
      }
      i++;
    }
  }
  regexStr += '$';
  return new RegExp(regexStr, 'i');
}
