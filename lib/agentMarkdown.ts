// lib/agentMarkdown.ts
//
// Turns an assistant reply into a small, typed document tree that
// components/assistant/AgentMessageBody.tsx renders as native views.
//
// The parser is a port of the website's lib/agent/agentMarkdown.ts, because
// both surfaces show replies from the same API. Keep the two in step: a change
// to what the assistant may write belongs in both files. blocksText, at the
// end of this file, is mobile-only and feeds screen reader labels.
//
// The output is data, not markup, and link targets are allow-listed here
// (http, https, mailto) before they can reach Linking.openURL. Text the
// assistant copied from an email or web page therefore can't inject anything.
//
// Deliberately unsupported: raw HTML (shown as text), images, footnotes,
// `_underscore_` emphasis (replies contain ids like venue_id, which must never
// turn italic), and setext headings.

// ── Types ──────────────────────────────────────────────────────────────────────

export type MdInline =
  | { type: 'text'; value: string }
  | { type: 'strong'; children: MdInline[] }
  | { type: 'em'; children: MdInline[] }
  | { type: 'code'; value: string }
  | { type: 'link'; href: string; children: MdInline[] }
  | { type: 'break' };

export type MdListItem = {
  children: MdInline[];
  /** Nested lists under this item. */
  sublists: MdList[];
};

export type MdList = {
  type: 'list';
  ordered: boolean;
  /** First number of an ordered list (lets "3. … 4. …" keep its numbering). */
  start: number;
  items: MdListItem[];
};

export type MdTableAlign = 'left' | 'center' | 'right' | null;

export type MdBlock =
  | { type: 'paragraph'; children: MdInline[] }
  | { type: 'heading'; level: 1 | 2 | 3; children: MdInline[] }
  | MdList
  | { type: 'code_block'; value: string }
  | { type: 'quote'; children: MdBlock[] }
  | { type: 'rule' }
  | { type: 'table'; align: MdTableAlign[]; head: MdInline[][]; rows: MdInline[][][] };

// ── Limits ─────────────────────────────────────────────────────────────────────

/**
 * Longest reply the parser will structure. Anything past this is rendered as
 * plain text, so a pathological reply can never make the chat window slow.
 * Real agent replies are a few thousand characters at most.
 */
export const MAX_MARKDOWN_CHARS = 40_000;
/** How deep bold-inside-italic-inside-link style nesting may go. */
const MAX_INLINE_DEPTH = 4;
/** How deep blockquotes may nest. */
const MAX_QUOTE_DEPTH = 3;
/** How many levels of nested lists are kept; deeper items join the last level. */
const MAX_LIST_DEPTH = 3;

// ── Links ──────────────────────────────────────────────────────────────────────

const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);

/**
 * Returns a normalised href when the link is safe to put in an <a>, or null.
 * Blocks javascript:, data:, vbscript:, relative paths and anything that
 * doesn't parse as a URL.
 *
 * @param raw - The link target exactly as the agent wrote it.
 * @returns The normalised URL string, or null if it must not become a link.
 */
export function safeHref(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  return SAFE_PROTOCOLS.has(url.protocol) ? url.href : null;
}

/**
 * Splits trailing sentence punctuation off a bare URL ("see https://x.com.")
 * and drops a closing parenthesis that has no opening partner in the URL
 * ("(https://x.com)"), so neither ends up inside the link.
 *
 * @param url - The URL as matched in running text.
 * @returns The URL to link and the text that follows it.
 */
export function trimUrlTail(url: string): { url: string; tail: string } {
  let end = url.length;
  for (;;) {
    const ch = url[end - 1];
    if (ch && '.,;:!?\'"*'.includes(ch)) { end--; continue; }
    if (ch === ')') {
      const body = url.slice(0, end);
      const opens = (body.match(/\(/g) || []).length;
      const closes = (body.match(/\)/g) || []).length;
      if (closes > opens) { end--; continue; }
    }
    break;
  }
  return { url: url.slice(0, end), tail: url.slice(end) };
}

// ── Inline parsing ─────────────────────────────────────────────────────────────

