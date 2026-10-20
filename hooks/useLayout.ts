// hooks/useLayout.ts
import { useWindowDimensions } from 'react-native';

import { layoutFor, type LayoutInfo } from '../lib/layout';

/**
 * Current layout for the window. Re-renders when the window resizes:
 * folding or unfolding an iPhone Duo, rotating, or resizing a split-screen
 * or Mac window.
 */
export function useLayout(): LayoutInfo {
  const { width } = useWindowDimensions();
  return layoutFor(width);
}
