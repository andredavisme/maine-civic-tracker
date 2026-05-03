# Maine Civic Tracker

> **Proof of Concept — Built with real data, donated time, and a Perplexity AI subscription.**

A civic accountability platform that makes community budget flows, fund allocations, project outcomes, and resident-submitted evidence publicly visible in one place. Built to demonstrate that meaningful government transparency tooling no longer requires six-figure development contracts.

**Live site:** https://andredavisme.github.io/maine-civic-tracker/

---

## What This Is

Maine Civic Tracker is a full-stack web application connecting:

- **Where money comes from** — federal grants, state aid, local tax revenue, bonds
- **Where money goes** — project allocations by category, fiscal year, and responsible official
- **What actually happened** — outcome reporting with measurable metrics and evidence links
- **What residents see on the ground** — photo and document submissions from the community, moderated before publication

This is not a prototype with dummy data. The database schema, storage layer, moderation pipeline, and public-facing interface are all operational. Any Maine community can be onboarded by inserting their budget data and assigning a local moderator.

---

## How It Can Be Applied to Individual Communities

Each community in the system is an independent record in the `civic_communities` table. Adding a new community — a town, school district, utility authority, or county — requires:

1. Inserting the community record (name, county, population, state)
2. Loading budget source data for one or more fiscal years
3. Creating allocation records tied to active projects
4. Assigning at least one accountable role (elected official, department head, or community liaison)
5. Optionally seeding historical outcomes

From that point, the community's data is immediately live on the public site — filterable on the Budget, Allocations, and Outcomes pages. Residents can begin submitting evidence through the Submit form the same day.

**Target communities:** municipalities (cities, towns), school administrative districts (SADs), utility districts, county governments, housing authorities, TIF districts, and tribal governments.

---

## Architecture & Data Flows

```
RESIDENT
  └─ Submits report (title, type, photo, location)
        │
        ▼
  civic_evidence table (status: pending)
        │
        ▼
  MODERATOR reviews via admin.html
        ├─ Approve → status: approved → appears on Evidence Wall
        └─ Reject  → status: rejected → removed from queue

ADMIN / DATA STEWARD
  └─ Inserts budget, allocation, outcome records
        │
        ▼
  Supabase Postgres (civic_budget_sources, civic_allocations,
                     civic_outcomes, civic_roles)
        │
        ▼
  Public site reads via anon key (RLS enforced)
        ├─ Budget page    — revenue by source type & year
        ├─ Allocations    — spending by project & category
        ├─ Outcomes       — verified results with metrics
        └─ Evidence Wall  — approved community submissions
```

### Data Tables

| Table | Purpose |
|---|---|
| `civic_communities` | Community registry |
| `civic_roles` | Accountable officials and their titles |
| `civic_budget_sources` | Revenue lines by fiscal year and type |
| `civic_allocations` | Project-level spending with status tracking |
| `civic_outcomes` | Reported results tied to allocations |
| `civic_evidence` | Resident submissions with moderation workflow |

### Storage
- `evidence-photos` bucket — public read, authenticated write, 5 MB image limit
- Photos are stored in Supabase Storage and referenced by URL in `civic_evidence.photo_url`

### Edge Functions
- `review-evidence` — admin moderation API (GET: list queue; POST: approve/reject). Protected by server-side passphrase, uses service role key to bypass RLS.

### Security Model
- **Anon key (public):** Can read `approved` evidence only; can insert new `pending` submissions
- **Service role key:** Used only inside Edge Functions, never exposed to the browser
- **Admin passphrase:** Verified server-side on every request; stored in Supabase Secrets
- **RLS policies:** Enforced at the database layer — no client-side trust

---

## Maintenance Requirements

### Ongoing (Weekly or As-Needed)

| Task | Who | Estimated Time |
|---|---|---|
| Review and moderate evidence submissions | Community Moderator | 1–3 hrs/week |
| Update allocation status (in progress → completed) | Data Steward | 30 min/week |
| Add new outcome records as projects close | Data Steward | 1 hr/project |
| Respond to flagged or disputed submissions | Moderator + Community Lead | As needed |

### Periodic (Monthly / Annual)

| Task | Who | Estimated Time |
|---|---|---|
| Load new fiscal year budget data | Data Steward | 2–4 hrs/year |
| Archive completed allocations | Data Steward | 1 hr/year |
| Review schema for new community needs | Technical Steward | Quarterly |
| Rotate admin passphrase | Technical Steward | Quarterly |
| Review Supabase usage and tier | Technical Steward | Monthly |

### Technical Upkeep
- Supabase handles database backups, SSL, and infrastructure automatically
- No server to patch or manage
- GitHub Pages handles static hosting with zero configuration
- The only "code maintenance" is updating Edge Functions if business logic changes

---

## Community Management Models

### Model 1: Volunteer Civic Organization
*Best for: small towns, neighborhood associations, local advocacy groups*

| Role | Responsibilities | Time Commitment | Required Skills |
|---|---|---|---|
| **Community Lead** | Owns the project publicly, recruits contributors, engages elected officials | 2–4 hrs/week | Communication, civic knowledge |
| **Data Steward** | Enters budget/allocation/outcome data from public records | 3–5 hrs/week | Spreadsheet literacy, attention to detail |
| **Evidence Moderator** | Reviews submissions, approves/rejects, flags patterns | 1–2 hrs/week | Judgment, local knowledge |
| **Technical Steward** | Manages Supabase, deploys updates, rotates secrets | 1 hr/week | Basic web/database familiarity |