/*
 * One alternation, earliest match wins. No lookbehind: Safari before 16.4
 * throws a SyntaxError on it at load time, which would take the whole page
 * down, not just the chat.
 *   1  `inline code`
 *   2  **bold**          (content must not start or end with a space)
 *   3  *italic*          (same rule, so "5 * 3 * 2" stays text)
 *   4,5 [label](url)
 *   6  bare http(s) URL
 *   7  line break inside a paragraph
 */
const INLINE_PATTERN =
  /`([^`\n]+)`|\*\*(?=\S)([\s\S]*?\S)\*\*|\*(?=[^\s*])([^*\n]*?[^\s*])\*(?!\*)|\[([^\]\n]+)\]\(([^()\s]+(?:\([^()\s]*\)[^()\s]*)*)\)|(https?:\/\/[^\s<>]+)|(\n)/g;

/**
 * Parses inline Markdown in one block of text.
 *
 * @param text - Text of a paragraph, heading, list item or table cell.
 * @param depth - Current nesting depth (callers leave this at 0).
 * @returns Inline nodes; adjacent text is merged.
 */
export function parseInline(text: string, depth = 0): MdInline[] {
  if (depth >= MAX_INLINE_DEPTH) return text ? [{ type: 'text', value: text }] : [];

  const out: MdInline[] = [];
  const pushText = (value: string) => {
    if (!value) return;
    const last = out[out.length - 1];
    if (last && last.type === 'text') last.value += value;
    else out.push({ type: 'text', value });
  };

  // A fresh RegExp per call: the shared pattern is global (stateful lastIndex),
  // and parseInline recurses.
  const re = new RegExp(INLINE_PATTERN.source, 'g');
  let cursor = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    pushText(text.slice(cursor, m.index));
    cursor = m.index + m[0].length;

    const [, code, strong, em, label, href, bareUrl, newline] = m;
    if (code !== undefined) {
      out.push({ type: 'code', value: code });
    } else if (strong !== undefined) {
      out.push({ type: 'strong', children: parseInline(strong, depth + 1) });
    } else if (em !== undefined) {
      out.push({ type: 'em', children: parseInline(em, depth + 1) });
    } else if (label !== undefined && href !== undefined) {
      const safe = safeHref(href);
      if (safe) out.push({ type: 'link', href: safe, children: parseInline(label, depth + 1) });
      else pushText(m[0]); // unsafe target: show what was written, never link it
    } else if (bareUrl !== undefined) {
      const { url, tail } = trimUrlTail(bareUrl);
      const safe = safeHref(url);
      if (safe) out.push({ type: 'link', href: safe, children: [{ type: 'text', value: url }] });
      else pushText(url);
      pushText(tail);
    } else if (newline !== undefined) {
      out.push({ type: 'break' });
    }
  }
  pushText(text.slice(cursor));
  return out;
}

// ── Block parsing ──────────────────────────────────────────────────────────────

const FENCE = /^\s{0,3}(`{3,}|~{3,})/;
const HEADING = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/;
const RULE = /^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/;
const QUOTE = /^\s{0,3}>\s?(.*)$/;
const LIST_ITEM = /^(\s*)([-*+•]|\d{1,4}[.)])\s+(.*)$/;
const TABLE_SEPARATOR = /^\s*\|?\s*:?-{2,}:?\s*(?:\|\s*:?-{2,}:?\s*)*\|?\s*$/;

/** True when a line starts a block other than a paragraph. */
function startsBlock(line: string, next: string | undefined): boolean {
  return FENCE.test(line)
    || HEADING.test(line)
    || RULE.test(line)
    || QUOTE.test(line)
    || LIST_ITEM.test(line)
    || isTableStart(line, next);
}

function isTableStart(line: string, next: string | undefined): boolean {
  return line.includes('|') && next !== undefined && TABLE_SEPARATOR.test(next) && next.includes('-');
}

/** Splits a table row (outer pipes already stripped) into trimmed cells, honouring escaped pipes (\|). */
function splitUnescaped(s: string): string[] {
  const cells: string[] = [];
  let cell = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '\\' && s[i + 1] === '|') { cell += '|'; i++; continue; }
    if (ch === '|') { cells.push(cell.trim()); cell = ''; continue; }
    cell += ch;
  }
  cells.push(cell.trim());
  return cells;
}

