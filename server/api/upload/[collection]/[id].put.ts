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

const ROOM_KEY_RE = /^([WE])(\d+)([NS])(\d+)$/

function extractDimensions(data: Record<string, unknown>): { width: number; height: number } {
  // Use top-level width/height if present in the file
  if (data.width !== undefined && data.height !== undefined) {
    const w = Number(data.width)
    const h = Number(data.height)
    if (w > 0 && h > 0) return { width: w, height: h }
  }

  // Fall back to calculating from room names in .rooms[].room
  const rooms = Array.isArray(data.rooms)
    ? (data.rooms as Record<string, unknown>[]).map(r => r.room).filter(Boolean)
    : Object.keys(data)

  let maxW = -1, maxE = -1, maxN = -1, maxS = -1

  for (const key of rooms) {
    const m = ROOM_KEY_RE.exec(String(key))
    if (!m) continue
    const n = parseInt(m[2], 10)
    const s = parseInt(m[4], 10)
    if (m[1] === 'W') maxW = Math.max(maxW, n)
    else maxE = Math.max(maxE, n)
    if (m[3] === 'N') maxN = Math.max(maxN, s)
    else maxS = Math.max(maxS, s)
  }

  if (maxW === -1 && maxE === -1) return { width: 0, height: 0 }

  const totalEW = (maxW >= 0 ? maxW + 1 : 0) + (maxE >= 0 ? maxE + 1 : 0)
  const totalNS = (maxN >= 0 ? maxN + 1 : 0) + (maxS >= 0 ? maxS + 1 : 0)

  return {
    width: Math.floor(totalEW / 10),
    height: Math.floor(totalNS / 10),
  }
}

export default defineEventHandler(async (event) => {
  const collection = getRouterParam(event, 'collection') as Collection
  const id = getRouterParam(event, 'id')

  if (!VALID_COLLECTIONS.includes(collection)) {
    throw createError({ statusCode: 400, message: 'Invalid collection' })
  }

  if (!id) {
    throw createError({ statusCode: 400, message: 'Missing id' })
  }

  // Auth check
  const auth = getHeader(event, 'authorization')
  const token = useRuntimeConfig().uploadToken
  if (!auth || auth !== `Bearer ${token}`) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  // Read and parse JSON body
  const body = await readBody<Record<string, unknown>>(event)
  if (typeof body !== 'object' || body === null) {
    throw createError({ statusCode: 400, message: 'Invalid JSON body' })
  }

  const blobKey = `${collection}/${id}.json`
  const bodyStr = JSON.stringify(body)

  // Store file in R2
  await blob.put(blobKey, bodyStr, { contentType: 'application/json' })

  // Build index entry
  let entry: IndexEntry
  if (collection === 'maps') {
    const { width, height } = extractDimensions(body)
    entry = { id, width, height } as MapEntry
  } else {
    entry = { id } as SectorEntry
  }

  // Read current KV index, upsert entry, write back
  const kvKey = `index:${collection}`
  const current = await kv.get<IndexEntry[]>(kvKey) ?? []
  const filtered = current.filter((e) => e.id !== id)
  filtered.push(entry)
  await kv.set(kvKey, filtered)

  return { ok: true, id }
})
