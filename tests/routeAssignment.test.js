import test from 'node:test'
import assert from 'node:assert/strict'
import {
  assignTripsByTravelerStations,
  getMatchingTrips,
  getStationOptions,
} from '../src/routeAssignment.js'

const trips = [
  { id: '1', journey: 'Lorong Chuan - Hougang' },
  { id: '2', journey: 'Hougang - Kovan' },
  { id: '3', journey: 'Ang Mo Kio - Bishan' },
]

test('lists distinct stations from both trip endpoints', () => {
  const stations = getStationOptions(trips, {
    Kenny: ['Lorong Chuan'],
    Dexter: ['Woodlands TEL', 'Opp Fairfield Meth Pr Sch'],
  })
  assert.ok(stations.includes('Lorong Chuan'))
  assert.ok(stations.includes('Woodlands TEL'))
  assert.ok(stations.includes('Opp Fairfield Meth Pr Sch'))
  for (const station of ['Ang Mo Kio', 'Bishan', 'Hougang', 'Kovan']) {
    assert.ok(stations.includes(station))
  }
  assert.equal(new Set(stations).size, stations.length)
})

test('matches trips when either endpoint contains any selected station', () => {
  assert.deepEqual(
    getMatchingTrips(trips, ['Chuan', 'Kovan']).map((trip) => trip.id),
    ['1', '2'],
  )
})

test('does not match trips without selected stations or route endpoints', () => {
  assert.deepEqual(getMatchingTrips(trips, []), [])
  assert.deepEqual(getMatchingTrips([{ id: '4', journey: 'Unparsed trip' }], ['Hougang']), [])
})

test('assigns trips from the traveler stations supplied by the spreadsheet', () => {
  assert.deepEqual(assignTripsByTravelerStations(trips, {
    Kenny: ['Lorong Chuan'],
    Dexter: ['Hougang'],
    Chiew: [],
  }), { 1: 'Dexter', 2: 'Dexter' })
})
