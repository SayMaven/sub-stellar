import React, { useEffect } from 'react';
import { Shell } from './components/layout/Shell';
import { useThemeStore } from './stores/useThemeStore';

export const App: React.FC = () => {
  const syncThemeToRoot = useThemeStore((s) => s.syncThemeToRoot);

  useEffect(() => {
    // Re-apply persisted Gatefold OKLCH theme tokens without overwriting saved preset
    syncThemeToRoot();
  }, [syncThemeToRoot]);

  return <Shell />;
};

export default App;

