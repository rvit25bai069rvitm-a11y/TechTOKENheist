# 📄 PRD.md — Tech Token Heist Platform (v2)

## 1. Product Overview

**Product Name:** Tech Token Heist Platform
**Type:** Real-time competitive event management system
**Deployment Target:** Vercel (Next.js) + Supabase

### Purpose

To digitize and automate the **Tech Token Heist** event, enabling:

- Fully automatic matchmaking (no player-initiated actions)
- Real-time leaderboard and match screens
- Token economy with wager mechanics
- Admin-controlled game flow (registration, matchmaking, results, phase transitions)
- Scalable, low-latency performance via Supabase Realtime

---

## 2. User Roles & Privileges

### 👥 Teams (Players) — **Display Only**

> Teams have **zero interaction privileges**. They can only view their dashboard.

| Feature                  | Access |
|--------------------------|--------|
| Login (Team ID + Password) | ✅ |
| View own tokens & stats  | ✅ |
| View leaderboard         | ✅ |
| View current match & domain | ✅ |
| View domain spin wheel animation | ✅ |
| View match timer         | ✅ |
| Join matchmaking queue   | ❌ (auto, admin-triggered) |
| Initiate anything        | ❌ |

---

### 🛠 Admin — **Full Control**

| Feature                             | Access |
|-------------------------------------|--------|
| Register teams (set Team ID + Password) | ✅ |
| Start game / trigger global matchmaking | ✅ |
| Manually assign a specific match    | ✅ |
| View all match timers               | ✅ |
| Declare/update match results        | ✅ |
| Toggle Phase 1 → Phase 2 (Wager Mode) | ✅ |
| Override token values               | ✅ |
| View live queue & match state       | ✅ |
| Control leaderboard visibility      | ✅ |
| ADD OR REMOVE DOMAINS AND EDIT THEM  | ALLOWED|
---

### 🧑‍⚖️ Judges

- Evaluate domain performance
- No result submission (only admin submits results)
- View-only access to assigned match

### 🎯 Volunteers

- Monitor rule violations
- View domain/opponent constraint logs
- No write access

---

## 3. Authentication

- **Method:** JWT-based authentication
- **Credentials:** Team ID (string) + Password
- **Admin:** Separate admin credentials, same JWT mechanism
- **Flow:**
  1. Admin pre-registers all teams (sets Team ID + Password)
  2. Teams log in with their credentials
  3. JWT issued, role embedded in payload
  4. Role-based route guards applied throughout

---

## 4. Game Logic System



### 4.1 Token System

- Every team starts with **1 token**
- Tokens function as:
  - Ranking metric
  - Match eligibility constraint (Phase 1)
  - Risk asset (Phase 2 / Wager Mode)

---

### 4.2 Matchmaking Engine

#### Global Start (Both Phases)

- When admin clicks **"Start Game"** or **"Start Next Round"**, ALL eligible teams are automatically enrolled into the matchmaking queue
- Teams do **not** manually join the queue — ever
- Matchmaking runs server-side immediately after all teams are enrolled

#### Phase 1 Rules

**Token Range:** Match teams within ±3 tokens

**Priority Order:**
1. Same token count
2. ±1 token difference
3. ±2 token difference
4. ±3 token difference

**Constraints:**
- Max **1 active match per team** at any time
- Same opponent allowed at most **2 times total** (not consecutively)
- Same domain allowed at most **2 times total** per team
- Same opponent **+** same domain → only **1 time** allowed
- No **consecutive repeat** matches (opponent)

#### Phase 2 Rules

- **No token-range limits** — any team can match any team
- **Auto matchmaking** — no manual trigger per round needed once Phase 2 is active
- Cannot repeat same domain **consecutively**
- Prefernce of matchmaking in phase 2 is largest token difrrence is given highest priority and same token team with least preference while matchmaking

---

### 4.3 Domain Assignment (Spin Wheel)

