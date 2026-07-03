const SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText'

// Only ask Google for the fields we actually show — keeps each call on the
// cheaper "Text Search Pro" SKU field set instead of the "Enterprise" tier.
const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.internationalPhoneNumber',
  'places.nationalPhoneNumber',
  'places.websiteUri',
  'places.rating',
  'places.userRatingCount',
  'places.googleMapsUri',
  'nextPageToken',
].join(',')

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Runs one Text Search query, following nextPageToken until either the page
 * cap (3 pages / 60 results) is hit or `stopSignal()` returns true.
 */
async function searchOneQuery({ apiKey, textQuery, stopSignal, onPage }) {
  const results = []
  let pageToken = undefined

  for (let page = 0; page < 3; page++) {
    if (stopSignal()) break

    const body = { textQuery, pageSize: 20 }
    if (pageToken) body.pageToken = pageToken

    const res = await fetch(SEARCH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': FIELD_MASK,
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      let message = `Request failed (HTTP ${res.status})`
      try {
        const errJson = await res.json()
        if (errJson?.error?.message) message = errJson.error.message
      } catch {
        // ignore parse failure, keep default message
      }
      const err = new Error(message)
      err.status = res.status
      throw err
    }

    const data = await res.json()
    const places = data.places || []
    results.push(...places)
    onPage?.(places.length, textQuery)

    if (!data.nextPageToken || places.length === 0) break
    pageToken = data.nextPageToken

    // Google's nextPageToken is not valid instantly — a short wait avoids
    // an INVALID_ARGUMENT error on the very next request.
    await sleep(2100)
  }

  return results
}

function mapPlace(place) {
  return {
    name: place.displayName?.text || '',
    address: place.formattedAddress || '',
    phone: place.internationalPhoneNumber || place.nationalPhoneNumber || '',
    website: place.websiteUri || '',
    rating: place.rating ?? '',
    reviewCount: place.userRatingCount ?? '',
    mapsUrl: place.googleMapsUri || '',
    id: place.id,
  }
}

/**
 * Searches `keyword` across a list of locations (e.g. Tamil Nadu districts),
 * deduplicating by place id, until `desiredCount` unique places are found or
 * the location list is exhausted. Reports progress via callbacks so the UI
 * can show a live log and a stop button can interrupt mid-run.
 */
export async function collectInstitutes({
  apiKey,
  keyword,
  locations,
  desiredCount,
  stopSignal,
  onProgress,
}) {
  const seen = new Map()

  for (const location of locations) {
    if (stopSignal()) break
    if (seen.size >= desiredCount) break

    const textQuery = `${keyword}`
    onProgress?.({ type: 'searching', location, collected: seen.size })

    try {
      const places = await searchOneQuery({
        apiKey,
        textQuery,
        stopSignal,
        onPage: (count) =>
          onProgress?.({ type: 'page', location, count, collected: seen.size }),
      })

      for (const place of places) {
        if (!seen.has(place.id)) {
          seen.set(place.id, mapPlace(place))
        }
      }

      onProgress?.({ type: 'done-location', location, collected: seen.size })
    } catch (err) {
      onProgress?.({ type: 'error', location, message: err.message, status: err.status })
      // Invalid/blocked key or exhausted quota — no point continuing.
      if (err.status === 403 || err.status === 429) throw err
    }

    // Small pacing gap between locations to stay well under QPS limits.
    await sleep(300)
  }

  return Array.from(seen.values()).slice(0, desiredCount)
}
