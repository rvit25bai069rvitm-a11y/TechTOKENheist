
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY; // We'd ideally use service_role key here if we had it, but anon might work if policies are open.

const supabase = createClient(supabaseUrl, supabaseKey);

async function setupAdmin() {
  console.log('Setting up admin credentials in Supabase...');
  
  // We'll use the 'system' table which already exists.
  // We'll insert or update a record with key 'admin_auth'.
  // We use a JSON string or a simple string for value.
  // Note: The schema of 'system' table seems to be flexible or we can use an existing column.
  // From useGameState.jsx, it seems 'key' is the identifier.
  
  const { data, error } = await supabase
    .from('system')
    .upsert([
      { 
        key: 'admin_auth', 
        status: 'proffesor:iamadmin' // We'll hijack the 'status' column for now as a simple store
      }
    ]);

  if (error) {
    console.error('Error setting up admin:', error);
  } else {
    console.log('Admin credentials successfully stored in "system" table under key "admin_auth".');
  }
}

setupAdmin();
