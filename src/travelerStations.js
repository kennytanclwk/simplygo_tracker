export const TRAVELER_STATIONS_CSV_URL =
  'https://docs.google.com/spreadsheets/d/1kiE-pFOESP6R-bR0C4qEcTITIcWPX6doFJxpLIswees/export?format=csv&gid=0'

function parseCsvRows(csv) {
  const rows = []
  let row = []
  let field = ''
  let insideQuotes = false

  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index]
    if (insideQuotes) {
      if (character === '"' && csv[index + 1] === '"') {
        field += '"'
        index += 1
      } else if (character === '"') {
        insideQuotes = false
      } else {
        field += character
      }
    } else if (character === '"' && field === '') {
      insideQuotes = true
    } else if (character === ',') {
      row.push(field)
      field = ''
    } else if (character === '\r' || character === '\n') {
      row.push(field)
      if (row.some((value) => value.trim())) rows.push(row)
      row = []
      field = ''
      if (character === '\r' && csv[index + 1] === '\n') index += 1
    } else {
      field += character
    }
  }

  if (insideQuotes) throw new Error('The traveler stations CSV contains an unclosed quoted field.')
  row.push(field)
  if (row.some((value) => value.trim())) rows.push(row)
  return rows
}

export function parseTravelerStationsCsv(csv) {
  const rows = parseCsvRows(csv)
  if (!rows.length) throw new Error('The traveler stations spreadsheet is empty.')

  const headers = rows[0].map((value) => value.trim().toLowerCase())
  const travelerColumn = headers.indexOf('person')
  const stationsColumn = headers.indexOf('default locations')
  if (travelerColumn < 0 || stationsColumn < 0) {
    throw new Error('The traveler stations spreadsheet must have Person and Default Locations columns.')
  }

  const stationsByTraveler = {}
  for (const row of rows.slice(1)) {
    const traveler = row[travelerColumn]?.trim()
    const locations = row[stationsColumn]?.trim()
    if (!traveler && !locations) continue
    if (!traveler || !locations) {
      throw new Error('Every traveler row must include a person and at least one default location.')
    }
    if (Object.hasOwn(stationsByTraveler, traveler)) {
      throw new Error(`The traveler stations spreadsheet has more than one row for ${traveler}.`)
    }

    const stations = locations.split(',').map((station) => station.trim()).filter(Boolean)
    if (!stations.length) {
      throw new Error(`${traveler} must have at least one default location in the spreadsheet.`)
    }
    stationsByTraveler[traveler] = stations
  }

  if (!Object.keys(stationsByTraveler).length) {
    throw new Error('The traveler stations spreadsheet does not contain any travelers.')
  }
  return stationsByTraveler
}

export async function fetchTravelerStations() {
  const response = await fetch(TRAVELER_STATIONS_CSV_URL, { cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`Google Sheets returned HTTP ${response.status}.`)
  }
  return parseTravelerStationsCsv(await response.text())
}