- After two teams are matched, a **spin wheel animation plays on BOTH teams' screens**
- The wheel lands on the assigned domain
- Domain assignment follows allocation rules (no consecutive repeat for same team)
- Admin can **override** and **manually assign** a domain/match at any time
- **Domains:**
  1. Tech Pitch
  2. Tech Quiz
  3. Guess Output
  4. Frontend Dev
  5. Feature Addition

---

### 4.4 Match Timer

- Timer starts **immediately after domain is assigned**
- Timer is **visible to:**
  - Both matched teams (on their screen)
  - Admin dashboard (for all active matches simultaneously)
- Timer is **independent** of the domain's own activity duration — it is an event-level timer
- Timer **continues running** until admin declares the result
- Timer is for visibility/tracking only; it does not auto-end the match

---

### 4.5 Timeout System (Phase 1 Only)

A team that drops to **0 tokens** enters timeout:

| Time Since Game Start | Timeout Duration |
|-----------------------|-----------------|
| First 30 minutes      | 5 minutes        |
| After 30 minutes( ONLY UNTIL WAGER MODE)  | 15 minutes       |
| ALSO EDITABLE BY ADMIN | ANYTIME |
- During timeout the team is removed from the matchmaking queue
- After timeout ends → team is **reset to 1 token** and re-enrolled automatically

---

### 4.6 Phase 2 — Wager Mode

#### Activation
- Admin manually toggles Phase 1 → Phase 2
- ANY MATCH WHICH WAS ONGOING FROM PHASE ONE AND ENDS IN WAGER MODE WILL FOWLLOW WAGER MODE WINNING RULES 

#### Token Transfer Rules

| Match Scenario                      | Outcome                                                         |
|-------------------------------------|-----------------------------------------------------------------|
| Higher-token team wins              | Winner takes **ALL** of loser's tokens; loser is **eliminated** |
| Lower-token team wins               | Winner receives ⌊(A + B) / 2⌋ tokens transferred from loser   |
| Equal-token teams, one wins         | Winner takes **ALL** tokens; loser is **eliminated**            |
| Any team reaches 0 tokens           | **Permanent elimination** (no timeout reset in Phase 2)         |

> Where A = winner's tokens, B = loser's tokens before the match.

---

### 4.7 Leaderboard

**Sort order:**
1. Tokens (descending)
2. Time at which current token count was reached (ascending — earlier is better)

---

### 4.8 Grand Finale

- Top **2 teams** compete
- All **5 domains** are played in sequence
- Admin controls the flow manually

---

## 5. Match Flow (End-to-End)

```
Admin clicks "Start Game"
        ↓
All teams auto-enrolled in matchmaking queue
        ↓
Matchmaking engine pairs teams (server-side, rule-checked)
        ↓
Spin wheel animation plays on BOTH teams' screens
        ↓
Domain assigned (rule-validated)
        ↓
Match timer starts (visible to teams + admin)
        ↓
Teams compete (offline/physical)
        ↓
Admin declares result
        ↓
Tokens updated (transactional)
        ↓
Both teams re-enrolled in queue automatically
        ↓
(Repeat until phase ends or game concludes)
```

---

## 6. Non-Functional Requirements

### Performance
- < 200ms latency for real-time updates
- Spin wheel synced across both team screens

### Scalability
- Designed for 24 teams (expandable to 50+)

### Reliability
- No duplicate matches via server-side lock
- All token updates are DB transactions
- No rule violations — server enforces all constraints

### Security
- JWT with role-based access control
- Admin routes protected server-side
- Rate limiting on auth endpoints

---

## 7. Tech Stack

### Frontend
- **Framework:** Next.js 14+ (App Router)
- **Styling:** Tailwind CSS
- **State:** Zustand
- **Realtime:** Supabase Realtime client
- **Animations:** Framer Motion (spin wheel)

### Backend
- **API Routes:** Next.js Route Handlers (serverless on Vercel)
- **Matchmaking Logic:** Server-side, runs on Vercel Edge Functions
- **Auth:** JWT (jose library), custom middleware

### Database
- **Primary DB:** Supabase (PostgreSQL)
- **ORM:** Prisma or Supabase JS client
- **Realtime:** Supabase Realtime (broadcast + postgres changes)

