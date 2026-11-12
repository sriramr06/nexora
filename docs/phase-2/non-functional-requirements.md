# Non-Functional Requirements

**Project:** Nexora — Multi-Tenant Project Management SaaS  
**Phase:** 2 — Requirements Engineering  
**Step:** 2.6 — Non-Functional Requirements  
**Version:** 1.0  
**Status:** Draft

## 1. Objective

Define the quality attributes Nexora must meet — how well the system performs its functions. Each requirement is measurable or verifiable.

## 2. Technology Constraints

Selected by the Project Owner. Detailed architecture is defined in Phase 3 — System Design.

| Layer | Technology |
|---|---|
| Language | TypeScript (frontend and backend) |
| Frontend | React with Tailwind CSS |
| Backend | Node.js with Express, REST API |
| Database | MongoDB (replica set, e.g. MongoDB Atlas) |
| Authentication | JWT (access and refresh tokens) |
| Media storage | MongoDB `avatars` collection (resized avatars only) |
| Email | Transactional email provider with a free tier (selected in Phase 3) |

## 3. Security (SEC)

| ID | Requirement |
|---|---|
| NFR-SEC-01 | Passwords shall be hashed with bcrypt (cost ≥ 12) or Argon2id. Plain-text passwords shall never be stored or logged. |
| NFR-SEC-02 | Access tokens shall expire after 15 minutes. Refresh tokens shall expire after 7 days, be stored in an `httpOnly`, `Secure`, `SameSite` cookie, be rotated on each use and be revocable server-side. |
| NFR-SEC-03 | JWTs shall carry user identity only. Organization roles shall be read from stored memberships on each request. |
| NFR-SEC-04 | Verification, invitation and password reset tokens shall be cryptographically random, single-use, time-limited and stored only as hashes. |
| NFR-SEC-05 | All input shall be validated server-side against schemas. Unknown fields and MongoDB operators in user input shall be rejected. |
| NFR-SEC-06 | User-generated text shall be rendered as plain text to prevent XSS. |
| NFR-SEC-07 | Authentication endpoints shall be rate-limited (e.g. 10 login attempts per 15 minutes per IP and email). |
| NFR-SEC-08 | The API shall use security headers (e.g. Helmet) and a CORS allowlist limited to the frontend origin. |
| NFR-SEC-09 | All traffic shall use HTTPS in production. |
| NFR-SEC-10 | Secrets shall be supplied through environment variables and never committed to the repository. |
| NFR-SEC-11 | Avatar uploads shall be validated by type and size on the server; storage credentials shall never be exposed to the client. |
| NFR-SEC-12 | Authentication error messages shall not reveal whether an email is registered. |

## 4. Tenant Isolation (ISO)

| ID | Requirement |
|---|---|
| NFR-ISO-01 | Every tenant-owned document (memberships, invitations, projects, tasks, comments, activity entries, notifications) shall store an `organizationId`. |
| NFR-ISO-02 | Tenant scoping shall be applied by a single central mechanism (e.g. a repository layer or Mongoose plugin), not by individual route handlers. |
| NFR-ISO-03 | Queries on tenant-owned collections without an organization scope shall fail rather than return unscoped data. |
| NFR-ISO-04 | The active organization shall be taken from the request and verified against the user's membership on every request. |
| NFR-ISO-05 | References between documents (e.g. task assignee, project member) shall be validated to belong to the same organization. |
| NFR-ISO-06 | Cross-tenant access attempts shall return 404, as defined in the Roles document, Section 7. |
| NFR-ISO-07 | An automated cross-tenant test suite shall cover every tenant-scoped endpoint. |

## 5. Performance (PERF)

Targets under normal load on the selected free/low-cost hosting, excluding cold starts.

| ID | Requirement |
|---|---|
| NFR-PERF-01 | 95% of API requests shall complete within 500 ms. |
| NFR-PERF-02 | A Kanban board with 200 tasks shall load and render within 2 seconds. |
| NFR-PERF-03 | All list endpoints shall be paginated (default 20, maximum 100 items). |
| NFR-PERF-04 | Tenant-owned collections shall have compound indexes beginning with `organizationId` for their main queries. |
| NFR-PERF-05 | Notification polling shall occur no more often than every 30 seconds and only while the tab is visible. |

