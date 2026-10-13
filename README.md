# SimplyGo Trip Selector — Vue.js version

A Vue 3 + Vite web app that recreates the key features of the Streamlit version:

- Upload a SimplyGo statement PDF
- Extract selectable PDF text in the browser with PDF.js
- Parse trip date, journey, fare, and statement total
- Search by date or journey
- Filter trips by a single-calendar date range, selected stations within journeys, traveler (including unassigned), and amount range
- Sort trips by date, day type, journey, traveler, or amount; unassigned trips stay at the top when sorting by traveler
- Show a weekday or weekend icon for each trip
- Select/deselect individual trips, select visible trips, or clear all
- Preserve selections while filtering
- Assign each trip to travelers listed in the shared defaults spreadsheet, individually or by matching entry/exit
- Show assigned trip counts and net fare totals for each traveler, with optional refund deductions
- Load traveler names and preselected stations from the [shared defaults spreadsheet](https://docs.google.com/spreadsheets/d/1kiE-pFOESP6R-bR0C4qEcTITIcWPX6doFJxpLIswees/edit?usp=sharing)
- Show selected trip count, selected total, statement total, and difference
- Download selected trips and their traveler assignments as CSV

## Requirements

- Node.js 20 or newer recommended
- npm

## Run locally

Open a terminal in this folder and run:

```bash
npm install
npm run dev
```

Vite will print a local URL, usually `http://localhost:5173`. Open it in your browser.

## Build for deployment

```bash
npm run build
```

The static production website is written to `dist/`. Deploy that folder to any static host, such as GitHub Pages, Netlify, or Cloudflare Pages.

## Notes

- PDF processing is performed locally in the browser; this project does not upload the PDF to a backend.
- Traveler defaults are loaded from the linked Google Sheet when the app opens. The sheet must be publicly readable and include `Person` and `Default Locations` columns; locations in each row are comma-separated.
- The parser expects trip lines similar to `01 Jan 2026 Journey details $ 1.20` and a total line similar to `Total: $ 45.60`. If your statement's extracted text has a different layout, adjust `DATE_RE` and `TOTAL_RE` in `src/App.vue`.
- The original Python parser reads line-by-line. PDF.js exposes text fragments, so this app reconstructs lines based on PDF text positions; different statement layouts may require tuning.
- The app uses a simple table instead of AG Grid, so it does not need a grid license or custom JavaScript cell renderer.
