// hooks/useLayout.ts
import { useWindowDimensions } from 'react-native';

import { layoutFor, navStyleFor, navWidthFor, type LayoutInfo, type NavStyle } from '../lib/layout';

/**
 * Current layout for the screen's content area. Re-renders when the window
 * resizes: folding or unfolding an iPhone Duo, rotating, or resizing a
 * split-screen or Mac window.
 *
 * On tablets the sidebar takes the left of the window, so grid columns are
 * chosen from the width that's left for content, not the whole window.
 */
export function useLayout(): LayoutInfo & { nav: NavStyle } {
  const { width } = useWindowDimensions();
  return { ...layoutFor(width - navWidthFor(width)), nav: navStyleFor(width) };
}
