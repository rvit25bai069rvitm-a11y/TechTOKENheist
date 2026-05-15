import fs from 'fs';

const filePath = 'e:/tokenheist/src/hooks/useGameState.jsx';
let content = fs.readFileSync(filePath, 'utf8');

const oldLogin = `      login: async (username, password) => {
        const { data, error } = await supabase.functions.invoke('game-actions', {
          body: { action: 'login', payload: { username, password } }
        });
        if (error) return { success: false, error: error.message };
        if (!data?.success) return { success: false, error: data?.error || 'Login failed' };

        if (data.role === 'admin') {
          set({ user: { role: 'admin', teamId: null, teamName: null, token: data.token } });
          return { success: true, role: 'admin' };
        } else {
          set({ user: { role: 'player', teamId: data.teamId, teamName: data.teamName, avatarSrc: getProfileAvatar(data.teamName), token: data.token } });
          return { success: true, role: 'player', teamId: data.teamId, teamName: data.teamName };
        }
      },`;

const newLogin = `      login: async (username, password) => {
        const { data: response, error } = await supabase.functions.invoke('game-actions', {
          body: { action: 'login', payload: { username, password } }
        });
        
        if (error) return { success: false, error: error.message };
        if (!response?.success) return { success: false, error: response?.error || 'Login failed' };

        const { role, token, teamId, teamName } = response.data || {};

        if (role === 'admin') {
          set({ user: { role: 'admin', teamId: null, teamName: null, token } });
          return { success: true, role: 'admin' };
        } else {
          set({ user: { role: 'player', teamId, teamName, avatarSrc: getProfileAvatar(teamName), token } });
          return { success: true, role: 'player', teamId, teamName };
        }
      },`;

// Replace carefully. If the exact string doesn't match, I'll try a regex.
if (content.includes(oldLogin)) {
    content = content.replace(oldLogin, newLogin);
} else {
    // Try a more flexible replacement if formatting differs
    content = content.replace(/login: async \(username, password\) => \{[\s\S]*?return \{ success: true, role: 'player'[\s\S]*?\};[\s\S]*?\},/, newLogin);
}

fs.writeFileSync(filePath, content);
console.log('Successfully fixed login response handling in useGameState.jsx');
