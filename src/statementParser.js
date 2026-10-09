const DATE_RE = /^\d{1,2}\s+[A-Za-z]{3}\s+\d{4}$/
const TOTAL_RE = /^Total\s*:??\s*\$\s*([0-9]+\.[0-9]{2})$/i
const AMOUNT_LINE_RE = /^\$\s*([0-9]+\.[0-9]{2})$/
const DAY_RE = /^\([A-Za-z]{3}\)$/
const TIME_RE = /^\d{1,2}:\d{2}\s(?:AM|PM)\b/i
const HEADER_RE = /^Date\s+Journey\s+Charges$/i

export function parseStatementText(lines) {
  const parsedTrips = []
  const occurrenceCounts = new Map()
  let parsedTotal = null

  for (let i = 0; i < lines.length; i += 1) {
    const rawLine = String(lines[i] ?? '').replace(/\s+/g, ' ').trim()
    if (!rawLine) continue

    if (TOTAL_RE.test(rawLine)) {
      parsedTotal = Number(rawLine.match(TOTAL_RE)[1])
      continue
    }

    if (!DATE_RE.test(rawLine)) continue

    const date = rawLine
    let journey = ''
    let amount = null

    let j = i + 1
    while (j < lines.length) {
      const candidate = String(lines[j] ?? '').replace(/\s+/g, ' ').trim()
      if (!candidate) {
        j += 1
        continue
      }

      if (DATE_RE.test(candidate) || TOTAL_RE.test(candidate)) break
      if (
        HEADER_RE.test(candidate)
        || DAY_RE.test(candidate)
        || candidate.startsWith('STATEMENT GENERATED ON')
        || candidate.startsWith('PAGE ')
      ) {
        j += 1
        continue
      }

      if (AMOUNT_LINE_RE.test(candidate)) {
        const match = candidate.match(AMOUNT_LINE_RE)
        amount = Number(match[1])
        j += 1
        continue
      }

      if (TIME_RE.test(candidate) || /^(?:Train|Bus|MRT|Taxi|LRT|Walking)\b/i.test(candidate)) {
        j += 1
        continue
      }

      if (!journey) journey = candidate
      j += 1
    }

    if (journey && amount !== null) {
      const base = `${date}|${journey}|${amount.toFixed(2)}`
      const occurrence = (occurrenceCounts.get(base) ?? 0) + 1
      occurrenceCounts.set(base, occurrence)
      parsedTrips.push({
        id: `${base}::${occurrence}`,
        date,
        journey,
        amount,
      })
    }

    i = j - 1
  }

  return { parsedTrips, parsedTotal }
}
