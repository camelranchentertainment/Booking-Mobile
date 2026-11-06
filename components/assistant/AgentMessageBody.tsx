// components/assistant/AgentMessageBody.tsx
//
// Renders one assistant reply as native views: headings, lists, tables, links,
// bold and code, parsed by lib/agentMarkdown.ts. The website's chat shows the
// same replies through its own renderer.
//
// Tables are stacked into one small card per row instead of columns. A chat
// bubble on a phone can't fit four columns of venue names and sentences, and a
// sideways-scrolling table would fight with the thread's own scrolling.
import 'react-native-url-polyfill/auto'; // safeHref in the parser needs a full URL implementation.

import { useMemo, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  inlineText,
  parseAgentMarkdown,
  type MdBlock,
  type MdInline,
  type MdList,
} from '../../lib/agentMarkdown';
import { openSafely } from '../../lib/links';
import { colors, fonts, radius, space, type } from '../../lib/theme';

type Props = {
  /** The reply text exactly as the assistant sent it. */
  content: string;
};

/**
 * One assistant reply, fully shown.
 *
 * @param props.content - Reply text (Markdown subset).
 */
export function AgentMessageBody({ content }: Props) {
  // The thread re-renders on every keystroke in the composer; memoising keeps
  // long histories from being re-parsed each time.
  const blocks = useMemo(() => parseAgentMarkdown(content), [content]);
  return <View style={styles.body}>{blocks.map((block, i) => renderBlock(block, i))}</View>;
}

function renderBlock(block: MdBlock, key: number): ReactNode {
  switch (block.type) {
    case 'paragraph':
      return (
        <Text key={key} selectable style={styles.text}>
          {renderInlines(block.children)}
        </Text>
      );
    case 'heading':
      return (
        <Text key={key} selectable accessibilityRole="header" style={styles.heading}>
          {renderInlines(block.children)}
        </Text>
      );
    case 'list':
      return renderList(block, key);
    case 'code_block':
      return (
        <View key={key} style={styles.codeBlock}>
          <Text selectable style={styles.code}>
            {block.value}
          </Text>
        </View>
      );
    case 'quote':
      return (
        <View key={key} style={styles.quote}>
          {block.children.map((child, i) => renderBlock(child, i))}
        </View>
      );
    case 'rule':
      return <View key={key} style={styles.rule} />;
    case 'table':
      return (
        <View key={key} style={styles.table}>
          {block.rows.map((row, r) => (
            <View key={r} style={styles.tableRow}>
              {row.map((cell, c) =>
                inlineText(cell).trim() ? renderCell(cell, block.head[c] ?? [], c) : null
              )}
            </View>
          ))}
        </View>
      );
  }
}

/** The first column names the row, so it reads as the card's title; the rest get their column label. */
function renderCell(cell: MdInline[], head: MdInline[], column: number): ReactNode {
  if (column === 0) {
    return (
      <Text key={column} selectable style={styles.cardTitle}>
        {renderInlines(cell)}
      </Text>
    );
  }
  return (
    <View key={column} style={styles.cardField}>
      <Text style={styles.cardLabel}>{inlineText(head)}</Text>
      <Text selectable style={styles.text}>
        {renderInlines(cell)}
      </Text>
    </View>
  );
}

function renderList(list: MdList, key: number): ReactNode {
  return (
    <View key={key} style={styles.list}>
      {list.items.map((item, i) => (
        <View key={i} style={styles.listItem}>
          <Text style={styles.marker}>{list.ordered ? `${list.start + i}.` : '•'}</Text>
          <View style={styles.listContent}>
            <Text selectable style={styles.text}>
              {renderInlines(item.children)}
            </Text>
            {item.sublists.map((sub, s) => renderList(sub, s))}
          </View>
        </View>
      ))}
    </View>
  );
}

function renderInlines(nodes: MdInline[]): ReactNode[] {
  return nodes.map((node, i) => renderInline(node, i));
}

function renderInline(node: MdInline, key: number): ReactNode {
  switch (node.type) {
    case 'text':
      return node.value;
    case 'strong':
      return (
        <Text key={key} style={styles.strong}>
          {renderInlines(node.children)}
        </Text>
      );
    case 'em':
      return (
        <Text key={key} style={styles.em}>
          {renderInlines(node.children)}
        </Text>
      );
    case 'code':
      return (
        <Text key={key} style={styles.code}>
          {node.value}
        </Text>
      );
    case 'break':
      return '\n';
    case 'link':
      return (
        <Text
          key={key}
          accessibilityRole="link"
          onPress={() => void openSafely(node.href)}
          style={styles.link}>
          {renderInlines(node.children)}
        </Text>
      );
  }
}

const styles = StyleSheet.create({
  body: { gap: space.sm },
  text: { ...type.base, color: colors.cream },
  heading: { ...type.lg, color: colors.cream },
  strong: { fontFamily: fonts.bodyBold },
  em: { fontStyle: 'italic' },
  link: { color: colors.mustard, textDecorationLine: 'underline' },
  code: { ...type.sm, fontFamily: fonts.bodySemibold, color: colors.cream },
  codeBlock: { backgroundColor: colors.backgroundDeep, borderRadius: radius.sm, padding: space.sm },
  quote: { gap: space.sm, borderLeftWidth: 3, borderLeftColor: colors.border, paddingLeft: space.md },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  list: { gap: space.xs },
  listItem: { flexDirection: 'row', gap: space.sm },
  marker: { ...type.base, color: colors.mustard },
  // flexShrink, not flex: 1. The bubble sizes to its content, so flex: 1 would collapse this to nothing.
  listContent: { flexShrink: 1, gap: space.xs },
  table: { gap: space.sm },
  tableRow: {
    gap: space.xs,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    padding: space.md,
  },
  cardTitle: { ...type.md, color: colors.cream },
  cardField: { gap: space.xxs },
  cardLabel: { ...type.eyebrow, color: colors.mustard },
});
