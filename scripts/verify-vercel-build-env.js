import process from 'node:process'
import { createClient } from '@supabase/supabase-js'
import { validateSupabaseProductionEnv } from './vercel-env-utils.js'

const validArgs = new Set(['--always'])
const unknownArgs = process.argv.slice(2).filter((arg) => !validArgs.has(arg))
if (unknownArgs.length > 0) {
  console.error(`Unknown argument: ${unknownArgs.join(', ')}`)
  console.error('Usage: node scripts/verify-vercel-build-env.js [--always]')
  process.exit(1)
}

const isVercelProductionBuild =
  process.env.VERCEL === '1' &&
  process.env.VERCEL_ENV === 'production'
const forceVerification = process.argv.includes('--always')

const createBuildSupabaseClient = () => createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  }
)

const assertNoSupabaseError = (result, label) => {
  if (result.error) {
    throw new Error(`${label}: ${result.error.message}`)
  }
}

const verifyProductionSupabaseSchema = async () => {
  const supabase = createBuildSupabaseClient()

  const adminCredential = await supabase.rpc('admin_credential_configured')
  assertNoSupabaseError(adminCredential, 'admin_credential_configured RPC')
  if (adminCredential.data !== true) {
    throw new Error('admin_credential_configured RPC returned false')
  }

  const teamLogin = await supabase.rpc('login_team', {
    p_name: '__vercel_build_probe__',
    p_password: '__invalid__',
  })
  assertNoSupabaseError(teamLogin, 'login_team RPC')

  const adminLogin = await supabase.rpc('login_admin_session', {
    p_username: '__vercel_build_probe__',
    p_password: '__invalid__',
  })
  assertNoSupabaseError(adminLogin, 'login_admin_session RPC')

  const adminCredentialRead = await supabase
    .from('system')
    .select('key,status')
    .eq('key', 'admin_credential')
    .maybeSingle()
  assertNoSupabaseError(adminCredentialRead, 'admin credential visibility check')
  if (adminCredentialRead.data) {
    throw new Error('admin_credential row is readable through the Data API')
  }

  const passwordRead = await supabase
    .from('teams')
    .select('password')
    .limit(1)
  if (!passwordRead.error) {
    throw new Error('teams.password is directly selectable through the Data API')
  }
}

if (isVercelProductionBuild || forceVerification) {
  const { missing, blank, invalid } = validateSupabaseProductionEnv(process.env)

  if (missing.length > 0) {
    console.error(`Vercel production build blocked. Missing required env vars: ${missing.join(', ')}`)
    console.error('Set non-empty Supabase env values in the Vercel project before deploying the event build.')
    process.exit(1)
  }

  if (blank.length > 0) {
    console.error(`Vercel production build blocked. Blank required env vars: ${blank.join(', ')}`)
    console.error('Replace the blank Vercel values with the real Supabase project URL and publishable anon key.')
    process.exit(1)
  }

  if (invalid.length > 0) {
    console.error(`Vercel production build blocked. Invalid Supabase env vars: ${invalid.join(', ')}`)
    console.error('Use the real https://<project-ref>.supabase.co URL and publishable anon key, not placeholders.')
    process.exit(1)
  }

  try {
    await verifyProductionSupabaseSchema()
  } catch (error) {
    console.error('Vercel production build blocked. Supabase schema/security checks failed.')
    console.error(error.message)
    console.error('Run server/supabase_policies.sql against the production Supabase project, then redeploy.')
    process.exit(1)
  }
}
