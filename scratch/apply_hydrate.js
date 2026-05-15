import fs from 'fs';

const filePath = 'e:/tokenheist/src/hooks/useGameState.jsx';
let content = fs.readFileSync(filePath, 'utf8');

// Add hasHydrated to initial state
content = content.replace(
  "  gameTimer: '00:00:00',",
  "  gameTimer: '00:00:00',\n  hasHydrated: false,"
);

// Add setHasHydrated to store
content = content.replace(
  "      setGameTimer: (gameTimer) => set({ gameTimer }),",
  "      setGameTimer: (gameTimer) => set({ gameTimer }),\n      setHasHydrated: (hasHydrated) => set({ hasHydrated }),"
);

// Add onRehydrateStorage
content = content.replace(
  "      partialize: (state) => ({ user: state.user }),",
  "      partialize: (state) => ({ user: state.user }),\n      onRehydrateStorage: () => (state) => {\n        state?.setHasHydrated(true);\n      }"
);

fs.writeFileSync(filePath, content);
console.log('Successfully updated useGameState.jsx');
