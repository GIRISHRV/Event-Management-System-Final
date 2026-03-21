# Requirements Document

## Introduction

EventMS has grown significantly beyond its original README. The platform now includes role-based dashboards for customers, vendors, and admins; five ML algorithms for recommendations, budget optimization, attendance forecasting, and community detection; an AI-powered chatbot; a vendor marketplace; and a Supabase backend with Row Level Security. This feature covers updating `README.md` to accurately reflect the current system and creating structured technical reference documents in the `docs/` folder for developers and contributors.

## Glossary

- **README**: The root-level `README.md` file serving as the primary entry point for the project
- **Architecture_Document**: `docs/ARCHITECTURE.md` — technical reference for system design and API routes
- **Database_Document**: `docs/DATABASE_SCHEMA.md` — reference for all database tables, columns, and RLS policies
- **Algorithm_Document**: `docs/ALGORITHMS.md` — reference for all five ML algorithms used in the platform
- **Documentation**: The collective set of README and all files under `docs/`
- **Developer**: A person setting up, contributing to, or integrating with the EventMS codebase
- **ML_Algorithm**: One of the five machine learning algorithms: XSimGCL, GNN-CF, MOEA/D-DRA-NEF, iTransformer, GAT+K-Means
- **API_Route**: A Next.js App Router route handler under `src/app/api/`
- **RLS**: Row Level Security — Supabase/PostgreSQL policy enforcing data access at the database level
- **JSONB**: PostgreSQL binary JSON column type used for nested structured data in the events table

## Requirements

### Requirement 1: README Accuracy and Completeness

**User Story:** As a developer or contributor, I want an accurate and complete README, so that I can understand what EventMS does and get it running locally without needing to ask for help.

#### Acceptance Criteria

1. THE README SHALL describe the EventMS platform's purpose and its three user roles (customer/organizer, vendor, admin)
2. THE README SHALL list all major features grouped by user role
3. THE README SHALL include a getting-started section with sequential steps covering repository cloning, dependency installation, environment variable setup, and running the development server
4. THE README SHALL list all required environment variables with a description of each variable's purpose
5. THE README SHALL document the project directory structure showing top-level folders and their purpose
6. THE README SHALL include the current tech stack with framework names and versions matching `package.json`
7. WHEN a developer follows the README setup instructions, THE README SHALL reference only commands and files that exist in the repository

### Requirement 2: Architecture Documentation

**User Story:** As a developer, I want a technical architecture document, so that I can understand how the system components interact and how to work with the API.

#### Acceptance Criteria

1. THE Architecture_Document SHALL include a system architecture diagram showing the frontend, API routes, algorithm layer, Supabase backend, and external services
2. THE Architecture_Document SHALL document every API route under `src/app/api/` with its HTTP method, request body shape, response shape, and authentication requirement
3. THE Architecture_Document SHALL document the role-based access control model, specifying which routes and dashboards each role (customer, vendor, admin) can access
4. THE Architecture_Document SHALL document the authentication flow from sign-in form submission through JWT issuance to role-based dashboard redirect
5. THE Architecture_Document SHALL document the three role-based dashboards (customer, vendor, admin) with their tabs, features, and access restrictions
6. WHEN an API route requires authentication, THE Architecture_Document SHALL specify the expected Authorization header format and the 401 response behavior
7. IF an API route has ownership or role restrictions beyond authentication, THE Architecture_Document SHALL document those restrictions and the resulting error response

### Requirement 3: Database Schema Documentation

**User Story:** As a developer, I want complete database schema documentation, so that I can understand the data model and write correct queries.

#### Acceptance Criteria

1. THE Database_Document SHALL document all database tables with each column's name, type, nullability, and any foreign key relationships
2. THE Database_Document SHALL document the JSONB fields in the `events` table (`schedules`, `performers`, `faqs`) with their nested object structures
3. THE Database_Document SHALL document the algorithm support tables (`user_interactions`, `favorites`, `attendance_forecasts`, `event_communities`, `algorithm_results`) with their purpose and key columns
4. THE Database_Document SHALL document the Row Level Security model, describing which roles can read, insert, update, and delete rows in each table
5. THE Database_Document SHALL document the `vendor_services` and `service_requests` tables including the `service_requests.status` transition rules
6. WHEN a table column has a constrained set of values, THE Database_Document SHALL list all valid values for that column

### Requirement 4: Algorithm Documentation

**User Story:** As a developer or researcher, I want detailed algorithm documentation, so that I can understand the ML layer, reproduce results, and maintain the algorithm code.

#### Acceptance Criteria

1. THE Algorithm_Document SHALL document all five ML algorithms (XSimGCL, GNN-CF, MOEA/D-DRA-NEF, iTransformer, GAT+K-Means) with their purpose, inputs, and outputs
2. THE Algorithm_Document SHALL document the recommendation algorithm selection logic, specifying the cold-start threshold (fewer than 3 interactions triggers GNN-CF, 3 or more triggers XSimGCL)
3. THE Algorithm_Document SHALL document the caching strategy for each algorithm result, including the TTL values (recommendations: 30 min, forecast: 60 min, communities: 30 min)
4. THE Algorithm_Document SHALL document the MOEA/D budget optimizer's Pareto bundle output format, including the bundle labels and the fields returned per bundle
5. THE Algorithm_Document SHALL document the iTransformer forecast API's `horizon` parameter options (7 or 14 days) and `confidenceLevel` range (0.80–0.99)
6. THE Algorithm_Document SHALL include pseudocode or step-by-step logic for each algorithm's execution flow
7. WHEN an algorithm has preconditions on its inputs, THE Algorithm_Document SHALL state those preconditions explicitly

### Requirement 5: Documentation Consistency and Cross-Referencing

**User Story:** As a developer, I want consistent and cross-referenced documentation, so that I can navigate between documents without confusion or contradictions.

#### Acceptance Criteria

1. THE Documentation SHALL use the same names for components, tables, and algorithms across all documents
2. THE Documentation SHALL define all technical terms in a glossary or inline on first use
3. WHEN a document references a concept documented in another file, THE document SHALL include a reference to that file
4. THE README SHALL link to the files in the `docs/` folder for developers who want deeper technical detail
