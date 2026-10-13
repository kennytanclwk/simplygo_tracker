export function getTripRoute(trip) {
  const separator = trip.journey.indexOf(' - ')
  if (separator < 0) return null
  return {
    entry: trip.journey.slice(0, separator).trim(),
    exit: trip.journey.slice(separator + 3).trim(),
  }
}

export function getStationOptions(trips, defaultStationsByTraveler = {}) {
  const stations = new Set()
  for (const trip of trips) {
    const route = getTripRoute(trip)
    if (!route) continue
    stations.add(route.entry)
    stations.add(route.exit)
  }
  for (const defaultStations of Object.values(defaultStationsByTraveler)) {
    for (const station of defaultStations) stations.add(station)
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
