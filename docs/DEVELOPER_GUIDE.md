# PeopleOS developer guide

This guide explains how the repository works and where to make future changes. The application is a Next.js 16 / React 19 JavaScript project with a custom Node.js server, Tailwind CSS 4, MongoDB-backed workspace APIs, and a browser-local demonstration mode.

Start with [README.md](../README.md) for a quick introduction, [OPERATIONS.md](./OPERATIONS.md) for running and deploying the service, [API_REFERENCE.md](./API_REFERENCE.md) for endpoint contracts, and [SECURITY.md](./SECURITY.md) for security boundaries and operational follow-up. These documents describe configuration and code; they do not imply that a real MongoDB deployment, Google OAuth application, or another external service has been connected.

## 1. Start the application and backend

Run commands from the project root. Check the runtime first:

```sh
node --version
npm --version
npm ci
```

The installed Next.js package requires Node.js 20.9 or newer. This workspace has been developed with Node.js 24. Use the checked-in package lock when installing dependencies.

Create a local configuration file if it does not already exist:

```sh
cp .env.example .env.local
```

Keep real secrets in `.env.local` or your deployment's secret store. Do not commit credentials, paste database connection strings into documentation, or add passwords to command-line arguments. Replace the example authentication secret with a securely generated value before using real accounts.

Start development:

