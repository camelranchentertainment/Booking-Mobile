// lib/layout.ts
//
// Width-based layout rules so the app looks intentional on every screen it
// can run on: iPhone (compact), iPhone Duo unfolded / iPad portrait / split
// screen (medium), and iPad landscape / Mac (expanded).
//
// Decisions are made from the *window* width, not the device type, because
// the same device changes size: the Duo folds and unfolds, and iPad/Mac run
// apps in split screen and resizable windows.

/** Readable column for text-heavy screens (day sheet, pay, band, calendar, login). */
export const READABLE_MAX_WIDTH = 720;

/** Outer frame for grid screens (the shows list), so cards don't stretch on huge displays. */
export const CONTENT_MAX_WIDTH = 1180;

/** Window width at which the shows list becomes two columns. */
export const MEDIUM_MIN_WIDTH = 700;

/** Window width at which the shows list becomes three columns. */
export const EXPANDED_MIN_WIDTH = 1100;

export type SizeClass = 'compact' | 'medium' | 'expanded';

export interface LayoutInfo {
  sizeClass: SizeClass;
  /** Columns for card grids. */
  columns: 1 | 2 | 3;
}

/**
 * Picks the layout for a window width.
 *
 * @param width window width in points (from useWindowDimensions)
 * @returns the size class and grid column count for that width
 */
export function layoutFor(width: number): LayoutInfo {
  if (!Number.isFinite(width) || width < MEDIUM_MIN_WIDTH) return { sizeClass: 'compact', columns: 1 };
  if (width < EXPANDED_MIN_WIDTH) return { sizeClass: 'medium', columns: 2 };
  return { sizeClass: 'expanded', columns: 3 };
}

/**
 * Pads a list with `null` fillers so its length is a multiple of `columns`.
 * A FlatList grid then keeps every card the same width, including the last row.
 *
 * @param items the real rows
 * @param columns grid column count
 * @returns the rows followed by enough `null` fillers to complete the last row
 */
export function padToColumns<T>(items: readonly T[], columns: number): (T | null)[] {
  const remainder = columns > 1 ? items.length % columns : 0;
  const fillers = remainder === 0 ? 0 : columns - remainder;
  return [...items, ...Array.from({ length: fillers }, () => null)];
}
