<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import * as pdfjsLib from 'pdfjs-dist'
import PdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?worker&inline'
import { parseStatementText } from './statementParser.js'
import { fetchTravelerStations } from './travelerStations.js'
import {
  assignTripsByTravelerStations,
  getMatchingTrips,
  getTripRoute,
  getStationOptions,
} from './routeAssignment.js'
import { filterTrips, UNASSIGNED_FILTER } from './tableFiltering.js'
import { sortTrips } from './tableSorting.js'
import { getTripDayType, parseTripDate } from './tripDate.js'
import './traveler.css'

pdfjsLib.GlobalWorkerOptions.workerPort = new PdfWorker()

const trips = ref([])
const statementTotal = ref(null)
const selectedIds = ref(new Set())
const travelers = ref([])
const tripAssignments = ref({})
const assignmentHistory = ref([])
const travelerRefunds = ref({})
const defaultTravelerStations = ref({})
const travelerStations = ref({})
const searchText = ref('')
const tableFilters = ref({
  dateFrom: '',
  dateTo: '',
  journey: [],
  traveler: '',
  minAmount: '',
  maxAmount: '',
})
const sortKey = ref('person')
const sortDirection = ref('asc')
const loading = ref(false)
const errorMessage = ref('')
const stationDefaultsLoading = ref(true)
const stationDefaultsError = ref('')
const fileName = ref('')
const fileInput = ref(null)
const dateCalendarMonth = ref('')