**Automation opportunities:** Submission intake, photo storage, public display, stat counts — all automated. Human required only for moderation judgment and data entry.

**Where human integrity is essential:**
- Moderators must not approve or reject submissions based on political alignment
- Data entry must reference verifiable public documents (budgets, meeting minutes, FOAA responses)
- Outcome records must link to primary sources — not self-reported claims

---

### Model 2: Municipal Partnership
*Best for: towns that want an official transparency layer without building their own system*

| Role | Responsibilities | Time Commitment |
|---|---|---|
| **Department Liaison** | Submits allocation and outcome data on behalf of their department | 1–2 hrs/week |
| **Town Clerk / Finance Office** | Provides budget source data each fiscal year | Annual, ~4 hrs |
| **IT Contact** | Coordinates with technical steward on access and credentials | Minimal |
| **Resident Moderator** | Independent volunteer who reviews evidence (not a town employee) | 1–2 hrs/week |

**Key principle:** The evidence moderator should be a resident, not a town employee, to preserve independence. Automation handles routing; humans handle judgment.

---

### Model 3: Regional Civic Network
*Best for: county-level or multi-community deployment (e.g., all of Cumberland County)*

| Role | Responsibilities |
|---|---|
| **Network Coordinator** | Manages all communities in the system, recruits local stewards |
| **Per-Community Data Steward** | One per community, responsible for their town's records |
| **Regional Moderator Pool** | 2–3 rotating moderators reviewing submissions across all communities |
| **Technical Director** | Maintains the platform, manages billing, deploys updates |

**Automation in this model:**
- Submission routing by community tag
- Email alerts to the relevant community steward when a new submission arrives
- Automated status counts and dashboards per community
- Scheduled reminders to stewards when allocations haven't been updated in 60+ days

**Human intervention required:**
- All moderation decisions
- Data sourcing and entry
- Dispute resolution when residents challenge official records
- Annual data audits for accuracy

---

## Cost Analysis

### What Traditional Development Would Have Cost

| Phase | Traditional Agency/Contractor Estimate |
|---|---|
| Discovery & requirements | $8,000 – $15,000 |
| UI/UX design (wireframes, mockups) | $10,000 – $20,000 |
| Front-end development | $15,000 – $30,000 |
| Back-end / database / API | $20,000 – $40,000 |
| Admin panel + moderation workflow | $10,000 – $18,000 |
| File storage / photo upload | $5,000 – $10,000 |
| Testing & QA | $5,000 – $10,000 |
| Deployment & documentation | $3,000 – $6,000 |
| **Total traditional estimate** | **$76,000 – $149,000** |

*Estimates based on 2025–2026 rates for Maine-based or remote civic tech contractors.*

---

### Actual Cost to Build This Proof of Concept

| Item | Cost |
|---|---|
| Developer time (André Davis — donated) | $0 |
| Perplexity AI Pro subscription | ~$20/month |
| Supabase (Free tier — current) | $0 |
| GitHub Pages hosting | $0 |
| Domain (optional, not yet applied) | $12–15/year |
| **Total to date** | **< $20** |

---

### Ongoing Operational Costs by Model

#### Model 1: Volunteer Civic Org (1–3 communities)

| Item | Cost/Month |
|---|---|
| Supabase Free tier | $0 |
| GitHub Pages | $0 |
| Domain (optional) | ~$1 |
| Email notifications (Resend free tier, 3,000 emails/mo) | $0 |
| **Total** | **~$1/month** |

#### Model 2: Municipal Partnership (1 town, light usage)

| Item | Cost/Month |
|---|---|
| Supabase Pro (needed for >500MB DB or >2GB storage) | $25 |
| GitHub Pages or custom hosting | $0–$10 |
| Domain | ~$1 |
| Email notifications (Resend) | $0–$20 |
| **Total** | **~$26–$56/month** |

#### Model 3: Regional Network (5–20 communities)

| Item | Cost/Month |
|---|---|
| Supabase Pro | $25 |
| Additional storage (if photo-heavy) | $0.021/GB over limit |
| Custom domain + CDN | $10–$20 |
| Email service (Resend or SendGrid) | $0–$20 |
| Part-time technical steward (contract, ~2 hrs/mo) | $100–$200 |
| **Total** | **~$135–$265/month** |

---

## The Broader Point

This project demonstrates that the barrier to civic transparency tooling is no longer primarily technical or financial — it is organizational. The technology to build this exists, works reliably, and costs almost nothing to operate.

What communities actually need is:
- **One person** willing to enter and maintain accurate data
- **One person** willing to moderate community submissions fairly
- **One person** willing to hold the technical pieces together
- **Institutional buy-in** — or the courage to operate without it

The traditional cost of this kind of platform has historically made it accessible only to well-funded municipalities or large nonprofits. That is no longer true.

---

## Built With

- [Supabase](https://supabase.com) — Postgres database, storage, Edge Functions, RLS
- [GitHub Pages](https://pages.github.com) — static hosting
- Vanilla JavaScript (ES modules) — no framework, no build step
- [Perplexity AI](https://perplexity.ai) — development assistant throughout

---

## Contact

Built by [André Davis](https://207analytix.com) · 207 Analytix · Portland, Maine

Interested in deploying this for your community? Open an issue or reach out directly.
