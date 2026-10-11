import test from 'node:test'
import assert from 'node:assert/strict'
import { sortTrips } from '../src/tableSorting.js'

const trips = [
  { id: 'kenny', date: '10 Oct 2026', journey: 'Kovan - Hougang', amount: 1.2 },
  { id: 'unassigned', date: '01 Oct 2026', journey: 'Bishan - Kovan', amount: 0.9 },
  { id: 'dexter', date: '05 Oct 2026', journey: 'Hougang - Kovan', amount: 1.5 },
]
const assignments = { kenny: 'Kenny', dexter: 'Dexter' }

test('defaults person ordering with unassigned trips at the top', () => {
  assert.deepEqual(sortTrips(trips, assignments, 'person', 'asc').map((trip) => trip.id), [
    'unassigned',
    'dexter',
    'kenny',
  ])
})

test('keeps unassigned trips at the top when person is sorted descending', () => {
  assert.deepEqual(sortTrips(trips, assignments, 'person', 'desc').map((trip) => trip.id), [
    'unassigned',
    'kenny',
    'dexter',
  ])
})

test('sorts dates chronologically and amounts numerically', () => {
  assert.deepEqual(sortTrips(trips, assignments, 'date', 'asc').map((trip) => trip.id), [
    'unassigned',
    'dexter',
    'kenny',
  ])
  assert.deepEqual(sortTrips(trips, assignments, 'amount', 'desc').map((trip) => trip.id), [
    'dexter',
    'kenny',
    'unassigned',
  ])
})