### Deployment
- **Platform:** Vercel
- **DB Hosting:** Supabase
- **CI/CD:** GitHub → Vercel auto-deploy

---

## 8. Database Schema

### teams
| Column               | Type        | Notes                        |
|----------------------|-------------|------------------------------|
| id                   | UUID / text | Team ID (login credential)   |
| name                 | text        | Display name                 |
| password_hash        | text        | Hashed password              |
| tokens               | integer     | Current token count          |
| status               | enum        | active / timeout / eliminated |
| timeout_until        | timestamp   | Null if not in timeout       |
| token_updated_at     | timestamp   | For leaderboard tiebreaker   |
| created_at           | timestamp   |                              |

### matches
| Column        | Type      | Notes                              |
|---------------|-----------|------------------------------------|
| id            | UUID      |                                    |
| team_a_id     | text      | FK → teams                         |
| team_b_id     | text      | FK → teams                         |
| domain        | enum      | One of 5 domains                   |
| status        | enum      | pending / active / completed       |
| winner_id     | text      | FK → teams, null until result      |
| timer_start   | timestamp | When domain was assigned           |
| result_at     | timestamp | When admin declared result         |
| phase         | integer   | 1 or 2                             |
| created_at    | timestamp |                                    |

### match_history (for constraint checks)
| Column        | Type   | Notes                              |
|---------------|--------|------------------------------------|
| id            | UUID   |                                    |
| team_id       | text   | FK → teams                         |
| opponent_id   | text   | FK → teams                         |
| domain        | enum   |                                    |
| match_id      | UUID   | FK → matches                       |
| created_at    | timestamp |                                 |

### game_state
| Column           | Type      | Notes                         |
|------------------|-----------|-------------------------------|
| id               | integer   | Single row (id = 1)           |
| phase            | integer   | 1 or 2                        |
| status           | enum      | idle / running / paused / ended |
| started_at       | timestamp |                               |
| phase2_started_at| timestamp |                               |

### token_logs
| Column      | Type      | Notes                            |
|-------------|-----------|----------------------------------|
| id          | UUID      |                                  |
| team_id     | text      |                                  |
| delta       | integer   | + or − change                   |
| reason      | text      | match_win / match_loss / timeout_reset / admin_override |
| match_id    | UUID      | Nullable                         |
| created_at  | timestamp |                                  |

---

## 9. Edge Cases & Handling

| Scenario                         | Handling                                         |
|----------------------------------|--------------------------------------------------|
| Odd number of teams in queue     | One team sits out this round, re-queued next     |
| Duplicate match assignment       | Server-side lock prevents concurrent writes      |
| Token mismatch on concurrent update | DB transaction with row-level lock            |
| Admin force-declares result mid-timer | Allowed; timer stops on result declaration  |
| Phase 2 transition mid-match     | Active matches complete under Phase 1 rules     |
| Team in timeout re-enrolled      | Automatic after timeout expires                  |
| Admin manually assigns match     | Bypasses queue, still validates domain constraints |

---

## 10. Success Metrics

- Zero rule violations during event
- < 1s match assignment after game start
- Spin wheel in sync on both team screens (< 300ms drift)
- 100% uptime during event
- Smooth Phase 1 → Phase 2 transition

---

## 11. Risks & Mitigation

| Risk                        | Mitigation                                      |
|-----------------------------|--------------------------------------------------|
| Vercel cold starts          | Use Edge Runtime for matchmaking endpoint        |
| Realtime sync delay         | Supabase Realtime with optimistic UI             |
| Data inconsistency on tokens| PostgreSQL transactions + Supabase RLS           |
| Spin wheel desync           | Server sends domain after wheel animation ends   |
| Admin accidentally re-starts matchmaking | Confirmation modal + idempotency check |

---

## 12. Future Enhancements

- Analytics dashboard (match history, token flow graphs)
- Spectator mode (read-only public leaderboard screen)
- Replay / audit log viewer
- AI-assisted matchmaking optimization
wwwwwwwwwwwwww