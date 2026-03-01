const VALID_COLLECTIONS = ['maps', 'sectors'] as const
type Collection = (typeof VALID_COLLECTIONS)[number]

interface MapEntry {
  id: string
  width: number
  height: number
}

interface SectorEntry {
  id: string
}

type IndexEntry = MapEntry | SectorEntry

export default defineEventHandler(async (event) => {
  const collection = getRouterParam(event, 'collection') as Collection

  if (!VALID_COLLECTIONS.includes(collection)) {
    throw createError({ statusCode: 404, message: 'Not found' })
  }

  // Per-entry keys: `${collection}:${id}` → IndexEntry
  const keys = await kv.keys(`${collection}:`)
  const entries = (await Promise.all(keys.map(k => kv.get<IndexEntry>(k)))).filter(Boolean) as IndexEntry[]

  // Content-based ETag for conditional request support (no-cache so clients always revalidate,
  // but get a fast 304 when nothing has changed)
  const body = JSON.stringify(entries)
  const hashBuffer = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(body))
  const etag = `"${Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')}"`

  if (getHeader(event, 'if-none-match') === etag) {
    setResponseStatus(event, 304)
    return null
  }

  setHeader(event, 'ETag', etag)
  setHeader(event, 'Cache-Control', 'no-cache')
  setHeader(event, 'Content-Type', 'application/json')

  return body
})
