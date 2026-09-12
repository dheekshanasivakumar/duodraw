# DuoDraw

**Draw Together. Leave No Trace.**

A private, temporary canvas for exactly two people: create a room, share the code, draw and chat together in real time, then leave — nothing is left behind. No accounts, no usernames, no galleries, no saved conversations.

---

## 1. Architecture, briefly

```
Browser A  ──┐                              ┌── Browser B
             │                              │
     React + Vite (Tailwind CSS)    React + Vite (Tailwind CSS)
             │                              │
             └───────── Supabase ───────────┘
                 ├─ Postgres:  rooms, participants   (RLS-protected)
                 ├─ Realtime Broadcast: drawing strokes, chat, canvas-sync
                 └─ Realtime Presence: "who's online right now"
```

**What's actually stored, and what isn't.** Two small tables persist to disk: `rooms` (a room code and an expiry time) and `participants` (a temporary anonymous session id and a label like "Artist 1"). **Drawing strokes and chat messages are never written to a database at all.** They travel only through Supabase Realtime *Broadcast*, a live relay that does not persist payloads. When a new participant joins mid-session, the existing participant's browser sends them a one-time snapshot of the current canvas (just the strokes needed to redraw it) over the same ephemeral channel — so catching up doesn't require the server to have stored anything either. Close both tabs, and the drawing and the conversation are simply gone.

**Identity.** Each tab signs in via Supabase Anonymous Auth the moment it loads. This is not an account — there's no email, password, or profile, and the resulting id is never shown in the UI. It exists purely so the database's Row Level Security rules can tell "a participant of this room" apart from an anonymous stranger on the internet.

**Drawing sync.** Strokes are batched per animation frame (not per pointer-move event) and sent as `start` / `move` / `end` messages, so a fast, sloppy scribble doesn't flood the network. The `end` message is authoritative and idempotent, so a dropped `move` packet never corrupts the shared drawing.

**Undo/redo.** Each browser can undo/redo only its *own* strokes (a safe, well-defined behavior for two independent artists sharing a canvas), and the result is re-synced to the other participant. This avoids the ambiguity of "whose undo wins" on a fully shared history.

---

## 2. Project structure

```
duodraw/
├── src/
│   ├── components/
│   │   ├── Canvas/            # <canvas> + pointer event wiring
│   │   ├── ChatPanel/         # ephemeral chat UI
│   │   ├── DrawingToolbar/    # tools, sizes, colors, undo/redo/clear/download
│   │   ├── RoomHeader/        # room code, connection status, Leave
│   │   ├── ParticipantStatus/ # "Artist 1 ● Artist 2 ●"
│   │   ├── Modals/            # confirmation dialogs
│   │   └── UI/                # Button, Toast
│   ├── pages/
│   │   ├── Home.jsx
│   │   ├── CreateRoom.jsx
│   │   ├── JoinRoom.jsx
│   │   └── DrawingRoom.jsx
│   ├── hooks/
│   │   ├── useCanvas.js       # pointer drawing, local history, undo/redo
│   │   ├── useRealtime.js     # Supabase channel lifecycle + status
│   │   └── useRoom.js         # presence, heartbeat, expiration
│   ├── services/
│   │   ├── supabase.js
│   │   ├── roomService.js     # create/join/leave/heartbeat
│   │   └── realtimeService.js # broadcast/presence wrapper
│   ├── utils/
│   │   ├── canvasUtils.js
│   │   ├── roomUtils.js
│   │   └── validation.js
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
├── supabase/
│   └── schema.sql              # tables, RLS policies, cleanup job
├── .env.example
├── netlify.toml
└── package.json
```

---

## 3. Run it locally

```bash
npm install
cp .env.example .env      # then fill in your Supabase values (step 4)
npm run dev
```

Open the printed `localhost` URL in **two different browsers** (or one normal + one incognito window) to test with two participants.

```bash
npm run build     # production build to dist/
npm run preview   # preview the production build locally
```

---

## 4. Supabase setup (beginner-friendly, step by step)

