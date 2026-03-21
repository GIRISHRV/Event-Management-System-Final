# Database Schema Reference

EventMS uses a PostgreSQL database hosted on Supabase with Row Level Security (RLS) enforced on all tables. This document covers every table's columns, types, nullability, foreign keys, JSONB field structures, RLS policies, and enum constraints.

See also:
- [docs/ARCHITECTURE.md](./ARCHITECTURE.md) — API routes, authentication flow, and role-based access control
- [docs/ALGORITHMS.md](./ALGORITHMS.md) — ML algorithm details, caching strategy, and TTL values

---

## Tables Overview

| Table | Purpose |
|---|---|
| `profiles` | User accounts and role assignments |
| `events` | All event data created by organizers |
| `bookings` | RSVPs linking users to events |
| `chat_history` | AI chatbot message history per user/event pair |
| `vendor_services` | Service offerings listed by vendors |
| `service_requests` | Vendor hire requests from customers to vendors |
| `user_interactions` | Implicit signals (view, favorite, RSVP) for ML algorithms |
| `favorites` | Explicit event favorites |
| `attendance_forecasts` | iTransformer output cache |
| `event_communities` | GAT+K-Means community detection output cache |
| `algorithm_results` | ML execution log and result cache for all algorithms |

---

## Core Tables

### `profiles`

Stores user account information. One row per authenticated user. The `role` column drives dashboard routing and RLS policies throughout the system.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NOT NULL | — | Primary key; matches Supabase Auth `user.id` |
| `email` | `text` | NOT NULL | — | User's email address |
| `username` | `text` | NULL | — | Optional display handle |
| `full_name` | `text` | NULL | — | Optional full name |
| `avatar_url` | `text` | NULL | — | URL to profile picture |
| `bio` | `text` | NULL | — | Optional short biography |
| `role` | `text` | NOT NULL | — | CHECK: `'customer'`, `'vendor'`, `'admin'` |
| `created_at` | `timestamptz` | NOT NULL | `now()` | Row creation timestamp |
| `updated_at` | `timestamptz` | NULL | — | Last update timestamp |

**Foreign keys:** None (this is the root user table).

---

### `events`