function parseAlign(cell: string): MdTableAlign {
  const c = cell.trim();
  const left = c.startsWith(':');
  const right = c.endsWith(':');
  if (left && right) return 'center';
  if (right) return 'right';
  if (left) return 'left';
  return null;
}

type ListLine = { indent: number; ordered: boolean; number: number; text: string };

/**
 * Builds one or more list blocks from consecutive list lines. A change between
 * bullets and numbers at the top level starts a new list; deeper lines nest
 * under the item above them.
 */
function buildLists(lines: ListLine[]): MdList[] {
  const lists: MdList[] = [];
  type Frame = { indent: number; list: MdList };
  let stack: Frame[] = [];

  for (const line of lines) {
    // Close deeper levels this line has stepped back out of.
    while (stack.length > 1 && line.indent < (stack[stack.length - 1]?.indent ?? 0)) stack.pop();

    const top = stack[stack.length - 1];
    const parentItem = top?.list.items[top.list.items.length - 1];

    if (!top) {
      const list: MdList = { type: 'list', ordered: line.ordered, start: line.number, items: [] };
      lists.push(list);
      stack = [{ indent: line.indent, list }];
    } else if (line.indent >= top.indent + 2 && parentItem && stack.length < MAX_LIST_DEPTH) {
      const list: MdList = { type: 'list', ordered: line.ordered, start: line.number, items: [] };
      parentItem.sublists.push(list);
      stack.push({ indent: line.indent, list });
    } else if (stack.length === 1 && line.indent <= top.indent && line.ordered !== top.list.ordered) {
      const list: MdList = { type: 'list', ordered: line.ordered, start: line.number, items: [] };
      lists.push(list);
      stack = [{ indent: line.indent, list }];
    }

    stack[stack.length - 1]?.list.items.push({ children: parseInline(line.text), sublists: [] });
  }
  return lists;
}

/**
 * Parses an agent reply into blocks.
 *
 * @param source - The reply text exactly as the agent sent it.
 * @param quoteDepth - Current blockquote depth (callers leave this at 0).
 * @returns The block tree. Never throws; text it can't structure becomes a paragraph.
 */
