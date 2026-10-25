# PeopleOS

PeopleOS is a role-based HR SaaS application built with Next.js App Router, JavaScript, Tailwind CSS 4, Node.js, MongoDB, and NextAuth email/password and Google sign-in. The interface combines Radix/shadcn-style components, Aceternity Spotlight, React Bits animations, and Recharts 3 visualizations.

## Documentation

- [Developer guide](docs/DEVELOPER_GUIDE.md): complete feature flows, architecture, file map, and common changes.
- [Operations](docs/OPERATIONS.md): start the backend, configure external services, create real accounts, deploy, and troubleshoot.
- [API reference](docs/API_REFERENCE.md): endpoint contracts and role requirements.
- [Security model](docs/SECURITY.md): implemented controls, trust boundaries, and deployment responsibilities.

## Run locally

Requires Node.js 20.9 or newer.

```sh
npm install
npm run dev
```

Open http://localhost:3000. Administrator, HR Manager, and Employee demo previews use fictional records stored in the browser. Selecting a demo role does not grant authenticated access to a real organization.

```sh
npm run build
npm start
npm test
```

The build command uses webpack. Both development and production run the custom Node server in `server.mjs`, which serves Next.js and the notification WebSocket endpoint.

## Implemented features

- Email/password and Google sign-in, first-workspace Google onboarding, administrator membership provisioning, persisted roles, and tenant-scoped server authorization.
- Administrator, HR Manager, and Employee dashboards with role-specific navigation and personal self-service views.
- CRUD for employee records, time-off requests, job postings, performance reviews, announcements, compensation requests, compliance tasks, and workspace memberships, subject to role permissions.
- Compensation review with pending/approved/declined decisions and review notes; compliance owners, due dates, priorities, filters, and completion indicators.
- Stable employee and membership IDs, employee profile passes, QR downloads, camera/image QR scanning, and manual ID lookup against already-authorized employee records.
- Private employee photo uploads and avatars, with employee self-service and administrator/HR management inside the current organization.
- Persistent in-app notifications delivered over real WebSockets, read/unread state, reconnect handling, and cross-tab demo updates.
- PDF and CSV exports of the current authorized results, localized English/Arabic headings, paginated PDF tables, and safe CSV escaping.
- English and Arabic interface preferences with RTL layouts, light/dark mode, responsive navigation, accessible dialogs, and a custom PeopleOS favicon.
- Five font choices: DM Sans, Inter, Manrope, Cairo, and Tajawal. Four accent palettes: Ember, Ocean, Violet, and Teal. Appearance and language preferences persist in the current browser.
- Recharts 3 area, bar, and donut charts for headcount, departments, compensation, time-off summaries, and checklist progress, with stationary tooltips and localized labels.
- Shimmer loaders matched to login, navigation shell, and individual page layouts; reusable shimmer primitives and reduced-motion support.

Chart calculations use the records currently available to the signed-in user. Headcount trends derive from stored employee start dates; they are not a historical employment ledger.

Attendance has been removed from navigation, APIs, seeding, and permissions. Legacy browser data discards unsupported resource keys. Existing database collections are preserved, but unsupported records are not exposed through the application.

## Email and password access

Real password login requires MongoDB, `NEXTAUTH_SECRET`, an active workspace membership, and a password provisioned for that membership. Passwords are salted and hashed with scrypt; plaintext passwords and hashes are never returned by the application API. Passwords must contain 12–128 characters. Login attempts have a bounded, process-local rate limit with a 15-minute window.

Administrators can set or reset an active member's password from the member details. `/api/credentials` accepts only a member email and password and always uses the administrator's current workspace. Resetting an account in one organization does not change the same email's credentials in another organization.

To create the first real administrator without Google setup, configure MongoDB in `.env.local` and run:

```sh
npm run user:create -- --workspace-id your-company --workspace-name "Your company" --email admin@yourcompany.com --name "Administrator" --role admin
```

The CLI prompts for a hidden password and confirmation. Automated setup can supply `PEOPLEOS_INITIAL_PASSWORD` through the environment; passwords are not accepted as command-line arguments. It can create the first administrator in an explicitly identified empty workspace, or provision an active member in a workspace that already has an active administrator. Existing suspended memberships and role assignments are preserved. This setup creates an account membership; an employee record can be linked separately by matching email.

Email-only login checks at most 20 credential candidates for that email in stable workspace order, verifies the password, and selects a workspace with an active matching membership. The authentication API also accepts an optional `workspaceId` to select one organization explicitly. Roles and the resulting workspace always come from persisted authorization records.

The development login screen provides sample-only credentials:

- Administrator: `alex@peopleos.co`
- HR Manager: `lana@peopleos.co`
- Employee: `olivia@peopleos.co`

All three sample accounts use `PeopleOS@2026!`. They open fictional browser-local previews through a signed HttpOnly demo cookie; they cannot authenticate real database APIs. Production previews are disabled unless `ALLOW_DEMO_ACCESS=true`. Real account sessions take precedence over preview cookies.

## Configure Google and MongoDB

