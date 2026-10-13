import test from 'node:test'
import assert from 'node:assert/strict'
import { getTripDayType, parseTripDate } from '../src/tripDate.js'

test('classifies weekdays and weekends from trip dates', () => {
  assert.equal(getTripDayType('12 Oct 2026'), 'weekday')
  assert.equal(getTripDayType('10 Oct 2026'), 'weekend')
  assert.equal(getTripDayType('11 Oct 2026'), 'weekend')
})

test('rejects invalid trip dates', () => {
  assert.equal(parseTripDate('31 Feb 2026'), null)
  assert.equal(getTripDayType('Unknown'), null)
})