export function parseAgentMarkdown(source: string, quoteDepth = 0): MdBlock[] {
  if (!source) return [];
  if (source.length > MAX_MARKDOWN_CHARS) {
    return [{ type: 'paragraph', children: [{ type: 'text', value: source }] }];
  }

  const lines = source.replace(/\r\n?/g, '\n').replace(/\t/g, '    ').split('\n');
  const blocks: MdBlock[] = [];
  // Reads a line by index. Every loop below checks the bound first, so the empty fallback only satisfies the type.
  const at = (n: number): string => lines[n] ?? '';
  let i = 0;

  while (i < lines.length) {
    const line = at(i);

    if (!line.trim()) { i++; continue; }

    // Fenced code block — everything up to the matching fence is literal.
    const fence = FENCE.exec(line);
    if (fence) {
      const marker = fence[1] ?? '';
      const body: string[] = [];
      i++;
      while (i < lines.length && !at(i).trim().startsWith(marker)) body.push(at(i++));
      i++; // skip the closing fence (or run off the end of an unclosed one)
      blocks.push({ type: 'code_block', value: body.join('\n') });
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      // h1/h2 from the model render at the same size as h3; a chat bubble has no room for page titles.
      const level = Math.min(3, Math.max(1, (heading[1] ?? '').length - 1)) as 1 | 2 | 3;
      blocks.push({ type: 'heading', level, children: parseInline(heading[2] ?? '') });
      i++;
      continue;
    }

    // Checked before lists: "- - -" and "* * *" are rules, not list items.
    if (RULE.test(line)) {
      blocks.push({ type: 'rule' });
      i++;
      continue;
    }

    if (QUOTE.test(line)) {
      const body: string[] = [];
      while (i < lines.length) {
        const q = QUOTE.exec(at(i));
        if (!q) break;
        body.push(q[1] ?? '');
        i++;
      }
      blocks.push(quoteDepth < MAX_QUOTE_DEPTH
        ? { type: 'quote', children: parseAgentMarkdown(body.join('\n'), quoteDepth + 1) }
        : { type: 'paragraph', children: parseInline(body.join('\n')) });
      continue;
    }

    if (isTableStart(line, lines[i + 1])) {
      const head = splitUnescaped(stripPipes(line));
      const align = splitUnescaped(stripPipes(at(i + 1))).map(parseAlign);
      i += 2;
      const rows: MdInline[][][] = [];
      while (i < lines.length && at(i).trim() && at(i).includes('|')) {
        const cells = splitUnescaped(stripPipes(at(i)));
        // Pad or trim every row to the header's width so columns line up.
        const fitted = head.map((_, c) => cells[c] ?? '');
        rows.push(fitted.map(c => parseInline(c)));
        i++;
      }
      blocks.push({
        type: 'table',
        align: head.map((_, c) => align[c] ?? null),
        head: head.map(c => parseInline(c)),
        rows,
      });
      continue;
    }

    if (LIST_ITEM.test(line)) {
      const items: ListLine[] = [];
      while (i < lines.length) {
        const current = at(i);
        const item = LIST_ITEM.exec(current);
        if (item) {
          const marker = item[2] ?? '';
          const ordered = /^\d/.test(marker);
          items.push({
            indent: (item[1] ?? '').length,
            ordered,
            number: ordered ? parseInt(marker, 10) : 1,
            text: item[3] ?? '',
          });
          i++;
          continue;
        }
        if (!current.trim()) {
          // A blank line ends the list unless another item follows it.
          let j = i + 1;
          while (j < lines.length && !at(j).trim()) j++;
          if (j < lines.length && LIST_ITEM.exec(at(j))) { i = j; continue; }
          break;
        }
        // An indented line with no marker continues the item above it.
        const lastItem = items[items.length - 1];
        if (/^\s{2,}\S/.test(current) && lastItem && !startsBlock(current.trim(), lines[i + 1])) {
          lastItem.text += `\n${current.trim()}`;
          i++;
          continue;
        }
        break;
      }
      blocks.push(...buildLists(items));
      continue;
    }

    // Paragraph: runs until a blank line or the start of another block.
    const para: string[] = [line];
    i++;
    while (i < lines.length && at(i).trim() && !startsBlock(at(i), lines[i + 1])) {
      para.push(at(i));
      i++;
    }
    blocks.push({ type: 'paragraph', children: parseInline(para.map(l => l.trim()).join('\n')) });
  }

  return blocks;
}

function stripPipes(line: string): string {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1);
  return s;
}

/**
 * Plain-text version of inline nodes — used for accessible labels and tests.
 *
 * @param nodes - Inline nodes from parseInline.
 * @returns Their visible text, with line breaks as "\n".
 */
export function inlineText(nodes: MdInline[]): string {
  return nodes.map(n => {
    switch (n.type) {
      case 'text':
      case 'code':
        return n.value;
      case 'break':
        return '\n';
      default:
        return inlineText(n.children);
    }
  }).join('');
}

/**
 * Plain-text version of a whole reply, with Markdown symbols removed. Screen
 * readers get this instead of the raw reply, so VoiceOver and TalkBack never
 * read out pipes and asterisks.
 *
 * @param blocks - Blocks from parseAgentMarkdown.
 * @returns The reply's visible text.
 */
export function blocksText(blocks: MdBlock[]): string {
  const listText = (list: MdList): string =>
    list.items
      .map((item) => [inlineText(item.children), ...item.sublists.map(listText)].join('\n'))
      .join('\n');

  return blocks
    .map((block) => {
      switch (block.type) {
        case 'paragraph':
        case 'heading':
          return inlineText(block.children);
        case 'list':
          return listText(block);
        case 'code_block':
          return block.value;
        case 'quote':
          return blocksText(block.children);
        case 'rule':
          return '';
        case 'table':
          return block.rows
            .map((row) =>
              row
                .map((cell, c) => `${inlineText(block.head[c] ?? [])}: ${inlineText(cell)}`)
                .join(', ')
            )
            .join('\n');
      }
    })
    .filter(Boolean)
    .join('\n');
}
