---
name: testing-split-flow
description: How to run and end-to-end test the Uddhar Diary bill upload → review → split → success flow locally without real Supabase/Gemini credentials.
---

# Testing the Uddhar Diary split flow locally

## Servers
- Node: `export PATH=~/.nvm/versions/node/v22.12.0/bin:$PATH` (default node v20 crashes `supabase-js`
  with "native WebSocket not found").
- Frontend: `(cd frontend && npm run dev)` → http://localhost:5173. It calls
  `VITE_API_URL || http://localhost:3001`.
- Backend: `(cd backend && SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm start)` — needs a REAL
  Supabase project (storage bucket `bill-images`, RPC `create_bill_with_split`, tables
  `people`/`categories`/`debts`) plus `GEMINI_API_KEY` for extraction.

## No credentials? Run the real routes with stubbed I/O (preferred over a hand-written mock)
Devin Secrets needed for the real path: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`.
If they are unavailable, keep full validation fidelity by loading the repo's real route modules from a
harness **outside the repo** (e.g. `/home/ubuntu/mock-backend/server.js`) that pre-populates
`require.cache` for `backend/src/lib/supabaseClient.js` (in-memory `supabase` stub with
`from()/insert()/select()/eq()/single()`, `storage.from().upload()`, and `rpc('create_bill_with_split')`)
and `backend/src/services/billExtraction.js` (returns a canned bill), then mounts
`src/routes/{bills,people,categories}` on port 3001 exactly like `backend/index.js`. This keeps the real
validators and `splitCalculator`, so error strings and split math are authentic. Never edit committed
source to make testing work.

Useful details:
- Hardcoded `USER_ID` in `frontend/src/App.jsx` is `999af4e5-6e7b-4512-9202-95c1a29dfff0`; ids must pass
  the strict UUID regex in `backend/src/lib/validators.js` (v1–v8, RFC variant) — `crypto.randomUUID()` works.
- `POST /api/bills/extract` runs `file-type` on the buffer, so upload a genuine image (a generated PNG works).
- Log `p_split_entries` in the rpc stub to cross-check the client preview against backend math.

## Driving the UI
- Upload step: click the dashed drop zone → GTK file chooser → double-click the file, then "Extract Bill".
- Review step: "Bill Total" input is editable; setting it to a value ≠ the item sum is the easiest way to
  trigger the backend's `Item totals do not match bill total...` 400 on save.
- Split step: rows are `Paid ₹` number inputs, disabled until the row checkbox is checked. Remainder paise
  go to the FIRST **selected** person (selection order, not list order).
- The inline add-person form shifts the layout down ~18px when an error appears — re-screenshot before
  clicking "Add person" again.
