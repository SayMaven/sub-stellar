import React, { useEffect } from 'react';
import { Shell } from './components/layout/Shell';
import { useThemeStore } from './stores/useThemeStore';

export const App: React.FC = () => {
  const { setPreset } = useThemeStore();

  useEffect(() => {
    // Initialize default Gatefold OKLCH theme on mount
    setPreset('default');
  }, [setPreset]);

  return <Shell />;
};

export default App;

