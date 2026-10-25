# PeopleOS API reference

All paths are relative to the application origin. Use the browser's NextAuth session cookie for real workspace access. Signed demo-preview cookies authorize fictional UI previews only and never authenticate these database APIs.

Sensitive responses use private, non-cacheable delivery. Send JSON mutations with `Content-Type: application/json`; uploads use multipart form data. Browser mutation origins must match the validated request Host and scheme or the explicitly configured `NEXTAUTH_URL`. Cross-site Fetch Metadata is rejected. Forwarded headers do not establish a trusted public origin.

## Authentication

NextAuth is mounted at `/api/auth/[...nextauth]`. Use its client helpers for CSRF handling:

```js
await signIn('credentials', {
  email,
  password,
  redirect: false,
  // workspaceId is optional; supply it to choose one tenant explicitly.
});
await signIn('google');
await signOut();
```

Password login requires a provisioned credential record, an active membership in the same workspace, and an existing workspace. Passwords are 12–128 characters, salted and hashed with scrypt. Authorization accepts no role input. Without `workspaceId`, login checks at most 20 email-matched credential candidates in stable workspace order and selects a password-matching active membership. With `workspaceId`, it checks that tenant only. Failed login returns the normal generic NextAuth credential failure; the API does not reveal whether the email, password, or membership was incorrect. Login attempts have a bounded process-local limiter.

Sessions expose `user.email`, `name`, `role`, `workspaceId`, `workspaceName`, `memberCode`, and `verifiedGoogle`. Membership and role are re-resolved from MongoDB. Credential login sets `verifiedGoogle` false and cannot create an unprovisioned organization. Verified Google users can use first-workspace onboarding.

### Administrator password provisioning

`POST /api/credentials` requires a real active administrator session. The body contains exactly:

```json
{"email":"member@example.com","password":"a-new-private-password"}
```

The target must be an active member of the administrator's current workspace. Success returns `{ "ok": true, "email": "member@example.com", "workspaceId": "current-workspace" }`. Passwords and hashes are never returned. Every password reset rotates an opaque credential session version, revoking older password sessions on their next request and disconnecting existing password-authenticated WebSockets on their next refresh. Google sessions are unaffected. Session versions are kept inside signed token claims and are not exposed in the session user. Credentials are keyed by workspace and email; resetting one tenant does not change credentials for the same email in another tenant. Invalid input returns 400, missing real authentication 401, missing administrator access 403, an unavailable active target 404, and storage failure 503.

For first-account setup without Google, configure MongoDB and run:

```sh
npm run user:create -- --workspace-id your-company --workspace-name "Your company" --email admin@yourcompany.com --name "Administrator" --role admin
```

The CLI prompts for a hidden password and confirmation. Automation may use `PEOPLEOS_INITIAL_PASSWORD`; plaintext passwords are not accepted as command-line arguments. The first member of an empty workspace must be an administrator. The CLI preserves existing suspended memberships and existing roles. The script has not been run against a real database as part of this implementation.

## Public configuration and demo previews

`GET /api/config` returns `{google:boolean,database:boolean}`. These flags indicate configured environment values, not a successful OAuth or database health check. They never contain secret values.

`GET /api/demo` returns `{enabled:boolean,role:null|"admin"|"hr"|"employee"}` after validating the signed preview cookie. `POST /api/demo` accepts either `{role}` for an explicit preview or `{email,password}` for a published sample login. `DELETE /api/demo` clears preview access. Responses report the selected sample role; they do not create a real NextAuth session.

The preview cookie is signed, HttpOnly, SameSite=Lax, scoped to `/`, valid for eight hours, and Secure in production. Production previews require `ALLOW_DEMO_ACCESS=true`. A real account session always takes precedence over a preview cookie. Sample credentials are documented on the login screen and in the README.

## Workspace

`GET /api/workspace` requires active real membership and returns workspace fields plus the current `role` and `memberCode`. Administrators additionally receive `members`; other roles do not receive that list. Verified Google sessions without an active role receive 409 with `onboardingRequired:true`.

`POST /api/workspace` accepts exactly `{name}` from a verified Google session without an existing membership. Success is 201 with `{id,name,plan,createdAt,role:"admin"}`. The server generates the workspace ID. Any existing membership, including a suspended one, blocks onboarding. A unique per-email provisioning guard coordinates concurrent requests and recovery after partial setup. Refresh the NextAuth session after creation. Password-only sessions cannot use this endpoint to bypass provisioning.

## Resource collections

Supported resource names are `employees`, `requests`, `jobs`, `announcements`, `reviews`, `compliance`, `compensation`, `memberships`, and `audit`.

- `GET /api/[resource]` returns an array of up to 1,000 authorized records.
- `POST /api/[resource]` creates a record and returns it with status 201. IDs, workspace ownership, timestamps, and employee self-service identity are assigned by the server.
- `PUT /api/[resource]` accepts `{id,...changedFields}` and returns `{ok:true}`.
- `DELETE /api/[resource]` accepts `{id}` and returns `{ok:true}`.
- `GET /api/[resource]/[id]` returns `{record}` under the same authorization rules. Employee URLs use the dedicated profile bundle described below.

Administrators and HR can manage operational records. Only administrators can read or change memberships. Audit history is readable by administrators and HR and cannot be mutated through these APIs. Compliance is unavailable to employees.

