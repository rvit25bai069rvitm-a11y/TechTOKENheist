import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const rootDir = path.resolve(fileURLToPath(new URL('../..', import.meta.url)))

const readProjectFile = (relativePath) => fs.readFileSync(
  path.join(rootDir, relativePath),
  'utf8'
)

const hasExactLine = (contents, expectedLine) => contents
  .split(/\r?\n/)
  .some((line) => line.trim() === expectedLine)

const collectTextFiles = (directory) => {
  const files = []

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...collectTextFiles(fullPath))
    } else if (/\.(css|html|js|jsx|json|md)$/.test(entry.name)) {
      files.push(fullPath)
    }
  }

  return files
}

test('production build prunes unused copied public assets', () => {
  const packageJson = JSON.parse(readProjectFile('package.json'))
  const pruneScript = readProjectFile('scripts/prune-dist-public.js')
  const distVerifier = readProjectFile('scripts/verify-dist-artifacts.js')
  const routeVerifier = readProjectFile('scripts/verify-static-routes.js')
  const browserVerifier = readProjectFile('scripts/verify-browser-smoke.js')
  const configuredBrowserVerifier = readProjectFile('scripts/verify-configured-browser-smoke.js')
  const adminWorkflowVerifier = readProjectFile('scripts/verify-admin-workflow-smoke.js')
  const releaseVerifier = readProjectFile('scripts/verify-release.js')
  const productionDeploy = readProjectFile('scripts/deploy-production.js')

  assert.equal(packageJson.scripts.postbuild, 'node scripts/prune-dist-public.js && node scripts/verify-dist-artifacts.js && node scripts/verify-static-routes.js')
  assert.equal(packageJson.scripts['verify:install'], 'npm ci --dry-run')
  assert.equal(packageJson.scripts['verify:dist'], 'node scripts/verify-dist-artifacts.js')
  assert.equal(packageJson.scripts['verify:static-routes'], 'node scripts/verify-static-routes.js')
  assert.equal(packageJson.scripts['verify:browser'], 'node scripts/verify-browser-smoke.js')
  assert.equal(packageJson.scripts['verify:browser:configured'], 'node scripts/verify-configured-browser-smoke.js')
  assert.equal(packageJson.scripts['verify:admin-workflow'], 'node scripts/verify-admin-workflow-smoke.js')
  assert.match(packageJson.devDependencies.playwright, /^\^1\./)
  assert.match(pruneScript, /icons\/logo\.png/)
  assert.match(pruneScript, /icons\/bgmap\.png/)
  assert.match(pruneScript, /player1\.png/)
  assert.match(pruneScript, /player2\.png/)
  assert.match(distVerifier, /event-hardening-2026-05-16/)
  assert.match(distVerifier, /admin123/)
  assert.match(distVerifier, /sb_secret_/)
  assert.match(distVerifier, /service_role/)
  assert.match(distVerifier, /admin-panel-mock/)
  assert.match(routeVerifier, /cleanUrls/)
  assert.match(routeVerifier, /\/admin\.html/)
  assert.match(routeVerifier, /\/login/)
  assert.match(routeVerifier, /Static route verification passed/)
  assert.match(browserVerifier, /import \{ chromium \} from 'playwright'/)
  assert.match(browserVerifier, /LocalNetworkAccessChecks/)
  assert.match(browserVerifier, /launchSmokeBrowser/)
  assert.match(browserVerifier, /buildMissingConfigBundle/)
  assert.match(browserVerifier, /VITE_SUPABASE_URL: ''/)
  assert.match(browserVerifier, /waitUntil: 'domcontentloaded'/)
  assert.match(browserVerifier, /logged console errors/)
  assert.doesNotMatch(browserVerifier, /npmInvocation/)
  assert.doesNotMatch(browserVerifier, /'exec'[\s\S]*'playwright'[\s\S]*'screenshot'/)
  assert.match(browserVerifier, /\[data-testid=supabase-config-missing\]/)
  assert.match(browserVerifier, /390,844/)
  assert.match(browserVerifier, /Browser smoke verification passed/)
  assert.match(configuredBrowserVerifier, /SMOKE_SUPABASE_URL = 'https:\/\/configured-smoke-tth\.supabase\.co'/)
  assert.match(configuredBrowserVerifier, /LocalNetworkAccessChecks/)
  assert.match(configuredBrowserVerifier, /launchSmokeBrowser/)
  assert.match(configuredBrowserVerifier, /createFakeAnonJwt/)
  assert.match(configuredBrowserVerifier, /role: 'anon'/)
  assert.match(configuredBrowserVerifier, /createReadOnlySupabaseRouteHandler/)
  assert.match(configuredBrowserVerifier, /page\.route/)
  assert.match(configuredBrowserVerifier, /shouldIgnoreConsoleError/)
  assert.match(configuredBrowserVerifier, /--outDir/)
  assert.match(configuredBrowserVerifier, /heist-auth-storage/)
  assert.match(configuredBrowserVerifier, /THE PROFESSOR'S DIRECTORY/)
  assert.match(configuredBrowserVerifier, /ENTRY PROTOCOL/)
  assert.match(configuredBrowserVerifier, /supabase-config-missing/)
  assert.match(configuredBrowserVerifier, /logged console errors/)
  assert.match(configuredBrowserVerifier, /Configured browser smoke verification passed/)
  assert.doesNotMatch(configuredBrowserVerifier, /sb_secret_/)
  assert.match(adminWorkflowVerifier, /SMOKE_SUPABASE_URL = 'https:\/\/admin-workflow-smoke-tth\.supabase\.co'/)
  assert.match(adminWorkflowVerifier, /LocalNetworkAccessChecks/)
  assert.match(adminWorkflowVerifier, /launchSmokeBrowser/)
  assert.match(adminWorkflowVerifier, /page\.route/)
  assert.match(adminWorkflowVerifier, /shouldIgnoreConsoleError/)
  assert.match(adminWorkflowVerifier, /CREATE TEAM/)
  assert.match(adminWorkflowVerifier, /EXECUTE PLAN/)
  assert.match(adminWorkflowVerifier, /SPIN WHEEL/)
  assert.match(adminWorkflowVerifier, /DECLARE WINNER/)
  assert.match(adminWorkflowVerifier, /declare_match_winner/)
  assert.match(adminWorkflowVerifier, /PLANS READY/)
  assert.match(adminWorkflowVerifier, /ACTIVE MISSIONS \(0\)/)
  assert.match(adminWorkflowVerifier, /RESET PARAMETERS/)
  assert.match(adminWorkflowVerifier, /logged console errors/)
  assert.match(adminWorkflowVerifier, /Admin workflow smoke verification passed/)
  assert.match(releaseVerifier, /admin workflow smoke gate[\s\S]*'run', 'verify:admin-workflow'/)
  assert.match(productionDeploy, /admin workflow smoke gate[\s\S]*'run', 'verify:admin-workflow'/)
})

test('source only references public assets that survive the build prune', () => {
  const searchableRoots = ['src', 'public']
  const text = searchableRoots
    .flatMap((relativeRoot) => collectTextFiles(path.join(rootDir, relativeRoot)))
    .map((filePath) => fs.readFileSync(filePath, 'utf8'))
    .join('\n')

  const publicIconRefs = [...text.matchAll(/["'`]\/icons\/[^"'`)\s]+/g)]
    .map((match) => match[0].slice(1))
  assert.deepEqual([...new Set(publicIconRefs)].sort(), ['/icons/closedbank.png', '/icons/openbank.jpg'])
})

test('deployment package ignores local agent caches and one-off artifacts', () => {
  const vercelIgnore = readProjectFile('.vercelignore')
  const npmIgnore = readProjectFile('.npmignore')
  const gitIgnore = readProjectFile('.gitignore')

  for (const ignoreFile of [vercelIgnore, npmIgnore]) {
    assert.equal(hasExactLine(ignoreFile, '.env'), true)
    assert.equal(hasExactLine(ignoreFile, '.env.*'), true)
    assert.equal(hasExactLine(ignoreFile, '!.env.example'), true)
    assert.equal(hasExactLine(ignoreFile, '!.env.production.local.example'), false)
    assert.match(ignoreFile, /\.agents\//)
    assert.match(ignoreFile, /\.claude\//)
    assert.match(ignoreFile, /\.kiro\//)
    assert.match(ignoreFile, /\.trae\//)
    assert.match(ignoreFile, /\.windsurf\//)
    assert.match(ignoreFile, /src\/\*\*\/\*\.test\.js/)
    assert.match(ignoreFile, /admin-panel-mock\.html/)
    assert.match(ignoreFile, /Create_a_hyper_cinematic_D_im\.mp4/)
    assert.match(ignoreFile, /TechTokenHeist_Rulebook \(1\)\.docx/)
    assert.equal(hasExactLine(ignoreFile, '*.local.sql'), true)
    assert.match(ignoreFile, /\.github\//)
    assert.match(ignoreFile, /scratch\//)
    assert.match(ignoreFile, /security_audit_report\.md/)
    assert.match(ignoreFile, /prd\.md/)
    assert.match(ignoreFile, /skills-lock\.json/)
    assert.match(ignoreFile, /server\/serviceAccountKey\.json/)
    assert.match(ignoreFile, /public\/icons\/logo\.png/)
    assert.match(ignoreFile, /public\/icons\/openbank\.png/)
    assert.match(ignoreFile, /public\/icons\/bgmap\.png/)
    assert.match(ignoreFile, /assets\/icons\/riod\.png/)
    assert.match(ignoreFile, /assets\/rvitm\.png/)
    assert.match(ignoreFile, /assets\/song\.mp3/)
    assert.match(ignoreFile, /assets\/icons\/matchhistory\.png/)
    assert.doesNotMatch(ignoreFile, /^assets\/login\.png$/m)
    assert.doesNotMatch(ignoreFile, /^assets\/prat\.png$/m)
    assert.doesNotMatch(ignoreFile, /^assets\/icons\/berlinl\.png$/m)
    assert.doesNotMatch(ignoreFile, /^assets\/icons\/riol\.png$/m)
    assert.doesNotMatch(ignoreFile, /^assets\/icons\/tokyol\.png$/m)
    assert.doesNotMatch(ignoreFile, /^src\/assets\/rvitm\.png$/m)
  }

  assert.equal(hasExactLine(gitIgnore, '.env'), true)
  assert.equal(hasExactLine(gitIgnore, '*.env'), true)
  assert.equal(hasExactLine(gitIgnore, '!.env.example'), true)
  assert.equal(hasExactLine(gitIgnore, '!.env.production.local.example'), true)
  assert.equal(hasExactLine(gitIgnore, '.env*.local'), true)
  assert.equal(hasExactLine(gitIgnore, '*.local.sql'), true)
  assert.match(gitIgnore, /\.agents\//)
  assert.match(gitIgnore, /\.claude\//)
  assert.match(gitIgnore, /\.kiro\//)
  assert.match(gitIgnore, /\.trae\//)
  assert.match(gitIgnore, /\.windsurf\//)
  assert.match(gitIgnore, /admin-panel-mock\.html/)
  assert.match(gitIgnore, /Create_a_hyper_cinematic_D_im\.mp4/)
  assert.match(gitIgnore, /TechTokenHeist_Rulebook \(1\)\.docx/)
})
