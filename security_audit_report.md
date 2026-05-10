# 🔴 TECH TOKEN HEIST — Enterprise Security & Architecture Audit

**Classification:** CONFIDENTIAL  
**Date:** 2026-05-10  
**Auditor:** Senior Security & Architecture Review  
**Scope:** Full-stack application audit — Frontend, Backend, Database, Game Systems, Deployment

---

## 1. EXECUTIVE SUMMARY

Tech Token Heist is a **client-side SPA** (Vite + React) with **Supabase** as the sole backend (database + realtime). The application has **no server-side API layer** — all business logic runs in the browser. This architectural decision is the root cause of nearly every critical vulnerability found.

### Verdict: 🔴 NOT PRODUCTION-SECURE

The application is functional for a **trusted, supervised event environment** (e.g., a college hackathon with physical oversight) but has **catastrophic security gaps** that would be exploited instantly in any public-facing deployment.

---

## 2. SCORES

| Category | Score | Rating |
|---|---|---|
| **Overall Security** | 15/100 | 🔴 CRITICAL |
| **Architecture** | 35/100 | 🔴 POOR |
| **Performance** | 65/100 | 🟡 ACCEPTABLE |
| **Scalability** | 40/100 | 🔴 POOR |
| **UX/UI** | 80/100 | 🟢 STRONG |
| **SEO** | 20/100 | 🔴 POOR |
| **DevOps/CI-CD** | 10/100 | 🔴 CRITICAL |
| **Game Integrity** | 10/100 | 🔴 CRITICAL |

---

## 3. 🔴 CRITICAL VULNERABILITIES (Severity: CRITICAL)

### CRIT-01: Hardcoded Admin Credentials in Client-Side Code

**File:** `useGameState.jsx:173`
```javascript
if (username === 'admin' && password === 'admin123') {
  set({ user: { role: 'admin', teamId: null, teamName: null } })
  return { success: true, role: 'admin' }
}
```

**Impact:** Anyone can view source → DevTools → search for `admin123` → gain full admin access.  
**Exploit:** Open browser DevTools, search bundled JS for "admin". Instant privilege escalation.  
**Severity:** 🔴 CRITICAL  
**Fix:** Move admin auth to a Supabase Edge Function with hashed credentials or use Supabase Auth with role-based claims.

---

### CRIT-02: Plaintext Passwords Stored in Database

**File:** `useGameState.jsx:193`
```javascript
if (team.password !== password) return { success: false, error: 'Invalid...' }
```

Team passwords are stored and compared as **plaintext** in the `teams` table.  
**Impact:** Any user with Supabase anon key (exposed in client) can query `SELECT * FROM teams` and read all passwords.  
**Severity:** 🔴 CRITICAL  
**Fix:** Hash passwords with bcrypt via Edge Function. Never store or compare plaintext passwords client-side.

---

### CRIT-03: ZERO Backend Authorization — Full Database Write Access

**File:** `supabase_policies.sql:56-174`
```sql
create policy teams_select on public.teams
for select to anon, authenticated
using (true);

create policy teams_insert on public.teams
for insert to anon, authenticated
with check (true);

create policy teams_update on public.teams
for update to anon, authenticated
using (true) with check (true);

create policy teams_delete on public.teams
for delete to anon, authenticated
using (true);
```

**EVERY table has fully open RLS policies.** Any anonymous user with the Supabase URL + anon key (both exposed in the client bundle) can:
- DELETE all teams, matches, history
- UPDATE any team's tokens to 999999
- INSERT fake match results
- MODIFY the system table to take control of game state

**Exploit scenario:**
```javascript
// Run in any browser console on the site
const { createClient } = supabase;
const client = createClient('https://cijggyxbdziimshdibwr.supabase.co', 'sb_publishable_...');
await client.from('teams').update({ tokens: 999 }).eq('name', 'myteam');
await client.from('system').update({ phase: 'phase1', is_game_active: false }).eq('key', 'game');
```

**Severity:** 🔴 CRITICAL  
**Fix:** Implement proper RLS policies that validate the authenticated user's role. Use Supabase Auth for login, store role in JWT claims, and restrict write operations accordingly.

---

### CRIT-04: Client-Authoritative Game Logic

ALL game logic (matchmaking, token transfers, winner declaration, phase changes, eliminations) executes **entirely in the browser**. There is no server-side validation.

