import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

// Load .env manually
const env = dotenv.parse(fs.readFileSync('.env'));
const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_ANON_KEY;

console.log('Testing Supabase Connection...');
console.log('URL:', supabaseUrl);
console.log('Key length:', supabaseKey?.length);

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data, error } = await supabase.from('teams').select('count', { count: 'exact', head: true });
  if (error) {
    console.error('Connection failed or table "teams" missing:', error.message);
  } else {
    console.log('Connection successful! Team count:', data);
  }

  const { data: system, error: systemError } = await supabase.from('system').select('*').eq('key', 'game').maybeSingle();
  if (systemError) {
    console.error('Table "system" missing or error:', systemError.message);
  } else if (!system) {
    console.warn('Table "system" exists but no "game" entry found.');
  } else {
    console.log('System state found:', system);
  }
}

test();
