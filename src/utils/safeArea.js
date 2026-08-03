const ZERO = {top: 0, right: 0, bottom: 0, left: 0};

let SafeAreaProviderImpl = ({children}) => children;
let useSafeAreaInsetsImpl = () => ZERO;

try {
  const sac = require('react-native-safe-area-context');
  if (sac?.SafeAreaProvider) {
    SafeAreaProviderImpl = sac.SafeAreaProvider;
  }
  if (typeof sac?.useSafeAreaInsets === 'function') {
    useSafeAreaInsetsImpl = sac.useSafeAreaInsets;
  }
} catch (_e) {
  // optional peer — host apps without it still render
}

/**
 * Soft wrapper so the library works when the peer is missing.
 * Immersive Modal should remount a provider so Android nav-bar insets resolve.
 */
export const PlayerSafeAreaProvider = SafeAreaProviderImpl;

export function usePlayerSafeArea() {
  const insets = useSafeAreaInsetsImpl();
  return {
    top: insets?.top || 0,
    right: insets?.right || 0,
    bottom: insets?.bottom || 0,
    left: insets?.left || 0,
  };
}
