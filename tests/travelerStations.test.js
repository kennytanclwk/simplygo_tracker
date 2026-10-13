import test from 'node:test'
import assert from 'node:assert/strict'
import { parseTravelerStationsCsv } from '../src/travelerStations.js'

test('parses travelers and their comma-separated default locations', () => {
  assert.deepEqual(parseTravelerStationsCsv([
    'Person,Default Locations',
    'Kenny,"Lorong Chuan, Kangkar, Blk 111"',
    'Chiew,"Opp W\'lands Auto Hub, Blk 872"',
  ].join('\r\n')), {
    Kenny: ['Lorong Chuan', 'Kangkar', 'Blk 111'],
    Chiew: ["Opp W'lands Auto Hub", 'Blk 872'],
  })
})

test('rejects an unexpected spreadsheet layout', () => {
  assert.throws(
    () => parseTravelerStationsCsv('Name,Stations\nKenny,Lorong Chuan'),
    /must have Person and Default Locations columns/,
  )
})

test('rejects duplicate traveler rows', () => {
  assert.throws(
    () => parseTravelerStationsCsv('Person,Default Locations\nKenny,One\nKenny,Two'),
    /more than one row for Kenny/,
  )
})