Stores all event data. Complex nested data (schedules, performers, FAQs) is stored as JSONB. See [JSONB Field Structures](#jsonb-field-structures) below for nested schemas.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NOT NULL | — | Primary key |
| `user_id` | `uuid` | NOT NULL | — | FK → `profiles.id`; the event organizer |
| `event_name` | `text` | NOT NULL | — | Display name of the event |
| `event_description` | `text` | NULL | — | Optional long description |
| `start_date` | `date` | NOT NULL | — | Event start date (YYYY-MM-DD) |
| `start_time` | `time` | NOT NULL | — | Event start time (HH:MM) |
| `end_date` | `date` | NOT NULL | — | Event end date (YYYY-MM-DD) |
| `end_time` | `time` | NOT NULL | — | Event end time (HH:MM) |
| `visibility_type` | `text` | NOT NULL | — | CHECK: `'public'`, `'private'`, `'whitelist'` |
| `event_status` | `text` | NOT NULL | — | CHECK: `'upcoming'`, `'ongoing'`, `'completed'`, `'cancelled'` |
| `max_attendees` | `int` | NULL | — | Optional capacity cap |
| `budget` | `numeric` | NULL | — | Optional event budget (INR) |
| `venue_name` | `text` | NULL | — | Optional venue name |
| `venue_city` | `text` | NULL | — | Optional venue city |
| `venue_latitude` | `float` | NULL | — | Optional GPS latitude |
| `venue_longitude` | `float` | NULL | — | Optional GPS longitude |
| `schedules` | `jsonb` | NOT NULL | `'[]'` | Array of schedule items; see JSONB structures |
| `performers` | `jsonb` | NOT NULL | `'[]'` | Array of performer objects; see JSONB structures |
| `faqs` | `jsonb` | NOT NULL | `'[]'` | Array of FAQ objects; see JSONB structures |
| `tags` | `text[]` | NOT NULL | `'{}'` | Array of tag strings |
| `gallery_images` | `text[]` | NOT NULL | `'{}'` | Array of image URLs |
| `gallery_videos` | `text[]` | NOT NULL | `'{}'` | Array of video URLs |
| `attendee_count` | `int` | NOT NULL | `0` | Denormalized count of confirmed bookings |
| `created_at` | `timestamptz` | NOT NULL | `now()` | Row creation timestamp |
| `updated_at` | `timestamptz` | NULL | — | Last update timestamp |

**Foreign keys:**
- `user_id` → `profiles.id`

---

### `bookings`

Stores RSVPs linking users to events.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NOT NULL | — | Primary key |
| `event_id` | `uuid` | NOT NULL | — | FK → `events.id` |
| `user_id` | `uuid` | NOT NULL | — | FK → `profiles.id` |
| `status` | `text` | NOT NULL | — | CHECK: `'confirmed'`, `'cancelled'`, `'waitlist'` |
| `created_at` | `timestamptz` | NOT NULL | `now()` | Row creation timestamp |

**Foreign keys:**
- `event_id` → `events.id`
- `user_id` → `profiles.id`

---

### `chat_history`

Stores AI chatbot message history per user/event pair. The full conversation is stored as a JSONB array in `messages`.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NOT NULL | — | Primary key |
| `user_id` | `uuid` | NOT NULL | — | FK → `profiles.id` |
| `event_id` | `uuid` | NOT NULL | — | FK → `events.id` |
| `messages` | `jsonb` | NOT NULL | `'[]'` | Array of `ChatMessage` objects |
| `created_at` | `timestamptz` | NOT NULL | `now()` | Row creation timestamp |
| `updated_at` | `timestamptz` | NULL | — | Last update timestamp |

**Foreign keys:**
- `user_id` → `profiles.id`
- `event_id` → `events.id`

---

### `vendor_services`

Stores service offerings listed by vendors. Used by the MOEA/D budget optimizer as candidate vendors. The `quality_score` is computed by `/api/admin/backfill-quality` from real `service_requests` data.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NOT NULL | — | Primary key |
| `vendor_id` | `uuid` | NOT NULL | — | FK → `profiles.id`; the owning vendor |
| `service_name` | `text` | NOT NULL | — | Display name of the service |
| `description` | `text` | NULL | — | Optional service description |
| `base_price` | `numeric` | NULL | — | Optional base price (INR) |
| `price_unit` | `text` | NULL | — | CHECK: `'per_hour'`, `'per_event'` |
| `category` | `text` | NULL | — | Service category (e.g. `'DJ'`, `'Catering'`) |
| `quality_score` | `numeric` | NULL | — | CHECK: 0–100; computed by backfill-quality |
| `rating` | `numeric` | NULL | — | CHECK: 0–5; average customer rating |
| `images` | `text[]` | NULL | — | Array of image URLs |
| `created_at` | `timestamptz` | NOT NULL | `now()` | Row creation timestamp |

**Foreign keys:**
- `vendor_id` → `profiles.id`

---

### `service_requests`

Stores vendor hire requests from customers to vendors. Tracks the full lifecycle from initial request through acceptance, completion, or cancellation.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NOT NULL | — | Primary key |
| `event_id` | `uuid` | NOT NULL | — | FK → `events.id` |
| `service_id` | `uuid` | NOT NULL | — | FK → `vendor_services.id` |
| `requester_id` | `uuid` | NOT NULL | — | FK → `profiles.id`; the customer |
| `vendor_id` | `uuid` | NOT NULL | — | FK → `profiles.id`; the vendor |
| `status` | `text` | NOT NULL | — | CHECK: `'pending'`, `'accepted'`, `'rejected'`, `'completed'`, `'cancelled'` |
| `cancellation_requested_by` | `text` | NULL | — | CHECK: `'customer'`, `'vendor'`; set when cancelling an accepted request |
| `message` | `text` | NULL | — | Optional message from the requester |
| `created_at` | `timestamptz` | NOT NULL | `now()` | Row creation timestamp |
| `updated_at` | `timestamptz` | NULL | — | Last update timestamp |

**Foreign keys:**
- `event_id` → `events.id`
- `service_id` → `vendor_services.id`
- `requester_id` → `profiles.id`
- `vendor_id` → `profiles.id`

#### `service_requests.status` Transition Rules

Valid state transitions are:

```
pending ──→ accepted    (by vendor)
pending ──→ rejected    (by vendor)
pending ──→ cancelled   (by customer/requester)

accepted ──→ completed  (by system or vendor when event passes)
accepted ──→ cancelled  (by either party — sets cancellation_requested_by)

rejected   [terminal]
completed  [terminal]
```

- `rejected` and `completed` are terminal states; no further transitions are permitted.
- When an `accepted` request is cancelled by either party, `cancellation_requested_by` is set to `'customer'` or `'vendor'` accordingly.

---

## Algorithm Support Tables

These tables store implicit signals, explicit favorites, and cached ML outputs. They are read and written by the algorithm API routes and are not directly exposed to the frontend.

### `user_interactions`

Records implicit user signals used as input to XSimGCL and GNN-CF. Every view, favorite, and RSVP is logged here to build the interaction graph.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NOT NULL | — | Primary key |
| `user_id` | `uuid` | NOT NULL | — | FK → `profiles.id` |
| `event_id` | `uuid` | NOT NULL | — | FK → `events.id` |
| `interaction_type` | `text` | NOT NULL | — | CHECK: `'view'`, `'favorite'`, `'rsvp'` |
| `created_at` | `timestamptz` | NOT NULL | `now()` | Timestamp of the interaction |

**Foreign keys:**
- `user_id` → `profiles.id`
- `event_id` → `events.id`

**Purpose:** The recommendation API counts rows in this table per user to determine cold-start status (fewer than 3 interactions → GNN-CF; 3 or more → XSimGCL). See [docs/ALGORITHMS.md](./ALGORITHMS.md) for the full selection logic.

---

### `favorites`

Stores explicit event favorites. Synced with `user_interactions` (a favorite also writes an `interaction_type = 'favorite'` row). The `UNIQUE(user_id, event_id)` constraint prevents duplicate favorites.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NOT NULL | — | Primary key |
| `user_id` | `uuid` | NOT NULL | — | FK → `profiles.id` |
| `event_id` | `uuid` | NOT NULL | — | FK → `events.id` |
| `created_at` | `timestamptz` | NOT NULL | `now()` | Timestamp of the favorite |

**Constraints:** `UNIQUE(user_id, event_id)`

**Foreign keys:**
- `user_id` → `profiles.id`
- `event_id` → `events.id`

---

### `attendance_forecasts`

Caches iTransformer attendance forecast output per event. TTL is 1 hour (`expires_at = created_at + 60 min`). The API checks `expires_at` before rerunning the model.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NOT NULL | — | Primary key |
| `event_id` | `uuid` | NOT NULL | — | FK → `events.id` |
| `predictions` | `jsonb` | NOT NULL | — | Array of daily prediction objects |
| `trend` | `text` | NOT NULL | — | `'increasing'`, `'decreasing'`, or `'stable'` |
| `recommended_capacity` | `int` | NOT NULL | — | Suggested max attendees |
| `horizon` | `int` | NOT NULL | — | Forecast horizon in days (7 or 14) |
| `confidence_level` | `numeric` | NOT NULL | — | Confidence level used (0.80–0.99) |
| `expires_at` | `timestamptz` | NOT NULL | — | Cache expiry (created_at + 60 min) |
| `created_at` | `timestamptz` | NOT NULL | `now()` | Row creation timestamp |

**Foreign keys:**
- `event_id` → `events.id`

---

### `event_communities`

Caches GAT+K-Means community detection output. TTL is 30 minutes (`expires_at = created_at + 30 min`). Each row represents one event's community membership.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NOT NULL | — | Primary key |
| `event_id` | `uuid` | NOT NULL | — | FK → `events.id` |
| `community_id` | `int` | NOT NULL | — | Cluster index assigned by K-Means |
| `community_label` | `text` | NULL | — | Optional human-readable cluster label |
| `similar_event_ids` | `text[]` | NOT NULL | `'{}'` | UUIDs of other events in the same community |
| `silhouette_score` | `numeric` | NULL | — | Clustering quality score for this run |
| `expires_at` | `timestamptz` | NOT NULL | — | Cache expiry (created_at + 30 min) |
| `created_at` | `timestamptz` | NOT NULL | `now()` | Row creation timestamp |

**Foreign keys:**
- `event_id` → `events.id`

---

### `algorithm_results`

General-purpose ML execution log and result cache. Every algorithm run (recommendations, budget optimizer, forecast, communities) writes a row here. Used for caching (checked before re-running), research paper logging, and admin evaluation.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NOT NULL | — | Primary key |
| `user_id` | `uuid` | NOT NULL | — | FK → `profiles.id`; the requesting user |
| `algorithm_type` | `text` | NOT NULL | — | CHECK: `'xsimgcl'`, `'gnn-cf'`, `'moea-d'`, `'itransformer'`, `'gat-kmeans'` |
| `input_data` | `jsonb` | NOT NULL | — | Serialized algorithm inputs |
| `output_data` | `jsonb` | NOT NULL | — | Serialized algorithm outputs |
| `execution_time_ms` | `int` | NOT NULL | — | Wall-clock execution time in milliseconds |
| `version` | `text` | NOT NULL | — | Algorithm version string |
| `expires_at` | `timestamptz` | NOT NULL | — | Cache expiry timestamp |
| `created_at` | `timestamptz` | NOT NULL | `now()` | Row creation timestamp |

**Foreign keys:**
- `user_id` → `profiles.id`

**Cache TTLs by algorithm type:**

| `algorithm_type` | TTL |
|---|---|
| `xsimgcl` | 30 minutes |
| `gnn-cf` | 30 minutes |
| `moea-d` | 30 minutes |
| `itransformer` | 60 minutes |
| `gat-kmeans` | 30 minutes |

See [docs/ALGORITHMS.md](./ALGORITHMS.md) for full caching strategy details.

---

## JSONB Field Structures

The `events` table stores three complex nested fields as JSONB arrays.

### `schedules`

An ordered list of agenda items for the event.

```typescript
interface EventScheduleItem {
  time: string         // HH:MM format (e.g. "14:30")
  title: string        // agenda item title
  description?: string // optional details
}
```

**Example:**
```json
[
  { "time": "09:00", "title": "Registration & Welcome" },
  { "time": "10:00", "title": "Keynote", "description": "Opening keynote by the main speaker" }
]
```

---

### `performers`

A list of performers or speakers appearing at the event.

```typescript
interface EventPerformerItem {
  name: string       // performer's name
  role?: string      // e.g. "DJ", "Speaker", "Host"
  bio?: string       // optional short biography
  image_url?: string // optional profile image URL
}
```

**Example:**
```json
[
  { "name": "DJ Arjun", "role": "DJ", "image_url": "https://cdn.example.com/arjun.jpg" },
  { "name": "Priya Sharma", "role": "Speaker", "bio": "Tech entrepreneur and author" }
]
```

---

### `faqs`

A list of frequently asked questions about the event.

```typescript
interface EventFAQItem {
  question: string // the question text
  answer: string   // the answer text
}
```

**Example:**
```json
[
  { "question": "Is parking available?", "answer": "Yes, free parking is available on-site." },
  { "question": "Is the event family-friendly?", "answer": "Yes, all ages are welcome." }
]
```

---

## Row Level Security (RLS)

All tables have RLS enabled. Policies are enforced at the PostgreSQL level — they apply to all clients including the Supabase JS client. The `auth.uid()` function returns the authenticated user's UUID.

### `profiles`

| Operation | Who | Condition |
|---|---|---|
| SELECT | Any authenticated user | `true` (all profiles are readable) |
| INSERT | Supabase Auth trigger | Handled automatically on sign-up |
| UPDATE | Row owner | `auth.uid() = id` |
| DELETE | Not permitted | — |

---

### `events`

| Operation | Who | Condition |
|---|---|---|
| SELECT (public) | Anyone (including anon) | `visibility_type = 'public'` |
| SELECT (private) | Owner only | `auth.uid() = user_id` |
| SELECT (whitelist) | Owner only | `auth.uid() = user_id` |
| INSERT | Authenticated user | `auth.uid() = user_id` |
| UPDATE | Owner only | `auth.uid() = user_id` |
| DELETE | Owner only | `auth.uid() = user_id` |

---

### `bookings`

| Operation | Who | Condition |
|---|---|---|
| SELECT | Row owner | `auth.uid() = user_id` |
| INSERT | Authenticated user | `auth.uid() = user_id` |
| UPDATE | Row owner | `auth.uid() = user_id` |
| DELETE | Not permitted | — |

---

### `chat_history`

| Operation | Who | Condition |
|---|---|---|
| SELECT | Row owner | `auth.uid() = user_id` |
| INSERT | Authenticated user | `auth.uid() = user_id` |
| UPDATE | Row owner | `auth.uid() = user_id` |
| DELETE | Row owner | `auth.uid() = user_id` |

---

### `vendor_services`

| Operation | Who | Condition |
|---|---|---|
| SELECT | Anyone (including anon) | `true` (all services are publicly browsable) |
| INSERT | Authenticated vendor | `auth.uid() = vendor_id` |
| UPDATE | Vendor owner | `auth.uid() = vendor_id` |
| DELETE | Vendor owner | `auth.uid() = vendor_id` |

---

### `service_requests`

| Operation | Who | Condition |
|---|---|---|
| SELECT | Requester or vendor | `auth.uid() = requester_id OR auth.uid() = vendor_id` |
| INSERT | Requester (customer) | `auth.uid() = requester_id` |
| UPDATE | Requester or vendor | `auth.uid() = requester_id OR auth.uid() = vendor_id` |
| DELETE | Not permitted | — |

Status changes (accept, reject, cancel) are performed via UPDATE. The API layer enforces which party may perform which transition — see [Status Transition Rules](#service_requestsstatus-transition-rules) above.

---

### `user_interactions`

| Operation | Who | Condition |
|---|---|---|
| SELECT | Row owner | `auth.uid() = user_id` |
| INSERT | Authenticated user | `auth.uid() = user_id` |
| UPDATE | Not permitted | — |
| DELETE | Not permitted | — |

---

### `favorites`

| Operation | Who | Condition |
|---|---|---|
| SELECT | Row owner | `auth.uid() = user_id` |
| INSERT | Authenticated user | `auth.uid() = user_id` |
| UPDATE | Not permitted | — |
| DELETE | Row owner | `auth.uid() = user_id` |

---

### `attendance_forecasts`

| Operation | Who | Condition |
|---|---|---|
| SELECT | Event owner | `auth.uid() = (SELECT user_id FROM events WHERE id = event_id)` |
| INSERT | Event owner | `auth.uid() = (SELECT user_id FROM events WHERE id = event_id)` |
| UPDATE | Not permitted | — |
| DELETE | Not permitted | — |

---

### `event_communities`

| Operation | Who | Condition |
|---|---|---|
| SELECT | Any authenticated user | `true` |
| INSERT | Any authenticated user | `true` (written by algorithm API routes) |
| UPDATE | Not permitted | — |
| DELETE | Not permitted | — |

---

### `algorithm_results`

| Operation | Who | Condition |
|---|---|---|
| SELECT | Row owner | `auth.uid() = user_id` |
| SELECT | Admin | `(SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'` |
| INSERT | Authenticated user | `auth.uid() = user_id` |
| UPDATE | Not permitted | — |
| DELETE | Not permitted | — |

---

## Enum Values Reference

All constrained text columns and their valid values:

| Table | Column | Valid Values |
|---|---|---|
| `profiles` | `role` | `'customer'`, `'vendor'`, `'admin'` |
| `events` | `visibility_type` | `'public'`, `'private'`, `'whitelist'` |
| `events` | `event_status` | `'upcoming'`, `'ongoing'`, `'completed'`, `'cancelled'` |
| `bookings` | `status` | `'confirmed'`, `'cancelled'`, `'waitlist'` |
| `vendor_services` | `price_unit` | `'per_hour'`, `'per_event'` |
| `service_requests` | `status` | `'pending'`, `'accepted'`, `'rejected'`, `'completed'`, `'cancelled'` |
| `service_requests` | `cancellation_requested_by` | `'customer'`, `'vendor'` |
| `user_interactions` | `interaction_type` | `'view'`, `'favorite'`, `'rsvp'` |
| `algorithm_results` | `algorithm_type` | `'xsimgcl'`, `'gnn-cf'`, `'moea-d'`, `'itransformer'`, `'gat-kmeans'` |

---

## Cross-References

- API routes that read and write these tables are documented in [docs/ARCHITECTURE.md](./ARCHITECTURE.md).
- The `algorithm_results` table schema and TTL values are also referenced in [docs/ALGORITHMS.md](./ALGORITHMS.md).
- The `user_interactions` cold-start threshold (< 3 interactions → GNN-CF, ≥ 3 → XSimGCL) is documented in [docs/ALGORITHMS.md](./ALGORITHMS.md).