1. **Create a project.** Go to [supabase.com](https://supabase.com) → New Project. Pick any name/region/password (the database password isn't used by the app itself).
2. **Create the tables and policies.** In your project, open **SQL Editor → New query**, paste the entire contents of [`supabase/schema.sql`](./supabase/schema.sql), and click **Run**. This single script creates the `rooms` and `participants` tables, turns on Row Level Security, adds every policy, and sets up automatic cleanup.
3. **Enable Anonymous sign-ins.** Go to **Authentication → Sign In / Providers → Anonymous Sign-Ins** and toggle it on. This is what gives each browser tab its temporary, profile-less identity.
4. **Realtime is already on.** The SQL script adds `rooms` and `participants` to the `supabase_realtime` publication for you. Broadcast and Presence (used for strokes, chat, and online status) need no extra setup — they work automatically over any channel.
5. **Configure cleanup/expiration.** The script tries to schedule `cleanup_expired_rooms()` every 5 minutes using `pg_cron`, which ships with every Supabase project. If your project doesn't have `pg_cron` enabled yet, go to **Database → Extensions**, enable `pg_cron`, then re-run just the bottom `do $$ ... $$` block of `schema.sql`. Alternatively, create a **Supabase Edge Function** on a cron trigger that calls:
   ```sql
   select public.cleanup_expired_rooms();
   ```
   Until cleanup runs, expired rooms simply become unusable immediately (the app checks `expires_at` on every join and every few seconds while inside a room) — the cron job's only job is to actually delete the old rows so they don't accumulate.
6. **Copy your API credentials.** Go to **Settings → API**. Copy the **Project URL** and the **`anon` `public` key** (never the `service_role` key).
7. **Add them to `.env`:**
   ```
   VITE_SUPABASE_URL=https://your-project-ref.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-public-key
   VITE_ROOM_EXPIRY_MINUTES=30
   ```
8. **Run the app** (`npm run dev`) and test with two browsers as described above.

---

## 5. Deploying to Netlify

1. Push this project to a Git repository (GitHub/GitLab/Bitbucket).
2. In Netlify: **Add new site → Import an existing project**, pick the repo.
3. Build settings are already provided by `netlify.toml` (`npm run build`, publish `dist`), so you shouldn't need to change anything.
4. Under **Site settings → Environment variables**, add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_ROOM_EXPIRY_MINUTES` (optional, defaults to 30)
5. Deploy. `netlify.toml` includes the SPA redirect rule (`/* → /index.html`) so refreshing `/room/AB7K9Q` on Netlify works correctly.

---

## 6. Privacy design

- No email/password registration, no profile pages, no public usernames.
- Each participant is shown only as "Artist 1" / "Artist 2" for the lifetime of the room.
- No list of past collaborators, past rooms, or activity history anywhere in the UI.
- Chat messages and drawing strokes are never written to a database — see the architecture note above.
- Rooms auto-expire after inactivity (`VITE_ROOM_EXPIRY_MINUTES`, default 30) and cannot be joined once expired.
- The only local export is an explicit, user-initiated **Download PNG** of the current canvas — nothing is uploaded anywhere automatically.
- Row Level Security ensures a session can only read/write the room it has actually joined, and the database itself enforces the 2-participant cap (via a trigger), independent of the frontend.

## 7. Testing checklist

These map directly to the scenarios the app is designed to handle:

1. Browser A creates a room → sees the room code + "Waiting for Artist 2…".
2. Browser B joins with that code → both browsers show 2/2 Artists.
3. Browser A draws → appears on Browser B immediately, and vice versa, simultaneously.
4. Browser A sends a chat message → appears instantly on Browser B, and vice versa.
5. A third browser tries to join the same code → sees "This private room is full."
6. One participant clicks Leave → the other sees a "left the room" notification.
7. Wait past the expiry window (or lower `VITE_ROOM_EXPIRY_MINUTES` for testing) → the room can no longer be joined.
8. Create a brand-new room → no chat, drawing, or collaborator history from the old room appears.
9. Refresh mid-session → you rejoin the same room as the same Artist number, without creating a duplicate participant.