const visibleTrips = computed(() => {
  const filteredTrips = filterTrips(
    trips.value,
    tripAssignments.value,
    searchText.value,
    tableFilters.value,
  )
  return sortTrips(filteredTrips, tripAssignments.value, sortKey.value, sortDirection.value)
})
const selectedTrips = computed(() => trips.value.filter((trip) => selectedIds.value.has(trip.id)))
const selectedTotal = computed(() => selectedTrips.value.reduce((sum, trip) => sum + trip.amount, 0))
const difference = computed(() => statementTotal.value == null ? null : selectedTotal.value - statementTotal.value)
const allVisibleSelected = computed(() => visibleTrips.value.length > 0 && visibleTrips.value.every((trip) => selectedIds.value.has(trip.id)))
const stationOptions = computed(() => getStationOptions(trips.value, defaultTravelerStations.value))
const journeyStationOptions = computed(() => [...new Set(trips.value.flatMap((trip) => {
  const route = getTripRoute(trip)
  return route ? [route.entry, route.exit] : []
}))]
  .sort((left, right) => left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' })))
const amountBounds = computed(() => {
  if (!trips.value.length) return { min: 0, max: 0 }
  const amounts = trips.value.map((trip) => trip.amount)
  return {
    min: Math.round(Math.min(...amounts) * 100),
    max: Math.round(Math.max(...amounts) * 100),
  }
})
const minimumAmountSliderValue = computed(() => tableFilters.value.minAmount === ''
  ? amountBounds.value.min
  : Math.round(Number(tableFilters.value.minAmount) * 100))
const maximumAmountSliderValue = computed(() => tableFilters.value.maxAmount === ''
  ? amountBounds.value.max
  : Math.round(Number(tableFilters.value.maxAmount) * 100))
const dateRangeLabel = computed(() => {
  const { dateFrom, dateTo } = tableFilters.value
  if (dateFrom && dateTo) return `${formatCalendarDate(dateFrom)} – ${formatCalendarDate(dateTo)}`
  if (dateFrom) return `From ${formatCalendarDate(dateFrom)}`
  if (dateTo) return `Through ${formatCalendarDate(dateTo)}`
  return 'Any date'
})
const journeyFilterLabel = computed(() => {
  const count = tableFilters.value.journey.length
  return count ? `${count} ${count === 1 ? 'station' : 'stations'} selected` : 'All stations'
})
const calendarHeading = computed(() => {
  if (!dateCalendarMonth.value) return ''
  const [year, month] = dateCalendarMonth.value.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('en-SG', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
})
const calendarDays = computed(() => {
  if (!dateCalendarMonth.value) return []
  const [year, month] = dateCalendarMonth.value.split('-').map(Number)
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay()
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const { dateFrom, dateTo } = tableFilters.value
  return [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, index) => {
      const day = index + 1
      const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      return {
        date,
        day,
        selected: date === dateFrom || date === dateTo,
        inRange: Boolean(dateFrom && dateTo && date > dateFrom && date < dateTo),
      }
    }),
  ]
})
const travelerQuickAssignRows = computed(() => travelers.value.map((traveler) => {
  const stations = travelerStations.value[traveler]
  return {
    traveler,
    stations,
    matchingTrips: getMatchingTrips(trips.value, stations),
  }
}))
const travelerSummaries = computed(() => travelers.value.map((traveler) => {
  const assignedTrips = trips.value.filter((trip) => tripAssignments.value[trip.id] === traveler)
  const assignedTotal = assignedTrips.reduce((sum, trip) => sum + trip.amount, 0)
  const enteredRefund = Number(travelerRefunds.value[traveler])
  const refund = Number.isFinite(enteredRefund) && enteredRefund > 0 ? enteredRefund : 0
  return {
    name: traveler,
    count: assignedTrips.length,
    refund,
    total: assignedTotal - refund,
  }
}))
const assignedTripCount = computed(() => trips.value.filter((trip) =>
  travelers.value.includes(tripAssignments.value[trip.id]),
).length)
const undoAssignmentLabel = computed(() => {
  const lastChange = assignmentHistory.value.at(-1)
  return lastChange ? `Undo ${lastChange.label}` : 'Undo assignment'
})
const hasActiveTableFilters = computed(() => Boolean(
  searchText.value.trim()
  || tableFilters.value.dateFrom
  || tableFilters.value.dateTo
  || tableFilters.value.journey.length
  || tableFilters.value.traveler
  || tableFilters.value.minAmount !== ''
  || tableFilters.value.maxAmount !== '',
))

function closeDropdownsOnOutsideClick(event) {
  const target = event.target
  if (!(target instanceof Node)) return
  document.querySelectorAll('details.station-picker[open], details.table-filter-dropdown[open]').forEach((dropdown) => {
    if (!dropdown.contains(target)) dropdown.open = false
  })
}

onMounted(() => {
  document.addEventListener('pointerdown', closeDropdownsOnOutsideClick)
  void loadTravelerStations()
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', closeDropdownsOnOutsideClick)
})

function stableId(base, occurrence) {
  // Details + occurrence distinguish repeated trips without relying on browser crypto support.
  return `${base}::${occurrence}`
}

async function loadTravelerStations() {
  try {
    const stationsByTraveler = await fetchTravelerStations()
    defaultTravelerStations.value = stationsByTraveler
    travelers.value = Object.keys(stationsByTraveler)
    travelerStations.value = Object.fromEntries(
      travelers.value.map((traveler) => [traveler, [...stationsByTraveler[traveler]]]),
    )
    travelerRefunds.value = Object.fromEntries(travelers.value.map((traveler) => [traveler, '']))
  } catch (error) {
    stationDefaultsError.value =
      `Could not load default traveler stations from Google Sheets. ${error?.message ?? 'Please check the sheet and reload the page.'}`
  } finally {
    stationDefaultsLoading.value = false
  }
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
  if (stationDefaultsLoading.value || stationDefaultsError.value) return
  errorMessage.value = ''
  loading.value = true
  fileName.value = file.name
  try {
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      throw new Error('Please choose a PDF file.')
    }
    const result = await parseStatement(file)
    trips.value = result.parsedTrips
    const firstTripDate = trips.value.length ? parseTripDate(trips.value[0].date) : null
    if (firstTripDate) {
      dateCalendarMonth.value = `${firstTripDate.getUTCFullYear()}-${String(firstTripDate.getUTCMonth() + 1).padStart(2, '0')}`
    }
    statementTotal.value = result.parsedTotal
    selectedIds.value = new Set()
    assignmentHistory.value = []
    travelerStations.value = Object.fromEntries(
      travelers.value.map((traveler) => [traveler, [...defaultTravelerStations.value[traveler]]]),
    )
    travelerRefunds.value = Object.fromEntries(travelers.value.map((traveler) => [traveler, '']))
    tripAssignments.value = assignTripsByTravelerStations(trips.value, travelerStations.value)
    searchText.value = ''
    clearTableFilters()
    if (!trips.value.length) {
      errorMessage.value = 'No trips were detected. Check that the PDF contains selectable text and that its trip lines match the expected format.'
    }
  } catch (error) {
    trips.value = []
    selectedIds.value = new Set()
    tripAssignments.value = {}
    assignmentHistory.value = []
    travelerRefunds.value = Object.fromEntries(travelers.value.map((traveler) => [traveler, '']))
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
function clearTableFilters() {
  searchText.value = ''
  tableFilters.value = {
    dateFrom: '',
    dateTo: '',
    journey: [],
    traveler: '',
    minAmount: '',
    maxAmount: '',
  }
}
function setMinimumAmount(value) {
  const cents = Math.min(Number(value), maximumAmountSliderValue.value)
  tableFilters.value.minAmount = cents === amountBounds.value.min ? '' : (cents / 100).toFixed(2)
}
function setMaximumAmount(value) {
  const cents = Math.max(Number(value), minimumAmountSliderValue.value)
  tableFilters.value.maxAmount = cents === amountBounds.value.max ? '' : (cents / 100).toFixed(2)
}
function changeCalendarMonth(offset) {
  if (!dateCalendarMonth.value) return
  const [year, month] = dateCalendarMonth.value.split('-').map(Number)
  const nextMonth = new Date(Date.UTC(year, month - 1 + offset, 1))
  dateCalendarMonth.value = `${nextMonth.getUTCFullYear()}-${String(nextMonth.getUTCMonth() + 1).padStart(2, '0')}`
}
function selectCalendarDate(date) {
  const { dateFrom, dateTo } = tableFilters.value
  if (!dateFrom || dateTo) {
    tableFilters.value.dateFrom = date
    tableFilters.value.dateTo = ''
  } else if (date < dateFrom) {
    tableFilters.value.dateFrom = date
    tableFilters.value.dateTo = dateFrom
  } else {
    tableFilters.value.dateTo = date
  }
}
function formatCalendarDate(value) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-SG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}
function setSort(key) {
  if (sortKey.value === key) sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
  else {
    sortKey.value = key
    sortDirection.value = 'asc'
  }
}
function sortIndicator(key) {
  return sortKey.value === key ? (sortDirection.value === 'asc' ? '↑' : '↓') : '↕'
}
function updateTripAssignments(nextAssignments, label) {
  const previousAssignments = tripAssignments.value
  const changedCount = [...new Set([
    ...Object.keys(previousAssignments),
    ...Object.keys(nextAssignments),
  ])].filter((tripId) => previousAssignments[tripId] !== nextAssignments[tripId]).length
  if (!changedCount) return

  assignmentHistory.value = [
    ...assignmentHistory.value.slice(-49),
    { assignments: previousAssignments, label: `${label} (${changedCount})` },
  ]
  tripAssignments.value = nextAssignments
}
function undoAssignment() {
  const previousChange = assignmentHistory.value.at(-1)
  if (!previousChange) return
  assignmentHistory.value = assignmentHistory.value.slice(0, -1)
  tripAssignments.value = previousChange.assignments
}
function toggleTraveler(tripId, traveler) {
  const next = { ...tripAssignments.value }
  if (next[tripId] === traveler) delete next[tripId]
  else next[tripId] = traveler
  updateTripAssignments(next, traveler)
}
function toggleStation(traveler, station) {
  const selected = new Set(travelerStations.value[traveler])
  const isSelected = selected.has(station)
  if (isSelected) selected.delete(station)
  else selected.add(station)
  travelerStations.value = {
    ...travelerStations.value,
    [traveler]: [...selected],
  }
  if (!isSelected) {
    const next = { ...tripAssignments.value }
    for (const trip of getMatchingTrips(trips.value, [...selected])) next[trip.id] = traveler
    updateTripAssignments(next, `${traveler} auto-assign`)
  }
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
        <input
          id="pdf-upload"
          ref="fileInput"
          type="file"
          accept="application/pdf,.pdf"
          :disabled="stationDefaultsLoading || Boolean(stationDefaultsError)"
          @change="onFileChange"
        />
      </label>
      <p v-if="stationDefaultsLoading" class="status-line"><span class="spinner"></span> Loading default traveler stations…</p>
      <div v-if="stationDefaultsError" class="alert" role="alert">{{ stationDefaultsError }}</div>
      <p v-if="loading" class="status-line"><span class="spinner"></span> Reading PDF and extracting trips…</p>
      <div v-if="errorMessage" class="alert" role="alert">{{ errorMessage }}</div>
      <div v-else-if="trips.length" class="success-line">✓ {{ trips.length }} trips found in {{ fileName }}</div>
    </section>

    <template v-if="trips.length">
      <section class="assignment-panel panel" aria-labelledby="traveler-summary-heading">
        <div class="section-heading">
          <div>
            <span class="step-label">TRAVELER TOTALS</span>
            <h2 id="traveler-summary-heading">Amount by person</h2>
            <p>{{ assignedTripCount }} trips assigned in total. Unassigned trips are not included.</p>
          </div>
        </div>
        <div class="traveler-summary-grid">
          <article v-for="summary in travelerSummaries" :key="summary.name" class="traveler-summary-card">
            <span class="metric-label">{{ summary.name.toUpperCase() }}</span>
            <strong>{{ money(summary.total) }}</strong>
            <span class="metric-foot">{{ summary.count }} assigned {{ summary.count === 1 ? 'trip' : 'trips' }}</span>
            <label class="refund-field">
              <span>Refund</span>
              <input
                v-model="travelerRefunds[summary.name]"
                type="number"
                min="0"
                step="0.01"
                inputmode="decimal"
                placeholder="0.00"
                :aria-label="`Refund for ${summary.name}`"
              />
            </label>
          </article>
        </div>
      </section>

      <section class="auto-assign-panel panel" aria-labelledby="auto-assign-heading">
        <div class="section-heading">
          <div>
            <span class="step-label">QUICK ASSIGN</span>
            <h2 id="auto-assign-heading">Auto-assign by entry and exit</h2>
            <p>Select one or more stations for each person. A trip matches when either endpoint contains a selected station.</p>
          </div>
        </div>
        <div class="quick-assign-rows">
          <div v-for="row in travelerQuickAssignRows" :key="row.traveler" class="quick-assign-row">
            <strong class="quick-assign-name">{{ row.traveler }}</strong>
            <details class="station-picker">
              <summary>{{ row.stations.length ? `${row.stations.length} stations selected` : 'Select stations' }}</summary>
              <div class="station-options">
                <label v-for="station in stationOptions" :key="station" class="station-option">
                  <input
                    type="checkbox"
                    :checked="row.stations.includes(station)"
                    @change="toggleStation(row.traveler, station)"
                  />
                  <span>{{ station }}</span>
                </label>
                <p v-if="!stationOptions.length" class="station-empty">No stations found in the trips.</p>
              </div>
            </details>
            <span class="quick-assign-count">{{ row.matchingTrips.length }} matching {{ row.matchingTrips.length === 1 ? 'trip' : 'trips' }}</span>
          </div>
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

        <fieldset class="table-filters">
          <legend>Filter trips</legend>
          <div class="table-filter-field">
            <span>Date range</span>
            <details class="table-filter-dropdown">
              <summary aria-label="Choose date range">{{ dateRangeLabel }}</summary>
              <div class="table-filter-menu date-range-menu">
                <div class="calendar-heading">
                  <button type="button" aria-label="Previous month" @click="changeCalendarMonth(-1)">‹</button>
                  <strong>{{ calendarHeading }}</strong>
                  <button type="button" aria-label="Next month" @click="changeCalendarMonth(1)">›</button>
                </div>
                <div class="calendar-grid" role="group" aria-label="Choose date range">
                  <span v-for="weekday in ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']" :key="weekday" class="calendar-weekday">{{ weekday }}</span>
                  <span v-for="(day, index) in calendarDays" :key="day?.date ?? `blank-${index}`" class="calendar-day-slot">
                    <button
                      v-if="day"
                      type="button"
                      class="calendar-day"
                      :class="{ selected: day.selected, 'in-range': day.inRange }"
                      :aria-pressed="day.selected"
                      :aria-label="formatCalendarDate(day.date)"
                      @click="selectCalendarDate(day.date)"
                    >{{ day.day }}</button>
                  </span>
                </div>
                <p class="calendar-hint">{{ tableFilters.dateFrom && !tableFilters.dateTo ? 'Choose an end date' : 'Choose a start date, then an end date' }}</p>
              </div>
            </details>
          </div>
          <div class="table-filter-field">
            <span>Journey contains station</span>
            <details class="table-filter-dropdown">
              <summary aria-label="Choose stations">{{ journeyFilterLabel }}</summary>
              <div class="table-filter-menu station-filter-menu">
                <label v-for="station in journeyStationOptions" :key="station" class="journey-filter-option">
                  <input v-model="tableFilters.journey" type="checkbox" :value="station" />
                  <span>{{ station }}</span>
                </label>
                <p v-if="!journeyStationOptions.length" class="station-empty">No stations found.</p>
              </div>
            </details>
          </div>
          <label class="table-filter-field">
            <span>Traveler</span>
            <select v-model="tableFilters.traveler" aria-label="Filter by traveler">
              <option value="">All travelers</option>
              <option :value="UNASSIGNED_FILTER">Unassigned</option>
              <option v-for="traveler in travelers" :key="traveler" :value="traveler">{{ traveler }}</option>
            </select>
          </label>
          <div class="table-filter-field amount-range-filter">
            <span>Amount range</span>
            <div class="amount-slider">
              <div class="amount-slider-values">
                <span>Min <strong>{{ money(minimumAmountSliderValue / 100) }}</strong></span>
                <span>Max <strong>{{ money(maximumAmountSliderValue / 100) }}</strong></span>
              </div>
              <div class="amount-slider-track">
                <input
                  type="range"
                  :min="amountBounds.min"
                  :max="amountBounds.max"
                  step="1"
                  :value="minimumAmountSliderValue"
                  aria-label="Minimum amount"
                  @input="setMinimumAmount($event.target.value)"
                />
                <input
                  type="range"
                  :min="amountBounds.min"
                  :max="amountBounds.max"
                  step="1"
                  :value="maximumAmountSliderValue"
                  aria-label="Maximum amount"
                  @input="setMaximumAmount($event.target.value)"
                />
              </div>
            </div>
          </div>
          <button
            class="button button-ghost clear-filters-button"
            :disabled="!hasActiveTableFilters"
            @click="clearTableFilters"
          >Clear filters</button>
        </fieldset>

        <div class="table-meta">
          <span>Showing <strong>{{ visibleTrips.length }}</strong> of {{ trips.length }} trips<span v-if="hasActiveTableFilters"> after filtering</span></span>
          <span>{{ selectedTrips.length }} selected</span>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th class="tick-heading">Tick</th>
                <th :aria-sort="sortKey === 'date' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'">
                  <button class="table-sort-button" @click="setSort('date')">Date <span aria-hidden="true">{{ sortIndicator('date') }}</span></button>
                </th>
                <th class="day-type-heading" :aria-sort="sortKey === 'day' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'">
                  <button class="table-sort-button" @click="setSort('day')">Day <span aria-hidden="true">{{ sortIndicator('day') }}</span></button>
                </th>
                <th :aria-sort="sortKey === 'journey' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'">
                  <button class="table-sort-button" @click="setSort('journey')">Journey <span aria-hidden="true">{{ sortIndicator('journey') }}</span></button>
                </th>
                <th :aria-sort="sortKey === 'person' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'">
                  <button class="table-sort-button" @click="setSort('person')">Person <span aria-hidden="true">{{ sortIndicator('person') }}</span></button>
                </th>
                <th class="amount-heading" :aria-sort="sortKey === 'amount' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'">
                  <button class="table-sort-button" @click="setSort('amount')">Amount <span aria-hidden="true">{{ sortIndicator('amount') }}</span></button>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="trip in visibleTrips" :key="trip.id" :class="{ 'row-selected': selectedIds.has(trip.id) }">
                <td class="tick-cell">
                  <button class="tick-button" :class="{ checked: selectedIds.has(trip.id) }" :aria-pressed="selectedIds.has(trip.id)" :aria-label="selectedIds.has(trip.id) ? 'Exclude this trip' : 'Include this trip'" :title="selectedIds.has(trip.id) ? 'Click to exclude this trip' : 'Click to include this trip'" @click="toggleTrip(trip.id)">{{ selectedIds.has(trip.id) ? '✓' : '' }}</button>
                </td>
                <td class="date-cell">{{ trip.date }}</td>
                <td class="day-type-cell">
                  <span
                    v-if="getTripDayType(trip.date)"
                    class="day-type-icon"
                    :class="`day-type-${getTripDayType(trip.date)}`"
                    :aria-label="getTripDayType(trip.date)"
                    :title="getTripDayType(trip.date) === 'weekend' ? 'Weekend' : 'Weekday'"
                    role="img"
                  >{{ getTripDayType(trip.date) === 'weekend' ? '🌴' : '🏢' }}</span>
                  <span v-else aria-label="Day type unknown" title="Day type unknown">—</span>
                </td>
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
              <tr v-if="!visibleTrips.length"><td colspan="6" class="empty-state">No trips match your search.</td></tr>
            </tbody>
          </table>
        </div>

        <div v-if="difference !== null" class="comparison" :class="{ matched: Math.abs(difference) < 0.01 }">
          <span v-if="Math.abs(difference) < 0.01">✓ Selected total matches the statement total.</span>
          <span v-else>Selected total minus statement total: <strong>{{ difference > 0 ? '+' : '−' }}{{ money(Math.abs(difference)) }}</strong></span>
        </div>
      </section>

      <section class="summary-grid" aria-label="Trip totals">
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
        <article class="metric-card">
          <span class="metric-label">SELECTED TRIPS</span>
          <strong>{{ selectedTrips.length }}</strong>
          <span class="metric-foot">of {{ trips.length }} trips</span>
        </article>
      </section>
    </template>
    <footer>SimplyGo Trip Selector <span>·</span> Your PDF is processed in this browser and is not uploaded to a server.</footer>
    <button
      v-if="assignmentHistory.length"
      class="floating-undo-button"
      type="button"
      :aria-label="undoAssignmentLabel"
      :title="undoAssignmentLabel"
      @click="undoAssignment"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
        <path d="M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
      </svg>
    </button>
  </main>
</template>