1. Copy `.env.example` to `.env.local`.
2. Add `MONGODB_URI` and optionally `MONGODB_DB`.
3. Create a Google OAuth web application client with authorized origin `http://localhost:3000` and redirect URI `http://localhost:3000/api/auth/callback/google`. Use the deployed HTTPS origin in production.
4. Add `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `NEXTAUTH_URL`.
5. Generate `NEXTAUTH_SECRET`, for example with `openssl rand -base64 32`.
6. Restart the server and sign in with Google.

A verified Google account without any membership can create its first organization. The server generates the workspace ID and assigns the creator the administrator role. Existing and suspended memberships cannot create a replacement tenant through onboarding. A per-email provisioning guard makes concurrent creation and interrupted setup recoverable.

Administrators add members by email in **Workspace & access**. Those users can sign in with Google, or an administrator can set a password from the member details. Either method receives the stored role. Client-selected roles and workspace IDs do not grant permissions. Suspensions and role changes are checked again by the APIs and notification transport.

Optional bootstrap configuration uses `WORKSPACE_ID`, `WORKSPACE_NAME`, and `ADMIN_EMAILS` for one specific organization. Existing suspended memberships remain suspended. Bootstrap administrators can be suspended; deleting a configured bootstrap membership is blocked to prevent it being recreated at the next login.

To seed fictional HR records into that configured organization while preserving existing records:

```sh
node --env-file=.env.local scripts/seed.mjs
```

Use sample seeding only in a demo workspace. Older unscoped database records are excluded from tenant-scoped API queries.

## Permissions and employee identity

Administrators manage operational records and memberships. HR managers manage operational records and review requests, without membership controls. Employees see their own profile, reviews, time-off and compensation records, along with permitted workspace announcements and job postings. Employees can edit pending self-service requests; reviewed requests are locked.

Private profile and record-detail APIs apply the same tenant and ownership rules. `/api/profile` looks up the signed-in account directly by organization and normalized email, so the employee directory's list limit cannot hide a user's own profile. Linked profiles include that employee's time-off, performance, and compensation records; an account without an employee record returns an empty profile link. Employee detail bundles return up to 100 recent records per related collection with total counts.

Employees have a tenant-unique `employeeCode`. Administrators and HR can choose a 3–32-character code using letters, digits, underscores, or hyphens; codes are normalized to uppercase. Missing legacy codes receive stable defaults through scoped conditional updates. Memberships receive a server-generated `memberCode`. Membership changes preserve at least one active administrator.

QR passes contain a workspace ID, employee record ID, and employee code. They identify records and never serve as authentication tokens. Scanning resolves only against the current user's authorized employee collection. Changing an employee code requires generating a new pass.

## Photos and report exports

Photo uploads require an existing employee profile. The server accepts JPEG, PNG, or WebP files up to 2 MB, validates image contents and dimensions, rejects animation, strips metadata, and stores a bounded WebP image in MongoDB. Photo reads require active membership in the same tenant; employees can read their own images, while administrators and HR can manage their organization's images.

Exports include an explicit set of business columns and omit internal database IDs, workspace metadata, and media URLs. CSV downloads use UTF-8 with formula escaping. PDFs include organization name, report title, date, page numbering, repeated headers, and the bundled Tajawal font for Arabic text. Download filenames and report dates use the Asia/Dubai calendar.

## WebSocket transport and deployment

`server.mjs` hosts authenticated WebSockets at `/api/live`. Keep `NEXTAUTH_SECRET` configured. New requests notify managers; decisions notify the requester; announcements notify active workspace members; compliance and membership updates notify their intended recipients. Notifications persist in MongoDB with per-recipient read state.

The Node server refreshes MongoDB every two seconds and sends changes through WebSockets. MongoDB change streams or a replica set are not required. Membership and current role checks repeat before delivery, expired or revoked sessions disconnect, and ping/pong heartbeats clean up stale connections. Next.js development HMR upgrades remain separate from notification traffic.

Production needs a long-running Node.js host and a reverse proxy that forwards WebSocket upgrade headers. Run `npm run build` followed by `npm start`, with production environment variables and the correct Google redirect URI. Static or serverless-only hosting does not run this custom WebSocket server. Multiple Node instances can share the same MongoDB database.

## Profile pages and navigation

Employee names open `/employees/[id]`, with employment details, profile photos, QR passes, and scoped requests, compensation, and performance tabs. `/profile` opens the signed-in member’s own profile, including account identity and permissions when no employee profile is linked. Other lists open `/records/[resource]/[id]` for record details and permitted edit actions.

The workspace shell, session, data, and notification connection stay mounted across Next.js navigation. Profile and record reads use an abortable, route-scoped request; only the content area shows a matching skeleton while it loads. Breadcrumbs link back to the dashboard and authorized parent list, and browser Back/Forward works. Unknown or inaccessible records show an unavailable state. Related profile records show their totals and clearly identify the latest 100 records when truncated.

## Verification and scope

`npm test` covers tenant isolation, role and owner restrictions, locked request states, Google onboarding, suspended accounts, provisioning concurrency/recovery, custom IDs, QR round trips and access restrictions, image validation, notification recipients and revocation, signed-cookie authentication, malformed upgrade targets, chart date boundaries, and PDF/CSV generation. Database contract tests use in-memory fixtures.

English and Arabic sample PDFs have been rendered and inspected, with text and record counts checked across multiple pages. Live Google OAuth, real email/password accounts, and MongoDB still need configured credentials and have not been verified against a real account/database.

This is a working SaaS foundation. Subscription plans are informational: billing and payment collection are not connected. Compensation approvals record decisions and do not transfer funds; payroll is a compensation register without tax calculations or payment execution. Compliance is an internal operational checklist, not a certification or legal advice. Hiring manages postings and applicant counts; resume intake and candidate applications are not implemented. Notifications are in-app. Activity and notification writes are best-effort rather than guaranteed audit or delivery systems.

## UI references

- shadcn/ui: https://ui.shadcn.com/docs/installation/next
- Aceternity Spotlight: https://ui.aceternity.com/components/spotlight
- React Bits: https://reactbits.dev/components/spotlight-card and https://reactbits.dev/text-animations/blur-text
- Requested palette reference: https://stroomxnew.vercel.app/website-3/stroomxweb3.html
