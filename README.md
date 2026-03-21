# EventMS

A full-stack event management platform built with Next.js, React 19, and Supabase. EventMS serves three distinct user roles — customer/organizer, vendor, and admin — and integrates five ML algorithms for smart recommendations, budget optimization, attendance forecasting, and community detection, alongside an AI-powered event chatbot.

---

## User Roles and Features

### Customer / Organizer
- **My Events** — Create, edit, and delete events with rich details (schedules, performers, FAQs, gallery, venue map)
- **Discover** — Browse public events with AI-powered recommendations (XSimGCL for returning users, GNN-CF for new users)
- **Bookings** — RSVP to events, manage waitlist status, and track confirmed bookings
- **Vendors** — Browse the vendor marketplace and send service requests to vendors
- **Pro Team** — Manage accepted vendors attached to your events
- **Inquiries** — Track outgoing service requests and their status
- **Smart Budget Planner** — MOEA/D-DRA-NEF algorithm generates Pareto-optimal vendor bundles within your budget
- **Attendance Forecast** — iTransformer model predicts attendance trends for your events
- **Community Filter** — GAT+K-Means community detection groups similar events and users
- **AI Chatbot** — Context-aware event assistant powered by HuggingFace LLM

### Vendor
- **Service Listings** — Create and manage service offerings with pricing, category, and images
- **Incoming Requests** — Accept, reject, or cancel service requests from event organizers
- **Earnings Overview** — Track bookings and revenue from completed services

### Admin
- **Algorithm Lab** — Run and evaluate all five ML algorithms with configurable parameters
- **BPR Training** — Trigger Bayesian Personalized Ranking embedding training for XSimGCL
- **Export Reports** — Export algorithm results as JSON, CSV, or PDF for research paper tables
- **System Health** — Monitor cache state, algorithm execution metrics, and database health

---

## ML Algorithm Layer

| Algorithm | Purpose | Trigger |
|---|---|---|
| XSimGCL | Collaborative filtering recommendations (warm users) | ≥ 3 user interactions |
| GNN-CF | Cross-domain cold-start recommendations | < 3 user interactions |
| MOEA/D-DRA-NEF | Multi-objective budget optimization (Pareto bundles) | Budget Planner request |
| iTransformer | Attendance forecasting (7 or 14-day horizon) | Forecast panel request |
| GAT+K-Means | Community detection and event clustering | Community filter request |

See [docs/ALGORITHMS.md](docs/ALGORITHMS.md) for full algorithm documentation.

---

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/your-username/eventms.git
cd eventms
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

```bash
cp .env.example .env.local
```

Then open `.env.local` and fill in your credentials (see [Environment Variables](#environment-variables) below).

### 4. Run the development server

```bash
npm run dev
```

### 5. Open your browser

Navigate to `http://localhost:3000`

---

## Environment Variables

Copy `.env.example` to `.env.local` and set the following:

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Your Supabase project URL (safe to expose client-side) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anonymous key — RLS policies enforce access control |
| `HF_TOKEN` | Yes | HuggingFace API token for the AI chatbot LLM (server-side only) |
| `HF_MODEL` | Yes | HuggingFace model ID, e.g. `meta-llama/Llama-3.3-70B-Instruct` (server-side only) |
| `NEXT_PUBLIC_SITE_URL` | No | Base URL of the deployment, e.g. `http://localhost:3000` |

> `HF_TOKEN` and `HF_MODEL` must never use the `NEXT_PUBLIC_` prefix — they are server-side only and must not be exposed to the browser.

---

## Project Structure

```
eventms/
├── src/
│   ├── app/                # Next.js App Router — pages, layouts, and API routes
│   │   ├── (auth)/         # Sign-in, sign-up, and email verification pages
│   │   ├── api/            # API route handlers (chat, algorithms, geocoding)
│   │   ├── admin-dashboard/
│   │   ├── customer-dashboard/
│   │   ├── vendor-dashboard/
│   │   ├── event/[id]/     # Public event detail page
│   │   └── events/         # Public events browser
│   ├── components/         # Reusable React components (UI, dashboard, events, chat)
│   ├── context/            # React context providers (AuthContext)
│   ├── hooks/              # Custom React hooks (SWR data fetching)
│   ├── lib/                # Utilities, Supabase clients, algorithm implementations
│   ├── schemas/            # Zod validation schemas for forms and API bodies
│   ├── scripts/            # One-off database and data migration scripts
│   ├── services/           # Service layer — Supabase query functions
│   └── types/              # Shared TypeScript type definitions
├── docs/                   # Technical reference documentation
│   ├── ARCHITECTURE.md     # System diagram, API routes, auth flow, RBAC
│   ├── DATABASE_SCHEMA.md  # All tables, columns, RLS policies
│   └── ALGORITHMS.md       # ML algorithm reference and pseudocode
├── public/                 # Static assets
├── .env.example            # Environment variable template
└── package.json
```

---

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js | ^16.2.1 |
| UI Library | React / React DOM | 19.2.0 |
| Database / Auth / Storage | Supabase (`@supabase/supabase-js`) | ^2.81.1 |
| Supabase SSR client | `@supabase/ssr` | ^0.8.0 |
| Styling | Tailwind CSS v4 | ^4 |
| Schema validation | Zod | ^4.1.13 |
| Form management | React Hook Form | ^7.67.0 |
| Client-side data fetching | SWR | ^2.3.7 |
| Animations | Framer Motion | ^12.23.25 |
| Maps | Leaflet / React Leaflet | ^1.9.4 / ^5.0.0 |
| Charts | Recharts | ^3.8.0 |
| Date utilities | date-fns | ^4.1.0 |
| Matrix operations (ML) | ml-matrix | ^6.12.1 |
| Math utilities (ML) | mathjs | ^15.1.1 |
| Statistics (ML) | simple-statistics | ^7.8.9 |
| Markdown rendering | react-markdown | ^10.1.0 |
| Icons | lucide-react | ^0.554.0 |
| Pre-commit hooks | Husky + lint-staged | ^9 / ^16 |

---

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — System architecture diagram, all API routes, authentication flow, and role-based access control
- [docs/DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md) — Complete database schema with column types, foreign keys, RLS policies, and enum values
- [docs/ALGORITHMS.md](docs/ALGORITHMS.md) — ML algorithm reference: purpose, inputs, outputs, pseudocode, and caching strategy

---

## Contributing

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m 'Add your feature'`
4. Push to the branch: `git push origin feature/your-feature`
5. Open a Pull Request

---

## License

This project is licensed under the MIT License.
