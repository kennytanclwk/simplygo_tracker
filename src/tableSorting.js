const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

function compareDates(left, right) {
  const parseDate = (value) => {
    const match = value.match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/)
    if (!match) return null
    const month = MONTHS.indexOf(match[2].toLowerCase())
    if (month < 0) return null
    return new Date(Number(match[3]), month, Number(match[1])).getTime()
  }
  const leftDate = parseDate(left)
  const rightDate = parseDate(right)
  if (leftDate !== null && rightDate !== null) return leftDate - rightDate
  return left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' })
}

function compareValues(left, right, sortKey) {
  if (sortKey === 'amount') return left.amount - right.amount
  if (sortKey === 'date') return compareDates(left.date, right.date)
  const leftValue = sortKey === 'person' ? left.person : left.journey
  const rightValue = sortKey === 'person' ? right.person : right.journey
  return leftValue.localeCompare(rightValue, undefined, { numeric: true, sensitivity: 'base' })
}

export function sortTrips(trips, assignments, sortKey, direction) {
  const sortDirection = direction === 'desc' ? -1 : 1
  return trips
    .map((trip, index) => ({
      trip,
      index,
      person: assignments[trip.id] ?? '',
    }))
    .sort((left, right) => {
      if (sortKey === 'person') {
        const leftUnassigned = !left.person
        const rightUnassigned = !right.person
        if (leftUnassigned !== rightUnassigned) return leftUnassigned ? -1 : 1
      }
      return sortDirection * compareValues(
        { ...left.trip, person: left.person },
        { ...right.trip, person: right.person },
        sortKey,
      ) || left.index - right.index
    })
    .map(({ trip }) => trip)
}