**Exploitable functions (all in `useGameState.jsx`):**
- `declareWinner()` — Any player can call this from DevTools
- `updateTokens()` — Direct token manipulation
- `createMatch()` — Forge arbitrary matches
- `togglePhase()` — Switch game phases
- `startGame() / stopGame() / resetGame()` — Full game control
- `deleteTeam()` — Remove competitors

**Severity:** 🔴 CRITICAL  
**Fix:** Move ALL state-mutating operations to Supabase Edge Functions or a backend API with role verification.

---

### CRIT-05: Supabase Credentials Exposed in Client Bundle

**File:** `.env`
```
VITE_SUPABASE_URL=https://cijggyxbdziimshdibwr.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_MdIbnKE41m0L30xbiVweDg_sY7vo4C4
```

The anon key is designed to be public, BUT combined with CRIT-03 (open RLS), this gives **unrestricted database access** to anyone.  
**Severity:** 🔴 CRITICAL (due to open RLS)

---

## 4. 🟠 HIGH VULNERABILITIES

### HIGH-01: No Role Verification on Admin Routes

**File:** `App.jsx:222-224`
```jsx
<Route path="/admin" element={
  user && user.role === 'admin' ? <AdminLayout>... : <Navigate to="/login" />
} />
```

The `user.role` is stored **client-side in Zustand** (in-memory). It is trivially overridable:
```javascript
// Browser console exploit
useGameStateStore.setState({ user: { role: 'admin', teamId: null } })
```

**Fix:** Verify role server-side on every admin action. Client-side route guards are UX conveniences, not security.

---

### HIGH-02: No Rate Limiting on Any Operations

There is zero rate limiting on:
- Login attempts (brute force possible)
- Queue join/leave (spam possible)
- Token updates (rapid-fire manipulation)
- Match creation (flooding)
- Notification inserts (spam)

**Fix:** Implement rate limiting via Supabase Edge Functions or pg_net rate limiting.

---

### HIGH-03: Password Bypass in Dev Mode

**File:** `useGameState.jsx:188-190`
```javascript
if (team.password === undefined) {
  set({ user: { role: 'player', teamId: team.id, ... } })
  return { success: true, role: 'player', ... }
}
```

If the `password` column doesn't exist, login succeeds with ANY password.  
**Fix:** Remove dev-mode bypass. Always require password validation.

---

### HIGH-04: No Session Management

- No JWT tokens, no session cookies, no expiry
- Auth state is purely in-memory Zustand — a page refresh logs out
- No session invalidation mechanism
- Multiple browser tabs can independently authenticate as different users
- No concurrent session detection

---

### HIGH-05: ilike() SQL Injection Risk

**File:** `useGameState.jsx:181`
```javascript
.ilike('name', username)
```

While Supabase parameterizes queries, `ilike` with user input enables **pattern matching attacks**: a username of `%` would match every team. Combined with `.limit(1)`, an attacker logs in as the first team alphabetically.

**Fix:** Use `.eq('name', username)` for exact match, or sanitize wildcard characters.

---

## 5. 🟡 MEDIUM VULNERABILITIES

### MED-01: No Input Validation/Sanitization
- Team names accept any string (including `<script>` tags, SQL-like patterns, extremely long strings)
- Member names have no length or character restrictions
- Domain names accept arbitrary input
- No XSS sanitization on notification messages displayed via `{n.message}`

### MED-02: Race Conditions in Token Updates
`declareWinner()` reads team tokens, calculates new values, then writes. Two simultaneous match resolutions for the same team can cause token calculation errors (lost updates).

### MED-03: No CSRF Protection
The SPA makes direct Supabase calls with no CSRF tokens. In a scenario where Supabase Auth is added, CSRF attacks would be possible.

### MED-04: Duplicate Supabase Client Initialization
Two separate Supabase clients exist:
- `src/lib/supabase.js` — uses `createClient` from `@supabase/supabase-js`
- `src/utils/supabase/client.js` — uses `createBrowserClient` from `@supabase/ssr`

The SSR client is **never used anywhere**. Dead code that adds bundle size and confusion.

### MED-05: Notification Message Injection
Any user can insert arbitrary messages into the `notifications` table (open RLS). This enables social engineering attacks through the Intel Feed.

### MED-06: Match History Forgery
Any user can insert fake entries into `match_history`, manipulating the leaderboard display and telemetry logs.

---

## 6. 🟢 LOW VULNERABILITIES

