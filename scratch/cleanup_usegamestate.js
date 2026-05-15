import fs from 'fs';

const filePath = 'e:/tokenheist/src/hooks/useGameState.jsx';
const content = fs.readFileSync(filePath, 'utf8');

// The file is corrupted. I need to find the correct structure.
// I'll rebuild it by taking the preamble (imports and initial state/helpers)
// and then the correctly defined store.

const imports = content.substring(0, content.indexOf('const useGameStateStore = create('));
const storePartStart = content.indexOf('const useGameStateStore = create(');

// I'll search for the _invoke function I just added and use that as an anchor.
const invokeAnchor = '_invoke: async (action, payload = {}) => {';
const invokePos = content.lastIndexOf(invokeAnchor);

if (invokePos === -1) {
    console.error('Could not find invoke anchor');
    process.exit(1);
}

// I'll take the store definition from the second occurrence (the one I messed up/duplicated)
// or just find where the first one went wrong.

const lines = content.split('\n');
let newLines = [];
let insideMess = false;

// Line 147 was where it started going wrong.
for (let i = 0; i < lines.length; i++) {
    if (i === 146) { // Line 147 (0-indexed)
        newLines.push('      resetClientState: () => {');
        newLines.push('        set({ ...createInitialClientState() })');
        newLines.push('        syncQueryCache(createInitialGameState())');
        newLines.push('      },');
        newLines.push('      setCountdown: (countdown) => set({ countdown }),');
        newLines.push('      setGameTimer: (gameTimer) => set({ gameTimer }),');
        newLines.push('      setHasHydrated: (hasHydrated) => set({ hasHydrated }),');
        
        // Skip until we find the next method in the store or the _invoke I added.
        // I added _invoke recently.
        let skipUntil = i;
        while (skipUntil < lines.length && !lines[skipUntil].includes('_invoke: async (action, payload = {}) => {')) {
            skipUntil++;
        }
        i = skipUntil - 1;
        continue;
    }
    newLines.push(lines[i]);
}

// Write it back and then fix any further duplicates.
fs.writeFileSync(filePath, newLines.join('\n'));
console.log('Cleaned up corruption in useGameState.jsx');
