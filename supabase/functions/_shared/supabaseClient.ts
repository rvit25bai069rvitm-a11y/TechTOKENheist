import { createClient } from "https://esm.sh/@supabase/supabase-js@2.105.1?target=deno";

const supabaseUrl = Deno.env.get('PROJECT_URL');
const serviceRoleKey = Deno.env.get('SERVICE_ROLE_KEY');

if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing PROJECT_URL or SERVICE_ROLE_KEY');
}

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
});
