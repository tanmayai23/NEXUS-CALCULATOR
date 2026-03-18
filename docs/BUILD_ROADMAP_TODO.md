# Build Roadmap (Todo-First)

Positioning line:

You are not building a calculator. You are building a continuous math improvement engine that turns every attempt into personalized next-step learning.

## Phase 1: Foundation

- [x] Keep guest token auth stable.
- [x] Separate answer panel and visualization panel clearly.
- [x] Add clear solver mode labels:
  - [x] Basic
  - [x] Board
  - [x] Competitive

Implementation refs:
- `backend/server.ts` (`/api/students`, token checks)
- `nexus-math-weaver/src/components/NexusLayout.tsx` (answer panel + visualization toggle + solver mode labels)

## Phase 2: Identity and Trust

- [x] Add email OTP login flow.
- [x] Link guest profile data to logged-in user.
- [x] Add profile progress history API + frontend section.
- [x] Add Google login.

Implementation refs:
- `backend/server.ts` (`/api/auth/request-otp`, `/api/auth/verify-otp`, `/api/auth/restore`)
- `backend/server.ts` (`/api/students/:studentId/profile/history`)
- `nexus-math-weaver/src/components/NexusLearningCoach.tsx` (OTP UI + profile history panel)

## Phase 3: Learning Intelligence

- [x] Improve mistake taxonomy engine (formula/sign/theorem categories in coach flow).
- [x] Add weighted weakness scoring.
- [x] Upgrade daily plan generator with:
  - [x] time limits,
  - [x] completion tracking,
  - [x] multi-factor inputs.

Implementation refs:
- `backend/server.ts` (`computeChapterWeaknessScore`, `computeWeaknessScores`, `/plan/daily`, `/plan/complete`)
- `nexus-math-weaver/src/components/NexusLearningCoach.tsx` (daily plan controls + completion submit)

## Phase 4: Gamification and B2B

- [x] Implement score engine.
- [x] Build leaderboard variants:
  - [x] global,
  - [x] class-wise,
  - [x] institute-wise,
  - [x] chapter-wise challenge.
- [x] Add institute admin dashboard API.
- [x] Add CSV/API exports for coaching centers.

Implementation refs:
- `backend/server.ts` (`/activity/score`, `/students/leaderboard`, `/institutes/:instituteName/dashboard`, `/institutes/:instituteName/export/students.csv`)
- `nexus-math-weaver/src/components/NexusLearningCoach.tsx` (leaderboard type selector)

## Phase 5: Sales Readiness

- [ ] Create one pilot dashboard for one institute.
- [ ] Run one cohort for 2 to 4 weeks.
- [ ] Measure retention, accuracy gain, weak-chapter recovery.
- [ ] Use pilot metrics for partnership pitch.

Suggested KPI contract for pilot:
- Weekly active learners
- Plan completion rate
- Challenge participation rate
- Accuracy lift (week-over-week)
- Weak chapter recovery rate
- Mentor intervention productivity (students handled per coach)

## Next Build Tasks

1. Institute admin frontend page (currently API-first)
2. Randomized challenge question pool with immutable question IDs
3. Add LMS integration webhooks and signed API keys
4. Add automated weekly institute KPI email export
5. Add role-based access controls for institute staff
