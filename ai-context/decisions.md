# Togetli Engineering Decisions

## Architecture philosophy

* keep it simple
* avoid over-engineering
* build only what is needed now
* ship fast and iterate

## Product direction (IMPORTANT)

* focus on:
  → decision (polls)
  → coordination (travel, itinerary, notes)

* NOT building full planning system yet

## Frontend rules

* use functional components
* keep UI clean and minimal
* avoid deeply nested logic
* separate logic into lib/ or hooks

## Backend rules

* Supabase is source of truth
* always use database.types.ts
* prefer simple queries
* avoid unnecessary joins/abstractions early

## Feature development rules

* build smallest usable version first
* prioritize real usage over completeness
* avoid “future-proofing” too early

## Permissions

* keep roles simple:

  * creator
  * member
* do NOT implement advanced permissions yet

## Product constraints

* MVP = decision + coordination
* DO NOT build:

  * destination recommendations
  * voting systems
  * complex permissions
  * reveal flow

## AI collaboration rules

* always read ai-context files first
* do not assume features exist
* prefer editing existing code over new systems
* return complete working code
