export const DEFAULT_TRAVELER_STATIONS = {
  Kenny: ['Lorong Chuan', 'Kangkar', 'Blk 111', 'Opp Blk 110'],
  Dexter: ['Woodlands TEL', 'one-north', 'Fairfield Meth Pr Sch', 'Opp Fairfield Meth Pr Sch'],
  Chiew: ["Opp W'lands Auto Hub", "Bef W'Lands Ind Pk E4"],
}

export function getTripRoute(trip) {
  const separator = trip.journey.indexOf(' - ')
  if (separator < 0) return null
  return {
    entry: trip.journey.slice(0, separator).trim(),
    exit: trip.journey.slice(separator + 3).trim(),
  }
}

export function getStationOptions(trips) {
  const stations = new Set()
  for (const trip of trips) {
    const route = getTripRoute(trip)
    if (!route) continue
    stations.add(route.entry)
    stations.add(route.exit)
  }
  for (const selectedStations of Object.values(DEFAULT_TRAVELER_STATIONS)) {
    for (const station of selectedStations) stations.add(station)
  }
  return [...stations].sort()
}

export function matchesSelectedStations(trip, stations) {
  if (!stations.length) return false
  const route = getTripRoute(trip)
  if (!route) return false
  return stations.some((station) => route.entry.includes(station) || route.exit.includes(station))
}

export function getMatchingTrips(trips, stations) {
  return trips.filter((trip) => matchesSelectedStations(trip, stations))
}

export function assignTripsByTravelerStations(trips, stationsByTraveler) {
  const assignments = {}
  for (const [traveler, stations] of Object.entries(stationsByTraveler)) {
    for (const trip of getMatchingTrips(trips, stations)) assignments[trip.id] = traveler
  }
  return assignments
}