## 6. Reliability and Data Integrity (REL)

| ID | Requirement |
|---|---|
| NFR-REL-01 | Operations that change multiple documents (e.g. task update + activity entry + notification; member removal + task unassignment) shall run in MongoDB transactions. |
| NFR-REL-02 | The API shall return errors in one consistent format: HTTP status, machine-readable code, message and optional field errors. |
| NFR-REL-03 | Unexpected errors shall return a generic 500 response without stack traces or internal details. |
| NFR-REL-04 | The API shall expose a health-check endpoint. |
| NFR-REL-05 | Failure of non-critical external services (email) shall not corrupt data; the user shall see a clear error and be able to retry. |
| NFR-REL-06 | All timestamps shall be stored in UTC. |

## 7. Usability and Accessibility (USE)

| ID | Requirement |
|---|---|
| NFR-USE-01 | The interface shall be responsive from 360 px mobile width to desktop. |
| NFR-USE-02 | Core flows shall be operable by keyboard, including a non-drag alternative for Kanban status changes. |
| NFR-USE-03 | Text and interactive elements shall meet WCAG 2.1 AA colour contrast. |
| NFR-USE-04 | Forms shall show field-level validation messages. |
| NFR-USE-05 | Destructive actions (delete project, delete task, remove member) shall require confirmation. |
| NFR-USE-06 | The interface shall show loading, empty and error states for all data views. |
| NFR-USE-07 | The application shall support the latest two versions of Chrome, Firefox, Edge and Safari. |

## 8. Maintainability (MAIN)

| ID | Requirement |
|---|---|
| NFR-MAIN-01 | TypeScript strict mode shall be enabled in frontend and backend. |
| NFR-MAIN-02 | ESLint and Prettier shall be enforced in CI. |
| NFR-MAIN-03 | The backend shall use a layered structure (routes → controllers → services → data access). |
| NFR-MAIN-04 | The API shall be versioned under `/api/v1`. |
| NFR-MAIN-05 | The API shall be documented (e.g. OpenAPI). |
| NFR-MAIN-06 | Git commits shall follow Conventional Commits. |

## 9. Testing (TEST)

| ID | Requirement |
|---|---|
| NFR-TEST-01 | Backend services and business rules shall have unit tests. |
| NFR-TEST-02 | API endpoints shall have integration tests against a real MongoDB replica set (e.g. in-memory replica set). |
| NFR-TEST-03 | Every permission matrix entry and business rule (R1–R16) shall have an authorization test. |
| NFR-TEST-04 | The cross-tenant test suite (NFR-ISO-07) shall pass before every deployment. |
| NFR-TEST-05 | Backend line coverage shall be at least 70%, and 90% for authorization and tenancy modules. |
| NFR-TEST-06 | Journeys J1, J3 and J5 shall have automated end-to-end tests. |
| NFR-TEST-07 | CI shall run linting, type checks and tests on every push and pull request. |

## 10. Deployment and Operations (OPS)

| ID | Requirement |
|---|---|
| NFR-OPS-01 | The application shall be deployed to a publicly accessible environment using free or low-cost hosting. |
| NFR-OPS-02 | Configuration shall be environment-based (development, test, production). |
| NFR-OPS-03 | The backend shall produce structured logs with request IDs; passwords, tokens and secrets shall never be logged. |
| NFR-OPS-04 | Production database backups shall be taken with a manual backup script (mongodump) before risky deployments, as the free database tier provides no automated backups. |
| NFR-OPS-05 | A seed script shall create the Application Owner and optional demo data. |

## 11. Privacy (PRIV)

| ID | Requirement |
|---|---|
| NFR-PRIV-01 | Only data needed for the MVP shall be collected (name, email, password hash, avatar, organization details). |
| NFR-PRIV-02 | The Application Owner shall see organization metadata only (FR-PLAT-08). |
| NFR-PRIV-03 | Member email addresses shall be visible only within organizations the viewer belongs to. |

## 12. Conclusion

These requirements turn Nexora's engineering objectives — tenant isolation, secure authorization, reliability and testing — into measurable criteria that will be verified before release.

**Next step:** Phase 3 — System Design.
