---
name: testing-backend-api
description: How to run and end-to-end test the Uddhar_Diary Express backend (including Supabase-backed endpoints) without real Supabase credentials.
---

# Testing the Uddhar_Diary backend

## Running the server
- Node 22+ is REQUIRED. `@supabase/supabase-js` crashes on the box's default Node 20 with
  `native WebSocket not found`. Use: `export PATH=~/.nvm/versions/node/v22.12.0/bin:$PATH`
- Deps: `cd backend && npm install`, then `npm start` (defaults to `PORT=3000`, override with `PORT=`).
- `backend/src/lib/supabaseClient.js` throws at import time if `SUPABASE_URL` or
  `SUPABASE_SERVICE_ROLE_KEY` are unset, so the app will not boot without them — dummy values are
  enough to boot.
- Start servers detached so a later `pkill` in the same shell doesn't kill your session:
  `PORT=3011 setsid nohup node index.js > /tmp/srv.log 2>&1 < /dev/null & disown`
  Always tee stdout/stderr to a log file — the route has unhandled-rejection/throw paths that kill
  the process, and the stack trace only appears in that log.

## Testing Supabase-backed endpoints without real credentials
`supabase-js` talks plain HTTP to `${SUPABASE_URL}/storage/v1/object/{bucket}/{path}`, so you can
point `SUPABASE_URL` at a local mock HTTP server and get full success-path coverage:

1. Write a small Node http server on e.g. 127.0.0.1:3099 that appends
   `{method, url, content-type, x-upsert, bodyBytes, sha256(body)}` to a log file and replies
   `200 {"Id":"...","Key":"..."}`.
2. Run the app with `SUPABASE_URL=http://127.0.0.1:3099 SUPABASE_SERVICE_ROLE_KEY=mockkey`.
3. Assert on the mock log: exact object path, `content-type`, `x-upsert`, and that the sha256 of the
   received body equals the sha256 of the uploaded file (proves bytes are forwarded intact).
4. Make the mock return a 4xx (e.g. behind a `MOCK_FAIL=1` env var) to exercise the upstream-error
   branch (should be 502).
5. Keep a second instance running with dummy creds against a real `*.supabase.co` URL to prove the
   real-network failure path returns 502 rather than hanging/crashing.

This gives everything except proof that a real bucket accepts the object — report that as untested
unless real credentials are provided.

## Things to always probe on multipart upload routes here
- Non-multipart requests (`application/x-www-form-urlencoded`, or no `Content-Type`): multer skips
  parsing and leaves `req.body` undefined. Handlers that destructure `req.body` throw synchronously
  inside the multer callback, which is OUTSIDE Express's error handling → the whole process exits.
  Always send a urlencoded/no-content-type request and then re-check `/health`.
- `userId`-style path segments interpolated into a storage path: try `userId=../other-bucket`.
  `supabase-js` does not normalize, but the HTTP layer collapses `..`, so traversal can escape the
  bucket. Verify with the mock what URL actually arrives.
- Size limits: check the exact boundary (limit-1 / limit / limit+1); multer rejects at exactly the
  limit value.

## Devin Secrets Needed
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (only for real end-to-end storage verification; a
  project with a `bill-images` bucket is required).
