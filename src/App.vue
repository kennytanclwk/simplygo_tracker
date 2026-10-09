<script setup>
import { computed, ref } from 'vue'
import * as pdfjsLib from 'pdfjs-dist'
import PdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?worker&inline'
import { parseStatementText } from './statementParser.js'
import './traveler.css'

pdfjsLib.GlobalWorkerOptions.workerPort = new PdfWorker()

const trips = ref([])
const statementTotal = ref(null)
const selectedIds = ref(new Set())
const travelers = ['Kenny', 'Dexter', 'Chiew']
const tripAssignments = ref({})
const autoEntry = ref('')
const autoExit = ref('')
const autoTraveler = ref(travelers[0])
const searchText = ref('')
const loading = ref(false)
const errorMessage = ref('')
const fileName = ref('')
const fileInput = ref(null)

const visibleTrips = computed(() => {
  const query = searchText.value.trim().toLowerCase()
  if (!query) return trips.value
  return trips.value.filter((trip) =>
    trip.date.toLowerCase().includes(query) || trip.journey.toLowerCase().includes(query),
  )
})
const selectedTrips = computed(() => trips.value.filter((trip) => selectedIds.value.has(trip.id)))
const selectedTotal = computed(() => selectedTrips.value.reduce((sum, trip) => sum + trip.amount, 0))
const difference = computed(() => statementTotal.value == null ? null : selectedTotal.value - statementTotal.value)
const allVisibleSelected = computed(() => visibleTrips.value.length > 0 && visibleTrips.value.every((trip) => selectedIds.value.has(trip.id)))
const tripRoutes = computed(() => trips.value.flatMap((trip) => {
  const separator = trip.journey.indexOf(' - ')
  if (separator < 0) return []
  return [{
    trip,
    entry: trip.journey.slice(0, separator).trim(),
    exit: trip.journey.slice(separator + 3).trim(),
  }]
}))
const entryOptions = computed(() => [...new Set(tripRoutes.value.map((route) => route.entry))].sort())
const exitOptions = computed(() => [...new Set(tripRoutes.value.map((route) => route.exit))].sort())
const matchingRouteTrips = computed(() => tripRoutes.value
  .filter((route) =>
    (autoEntry.value || autoExit.value)
    && (!autoEntry.value || route.entry === autoEntry.value)
    && (!autoExit.value || route.exit === autoExit.value),
  )
  .map((route) => route.trip))
const travelerSummaries = computed(() => travelers.map((traveler) => {
  const assignedTrips = trips.value.filter((trip) => tripAssignments.value[trip.id] === traveler)
  return {
    name: traveler,
    count: assignedTrips.length,
    total: assignedTrips.reduce((sum, trip) => sum + trip.amount, 0),
  }
}))

function stableId(base, occurrence) {
  // Details + occurrence distinguish repeated trips without relying on browser crypto support.
  return `${base}::${occurrence}`
}

async function extractPdfText(file) {
  const data = new Uint8Array(await file.arrayBuffer())
  const pdf = await pdfjsLib.getDocument({ data }).promise
  const lines = []
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber)
    const content = await page.getTextContent()
    let currentLine = []
    let lastY = null
    for (const item of content.items) {
      if (!('str' in item)) continue
      const y = item.transform?.[5] ?? 0
      if (lastY !== null && Math.abs(y - lastY) > 3) {
        lines.push(currentLine.join('').trim())
        currentLine = []
      }
      currentLine.push(item.str)
      // PDF text items often already include spaces. Add a separator only when needed.
      if (item.hasEOL) {
        lines.push(currentLine.join('').trim())
        currentLine = []
        lastY = null
      } else {
        lastY = y
      }
    }
    if (currentLine.length) lines.push(currentLine.join('').trim())
  }
  return lines.filter(Boolean)
}

async function parseStatement(file) {
  const lines = await extractPdfText(file)
  return parseStatementText(lines)
}

async function onFileChange(event) {
  const file = event.target.files?.[0]
  if (!file) return
  errorMessage.value = ''
  loading.value = true
  fileName.value = file.name
  try {
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      throw new Error('Please choose a PDF file.')
    }
    const result = await parseStatement(file)
    trips.value = result.parsedTrips
    statementTotal.value = result.parsedTotal
    selectedIds.value = new Set()
    tripAssignments.value = {}
    autoEntry.value = ''
    autoExit.value = ''
    searchText.value = ''
    if (!trips.value.length) {
      errorMessage.value = 'No trips were detected. Check that the PDF contains selectable text and that its trip lines match the expected format.'
    }
  } catch (error) {
    trips.value = []
    selectedIds.value = new Set()
    tripAssignments.value = {}
    statementTotal.value = null
    errorMessage.value = `Could not read this PDF. ${error?.message ?? 'Please try another statement.'}`
  } finally {
    loading.value = false
    // Let the same file be selected again after an error.
    if (fileInput.value) fileInput.value.value = ''
  }
}

