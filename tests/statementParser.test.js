import test from 'node:test'
import assert from 'node:assert/strict'
import { parseStatementText } from '../src/statementParser.js'

test('parses SimplyGo statement blocks in the real PDF layout', () => {
  const lines = [
    'Date Journey Charges',
    '31 Aug 2026',
    '(Mon)',
    'Lorong Chuan - Opp Blk 110',
    '06:57 PM Train Lorong Chuan - Hougang $ 1.38',
    '07:25 PM Bus 80 Blk 522 - Opp Blk 110 $ 0.21',
    '$ 1.59',
    '31 Aug 2026',
    '(Mon)',
    'Blk 111 - Lorong Chuan',
    '08:49 AM Bus 82 Blk 111 - Hougang Stn Exit C $ 1.28',
    '08:59 AM Bus 80 Hougang Stn Exit C - Opp Hougang Ctrl Int $ 0.00',
    '09:05 AM Train Hougang - Lorong Chuan $ 0.00',
    '$ 1.28',
    'Total: $ 83.59',
  ]

  const result = parseStatementText(lines)

  assert.deepEqual(result.parsedTrips.map((trip) => ({
    date: trip.date,
    journey: trip.journey,
    amount: trip.amount,
  })), [
    {
      date: '31 Aug 2026',
      journey: 'Lorong Chuan - Opp Blk 110',
      amount: 1.59,
    },
    {
      date: '31 Aug 2026',
      journey: 'Blk 111 - Lorong Chuan',
      amount: 1.28,
    },
  ])
  assert.equal(result.parsedTotal, 83.59)
})
