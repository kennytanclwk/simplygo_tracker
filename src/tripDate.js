const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

export function parseTripDate(value) {
  const match = value.match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/)
  if (!match) return null

  const month = MONTHS.indexOf(match[2].toLowerCase())
  const day = Number(match[1])
  const year = Number(match[3])
  if (month < 0) return null

  const date = new Date(Date.UTC(year, month, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month || date.getUTCDate() !== day) {
    return null
  }
  return date
}

export function getTripDayType(value) {
  const date = parseTripDate(value)
  if (!date) return null
  const day = date.getUTCDay()
  return day === 0 || day === 6 ? 'weekend' : 'weekday'
}
