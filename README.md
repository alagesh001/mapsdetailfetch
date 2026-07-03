# TN Computer Institute Finder

A React (Vite) app that finds computer training institutes across Tamil Nadu using
Google's **Places API (New)** `places:searchText` endpoint, and exports the results
to an Excel file (name, address, phone, website, rating, review count, Google Maps URL).

## 1. Get a Google Places API key

1. Go to the [Google Cloud Console](https://console.cloud.google.com/), create/select a project.
2. Enable **Places API (New)** (APIs & Services → Library → search "Places API (New)").
3. Make sure billing is enabled on the project (the new Places API is not on the legacy free tier).
4. Create an API key under APIs & Services → Credentials.
5. **Restrict the key**: under "Application restrictions" choose "HTTP referrers" and add
   `http://localhost:5173/*` for local dev (and your real domain once deployed). This is
   important because the key is used directly from the browser.

## 2. Run locally

```bash
npm install
npm run dev
```

Open the URL Vite prints (default `http://localhost:5173`), paste your API key into the
app, adjust the keyword / number of institutes, and click **Start search**.

## 3. How it works

- `src/districts.js` — list of Tamil Nadu districts/towns used to fan a single keyword
  (e.g. "computer training institute") out into many queries like
  `"computer training institute in Madurai, Tamil Nadu"`, since a single Text Search
  query is capped at 60 results (3 pages of 20) by Google.
- `src/placesApi.js` — calls `POST https://places.googleapis.com/v1/places:searchText`
  with a field mask limited to the 7 fields the app shows, follows `nextPageToken` for
  up to 3 pages per query, and de-duplicates institutes by place `id` across districts.
  Stops as soon as the requested count is reached.
- `src/exportExcel.js` — builds the `.xlsx` file with [SheetJS](https://sheetjs.com/) and
  triggers a download.
- `src/App.jsx` — the UI: API key field, keyword field, "number of institutes" field, a
  live query log, a results table, and the download button.

## 4. Notes & limits

- Each Text Search request (and each extra page) is billed by Google — see
  [Places API (New) pricing](https://developers.google.com/maps/billing-and-pricing/pricing#places-text-search).
  Asking for more institutes means more billed requests.
- `internationalPhoneNumber` / `website` / `rating` are not guaranteed to be present for
  every place; missing values show as `—` in the table and blank cells in Excel.
- The API key is only ever sent from your browser straight to Google — there's no backend
  and nothing is stored — but that also means anyone who opens the deployed page can see
  network requests containing the key, so the HTTP-referrer restriction in step 1 matters
  if you deploy this publicly.
