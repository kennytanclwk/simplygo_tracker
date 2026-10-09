# SimplyGo Trip Selector — Vue.js version

A Vue 3 + Vite web app that recreates the key features of the Streamlit version:

- Upload a SimplyGo statement PDF
- Extract selectable PDF text in the browser with PDF.js
- Parse trip date, journey, fare, and statement total
- Search by date or journey
- Select/deselect individual trips, select visible trips, or clear all
- Preserve selections while filtering
- Show selected trip count, selected total, statement total, and difference
- Download selected trips as CSV

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
- The parser expects trip lines similar to `01 Jan 2026 Journey details $ 1.20` and a total line similar to `Total: $ 45.60`. If your statement's extracted text has a different layout, adjust `DATE_RE` and `TOTAL_RE` in `src/App.vue`.
- The original Python parser reads line-by-line. PDF.js exposes text fragments, so this app reconstructs lines based on PDF text positions; different statement layouts may require tuning.
- The app uses a simple table instead of AG Grid, so it does not need a grid license or custom JavaScript cell renderer.
