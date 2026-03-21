# Implementation Plan: App Documentation

## Overview

Update `README.md` to accurately reflect the current EventMS platform and create structured technical reference documents under `docs/` covering architecture, database schema, and algorithms.

## Tasks

- [x] 1. Update README.md
  - [x] 1.1 Rewrite README.md with accurate platform description and role overview
    - Replace the existing README with content that describes EventMS's three user roles (customer/organizer, vendor, admin), all major features grouped by role, and the ML algorithm layer
    - Include getting-started steps: clone, install, env setup, dev server
    - List all required environment variables from `.env.example` with descriptions
    - Document the project directory structure (top-level folders and purpose)
    - Update the tech stack section with framework names and versions from `package.json`
    - Add links to `docs/ARCHITECTURE.md`, `docs/DATABASE_SCHEMA.md`, and `docs/ALGORITHMS.md`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 5.4_

- [x] 2. Create docs/ARCHITECTURE.md
  - [x] 2.1 Write architecture document with system diagram and API route reference
    - Include the Mermaid system architecture diagram from the design (frontend, API routes, algorithm layer, Supabase, external services)
    - Document every API route under `src/app/api/` with HTTP method, request body shape, response shape, and auth requirement
    - Document the role-based access control model (which routes/dashboards each role can access)
    - Document the authentication flow (sign-in → JWT → role-based redirect) using the sequence diagram from the design
    - Document the three role-based dashboards with their tabs, features, and access restrictions
    - Specify Authorization header format and 401/403 response behavior for protected routes
    - Cross-reference `docs/DATABASE_SCHEMA.md` and `docs/ALGORITHMS.md` where relevant
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 5.1, 5.3_

- [x] 3. Create docs/DATABASE_SCHEMA.md
  - [x] 3.1 Write complete database schema document
    - Document all tables with column names, types, nullability, and foreign key relationships (profiles, events, bookings, chat_history, vendor_services, service_requests, user_interactions, favorites, attendance_forecasts, event_communities, algorithm_results)
    - Document the JSONB fields in `events` (`schedules`, `performers`, `faqs`) with their nested object structures
    - Document algorithm support tables with their purpose and key columns
    - Document the Row Level Security model per table (read/insert/update/delete by role)
    - Document `service_requests.status` transition rules
    - List all valid enum values for constrained columns
    - Cross-reference `docs/ARCHITECTURE.md` for API context
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 5.1, 5.3_

- [x] 4. Checkpoint — Ensure README and architecture/schema docs are consistent
  - Verify that table names, column names, role names, and route paths are identical across README.md, ARCHITECTURE.md, and DATABASE_SCHEMA.md
  - Ensure all cross-references between documents resolve correctly
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Create docs/ALGORITHMS.md
  - [x] 5.1 Write algorithm reference document for all five ML algorithms
    - Document each algorithm (XSimGCL, GNN-CF, MOEA/D-DRA-NEF, iTransformer, GAT+K-Means) with purpose, inputs, and outputs
    - Document the recommendation selection logic: cold-start threshold (< 3 interactions → GNN-CF, ≥ 3 → XSimGCL)
    - Document caching strategy and TTL values (recommendations: 30 min, forecast: 60 min, communities: 30 min)
    - Document MOEA/D Pareto bundle output format including bundle labels and fields per bundle
    - Document iTransformer `horizon` options (7 or 14 days) and `confidenceLevel` range (0.80–0.99)
    - Include pseudocode for recommendation selection and budget optimization flows (from design)
    - State preconditions explicitly for each algorithm
    - Cross-reference `docs/ARCHITECTURE.md` for API route context and `docs/DATABASE_SCHEMA.md` for `algorithm_results` table
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 5.1, 5.3_

- [x] 6. Final checkpoint — Ensure all documentation is consistent and complete
  - Verify consistent naming across all four documents (README, ARCHITECTURE, DATABASE_SCHEMA, ALGORITHMS)
  - Verify all `docs/` links in README resolve to existing files
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation across documents
- All documentation is Markdown; no code compilation or test runner is needed