Employees can read their own employee record, requests, reviews, and compensation records. Job postings and announcements are readable within their workspace. Employee mutations are limited to their own pending requests and compensation requests. Request identity, owner, and decision fields cannot be changed by employee-supplied JSON; reviewed records cannot be edited or deleted. Conditional write filters preserve this rule during concurrent manager decisions.

### Business fields

- Employees: `name`, `email`, `role` (job title), `department`, `status`, `location`, `joined`, `salary`, `color`, `photoUrl`, `employeeCode`. Name and email are required on creation. Employee codes are uppercase, tenant-unique, 3–32 characters using letters/digits/underscores/hyphens. Missing codes receive stable server defaults.
- Requests: `name`, `type`, `from`, `to`, `reason`, `status`. Type and date range are required. Employees supply only type, dates, and reason; the server assigns their identity and Pending status.
- Jobs: `title`, `department`, `location`, `type`, `applicants`, `status`. Title is required.
- Announcements: `title`, `body`, `category`, `date`. Title and body are required.
- Reviews: `name`, `cycle`, `score`, `status`. Name and cycle are required.
- Compliance: `title`, `category`, `owner`, `description`, `dueDate`, `status`, `priority`, `assignedEmail`. Status is Complete, In progress, or Action needed; priority is Low, Medium, or High. These are internal operational checks.
- Compensation: `name`, `type`, `amount`, `currency`, `reason`, `status`, `reviewNote`. Type, positive amount, and reason are required. Types are Reimbursement, Salary adjustment, Benefit claim, and Final settlement. Status is Pending, Approved, or Declined. Currency is a three-letter uppercase code. Employees supply type, amount, currency, and reason; manager decisions record reviewer identity and time.
- Memberships: `email`, `name`, `role`, `status`. Role is admin, hr, or employee; status is Active or Suspended. Email is immutable after creation. `memberCode` is generated by the server. Passwords belong to `/api/credentials`, never membership records. Membership changes serialize and retain at least one active administrator.

Employee job titles are separate from membership authorization roles. Unknown input fields do not become authorization claims. Attendance is unsupported and has no active collection API.

## Private profile bundles

`GET /api/profile` directly looks up the signed-in email inside its workspace, independent of collection list limits. An unlinked account returns `{employee:null}`.

`GET /api/employees/[id]` returns:

```json
{
  "employee": {},
  "requests": [],
  "reviews": [],
  "compensation": [],
  "counts": {"requests":0,"reviews":0,"compensation":0}
}
```

Related arrays contain up to 100 recent authorized records per collection; counts report their totals. Related records are joined by owner email and workspace, never by a nonunique display name. Employees can access only their own profile, while administrators and HR can view employee profiles within their workspace. Inaccessible and nonexistent IDs both return 404. QR passes do not create public profile access.

## Profile images

`POST /api/uploads` accepts multipart fields `file` and `employeeId` for an existing employee record. Employees can upload only their own photo; administrators and HR can target their workspace's employees. JPEG, PNG, and WebP files must be at most 2 MB. Contents and dimensions are validated, animation is rejected, metadata is stripped, and output is re-encoded as a bounded WebP image.

Success is 201 with `{id,url,photoUrl,employeeId,ownerEmail}` and immediately updates the employee's photo reference. A concurrent employee identity change returns 409. Generic employee mutations accept only local uploaded-photo references belonging to that employee.

`GET /api/uploads/[id]` requires active membership in the media's tenant, with employees restricted to their own media. Successful responses are private, non-cacheable WebP bytes with content-type protection. Unknown, foreign, or unauthorized images return 404.

## Notifications and WebSockets

`GET /api/notifications` returns `{items,unreadCount}`. Items are limited to the current tenant, exact recipient email, current-role audience, and actor exclusion. The newest 50 items are returned; unreadCount counts all eligible unread items.

`POST /api/notifications/read` accepts `{id:"notification-id"}` or `{id:"all"}` and returns the updated feed. Read operations cannot update another recipient's rows.

The custom Node server accepts authenticated WebSockets at `/api/live`. It validates the browser origin, decrypts the signed NextAuth token, and checks current persisted membership. Frames are:

```json
{"type":"notifications","items":[],"unreadCount":0}
```

Clients may send `{type:"refresh"}` after marking items read. The server checks MongoDB every two seconds and pushes changed feeds over the socket. Membership/role are checked before delivery; expired sessions close with 4401, revoked membership with 4403, and unsupported client messages with 1008. Heartbeats and bounded message sizes clean up stale or invalid clients. Missing server secrets or database availability do not admit unauthenticated sockets.

## Status and security behavior

JSON validation errors generally return 400, missing real sign-in 401, forbidden role/action/origin 403, inaccessible or missing records 404, conflicts 409, oversized requests 413, unsupported content types 415, and unavailable persistence 503. Do not treat configuration flags as health checks or claim a mutation succeeded after a non-2xx response. A database failure never falls back to browser sample storage for a signed-in account.

All real HR business-record operations are tenant scoped. Employee reads and writes also apply identity/owner filters. Suspended users cannot regain access by choosing a client role, using a demo cookie, resetting another tenant's password, scanning a QR code, or creating a replacement onboarding tenant. Root login is public; protected workspace pages apply server role checks, live membership checks, and scoped detail checks before showing their routes.

Activity and notification writes are best-effort. These records are not a guaranteed audit system or exactly-once event bus. Password attempt limits are process-local; multi-instance production deployments should add a shared rate-limit store. Live OAuth, credential login, and MongoDB behavior still require verification against the deployment's configured external services.