| ID | Issue |
|---|---|
| LOW-01 | No Content Security Policy headers |
| LOW-02 | No `X-Frame-Options` / clickjacking protection |
| LOW-03 | Missing `rel="noopener noreferrer"` on external links |
| LOW-04 | Console.log statements left in production code |
| LOW-05 | No error boundary components for React crash recovery |
| LOW-06 | `autoFocus` on login input may cause a11y issues |
| LOW-07 | Copyright says "© 2024" (should be 2025/2026) |

---

## 7. DATABASE ANALYSIS

### Current Schema (7 tables discovered)

| Table | Purpose | Issues |
|---|---|---|
| `system` | Game state config | Single-row design, no audit trail |
| `teams` | Player teams | **Plaintext passwords**, no indexes on `name` |
| `matchmaking_queue` | Queue state | No unique constraint on `team_id` |
| `active_matches` | Live matches | Team data duplicated as JSON (denormalized) |
| `match_history` | Past results | Uses team names instead of foreign keys |
| `notifications` | Event log | No TTL, unbounded growth |
| `token_history` | Token changes | No foreign keys, uses team names |

### Missing Tables

| Table | Purpose |
|---|---|
| `admin_users` | Separate admin accounts with hashed passwords |
| `sessions` | Session tracking with expiry |
| `audit_log` | Immutable log of admin actions |
| `login_attempts` | Brute force detection |
| `game_config` | Versioned game configuration |

### Missing Database Features

- ❌ No foreign key constraints between tables
- ❌ No indexes (queries scan full tables)
- ❌ No `created_at` / `updated_at` timestamps with defaults
- ❌ No unique constraints (duplicate queue entries possible)
- ❌ No cascading deletes (orphaned records when teams deleted)
- ❌ No database functions/triggers for business logic
- ❌ No connection pooling configuration
- ❌ No backup/restore strategy

---

## 8. GAME EXPLOIT ANALYSIS

### Exploit 1: Infinite Token Generation
**Method:** Call `updateTokens(myTeamId, 1000, 'hack')` from browser console.  
**Impact:** Unlimited tokens. Instant leaderboard #1.

### Exploit 2: Self-Declare Winner
**Method:** Create a match with yourself, then declare yourself winner.  
**Impact:** Free tokens per cycle.

### Exploit 3: Eliminate Competitors
**Method:** `supabase.from('teams').update({status:'eliminated'}).eq('name','rival')`  
**Impact:** Remove any team from the game.

### Exploit 4: Game State Takeover
**Method:** Update `system` table directly to change phase, pause game, or reset.  
**Impact:** Complete game disruption.

### Exploit 5: Queue Manipulation
**Method:** Remove opponents from queue or insert fake queue entries.  
**Impact:** Control who gets matched with whom.

### Exploit 6: Matchmaking Constraint Bypass
Constraints are calculated client-side from `match_history`. A player can delete their history entries to reset constraints and face the same weak opponent repeatedly.

### Anti-Cheat Recommendations
1. Move ALL game mutations to Supabase Edge Functions
2. Implement server-side match resolution with cryptographic verification
3. Add admin approval workflow for suspicious token changes
4. Log all client actions with IP + timestamp for forensic review
5. Implement rate limiting on all game actions

---

## 9. FRONTEND ENGINEERING AUDIT

### Architecture Issues
- **No code splitting** — All screens load in a single bundle
- **No lazy loading** — `React.lazy()` not used for any route
- **No Suspense boundaries** — No fallback UI for loading states
- **No Error Boundaries** — Any component crash kills the entire app
- **Hardcoded values** — Bottom bar shows `5` (PLANS READY) and `3` (ACTIVE MISSIONS) instead of live data (App.jsx:174-178)

### Performance Issues
- Fallback polling every 5 seconds (`setInterval(fetchPublicState, 5000)`) even when realtime is working
- `useGameSocketBridge` fetches ALL 7 tables on EVERY change to ANY table
- No memoization on heavy renders (AdminScreen is 740 lines, single component)
- Multiple `setInterval` timers (countdown, game timer, recovery) running simultaneously
- Profile avatar URLs resolved via `new URL()` constructor on every render

### Dead Code
- `src/utils/supabase/client.js` — SSR client never imported
- `@supabase/ssr` package — unused dependency
- `queryClient` — initialized but never used for actual queries (Zustand handles everything)

### Bundle Impact
- `framer-motion` — Large library, used minimally (only basic fade/slide animations)
- Consider `motion` (lighter) or CSS animations as alternatives

---

