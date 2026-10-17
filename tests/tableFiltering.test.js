import test from 'node:test'
import assert from 'node:assert/strict'
import { filterTrips, UNASSIGNED_FILTER } from '../src/tableFiltering.js'

const trips = [
  { id: 'kenny', date: '10 Oct 2026', journey: 'Kovan - Hougang', amount: 1.2 },
  { id: 'unassigned', date: '01 Oct 2026', journey: 'Bishan - Kovan', amount: 0.9 },
  { id: 'dexter', date: '05 Oct 2026', journey: 'Hougang - Kovan', amount: 1.5 },
  { id: 'chiew', date: '15 Sep 2026', journey: 'Woodlands - Marsiling', amount: 2.1 },
]
const assignments = { kenny: 'Kenny', dexter: 'Dexter', chiew: 'Chiew' }
const emptyFilters = {
  dateFrom: '',
  dateTo: '',
  journey: [],
  traveler: '',
  minAmount: '',
  maxAmount: '',
  dayType: '',
}

test('filters dates inclusively by a from and to range', () => {
  assert.deepEqual(
    filterTrips(trips, assignments, '', {
      ...emptyFilters,
      dateFrom: '2026-10-01',
      dateTo: '2026-10-05',
    }).map((trip) => trip.id),
    ['unassigned', 'dexter'],
  )
})

test('filters by station within journeys, assigned traveler, and unassigned trips', () => {
  assert.deepEqual(
    filterTrips(trips, assignments, '', {
      ...emptyFilters,
      journey: ['Hougang'],
      traveler: 'Dexter',
    }).map((trip) => trip.id),
    ['dexter'],
  )
  assert.deepEqual(
    filterTrips(trips, assignments, '', {
      ...emptyFilters,
      journey: ['Kovan', 'Woodlands'],
    }).map((trip) => trip.id),
    ['kenny', 'unassigned', 'dexter', 'chiew'],
  )
  assert.deepEqual(
    filterTrips(trips, assignments, '', {
      ...emptyFilters,
      journey: ['Hougang', 'Kovan'],
    }).map((trip) => trip.id),
    ['kenny', 'unassigned', 'dexter'],
  )
  assert.deepEqual(
    filterTrips(trips, assignments, '', {
      ...emptyFilters,
      traveler: UNASSIGNED_FILTER,
    }).map((trip) => trip.id),
    ['unassigned'],
  )
})

test('filters amounts inclusively and combines filters with the global search', () => {
  assert.deepEqual(
    filterTrips(trips, assignments, 'kovan', {
      ...emptyFilters,
      minAmount: '0.9',
      maxAmount: '1.2',
    }).map((trip) => trip.id),
    ['kenny', 'unassigned'],
  )
})

test('excludes unparseable dates when a date range is active', () => {
  const rows = [{ id: 'unknown', date: 'Unknown', journey: 'Kovan - Hougang', amount: 1 }]
  assert.deepEqual(
    filterTrips(rows, {}, '', { ...emptyFilters, dateFrom: '2026-10-01' }),
    [],
  )
})

test('filters trips by weekday and weekend', () => {
  assert.deepEqual(
    filterTrips(trips, assignments, '', {
      ...emptyFilters,
      dayType: 'weekend',
    }).map((trip) => trip.id),
    ['kenny'],
  )
  assert.deepEqual(
    filterTrips(trips, assignments, '', {
      ...emptyFilters,
      dayType: 'weekday',
    }).map((trip) => trip.id),
    ['unassigned', 'dexter', 'chiew'],
  )
})
