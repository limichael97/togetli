# Togetli Core Flows (MVP-Focused)

## Core Principle

Users should always know:

* what state the trip is in
* what action is next

---

## 1. Trip Lifecycle (CRITICAL)

Each trip is in ONE state:

1. Draft

   * trip created
   * poll not sent

2. Polling

   * poll sent
   * collecting responses

3. Finalized

   * decisions locked
   * coordination begins

---

## 2. Trip Creation Flow

### Goal

Create a trip quickly.

### Steps

1. user creates trip (name)
2. enters setup (dates + budget)
3. invites members
4. sends poll

---

## 3. Poll Flow

### Goal

Collect structured input.

### Members submit:

* availability
* budget

### System:

* aggregates results
* shows participation

### Rules

* must have ≥1 date option
* must have ≥1 non-creator participant

---

## 4. Finalization Flow

### Goal

Move to execution phase

### Action

Creator finalizes trip

### Result

* trip.state → finalized
* poll locked
* coordination UI becomes primary

---

## 5. Coordination Flow (NEW CORE)

### Goal

Run the trip

### Includes:

* travel board (arrival times)
* itinerary (simple)
* shared info (notes + links)

---

## 6. Trip Detail Screen

### Must show:

* current state
* next action

### Examples:

Draft:
→ "Add dates" / "Send poll"

Polling:
→ "View responses"

Finalized:
→ "View itinerary"
→ "Add travel details"

---

## 7. Invitations

### Flow:

* invite via link/email
* user joins
* becomes member

---

## 8. What NOT to build yet

* destination system
* voting
* advanced permissions
* complex itinerary

---

## Key Insight

Togetli is:

→ a structured decision + coordination system

NOT:

→ a full planning platform (yet)
