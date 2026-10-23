# Tasks

- [x] Task 1: Fix browser title
  - [x] Subtask 1.1: Verified app/layout.tsx metadata title already shows "跨境智卖" (was already fixed)
  - [x] Subtask 1.2: Browser title confirmed correct

- [x] Task 2: Verify theme & i18n access for all roles
  - [x] Subtask 2.1: Reviewed dashboard/settings/page.tsx — theme/i18n settings NOT gated by role (only user role management section is admin-only)
  - [x] Subtask 2.2: Reviewed mobile/profile/page.tsx — settings entries (language, theme, timezone) visible to all roles
  - [x] Subtask 2.3: Reviewed mobile/settings-locale/page.tsx and mobile/settings-theme/page.tsx — no role checks
  - [x] Subtask 2.4: No role gating found on theme/i18n — confirmed accessible to all roles

- [x] Task 3: Fix route-guard tests
  - [x] Subtask 3.1: Read tests/auth/route-guard.test.ts and identified failing assertions (3 failures due to default-allow strategy)
  - [x] Subtask 3.2: Updated test assertions to match "default allow" strategy
  - [x] Subtask 3.3: Route-guard tests pass — 24/24 passing

- [x] Task 4: Full test verification
  - [x] Subtask 4.1: Ran full test suite — 601 tests passing, 37 suites
  - [x] Subtask 4.2: Zero regressions confirmed

# Task Dependencies
- [Task 3] depends on [Task 1] (no real dependency, just ordering)
- [Task 4] depends on [Task 1, Task 2, Task 3]