```sh
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). **This starts both the application and its backend.** There is no separate Express service or port 3001 to start. `server.mjs` creates one HTTP server, sends ordinary requests to Next.js, and handles authenticated notification WebSocket upgrades at `/api/live` on the same port.

For a production build running locally:

```sh
npm run build
npm start
```

Run either development or production on a given port, not both. The server defaults to port `3000` and host `0.0.0.0`. Alternative bindings are supported:

```sh
npm run dev -- --port 3001 --hostname 127.0.0.1
```

`PORT` and `HOST` environment variables are also supported. If changing the public origin, keep `NEXTAUTH_URL`, OAuth callback configuration, and proxy configuration consistent.

Basic local checks:

```sh
curl -i http://localhost:3000/api/config
curl -i http://localhost:3000/api/employees
```

`/api/config` reports whether Google and database environment variables are present. It is not a connection-health test. An unauthenticated call to a workspace resource should return an authorization error; a demo cookie must not authorize real workspace data.

## 2. Configuration and storage modes

`.env.example` is the configuration reference:

- `NEXTAUTH_URL`: canonical browser-facing origin, initially `http://localhost:3000`.
- `NEXTAUTH_SECRET`: signs NextAuth sessions and, when supplied, demonstration cookies. Keep it stable across instances of a real deployment.
- `MONGODB_URI`: real MongoDB connection string. Without it, cloud workspace APIs cannot load or save records.
- `MONGODB_DB`: database name; defaults to `peopleos`.
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`: enable the optional Google provider when both are present. The callback path is `/api/auth/callback/google` under `NEXTAUTH_URL`.
- `WORKSPACE_ID` and `WORKSPACE_NAME`: identify the configured bootstrap/seed workspace. They are not a client-controlled tenant selector.
- `ADMIN_EMAILS`: comma-separated verified Google accounts eligible for administrator bootstrap in the configured `WORKSPACE_ID` only.
- `ALLOW_DEMO_ACCESS`: demonstration access is enabled outside production unless explicitly set to `false`; production requires explicit `true` to enable it.

The two storage modes are intentionally different:

- **Real workspace mode:** a NextAuth session and active MongoDB membership authorize database records, image storage, and notification delivery.
- **Demo mode:** fictional data starts from `lib/seed.js` and `lib/demo.js`, is modified in React state, and is saved in this browser's `peopleos-v1` local-storage entry. A signed demo cookie permits demonstration pages; it does not grant a NextAuth session or access to MongoDB APIs.

Appearance uses `peopleos-theme`; organization/week preferences use `peopleos-settings`; language/font/accent preferences use `peopleos-preferences`. The selected demo role is remembered in `peopleos-demo-role` session storage alongside the server-issued demo cookie. Local browser state is not an authorization source for real APIs.

Optional fictional database seeding is separate from starting the application:

```sh
node --env-file=.env.local scripts/seed.mjs
```

Run that only after configuring MongoDB and an explicit `WORKSPACE_ID`, and only in a workspace intended for sample records. The script creates namespaced sample IDs and uses insert-only upserts to preserve existing records and roles. It provisions configured administrator memberships but does not create password hashes or connect Google. Browser demo data needs no database seeding. To reset only the browser's fictional records, sign out, remove the `peopleos-v1` local-storage entry in browser developer tools, and reload; this does not delete cloud records.

## 3. Sign-in and account setup

### Public demo accounts

When demonstration access is enabled, the sign-in screen shows these **public sample credentials**:

- Administrator: `alex@peopleos.co`.
- HR manager: `lana@peopleos.co`.
- Employee: `olivia@peopleos.co`.
- Shared demonstration password: `PeopleOS@2026!`.

Selecting a row fills the email/password form; it does not automatically sign in. Submitting calls `/api/demo`, which validates the sample combination and issues an eight-hour, HttpOnly, SameSite demo cookie. The server also retains a role-only demo-preview request shape for compatibility; neither request creates a real account. Demo credentials are not secrets and must never be reused as real workspace passwords.

`lib/demo-credentials.js` is the backend sample credential source, `lib/demo-session.js` controls signing and enablement, and `app/api/demo/route.js` handles status, sign-in, and sign-out. The login screen currently repeats these public examples for display/prefill; keep its role emails/password and `lib/demo.js` identities synchronized when changing them. `LoginScreen` must receive the actual `demoEnabled` configuration so public sample credentials stay hidden when demonstration access is disabled.

### Real email/password accounts

`LoginScreen` calls `HRApp.loginCredentials()`, which uses NextAuth `signIn('credentials', {email, password, redirect: false})` for real accounts. The provider is in `lib/auth.js`; verification and password setup are in `lib/credentials.js`.

Passwords are stored only as salted scrypt hashes in the server-only `credentials` collection. Valid passwords contain 12–128 characters, with an additional UTF-8 byte limit. Authentication derives the role from an active `memberships` record and checks that the workspace still exists. A submitted role is not accepted. The provider supports an optional workspace ID; the current login form sends email and password only.

Create the first real administrator after configuring MongoDB:

```sh
npm run user:create -- --workspace-id acme --workspace-name "Acme" --email admin@example.com --name "Workspace Admin" --role admin
```

The CLI prompts for and confirms the password without echoing it. `npm run user:create -- --help` documents its options. For a controlled noninteractive environment it also accepts `PEOPLEOS_INITIAL_PASSWORD`; avoid putting a literal password in shell history, and remove it from the environment after use. There is deliberately no `--password` argument.

The CLI creates the first active administrator for an empty workspace, preserves existing roles, and does not reactivate suspended memberships. Reusing it for an existing member must specify the member's current role. Treat CLI/database access as privileged operator access.

After an administrator signs in, the **Workspace & access** screen can provision active members and open `CredentialForm` to set a member's password. That form posts `{email, password}` to `/api/credentials`. The endpoint rechecks the acting administrator and target membership before saving the hash. This is administrator-managed setup, not public password registration or password recovery.

### Google accounts and first-workspace onboarding

Google sign-in is optional and appears enabled only when both OAuth variables are configured. `lib/auth.js` requires Google's verified-email result. It resolves active persisted membership, applies scoped administrator bootstrap when configured, and rejects existing suspended memberships.

A verified Google identity with no existing membership may create its first workspace through `WorkspaceSetup` and `POST /api/workspace`. The server chooses the workspace ID. `workspaceProvisioning` uses a per-email guard so retries and concurrent requests reuse one workspace allocation. Password-only sign-in cannot invoke this Google onboarding path.

NextAuth uses eight-hour JWT sessions. Memberships are resolved again in API/page checks and notification delivery; the client also revalidates session identity on route/focus changes. A session token's old role is not the final authority for database operations.

## 4. Roles, pages, and API permissions

The internal authentication roles are `admin`, `hr`, and `employee`. An employee record's `role` field is a **job title**, such as “Product Designer”; do not confuse it with `session.user.role`.

- Administrators manage operational records, workspace membership/access, and member password setup.
- HR managers manage operational HR records, compensation/time-off decisions, and compliance checks. They cannot manage memberships or member passwords.
- Employees access their own employee profile, compensation requests, time-off requests, and performance reviews, plus allowed company announcements and job records. They may create and change only their own pending self-service requests. Reviewed self-service requests are locked.

`lib/demo.js` exports `availablePages()` for navigation. `lib/page-access.js` checks server page access. `lib/access.js` is the central API permission/field/ownership policy. UI visibility is a convenience; the API rules remain authoritative.

Page paths are defined in `lib/navigation.js`:

- `/`: sign-in and post-sign-in redirection.
- `/dashboard`: role-specific overview.
- `/employees`, `/time-off`, `/recruitment`, `/payroll`, `/compensation`, `/compliance`, `/performance`, `/announcements`, `/settings`, `/workspace`: section pages, subject to role access.
- `/profile`: the signed-in account's own profile, with an account/permissions fallback when no employee record is linked.
- `/employees/[id]`: one employee's complete profile, subject to tenant and owner access.
- `/records/[resource]/[id]`: one permitted request, job, review, announcement, compliance check, compensation request, or membership record.

Attendance has intentionally been removed. There is no attendance resource, page, clock-in workflow, or attendance export to maintain.

## 5. Persistent frontend and loading behavior

`app/layout.js` mounts `PreferencesProvider`, one persistent `HRApp`, and `RouteOutlet`. `HRApp` derives the selected view from `usePathname()` and `workspaceRoute()` rather than remounting a new application for each page.

The App Router pages still execute server checks:

- `app/[section]/page.js` validates a section or `/profile`.
- `app/employees/[id]/page.js` checks employee-profile access.
- `app/records/[resource]/[id]/page.js` checks the resource and record.
- `RouteOutlet` mounts the route boundary while hiding its empty validated workspace output. Unknown routes can still show the framework's unavailable-page UI.

Keep this separation when changing navigation. Use `next/link`, `router.push()`, and helpers such as `profilePath()`/`recordPath()` for internal navigation. Replacing the shell with a new `HRApp` on every route or using `window.location` for ordinary internal links reintroduces full-screen reloads and reconnects notification state.

`HRApp` has separate async flows:

1. Initial configuration/session/demo restoration.
2. Authorized workspace collections and workspace metadata, refreshed for identity/configuration changes or explicit refresh.
3. Profile/record detail reads tied to the current `routePath`, using an `AbortController` and route-bound payload state.

A response for a previous detail URL must never populate the next URL. Preserve the route identity check and abort cleanup. Saving an existing detail uses `PUT` based on its record ID, even if that record is outside the directory/list's loaded window.

`components/saas/dashboard-skeleton.js` owns the reusable shimmer primitive and layouts for each view. `PageSkeleton`, `EmployeeProfileSkeleton`, `RecordDetailsSkeleton`, and account/profile-specific skeletons match the content they replace. `app/loading.js` and `route-skeleton.js` cover route suspense. Do not add timed fake loading. Show shimmer only while real requests, QR generation, image loading, or uploads are pending; retain an existing photo while its replacement is processed.

## 6. Database identity and request invariants

All real workspace records are scoped using the authenticated `workspaceId`. Querying by a raw `id` alone is insufficient. Private self-service records use `owner`, a normalized email address; cloud profile joins use this identity rather than a person's display name.

Important collections and business fields:

- `workspaces`: `id`, `name`, `plan`, `createdAt`; temporary membership-change locking is internal.
- `memberships`: `id`, `workspaceId`, normalized `email`, `name`, `memberCode`, authentication `role`, and `status` (`Active`/`Suspended`).
- `credentials`: `workspaceId`, normalized `email`, `passwordHash`, creation/update metadata. Never expose this collection through generic CRUD or exports.
- `employees`: `id`, `workspaceId`, `employeeCode`, `name`, normalized `email`, job-title `role`, `department`, employment `status`, `location`, `joined`, numeric annual `salary`, optional `photoUrl`/`color`, and timestamps.
- `requests`: identity fields plus `owner`, `name`, `type`, `from`, `to`, `reason`, and review `status`.
- `compensation`: identity/owner fields plus `type`, numeric `amount`, three-letter `currency`, `reason`, `status`, `submittedAt`, `reviewNote`, and optional decision metadata.
- `reviews`: identity/owner fields plus `name`, `cycle`, `score`, and `status`.
- `jobs`: `title`, `department`, `location`, `type`, `applicants`, and `status` within a workspace.
- `announcements`: `title`, `body`, `category`, and display `date` within a workspace.
- `compliance`: `title`, `category`, human-readable task `owner`, `description`, `dueDate`, `status`, `priority`, and optional `assignedEmail`. Here `owner` is a responsible-person field, unlike the private-record email ownership key.
- `notifications`: one persisted item per intended `recipientEmail`, with workspace/audience, title/body/page, actor metadata, timestamps, and `read` state.
- `uploads`: authorized employee/owner identity, normalized WebP bytes, MIME/dimensions, and creation metadata.
- `audit`: workspace, acting account, method-derived action, resource/record ID, and timestamp. These writes are best effort.
- `workspaceProvisioning`: server-only onboarding allocation/recovery guards.

`lib/mongodb.js` caches the connection and establishes unique indexes for workspace IDs, membership/credential emails within a workspace, employee emails/custom codes, and membership codes. It also indexes notification and upload lookups. `lib/codes.js` normalizes custom employee IDs to uppercase, enforces 3–32 letters/digits/underscores/hyphens, generates defaults, and fills missing legacy codes with scoped conditional updates. Employee codes and membership codes are display identifiers; the stable record `id` still identifies writes and routes.

## 7. HTTP request flow and API map

Generic CRUD lives in `app/api/[resource]/route.js` for the allowlisted resources in `lib/access.js`:

1. Validate the resource and resolve the NextAuth session.
2. Resolve current persisted membership and role.
3. Check read/write permission and scope queries to the authorized workspace/owner.
4. For mutations, check origin/content type/body limits, accept only allowed fields, and validate values.
5. Load the existing scoped record for updates/deletes and enforce pending-state ownership restrictions.
6. Write the record; derive server-owned identity, creation metadata, and defaults on creation.
7. Attempt audit and workflow notification writes; return a public response without MongoDB `_id`.

`GET /api/[resource]` returns up to 1,000 loaded records. Mutations use JSON: `POST` creates, `PUT` updates a body containing `id`, and `DELETE` deletes the scoped body `id`. Clients must not choose `workspaceId`, authoritative roles, owners, or audit actors. Membership changes are serialized per workspace and preserve at least one active administrator; configured bootstrap administrators are suspended rather than deleted.

Other endpoints:

- `/api/auth/[...nextauth]`: NextAuth provider/session/callback endpoints.
- `GET /api/config`: configuration-presence flags only.
- `GET/POST/DELETE /api/demo`: demo availability/session, sample sign-in, sign-out.
- `GET /api/workspace`: current workspace metadata; administrators can receive members.
- `POST /api/workspace`: verified-Google first-workspace onboarding.
- `POST /api/credentials`: administrator-managed password setup for an active workspace member.
- `GET /api/profile`: direct normalized-email lookup of the current user's employee profile, independent of list pagination; account fallback when none exists.
- `GET /api/employees/[id]`: scoped employee plus related `requests`, `reviews`, and `compensation`, each limited to 100 recent records, with full related `counts`.
- `GET /api/[resource]/[id]`: scoped individual record.
- `POST /api/uploads`: one authorized employee photo as multipart `{file, employeeId}`.
- `GET /api/uploads/[id]`: authorized private image read.
- `GET /api/notifications`: current recipient's persisted notification feed.
- `POST /api/notifications/read`: mark one notification or `all` as read.
- WebSocket `/api/live`: authenticated live delivery through `server.mjs`; it is not an ordinary Next.js route handler.

`lib/request-origin.js` validates browser origins against the request origin or configured public URL and rejects explicitly cross-site requests. Browser mutations must keep the current same-origin request pattern. NextAuth also supplies its own credential callback/session protections. `lib/http-response.js` supplies `privateJson()` for private, non-cacheable JSON responses with cookie variation and `readJsonBody()` for bounded stream parsing. Retain these helpers and route-specific limits when extending endpoints; consult [SECURITY.md](./SECURITY.md) for their precise coverage.

## 8. Feature flows and editing locations

### Employees, own profiles, and record details

The employee directory and its edit modal live in `HRApp`. A name/profile action opens `/employees/[id]`. `EmployeeProfile` filters supplied authorized related records, guards personal/manager access, and shows About, Requests, Compensation, and Performance tabs. Salaries are shown only to that employee or administrators/HR. The related-record tabs link to individual record pages.

`RecordDetails` renders resource-specific field definitions, notes, timestamps, linked employee identity, and permitted edit actions. Its `fields` map controls the visible detail rows. `/profile` uses the current account directly: a linked employee opens the full employee view; otherwise `AccountProfile` displays account identity and role permissions without inventing an employee record.

Edit `components/saas/employee-profile.js` / `app/employee-profile.css`, `record-details.js` / `record-details.css`, and `account-profile.js` / `account-profile.css`. Server detail joins and pagination counts live in `lib/record-details.js`. A profile's status counts, approved amounts, and leave-day sums describe the loaded subset when its related collection is truncated; keep the recent-record notices accurate.

### Photos and QR passes

`PhotoUploader` performs local 256px demo image conversion or sends a real multipart upload. The server enforces a 2 MB file limit, accepts JPEG/PNG/WebP, validates signatures and decoded dimensions, rejects animation, strips metadata, and re-encodes a bounded WebP image with `sharp`. It stores bytes in MongoDB and returns a private `/api/uploads/[id]` path. Uploads attach only to an existing authorized employee; private reads apply current tenant/owner checks.

`ProfilePass` creates a downloadable QR PNG and a pointer-reactive 3D profile card. The QR JSON contains only `{app: 'peopleos', workspaceId, employeeId, employeeCode}`. It is a locator, not an authentication token. `ProfileScanner` offers click-to-start camera access, QR-image upload, and manual custom-ID lookup. It resolves only against the already authorized employee collection, rejects cross-workspace/changed/unknown codes and arbitrary URLs, and stops camera tracks on close/unmount/backgrounding. Changing a custom ID invalidates an older pass.

Edit `photo-uploader.js`, `profile-pass.js`, `lib/media.js`, `lib/profile-code.js`, and their CSS/API handlers together when changing these contracts. Do not embed salary/contact data in QR payloads or make employee profiles public to simplify scanning.

### Time off, compensation, and compliance

Time-off CRUD and decision actions are coordinated by `HRApp`; compensation and compliance panels live in `components/saas/workflows.js`. Self-service requests start pending. Server field allowlists prevent employees from choosing an owner/approval status, and conditional write filters prevent a concurrent approval being overwritten by a pending edit.

Compensation records support reimbursement, salary adjustment, benefit claim, and final settlement requests, with decision notes. Approval records do not transfer money. Payroll is a base-compensation register derived from employee salaries. Compliance records are internal task/check tracking, not jurisdiction-specific legal certification.

### Recruitment, performance, and announcements

Recruitment manages job postings and recorded applicant counts; resume intake and candidate application processing are not implemented. Performance manages recorded employee review cycles/status/score. Announcements use `AnnouncementsPanel` in `organization.js` for search, categories, featured content, and editing. Source records remain in the same generic resource API; linked detail pages reuse `RecordDetails`.

### Workspace members and password setup

`WorkspacePanel` in `workflows.js` displays membership, access roles, plan labels, and activity. `HRApp` owns the membership modal and opens `CredentialForm` after an administrator selects password setup for an active member. Provisioning a membership does not create an employee record automatically; link the employee using the same normalized email when personal HR records are needed. Membership email changes require a separate membership rather than rewriting identity in place.

### Notifications

`lib/notifications.js` derives workflow events and recipients, writes recipient-specific MongoDB records, and implements socket session refresh. New pending requests notify managers; decisions notify requesters; announcements notify active members; applicable compliance and membership changes target their intended audience. The actor is excluded.

`useLiveNotifications()` in `components/saas/notifications.js` opens the browser WebSocket, reconnects with backoff, updates the unread badge, and marks records read through the HTTP endpoint. The server checks current membership/role and token expiry during delivery. MongoDB is refreshed every two seconds; socket heartbeats run every 30 seconds. This works with standalone MongoDB and does not require change streams. Demo notifications are local browser events and do not open an authorized database socket.

Notification/audit writes are best effort. Do not describe them as guaranteed delivery or an immutable compliance audit. Add a durable queue/outbox and retention policy if those requirements arise.

### Charts, CSV, and PDF

`workforce-insights.js`, `role-dashboard.js`, and `team-growth.js` derive chart data from currently available authorized records. `lib/team-growth.js` handles Dubai calendar boundaries, valid start dates, chart periods, and headcount axes. Shared Recharts rendering/tooltips live in `components/ui/data-chart.js`; preserve its fixed chart dimensions and tooltip configuration when adding charts.

`ExportOptions` opens CSV/PDF downloads for the authorized loaded collection supplied by `HRApp`. `lib/export-data.js` defines each resource's explicit business-column schema and localized headings. CSV uses UTF-8/BOM, quoting, and formula escaping. PDF uses jsPDF/AutoTable, repeated headers/page numbers, the workspace/date, and bundled `public/fonts/Tajawal-Regular.ttf` for Arabic. UI language controls report language; filenames/report dates use Asia/Dubai.

Export only authorized data and extend the explicit schema when adding fields. Do not serialize whole MongoDB documents. Reports/charts currently reflect loaded records, not an unlimited organization-wide query.

## 9. Styling, motion, localization, and preferences

`app/layout.js` establishes CSS import order. The styles are layered:

- `globals.css`: application structure, base controls, sidebar/header, original tokens, and responsive rules.
- `saas-visuals.css`: login/dashboard surfaces, animation/card primitives, shared visual elements.
- `stroomx-theme.css`: the warm neutral/Ember palette and compatibility overrides for existing `--green` token names.
- `preferences.css`: selectable fonts/accent palettes, language controls, and relevant RTL adjustments.
- Feature CSS files: organization, photos, profile passes, employee/account/record details, notifications, charts, exports, login credentials, workflows, and skeleton layouts.

Prefer theme variables (`--bg`, `--surface`, `--text`, `--muted`, `--border`, `--accent`, `--accent-text`) over hardcoded light-only colors. Test dark mode and all selectable accents. Use logical inline-start/end spacing for new RTL layouts.

`PreferencesProvider` exposes `{locale, t, font, accent, setLocale, setFont, setAccent}` through `usePreferences()`. English/Arabic interface strings are in `lib/i18n.js`; use exact source keys and parameter interpolation such as `t('Back to {page}', {page: t(parent)})`. Add the Arabic value when adding static UI text. User-authored names/messages are stored as entered and are not translated by a service. Set document language/direction through the provider, not individual route effects.

Fonts are DM Sans, Inter, Manrope, Cairo, and Tajawal. Browser font CSS currently uses Google Fonts imports; the PDF Arabic font is bundled locally. Appearance/language/font/accent are browser preferences, not organization-wide MongoDB configuration. The small bootstrap script in `app/layout.js` applies stored preferences before paint to avoid a theme flash.

`components/ui/button.js` is a shadcn-style Radix Slot/CVA primitive; dialogs use Radix. Spotlight/BlurText and animated-card components are local adaptations inspired by the requested Aceternity/React Bits references. Preserve reduced-motion handling and avoid unnecessary idle animation loops.

## 10. Source map and common future edits

The primary files to inspect for a change are:

- Runtime/build: `package.json`, `package-lock.json`, `server.mjs`, `.env.example`, `postcss.config.mjs`, and `jsconfig.json` (`@/*` imports).
- App entry/routing: `app/layout.js`, `app/page.js`, `app/[section]/page.js`, detail route pages, `components/saas/hr-app.js`, `components/saas/route-outlet.js`, `components/saas/route-skeleton.js`, and `lib/navigation.js`.
- Authentication/access: `lib/auth.js`, `lib/credentials.js`, `lib/demo-credentials.js`, `lib/demo-session.js`, `lib/page-access.js`, `lib/access.js`, `lib/request-origin.js`, and the matching auth/demo/credentials/workspace route handlers.
- Database and identities: `lib/mongodb.js`, `lib/codes.js`, `lib/record-details.js`, `lib/seed.js`, `lib/demo.js`, `scripts/create-user.mjs`, and `scripts/seed.mjs`.
- Main feature panels: `components/saas/organization.js`, `components/saas/workflows.js`, `components/saas/employee-profile.js`, `components/saas/account-profile.js`, `components/saas/record-details.js`, `components/saas/workspace-setup.js`, and `components/saas/credential-form.js`.
- Login/media/export: `components/saas/login-screen.js`, `components/saas/photo-uploader.js`, `components/saas/profile-pass.js`, `components/saas/export-dialog.js`, `lib/media.js`, `lib/profile-code.js`, and `lib/export-data.js`.
- Dashboard/charts: `components/saas/role-dashboard.js`, `components/saas/workforce-insights.js`, `components/saas/team-growth.js`, `lib/team-growth.js`, `components/ui/data-chart.js`, and `components/ui/chart-tooltip.js`.
- Notifications: `components/saas/notifications.js`, `lib/notifications.js`, the notification route handlers, and the WebSocket upgrade portion of `server.mjs`.
- Shared UI/preferences: `components/ui/button.js`, `components/ui/spotlight-card.js`, `components/ui/spotlight.js`, `components/ui/blur-text.js`, `components/saas/preferences.js`, `lib/i18n.js`, and `components/saas/dashboard-skeleton.js`.
- Styles/assets: CSS imports in `app/layout.js`, feature styles under `app/`, and `public/fonts/Tajawal-Regular.ttf`. Preview PNGs under `public/` are reference artifacts, not application data.
- Contract checks: `tests/*.test.mjs`; endpoint behavior details are in [API_REFERENCE.md](./API_REFERENCE.md).

When adding a new file, prefer its feature directory instead of expanding the central shell unnecessarily.

To add a field to an existing resource:

1. Update `RESOURCE_FIELDS` and validation in `lib/access.js`.
2. Decide whether employees may write it; update `employeeFields()` only when appropriate.
3. Add form/display/detail/profile handling in `HRApp` and the appropriate panel.
4. Add English/Arabic text and intentional export-schema changes.
5. Update demo seeds/migration handling and meaningful permission/validation tests.

To add a resource or page:

1. Add the server resource policy, validation, tenant/owner scope, and required indexes.
2. Add navigation/resource/modal mappings in `lib/navigation.js` and role pages in `lib/demo.js`.
3. Add authorized fetch/save state and the view without remounting `HRApp`.
4. Add a matching `PageSkeleton` and responsive/light/dark/RTL styles.
5. Add detail-page fields and export columns only if the feature supports them.
6. Add tests proving cross-tenant and employee ownership restrictions before exposing it.

To change authorization, start with `lib/access.js`, `lib/page-access.js`, `lib/auth.js`, and their tests. Hiding a sidebar entry is not sufficient. To change navigation, edit `lib/navigation.js` and keep route-page server guards and persistent-shell behavior aligned. To change notifications, edit event derivation and recipient rules together, then test both role changes and revoked membership.

## 11. Verification before handing off a change

Run the repository checks:

```sh
npm test
npm run build
```

For a focused change, a specific Node test file can run independently:

```sh
node --test tests/profile-code.test.mjs
```

The test suite covers access/owner restrictions, page gates, onboarding concurrency, credentials, sample credentials, custom IDs, QR encode/decode and scope, media validation, notification recipients/revocation/socket behavior, request origins, record detail scopes, chart dates, and export generation. Database contract tests use fixtures; they do not replace checks against a real configured MongoDB instance. There is no repository-wide lint script at present.

Browser QA should exercise the changed flow and its boundaries:

- Sign in as each sample role when demo access is enabled; verify the role's permitted pages/actions and account profile.
- Confirm demo rows prefill rather than auto-login; invalid credentials keep the user on the form.
- Test direct protected URLs, linked detail pages, breadcrumb/back navigation, browser Back/Forward, and rapid profile-to-profile transitions.
- Confirm the sidebar/header/session stay mounted and only the actual pending content displays a layout-matched shimmer.
- Exercise create/edit/delete and reviewed-request locking; verify a persisted demo change after reload.
- Check light/dark mode, Arabic RTL, a narrow mobile viewport, keyboard focus, and reduced motion.
- For photos/QR, test valid and invalid files, a replacement photo, QR image/manual lookup, permission-denied camera fallback, and a cross-workspace pass.
- For exports, inspect an English and Arabic PDF, a multi-page report, CSV escaping, and the authorized record count.
- Once real integrations are configured, separately test real password/Google sessions, membership revocation, MongoDB persistence, private images, and the WebSocket connection through the intended proxy.

Do not claim live external verification from fixture tests or configuration-presence flags. State which mode and environment were actually checked.

## 12. Limits and later integrations

The repository supplies application flows and configurable adapters. External account setup remains separate:

- Supply MongoDB credentials/network access/backups; current code stores operational records, images, password hashes, and notifications in MongoDB.
- Supply Google OAuth credentials and authorized callback origins when Google sign-in is wanted.
- Deploy the custom server on a long-running Node host with HTTPS and WebSocket upgrade support. A static export or serverless-only Next deployment will not run this socket process.
- Add billing/payment-provider integration if subscription plans must charge money. Current plan labels do not enforce paid entitlements or collect payment.
- Add payroll/payment/tax providers if compensation decisions must trigger payroll. Current approvals are recorded decisions only.
- Add email/SMS/push delivery, invitation acceptance, password recovery, MFA, or enterprise identity integration if needed. Those are not implemented by the in-app notification/password setup flows.
- Add an object-storage adapter and media retention/deletion policy if MongoDB image storage no longer fits the deployment.
- Add durable notification/audit processing, centralized rate limiting, monitoring, pagination, and backup/restore verification for larger or more demanding deployments.

Current practical limits include a 1,000-row generic collection load, 100 recent related records per profile section, and 50 visible recent notification items with a separate unread count. Dashboard/export totals are based on loaded collections. Team-growth history is derived from current employee records and start dates; there is no complete departure/history event ledger. Leave-day summaries count recorded calendar days, not a jurisdiction-aware accrual/holiday engine.

The password attempt limiter is process-local. The application has no public password signup/reset or MFA flow. Demo data and photos consume browser storage and are not shared between browsers. Recruitment does not include candidate intake; compliance remains a configurable internal checklist. Audit/notification writes are best effort, uploaded-image cleanup is not a complete retention system, and comprehensive production readiness requires deployment-specific validation.

Before changing Next.js conventions, read [AGENTS.md](../AGENTS.md) and the relevant installed guide under `node_modules/next/dist/docs/`. This repository explicitly requires the installed version's documentation because newer Next.js APIs and file conventions may differ from older examples.
