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

  const entries = await kv.get<IndexEntry[]>(`index:${collection}`) ?? []

  setHeader(event, 'Cache-Control', 'public, max-age=60, stale-while-revalidate=3600')
  setHeader(event, 'Content-Type', 'application/json')

  return entries
})
