/**
 * INI → YAML Parser
 *
 * Handles:
 *  - Sections: [section.name]
 *  - Key-value pairs: key = value
 *  - Comments: ; or # (inline and full-line)
 *  - Nested sections via dots: [parent.child] → nested YAML
 *  - Quoted values, multi-line values (continuation with leading whitespace)
 *  - Empty lines preserved as spacing
 */

const SECTION_RE = /^\s*\[([^\]]+)\]\s*$/;
const KV_RE = /^(\s*)([^=;#\n]+?)\s*=\s*(.*?)\s*$/;
const COMMENT_RE = /^(\s*)([;#])\s*(.*)$/;
const EMPTY_RE = /^\s*$/;

/**
 * Parse an INI string into a structured object.
 * Preserves comments as _comments arrays and order via _keys.
 */
export function parseINI(text) {
  const lines = text.split('\n');
  const result = { _sections: [] };
  /** @type {string[]} */
  let currentPath = [];
  /** @type {Object} */
  let currentSection = result;
  /** @type {{ indent: number, text: string, comment: string }[]} */
  let pendingComments = [];

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.replace(/\r$/, '');

    // Empty line
    if (EMPTY_RE.test(line)) {
      if (pendingComments.length > 0) {
        flushComments(currentSection, pendingComments);
        pendingComments = [];
      }
      appendLine(currentSection, { type: 'blank', raw: '' });
      continue;
    }

    // Full-line comment
    const cm = line.match(COMMENT_RE);
    if (cm && !cm[1].includes('=')) {
      // It's a comment line (not a value with # in it)
      // Check it's really a comment — no '=' before the comment marker
      const beforeComment = line.substring(0, line.indexOf(cm[2]));
      if (!beforeComment.includes('=')) {
        const commentText = (cm[3] || '').trim();
        pendingComments.push({ indent: cm[1].length, text: commentText, comment: cm[2] });
        continue;
      }
    }

    // Section header
    const sm = line.match(SECTION_RE);
    if (sm) {
      if (pendingComments.length > 0) {
        flushComments(currentSection, pendingComments);
        pendingComments = [];
      }
      const sectionName = sm[1].trim();
      currentPath = sectionName.split('.').filter(Boolean);
      currentSection = ensureSection(result, currentPath);
      appendLine(currentSection, { type: 'section', name: sectionName, raw });
      continue;
    }

    // Key-value pair
    const km = line.match(KV_RE);
    if (km) {
      if (pendingComments.length > 0) {
        flushComments(currentSection, pendingComments);
        pendingComments = [];
      }

      const key = km[2].trim();
      let value = km[3].trim();

      // Strip inline comment from value
      let inlineComment = null;
      const inlineIdx = findInlineComment(value);
      if (inlineIdx >= 0) {
        inlineComment = value.substring(inlineIdx + 1).trim();
        value = value.substring(0, inlineIdx).trim();
      }

      // Strip surrounding quotes
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      const entry = { type: 'kv', key, value, raw };

      if (inlineComment) {
        entry.comment = inlineComment;
      }

      appendLine(currentSection, entry);
      continue;
    }

    // Continuation line or unrecognized — treat as raw
    if (pendingComments.length > 0) {
      flushComments(currentSection, pendingComments);
      pendingComments = [];
    }
    appendLine(currentSection, { type: 'raw', raw: line });
  }

  // Flush any remaining pending comments
  if (pendingComments.length > 0) {
    flushComments(currentSection, pendingComments);
  }

  return result;
}

function findInlineComment(value) {
  let inString = false;
  let stringChar = '';
  for (let i = 0; i < value.length; i++) {
    const ch = value[i];
    if (inString) {
      if (ch === stringChar && value[i - 1] !== '\\') {
        inString = false;
      }
    } else if (ch === '"' || ch === "'") {
      inString = true;
      stringChar = ch;
    } else if (ch === ';' || ch === '#') {
      return i;
    }
  }
  return -1;
}

function ensureSection(root, path) {
  let current = root;
  for (const segment of path) {
    if (!current[segment]) {
      current[segment] = { _lines: [], _sections: [] };
    }
    if (!current._sections.includes(segment)) {
      current._sections.push(segment);
    }
    current = current[segment];
  }
  if (!current._lines) {
    current._lines = [];
  }
  return current;
}

function appendLine(section, entry) {
  if (!section._lines) section._lines = [];
  section._lines.push(entry);
}

function flushComments(section, comments) {
  for (const c of comments) {
    appendLine(section, { type: 'comment', text: c.text, marker: c.comment });
  }
  comments.length = 0;
}

/**
 * Convert parsed INI structure to YAML string.
 * @param {Object} parsed - Result from parseINI()
 * @param {number} indent - Current indentation level
 * @returns {string}
 */
export function toYAML(parsed, indent = 0) {
  const lines = [];
  const pad = '  '.repeat(indent);

  // Output root-level comments before any section
  for (const entry of (parsed._lines || [])) {
    if (entry.type === 'comment') {
      lines.push(`# ${entry.text}`);
    } else if (entry.type === 'blank') {
      lines.push('');
    }
  }

  for (const sectionName of (parsed._sections || [])) {
    const section = parsed[sectionName];
    if (!section) continue;

    // Emit any top-level comments before the section
    const prefixItems = [];
    const bodyItems = [];

    for (const entry of (section._lines || [])) {
      if (entry.type === 'comment') {
        prefixItems.push(entry);
      } else if (entry.type === 'blank') {
        // track blanks for spacing
        bodyItems.push(entry);
      } else {
        bodyItems.push(entry);
      }
    }

    // Output comments that preface this section
    for (const c of prefixItems) {
      lines.push(`${pad}# ${c.text}`);
    }

    lines.push(`${pad}${sectionName}:`);

    // Output body
    const hasSubSections = (section._sections && section._sections.length > 0);
    let hadContent = false;

    for (const entry of bodyItems) {
      if (entry.type === 'blank') {
        if (hasSubSections || hadContent) {
          lines.push('');
        }
        continue;
      }
      if (entry.type === 'comment') {
        lines.push(`${pad}  # ${entry.text}`);
        hadContent = true;
        continue;
      }
      if (entry.type === 'kv') {
        const yamlValue = formatYAMLValue(entry.value);
        let kvLine = `${pad}  ${entry.key}: ${yamlValue}`;
        if (entry.comment) {
          kvLine += `  # ${entry.comment}`;
        }
        lines.push(kvLine);
        hadContent = true;
        continue;
      }
      if (entry.type === 'section') {
        // Section markers are structural, not content — skip silently
        continue;
      }
      if (entry.type === 'raw') {
        if (entry.raw && entry.raw.trim()) {
          lines.push(`${pad}  # ${entry.raw.trim()}`);
        }
        continue;
      }
    }

    // Recurse into subsections
    if (hasSubSections) {
      if (hadContent) lines.push('');
      const subYAML = toYAML(section, indent + 1);
      if (subYAML.trim()) {
        lines.push(subYAML.trimEnd());
      }
    }
  }

  return lines.join('\n');
}

/**
 * Format a value for YAML output.
 * Strings with special chars get quoted; numbers/booleans left bare.
 */
function formatYAMLValue(value) {
  if (value === '' || value === undefined || value === null) {
    return "''";
  }

  // Booleans
  if (/^(true|false|yes|no|on|off)$/i.test(value)) {
    const lc = value.toLowerCase();
    if (lc === 'true' || lc === 'false') return value.toLowerCase();
    if (lc === 'yes' || lc === 'on') return 'true';
    if (lc === 'no' || lc === 'off') return 'false';
  }

  // Numbers
  if (/^-?\d+(\.\d+)?$/.test(value) && !/^0\d/.test(value)) {
    return value;
  }

  // Null
  if (/^(null|none|nil)$/i.test(value)) {
    return 'null';
  }

  // Needs quoting?
  const needsQuoting = /[#&*!|>{}\[\]%@`,'"?:=\-\s]|^</.test(value) || value === '';

  if (needsQuoting) {
    // Use single quotes, escape internal single quotes
    const escaped = value.replace(/'/g, "''");
    return `'${escaped}'`;
  }

  if (value.length === 0) return "''";
  return value;
}

/**
 * One-shot: INI string → YAML string
 */
export function iniToYaml(iniText) {
  if (!iniText || !iniText.trim()) return '';
  const parsed = parseINI(iniText);
  return toYAML(parsed);
}
