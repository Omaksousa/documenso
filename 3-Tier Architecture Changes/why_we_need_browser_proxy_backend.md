# Session Architecture & Proxy Decision

## Background: Cookies vs JWT

### How JWT Works

JWT (JSON Web Token) is a self-contained token the server returns in the
response body after login. The client stores it manually (typically in
`localStorage`) and manually attaches it to every request via an
`Authorization: Bearer <token>` header. The server verifies the token's
signature and reads the user data baked inside — no database lookup needed.

### How Session Cookies Work

A session cookie is a small identifier the server places on the browser
after login. The browser stores it automatically and sends it back on every
future request to that origin — with no code required from the developer.
The server reads the identifier, looks it up in the database, and retrieves
the full session record.

User logs in → POST /api/auth/login

Server verifies credentials, creates a session record in PostgreSQL,
and instructs the browser to store it:
Set-Cookie: sessionId=abc123; HttpOnly; SameSite=Lax

Browser stores the cookie automatically.

User navigates to any page → GET /dashboard
Browser automatically attaches:
Cookie: sessionId=abc123

Server hashes the token, looks it up in the database,
retrieves the session, knows who the user is.

### Cookie Security Flags

**`HttpOnly`**
JavaScript running on the page cannot read this cookie. `document.cookie`
returns nothing. This means an XSS attack cannot steal the session token.
JWT stored in `localStorage` does not have this protection.

**`SameSite`**
Controls when the browser sends the cookie based on the request's origin:

- `Strict` — only sent if the request originates from the exact same site
- `Lax` — sent on normal navigation but not on cross-origin `fetch()` calls
- `None` — sent always, even cross-origin, but requires `Secure`

**`Secure`**
Cookie is only transmitted over HTTPS. Never over plain HTTP.

### Side-by-Side Comparison

|                             | Session Cookie         | JWT                                      |
| --------------------------- | ---------------------- | ---------------------------------------- |
| Where stored                | Browser (automatic)    | Developer-managed (localStorage, memory) |
| Sent automatically          | Yes, by the browser    | No, must be attached manually            |
| Server needs DB lookup?     | Yes, every request     | No, self-contained                       |
| Can revoke instantly?       | Yes, delete the DB row | No, valid until expiry                   |
| Safe from XSS (if HttpOnly) | Yes                    | No — JS can read from localStorage       |
| Cross-origin complexity     | High (SameSite rules)  | Low (just a header)                      |

### How Documenso Uses Sessions

Documenso uses **database-backed session cookies**. The session token is
hashed with SHA-256 and stored in PostgreSQL. Every request, the server
reads the cookie, looks up the hash in the database, and retrieves the
user. This design allows instant session revocation — logging a user out
from all devices is a single `DELETE` query.

---

## The Proxy and Why It Exists

In the 3-tier architecture, the client server runs on port 3000 and the API
server runs on port 3001. Two types of traffic need to reach the API server:

| Traffic type                                                                       | Origin              | How it reaches port 3001          |
| ---------------------------------------------------------------------------------- | ------------------- | --------------------------------- |
| SSR loader calls (Phase 2+)                                                        | Node.js SSR process | Direct server-to-server `fetch()` |
| Browser requests (tRPC mutations, file downloads, OAuth callbacks, WebAuthn, etc.) | User's browser      | Via the proxy on port 3000        |

The proxy exists to handle the second category. Even after all 53 loaders
are migrated to direct HTTP calls in Phase 2, browser-initiated requests
still happen — clicking a download button, a passkey flow, an OAuth
redirect returning from Google, client-side React Query mutations. Those
requests hit port 3000 and the proxy forwards them to port 3001.

---

## Why Not Go Directly from Browser to Backend?

The option of having the browser call port 3001 directly (without a proxy)
was considered and rejected for Phase 1. Here is why.

### Problem 1 — CORS Blocks the Request

When the browser is on `localhost:3000` and makes a fetch to
`localhost:3001`, the browser treats this as a **cross-origin request**
(port number counts as a different origin). Before sending the real request,
the browser sends a preflight `OPTIONS` request asking the server if it
allows cross-origin calls from port 3000. If the server does not respond
with the correct headers, the browser blocks the request entirely — your
code never runs and the user sees a network error.

To fix this, `cors()` middleware would need to be added to every route in
`server/router.ts`, including auth routes and tRPC routes that currently
have no CORS configuration.

### Problem 2 — The Session Cookie Is Never Sent

The session cookie is currently set with `SameSite=Lax`. The browser's
SameSite policy means the cookie is **not sent** on cross-origin `fetch()`
calls. Every request to port 3001 would arrive with no cookie, making the
user appear unauthenticated on every call — even immediately after logging in.

To fix this, the cookie would need to change to `SameSite=None`. But
`SameSite=None` requires the `Secure` flag, and `Secure` requires **HTTPS**.
This means setting up a self-signed TLS certificate locally just to be able
to test the login button.

### Problem 3 — Every Fetch Call Needs Updating

Even if Problems 1 and 2 are resolved, every `fetch()` call in the browser
needs `credentials: 'include'` explicitly:

```javascript
// Required for cookies to be sent cross-origin
fetch('http://localhost:3001/api/trpc/document.getAll', {
  credentials: 'include',
})
This affects every React component, every tRPC call, and every file download
link throughout the application. The tRPC client config and all manual fetch
calls would need this option added. Additionally, the API server must respond
with Access-Control-Allow-Origin: http://localhost:3000 exactly — wildcard
origins (*) are forbidden when credentials are involved.

Why the Proxy Avoids All Three Problems
The proxy makes port 3001 invisible to the browser. From the browser's
perspective, every request goes to localhost:3000 — the same origin it
loaded from. There is no cross-origin situation, so:

No CORS preflight is triggered
SameSite=Lax works correctly — the cookie is sent on every request
No credentials: 'include' needed anywhere
No HTTPS required in development
The proxy is a single configuration block in Vite (development) and a small
middleware in server/main-client.js (production). It eliminates an entire
category of problems without touching any application code.

What About Switching to SPA Mode?
Switching React Router from SSR to SPA mode (ssr: false) was also
considered. In SPA mode there is no server-side rendering, so no
main-client.js is needed — just static files served from a CDN or simple
file server, and the browser calls the API directly.

The tradeoff is that all 53 loaders still need to be migrated to HTTP calls
— the same amount of work as Phase 2, with no shortcut. In addition, SPA
mode loses server-rendered HTML, meaning every page shows a loading state
until the browser fetches its data. For an auth-gated SaaS application this
is a deliberate product decision, not a free change.

The decision was to finish the 3-tier separation first, then evaluate SPA vs
SSR independently with a working system. Mixing both changes at once makes
debugging significantly harder.

The Future Path: Dropping the Proxy (Phase 5)
After the 3-tier separation is complete and stable, the proxy can be removed
by fixing the three problems described above in a focused, separate effort:

Fix 1 — Add global CORS to server/router.ts
Replace the per-route cors() calls with a single global middleware at the
top of the Hono app, configured with the frontend's origin and
credentials: true.

Fix 2 — Change the cookie to SameSite=None; Secure
Update the session cookie configuration in @documenso/auth. This requires
HTTPS in all environments, including local development (via a tool like
mkcert for local TLS certificates).

Fix 3 — Add credentials: 'include' to browser fetch calls
The tRPC client is configured in one place in the application providers, so
that is mostly a single change. Any manual fetch() calls in React
components would also need updating.

This path is viable but carries real complexity given the current cookie
architecture. It should be treated as a separate project undertaken only
after the 3-tier separation is fully working end-to-end.
```
