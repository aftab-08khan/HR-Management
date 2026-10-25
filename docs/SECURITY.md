# Security model

This document describes implemented controls and the responsibilities that remain when deploying PeopleOS. It is not a certification or a guarantee that a deployment is free of vulnerabilities. Read [OPERATIONS.md](OPERATIONS.md) before connecting real services or employee data.

## Trust boundaries

Real account access requires a signed NextAuth session and an active membership in a persisted workspace. Every private API resolves current membership and derives the workspace and role on the server. Browser-provided roles, owner IDs, and workspace IDs do not grant authority.

The public demo is a separate sample environment. Its signed, HttpOnly cookie authorizes only sample UI routes. Sample credentials and role selection cannot authenticate NextAuth APIs, read MongoDB organizations, or open a real notification WebSocket. A real session takes precedence over a demo cookie, including a revoked or unprovisioned real identity.

## Authentication

- Google sign-in checks Google's verified-email assertion. Membership or controlled first-workspace onboarding determines access.
- Password sign-in verifies a credential belonging to an active membership and existing workspace. The server obtains the role from that membership.
- Passwords use salted scrypt hashes with a random 16-byte salt, a 64-byte derived key, `N=32768`, `r=8`, `p=1`, and bounded memory. Raw passwords are not stored in employee records, browser storage, API responses, or logs.
- Password input is limited to 12–128 characters and 512 UTF-8 bytes. Comparisons use constant-time equality on derived keys. Invalid login responses do not reveal whether an account exists.
- Login attempts are limited by normalized email within the Node process. Tenant selection cannot bypass that limiter. The current limit is eight attempts per 15 minutes; successful login clears that email's counter.
- Sessions expire after eight hours. Page/API reads recheck membership. Password session versions allow password provisioning/reset to invalidate prior password sessions; Google sessions remain governed by their membership and expiry.
- Only an active tenant administrator may provision an active member's password through the web API. A password reset in one tenant cannot change credentials for the same email in another tenant.
- The CLI is a trusted operator tool using database credentials. It must not be exposed as an unauthenticated web endpoint.

An optional workspace ID can narrow a real credential login. Without it, the server considers at most 20 stored credential candidates for that email and accepts only a matching active tenant identity. The authorized tenant stays attached to the issued token; a later database failure cannot switch it to a different organization.

## Pages, roles, and data ownership

`lib/page-access.js` protects workspace pages and deep links on the server. Unauthorized visits redirect to sign-in or the authorized dashboard. `RouteOutlet` mounts the App Router's redirect/error boundary even though the main workspace shell persists between pages.

- Administrators manage organization records and workspace members.
- HR managers manage HR records and workflows, with no membership administration.
- Employees receive their own employee profile, requests, compensation, and reviews, plus shared announcements and permitted settings.

Page access does not replace API authorization. `lib/access.js` checks resource permissions and constructs tenant-scoped queries. Employee personal resources additionally require their server-assigned owner email. Single-record and profile APIs use the same restrictions. Names are not used to join private cloud records because names are not unique identities.

The browser hides unavailable actions for clarity, but the server enforces every write. Employee edits to self-service requests are limited to the Pending state, with that state included in the database write filter to avoid overwriting a concurrent review. Membership changes are serialized and cannot remove the last active administrator. Unique indexes prevent conflicting identities and IDs inside a tenant.

## Requests and responses

- Private HR JSON responses use `Cache-Control: private, no-store` and vary on Cookie. Private images are served only after workspace/owner checks and use private/no-store headers.
- Mutations validate content type, same-origin browser context, body size, types, allowed fields, IDs, and workflow states. Server-assigned ownership and tenant fields are not taken from form authority claims.
- Generic JSON records have a 64,000-byte streamed body limit. Onboarding and notification read-state requests have a 2,048-byte limit. Credential and demo requests have their own bounded readers. Limits apply even without a truthful Content-Length header.
- Cross-site browser mutations are rejected. The origin helper compares the actual request Host or the explicitly configured `NEXTAUTH_URL`, rather than trusting forwarded host headers.
- React renders user-entered text as text. Export fields omit internal structures. CSV formula-like values are escaped, and PDF generation uses the already-authorized result set.
- Response headers block framing and object embedding, disable MIME sniffing, restrict referrers, and permit camera use only by this origin. The CSP is deliberately limited to framing/object/base-URL protections; it is not a nonce-based script policy.

## Images and profile passes

Photos require an existing authorized employee profile. The server bounds multipart parsing, accepts only supported image formats, checks actual image data and dimensions, and re-encodes to WebP. SVG and arbitrary executable files are not accepted. Ownership is checked again when the stored photo is attached or read.

QR codes contain workspace/employee identifiers, not a public profile URL, salary, private contact data, or an authorization token. A scan can resolve only an employee already available to the current account. Image decoding takes place in the browser. Camera tracks stop when the scanner closes, the document becomes hidden, or the workspace changes.

## WebSocket notifications

`server.mjs` accepts `/api/live` only with a valid signed NextAuth cookie, an allowed Origin, and an active membership. The transport is a real WebSocket, with bounded messages, heartbeat cleanup, and reconnect handling.

Before delivery, the server rechecks the selected tenant, recipient, current role, session expiry, and password-session version when applicable. Suspended/revoked access closes the connection. Database refreshes approximately every two seconds work with a standalone MongoDB server; change streams are not required. Demo events remain browser-local.

## Deployment responsibilities

The application code is ready for external configuration; no real database, OAuth account, email service, subscription billing, or production hosting is supplied by the demo.

Before storing real HR data:

1. Configure a stable strong secret, HTTPS URL, and real account provisioning. Keep production demo access disabled unless a separate public sample experience is intended.
2. Restrict MongoDB network access and database-user privileges. Use TLS, backups, retention policies, and restore testing appropriate to the organization.
3. Run the Node process behind an HTTPS proxy with WebSocket support. Use shared secrets across instances and add distributed abuse protection at the ingress.
4. Establish monitoring, sanitized logs, incident response, credential rotation, and independent review before exposing sensitive operations publicly.
5. Determine the organization's HR/legal/privacy obligations. The compliance screen tracks internal tasks; it does not assess legal compliance automatically.

These are deployment controls, not completed integrations. The development server binds to loopback by default; public binding should be intentional.

## Current scope and limits

The local rate limiter is per process and resets on restart. It is not a replacement for distributed/IP-based ingress protection. MFA, SAML, email-based password recovery, billing collection, tax calculations, and payment execution are not implemented. Password changes are currently administrator/operator managed.

List APIs return at most 1,000 rows. Profile related lists return the latest 100 records with total counts; the UI marks truncated data. Own-profile lookup is direct and is not limited by the directory page. Database pagination and historical headcount ledgers can be added later.

Notification and activity writes are best effort. They are not a guaranteed delivery queue or tamper-proof audit system. Deletions are permanent through the current UI. Existing downloaded exports and information already seen by an authorized user cannot be recalled by revoking their session.

Unit checks use synthetic in-memory fixtures. Live Google OAuth, real MongoDB connectivity, multi-instance hosting, TLS/proxy behavior, and camera hardware must be checked in the configured deployment. See [API_REFERENCE.md](API_REFERENCE.md) for endpoint contracts and [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md) for where to change the implementation.
