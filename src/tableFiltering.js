export const UNASSIGNED_FILTER = '__unassigned__'
import { getTripDayType, parseTripDate } from './tripDate.js'

export function filterTrips(trips, assignments, searchText, filters) {
  const query = searchText.trim().toLowerCase()
  const selectedStations = new Set(filters.journey)
  const hasDateBounds = Boolean(filters.dateFrom || filters.dateTo)
  const minimumAmount = filters.minAmount === '' ? null : Number(filters.minAmount)
  const maximumAmount = filters.maxAmount === '' ? null : Number(filters.maxAmount)

  return trips.filter((trip) => {
    const parsedDate = parseTripDate(trip.date)
    const date = parsedDate?.toISOString().slice(0, 10) ?? null
    if (filters.dateFrom && (!date || date < filters.dateFrom)) return false
    if (filters.dateTo && (!date || date > filters.dateTo)) return false
    if (hasDateBounds && !date) return false
    if (filters.dayType && getTripDayType(trip.date) !== filters.dayType) return false

    const journey = trip.journey.toLowerCase()
    if (selectedStations.size && ![...selectedStations].some((station) =>
      journey.includes(station.toLowerCase()),
    )) return false
    if (query && !trip.date.toLowerCase().includes(query) && !journey.includes(query)) return false

    if (filters.traveler === UNASSIGNED_FILTER && assignments[trip.id]) return false
    if (filters.traveler && filters.traveler !== UNASSIGNED_FILTER && assignments[trip.id] !== filters.traveler) {
      return false
    }

    if (filters.minAmount !== '' && (!Number.isFinite(minimumAmount) || trip.amount < minimumAmount)) {
      return false
    }
    if (filters.maxAmount !== '' && (!Number.isFinite(maximumAmount) || trip.amount > maximumAmount)) {
      return false
    }
    return true
  })
}
