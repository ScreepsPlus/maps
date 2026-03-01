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

// Fields deleted from controllers (player-state, not map-state)
const CONTROLLER_CLEAR = ['user', 'autoSpawn', 'progress', 'safeMode', 'safeModeAvailable', 'safeModeCooldown', 'downgradeTime', 'isPowerEnabled']

function sanitize(data: Record<string, unknown>): void {
  if (!Array.isArray(data.rooms)) return
  for (const room of data.rooms as Record<string, unknown>[]) {
    // Rooms whose terrain is entirely walls are out of bounds
    if (typeof room.terrain === 'string' && /^1+$/.test(room.terrain)) {
      room.status = 'out of borders'
    }
    if (!Array.isArray(room.objects)) continue
    // Pass 1: strip player-state fields from controllers (keep the object)
    for (const obj of room.objects as Record<string, unknown>[]) {
      if (obj.type === 'controller') {
        for (const f of CONTROLLER_CLEAR) delete obj[f]
        obj.level = 0
      }
    }
    // Pass 2: drop all remaining objects that are owned by a player
    room.objects = (room.objects as Record<string, unknown>[]).filter(obj => !('user' in obj))
  }
}

async function gzipText(text: string): Promise<Uint8Array> {
  const stream = new ReadableStream({
    start(c) { c.enqueue(new TextEncoder().encode(text)); c.close() },
  }).pipeThrough(new CompressionStream('gzip'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

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

  const blobKey = `${collection}/${id}.json`

  // Parse body — accept gzip-encoded uploads for large files
  let body: Record<string, unknown>

  if (getHeader(event, 'content-encoding') === 'gzip') {
    const rawBody = await readRawBody(event, false)
    if (!rawBody || rawBody.length === 0) {
      throw createError({ statusCode: 400, message: 'Empty body' })
    }
    const rawBytes = rawBody instanceof Buffer
      ? new Uint8Array(rawBody.buffer, rawBody.byteOffset, rawBody.byteLength)
      : new Uint8Array(rawBody as ArrayBuffer)
    const text = await new Response(
      new ReadableStream({
        start(c) { c.enqueue(rawBytes); c.close() },
      }).pipeThrough(new DecompressionStream('gzip'))
    ).text()
    body = JSON.parse(text)
  } else {
    body = await readBody<Record<string, unknown>>(event)
    if (typeof body !== 'object' || body === null) {
      throw createError({ statusCode: 400, message: 'Invalid JSON body' })
    }
  }

  // Sanitize then store compressed
  sanitize(body)
  const compressed = await gzipText(JSON.stringify(body))
  await blob.put(blobKey, compressed, {
    contentType: 'application/json',
    customMetadata: { contentEncoding: 'gzip' },
  })

  // Build index entry
  let entry: IndexEntry
  if (collection === 'maps') {
    const { width, height } = extractDimensions(body)
    entry = { id, width, height } as MapEntry
  } else {
    entry = { id } as SectorEntry
  }

  // Write per-entry KV key (atomic single write, no read-modify-write race)
  await kv.set(`${collection}:${id}`, entry)

  return { ok: true, id }
})
