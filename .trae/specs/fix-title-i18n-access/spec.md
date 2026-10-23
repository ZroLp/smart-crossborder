# Fix Browser Title, i18n & Theme Access Spec

## Why
After the user-center-i18n-theme spec was completed, two issues were discovered:
1. Browser title still shows "速迈通" instead of the correct product name "跨境智卖"
2. Need to verify that regular users (non-admin) can see and use theme switching and internationalization options

## What Changes
- Fix browser title in `app/layout.tsx` metadata from "速迈通" to "跨境智卖"
- Verify and ensure theme/i18n settings are accessible to all user roles (viewer/operator/admin)
- Fix route-guard.test.ts tests that fail due to the "default allow" strategy in route-guard.ts

## Impact
- Affected specs: user-center-i18n-theme (follow-up fixes)
- Affected code: `app/layout.tsx`, `lib/auth/route-guard.ts`, `tests/auth/route-guard.test.ts`, mobile settings pages

## ADDED Requirements
### Requirement: Correct Browser Title
The system SHALL display the correct product name "跨境智卖" in the browser title bar.

#### Scenario: Page load
- **WHEN** user opens any page of the application
- **THEN** browser tab shows "跨境智卖" as the title

### Requirement: Universal Access to Theme & i18n Settings
Theme switching and internationalization settings SHALL be accessible to ALL user roles (admin, operator, viewer), both on desktop settings page and mobile profile page.

#### Scenario: Regular user accessing settings
- **WHEN** a viewer/operator user opens the Settings page or mobile profile
- **THEN** they can see and use language, timezone, theme, and currency settings

### Requirement: Route Guard Tests Pass
All route-guard tests SHALL pass, reflecting the current "default allow for unmapped paths" strategy.

#### Scenario: Running tests
- **WHEN** `npx jest` is executed
- **THEN** all route-guard tests pass with 0 failures

## MODIFIED Requirements
### Requirement: Route Guard Default Behavior (from user-center-i18n-theme)
The route guard SHALL use a "default allow" strategy for unmapped paths, while enforcing role-based access for explicitly mapped restricted pages.

**Reason**: PAGE_PERMISSIONS now only contains restricted pages (settings, data-center, etc.), and unmapped paths default to `allowed: true`.