## 10. ROUTE & NAVIGATION ANALYSIS

### Route Map

| Path | Guard | Issues |
|---|---|---|
| `/` | None (public) | ✅ OK |
| `/login` | Redirects if logged in | ✅ OK |
| `/lobby` | `user` check | ❌ No role check — admin can access player routes |
| `/arena` | `user` check | ❌ No role check |
| `/battle` | `user` check | ❌ No role check |
| `/rulebook` | `user` check | ❌ No role check |
| `/about` | `user` check | ❌ No role check |
| `/devs` | `user` check | ❌ No role check |
| `/admin` | `user.role === 'admin'` | ❌ Client-side only check |
| `*` | Redirects to `/` | ✅ OK |

### Issues
- Player routes don't check `user.role === 'player'` — an admin can access player views
- No 404 page (silent redirect instead)
- No route transition animations between dashboard screens
- Refreshing any route while "logged in" will lose auth state (no persistence)

---

## 11. SEO ANALYSIS

| Issue | Status |
|---|---|
| Meta description | ❌ Missing |
| Open Graph tags | ❌ Missing |
| Structured data | ❌ Missing |
| Sitemap | ❌ Missing |
| robots.txt | ❌ Missing |
| Semantic HTML | ❌ Minimal — divs everywhere |
| Single H1 per page | ❌ Multiple H1s on some screens |
| Alt text on images | 🟡 Partial |
| Title tag | 🟡 Static "Tech Token Heist" — not per-page |

---

## 12. DEPLOYMENT & DEVOPS

### Current State
- ❌ No CI/CD pipeline
- ❌ No automated tests (zero test files)
- ❌ No staging environment
- ❌ No build optimization (no compression, no image optimization)
- ❌ No monitoring/alerting
- ❌ No error tracking (no Sentry or equivalent)
- ❌ No health checks
- ❌ `.env` in `.gitignore` but credentials are still in bundled JS

### Vite Config Issues
- No `build.rollupOptions` for code splitting
- No `build.minify` configuration
- No asset optimization settings
- No `define` for stripping dev-only code

### Recommended Vite Config
```javascript
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: { manualChunks: { vendor: ['react','react-dom','react-router-dom'], supabase: ['@supabase/supabase-js'], ui: ['framer-motion','lucide-react'] } }
    },
    sourcemap: false, // Don't ship sourcemaps
    minify: 'terser',
  },
  server: { headers: { 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY' } }
})
```

---

## 13. SECURITY HARDENING PLAN (Priority Order)

### Phase 1: Immediate (Day 1)
1. **Move admin auth to Supabase Edge Function** with bcrypt-hashed password
2. **Restrict RLS policies** — read-only for anon, write via service_role only
3. **Remove hardcoded admin credentials** from client code
4. **Hash team passwords** using a database trigger or Edge Function

### Phase 2: Short-term (Week 1)
5. Create Edge Functions for: `declareWinner`, `updateTokens`, `createMatch`, `togglePhase`, `startGame`, `stopGame`, `resetGame`
6. Add rate limiting via Edge Function middleware
7. Add input validation and sanitization
8. Implement proper session management with Supabase Auth
9. Add unique constraints and foreign keys to database

### Phase 3: Medium-term (Week 2-3)
10. Add audit logging table with immutable insert-only policy
11. Implement Error Boundaries in React
12. Add code splitting with `React.lazy()`
13. Set up CI/CD pipeline with automated linting
14. Add security headers via deployment config
15. Implement anti-cheat logging

---

## 14. PRODUCTION READINESS VERDICT

| Criteria | Status |
|---|---|
| Secure authentication | ❌ FAIL |
| Server-side authorization | ❌ FAIL |
| Database security | ❌ FAIL |
| Game integrity | ❌ FAIL |
| Error handling | ❌ FAIL |
| Monitoring | ❌ FAIL |
| Tested | ❌ FAIL |
| CI/CD | ❌ FAIL |
| Performance optimized | 🟡 PARTIAL |
| UI/UX quality | ✅ PASS |
| Functional completeness | ✅ PASS |

### Final Verdict

**For a supervised college event (physical venue, trusted participants):** 🟡 ACCEPTABLE with risk  
**For any public-facing deployment:** 🔴 NOT READY — requires complete security overhaul

The application excels in UI design and game mechanics logic, but treats the browser as a trusted environment. The #1 priority is moving all state-mutating operations behind server-side functions with proper authentication and authorization.
