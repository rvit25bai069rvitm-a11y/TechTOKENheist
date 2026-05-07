import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Creates a Supabase client for use in the browser.
 * Note: Since this is a Vite project, we use import.meta.env instead of process.env.
 */
export const createClient = () =>
  createBrowserClient(
    supabaseUrl,
    supabaseKey
  );