function toggleTrip(id) {
  const next = new Set(selectedIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selectedIds.value = next
}
function selectAllVisible() {
  const next = new Set(selectedIds.value)
  for (const trip of visibleTrips.value) next.add(trip.id)
  selectedIds.value = next
}
function toggleVisible() {
  if (allVisibleSelected.value) clearVisible()
  else selectAllVisible()
}
function clearVisible() {
  const next = new Set(selectedIds.value)
  for (const trip of visibleTrips.value) next.delete(trip.id)
  selectedIds.value = next
}
function clearAll() {
  selectedIds.value = new Set()
}
function toggleTraveler(tripId, traveler) {
  const next = { ...tripAssignments.value }
  if (next[tripId] === traveler) delete next[tripId]
  else next[tripId] = traveler
  tripAssignments.value = next
}
function autoAssignRoute() {
  if (!autoEntry.value || !autoExit.value || !matchingRouteTrips.value.length) return
  const next = { ...tripAssignments.value }
  for (const trip of matchingRouteTrips.value) next[trip.id] = autoTraveler.value
  tripAssignments.value = next
}
function downloadCsv() {
  if (!selectedTrips.value.length) return
  const quote = (value) => `"${String(value).replace(/"/g, '""')}"`
  const rows = [
    ['Date', 'Journey', 'Amount ($)', 'Traveler'],
    ...selectedTrips.value.map((trip) => [
      trip.date,
      trip.journey,
      trip.amount.toFixed(2),
      tripAssignments.value[trip.id] ?? '',
    ]),
  ]
  const csv = '\ufeff' + rows.map((row) => row.map(quote).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
  const link = document.createElement('a')
  link.href = url
  link.download = 'selected_simplygo_trips.csv'
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
function money(value) {
  return new Intl.NumberFormat('en-SG', { style: 'currency', currency: 'SGD' }).format(value)
}
</script>

<template>
  <main class="page-shell">
    <header class="hero">
      <div class="brand-icon" aria-hidden="true">🚆</div>
      <div>
        <p class="eyebrow">YOUR COMMUTE, YOUR WAY</p>
        <h1>SimplyGo Trip Selector</h1>
        <p class="subtitle">Choose the trips you want to include and check your total.</p>
      </div>
    </header>

    <section class="upload-card panel">
      <div class="section-heading">
        <div>
          <h2>Upload statement</h2>
          <p>Choose a SimplyGo statement PDF to extract your trips.</p>
        </div>
      </div>
      <label class="upload-zone" for="pdf-upload">
        <span class="upload-symbol">↑</span>
        <span class="upload-main">{{ fileName || 'Choose a PDF statement' }}</span>
        <span class="upload-hint">PDF files only · Processed locally in your browser</span>
        <input id="pdf-upload" ref="fileInput" type="file" accept="application/pdf,.pdf" @change="onFileChange" />
      </label>
      <p v-if="loading" class="status-line"><span class="spinner"></span> Reading PDF and extracting trips…</p>
      <div v-if="errorMessage" class="alert" role="alert">{{ errorMessage }}</div>
      <div v-else-if="trips.length" class="success-line">✓ {{ trips.length }} trips found in {{ fileName }}</div>
    </section>

    <template v-if="trips.length">
      <section class="summary-grid" aria-label="Trip totals">
        <article class="metric-card">
          <span class="metric-label">SELECTED TRIPS</span>
          <strong>{{ selectedTrips.length }}</strong>
          <span class="metric-foot">of {{ trips.length }} trips</span>
        </article>
        <article class="metric-card metric-primary">
          <span class="metric-label">SELECTED TOTAL</span>
          <strong>{{ money(selectedTotal) }}</strong>
          <span class="metric-foot">Based on selected trips</span>
        </article>
        <article class="metric-card">
          <span class="metric-label">STATEMENT TOTAL</span>
          <strong>{{ statementTotal == null ? '—' : money(statementTotal) }}</strong>
          <span class="metric-foot">{{ statementTotal == null ? 'Not detected in PDF' : 'Read from statement' }}</span>
        </article>
      </section>

      <section class="assignment-panel panel" aria-labelledby="traveler-summary-heading">
        <div class="section-heading">
          <div>
            <span class="step-label">TRAVELER TOTALS</span>
            <h2 id="traveler-summary-heading">Amount by person</h2>
            <p>Totals include trips assigned to each person. Unassigned trips are not included.</p>
          </div>
        </div>
        <div class="traveler-summary-grid">
          <article v-for="summary in travelerSummaries" :key="summary.name" class="traveler-summary-card">
            <span class="metric-label">{{ summary.name.toUpperCase() }}</span>
            <strong>{{ money(summary.total) }}</strong>
            <span class="metric-foot">{{ summary.count }} assigned {{ summary.count === 1 ? 'trip' : 'trips' }}</span>
          </article>
        </div>
      </section>

      <section class="auto-assign-panel panel" aria-labelledby="auto-assign-heading">
        <div class="section-heading">
          <div>
            <span class="step-label">QUICK ASSIGN</span>
            <h2 id="auto-assign-heading">Auto-assign by entry and exit</h2>
            <p>Choose a route and traveler to assign every trip with that exact entry and exit.</p>
          </div>
        </div>
        <div class="auto-assign-controls">
          <label class="assign-field">
            <span>Entry</span>
            <select v-model="autoEntry" aria-label="Entry">
              <option value="">Select entry</option>
              <option v-for="entry in entryOptions" :key="entry" :value="entry">{{ entry }}</option>
            </select>
          </label>
          <label class="assign-field">
            <span>Exit</span>
            <select v-model="autoExit" aria-label="Exit">
              <option value="">Select exit</option>
              <option v-for="exit in exitOptions" :key="exit" :value="exit">{{ exit }}</option>
            </select>
          </label>
          <label class="assign-field">
            <span>Person</span>
            <select v-model="autoTraveler" aria-label="Person">
              <option v-for="traveler in travelers" :key="traveler" :value="traveler">{{ traveler }}</option>
            </select>
          </label>
          <button class="button button-download auto-assign-button" :disabled="!matchingRouteTrips.length" @click="autoAssignRoute">
            Assign {{ matchingRouteTrips.length }} {{ matchingRouteTrips.length === 1 ? 'trip' : 'trips' }}
          </button>
        </div>
      </section>

      <section class="trips-panel panel">
        <div class="section-heading table-heading">
          <div>
            <h2>Select your trips</h2>
            <p>Use the tick buttons to include or exclude trips. Selections stay saved while you search.</p>
          </div>
          <button class="button button-download" :disabled="!selectedTrips.length" @click="downloadCsv">↓ Download selected CSV</button>
        </div>

        <div class="toolbar">
          <label class="search-box">
            <span aria-hidden="true">⌕</span>
            <input v-model="searchText" type="search" placeholder="Search by date or journey…" aria-label="Search by date or journey" />
            <button v-if="searchText" class="clear-search" aria-label="Clear search" @click="searchText = ''">×</button>
          </label>
          <div class="bulk-actions">
            <button class="button button-soft" @click="toggleVisible">{{ allVisibleSelected ? '✓ Clear visible' : '✓ Select visible' }}</button>
            <button class="button button-ghost" @click="clearAll">Clear all</button>
          </div>
        </div>

        <div class="table-meta">
          <span>Showing <strong>{{ visibleTrips.length }}</strong> of {{ trips.length }} trips</span>
          <span>{{ selectedTrips.length }} selected</span>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr><th class="tick-heading">Tick</th><th>Date</th><th>Journey</th><th>Person</th><th class="amount-heading">Amount</th></tr>
            </thead>
            <tbody>
              <tr v-for="trip in visibleTrips" :key="trip.id" :class="{ 'row-selected': selectedIds.has(trip.id) }">
                <td class="tick-cell">
                  <button class="tick-button" :class="{ checked: selectedIds.has(trip.id) }" :aria-pressed="selectedIds.has(trip.id)" :aria-label="selectedIds.has(trip.id) ? 'Exclude this trip' : 'Include this trip'" :title="selectedIds.has(trip.id) ? 'Click to exclude this trip' : 'Click to include this trip'" @click="toggleTrip(trip.id)">{{ selectedIds.has(trip.id) ? '✓' : '' }}</button>
                </td>
                <td class="date-cell">{{ trip.date }}</td>
                <td class="journey-cell">{{ trip.journey }}</td>
                <td class="person-cell">
                  <div class="person-buttons" role="group" :aria-label="`Assign ${trip.journey} to a traveler`">
                    <button
                      v-for="traveler in travelers"
                      :key="traveler"
                      class="person-button"
                      :class="{ active: tripAssignments[trip.id] === traveler }"
                      :aria-pressed="tripAssignments[trip.id] === traveler"
                      :aria-label="`${tripAssignments[trip.id] === traveler ? 'Unassign' : 'Assign'} ${trip.journey} ${tripAssignments[trip.id] === traveler ? 'from' : 'to'} ${traveler}`"
                      @click="toggleTraveler(trip.id, traveler)"
                    >{{ traveler }}</button>
                  </div>
                </td>
                <td class="amount-cell">{{ money(trip.amount) }}</td>
              </tr>
              <tr v-if="!visibleTrips.length"><td colspan="5" class="empty-state">No trips match your search.</td></tr>
            </tbody>
          </table>
        </div>

        <div v-if="difference !== null" class="comparison" :class="{ matched: Math.abs(difference) < 0.01 }">
          <span v-if="Math.abs(difference) < 0.01">✓ Selected total matches the statement total.</span>
          <span v-else>Selected total minus statement total: <strong>{{ difference > 0 ? '+' : '−' }}{{ money(Math.abs(difference)) }}</strong></span>
        </div>
      </section>
    </template>
    <footer>SimplyGo Trip Selector <span>·</span> Your PDF is processed in this browser and is not uploaded to a server.</footer>
  </main>
</template>
