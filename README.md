# Togetli

Togetli is a mobile application that simplifies group trip planning by bringing trip coordination, scheduling, and decision-making into one place.

Instead of managing trips through scattered group chats, spreadsheets, and polls, Togetli helps groups collaborate on dates, travel logistics, accommodations, and activities through a shared planning experience.

## Features

### Trip Planning
- Create and manage group trips
- Invite members through shareable invite links
- Role-based permissions for organizers and guests

### Date Polling
- Propose trip dates
- Vote on preferred date ranges
- View poll results and group availability

### Shared Ideas
- Collect accommodation, food, and activity ideas
- Organize suggestions by category
- Collaborate on trip planning decisions

### Travel Coordination
- Track arrivals and departures
- Share flight information and travel details
- View travel plans across the entire group

### Authentication & Security
- Email/password authentication
- Google OAuth
- Secure multi-user data access with Row Level Security (RLS)

## Tech Stack

### Frontend
- React Native
- Expo
- TypeScript
- Zustand

### Backend
- Supabase
- PostgreSQL

### Authentication
- Supabase Auth
- Google OAuth

### Security
- Row Level Security (RLS)

## Architecture

Togetli follows a mobile-first architecture built with React Native and Expo. Data is stored in PostgreSQL through Supabase, with Row Level Security policies ensuring users can only access data associated with trips they belong to.

Core application state is managed using Zustand, while Supabase provides authentication, database access, and real-time synchronization.

## Why I Built It

Group trip planning is often fragmented across text messages, spreadsheets, shared documents, and multiple apps. Togetli was built to create a single place where groups can coordinate travel plans, vote on dates, organize ideas, and manage logistics together.

## Screenshots

<img width="369" height="400" alt="1780523736522" src="https://github.com/user-attachments/assets/cac04f8d-bbd8-49ec-ba40-4d12af2a2d28" />
<img width="369" height="400" alt="1780516684382" src="https://github.com/user-attachments/assets/97d375ec-8cf0-4957-bf59-c7477fc5ed10" />
<img width="369" height="400" alt="1780516684235" src="https://github.com/user-attachments/assets/5335cf86-fd4b-47c6-8716-95fadbd247bd" />
<img width="369" height="400" alt="1780516683948" src="https://github.com/user-attachments/assets/a2cbd796-59dc-4175-b6d9-b79259bb7273" />



## Current Status

Active development.

Recent areas of development include:
- Date polling workflows
- Travel coordination board
- Shared ideas and trip collaboration features
- Role-based permissions and invitation flows
- UI/UX improvements across the planning experience
