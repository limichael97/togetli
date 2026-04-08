# Togetli Backend Context (Current Reality)

## Stack

* Supabase (Postgres + Auth + RLS)
* Expo React Native client directly calling Supabase

## Core Tables (important)

* profiles
* trips
* trip_members
* trip_invites (NEW)
* trip_date_options
* trip_budget_options
* poll_responses
* travel_details (NEW)
* trip_notes (NEW)
* itinerary_days
* itinerary_items

These are the main tables actively used in the app today.

## Relationships (simplified)

* a trip has many trip_members
* a trip has many invites
* a trip has many date options
* a trip has many budget options
* a trip has many poll responses
* a trip has many travel_details (one per user)
* a trip has many notes
* a trip has itinerary days → items

## Trip ownership

* trips.creator_id is the owner
* creator is always a member of the trip

## Membership model

* trip_members links users to trips
* roles exist (creator, member)
* advanced permissions are NOT implemented

## Trip State System (IMPORTANT)

* trips.state:

  * 'draft'
  * 'polling'
  * 'finalized'

This drives all UI behavior.

## Poll system (current)

* poll_responses stores:

  * selected date options (array of ids)
  * budget selections
* one row per user per trip

## Coordination system (NEW)

* travel_details → tracks arrival/departure per user
* trip_notes → shared links + notes
* itinerary → simple day + items structure

## Important backend rules

* a user must be a trip member to access trip data
* creator must always have access
* poll responses are unique per (trip_id, user_id)
* travel_details are unique per (trip_id, user_id)

## Current backend constraints

* no destination system yet
* no voting system
* no reveal system
* no advanced permissions

## How frontend interacts

* direct Supabase queries from app
* minimal abstraction (lib/ functions)

## Key principle

Do NOT assume future systems exist.

Only use what exists in database.types.ts.
