const VALID_COLLECTIONS = ['maps', 'sectors'] as const
type Collection = (typeof VALID_COLLECTIONS)[number]

export default defineEventHandler(async (event) => {
  const collection = getRouterParam(event, 'collection') as Collection

  if (!VALID_COLLECTIONS.includes(collection)) {
    throw createError({ statusCode: 404, message: 'Not found' })
  }

  let path = getRouterParam(event, 'path') ?? ''

  // Strip .gz suffix for legacy URL backward compat
  if (path.endsWith('.gz')) {
    path = path.slice(0, -3)
  }

  // Strip collection-singular prefix for legacy URLs (e.g. map-<id>.json → <id>.json)
  const prefix = collection.replace(/s$/, '') + '-'
  if (path.startsWith(prefix)) {
    path = path.slice(prefix.length)
  }

  setHeader(event, 'Cache-Control', 'public, max-age=3600, must-revalidate')

  return blob.serve(event, `${collection}/${path}`)
})
