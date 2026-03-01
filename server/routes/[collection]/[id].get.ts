const VALID_COLLECTIONS = ['maps', 'sectors'] as const
type Collection = (typeof VALID_COLLECTIONS)[number]

export default defineEventHandler(async (event) => {
  const collection = getRouterParam(event, 'collection') as Collection

  if (!VALID_COLLECTIONS.includes(collection)) {
    throw createError({ statusCode: 404, message: 'Not found' })
  }

  let id = getRouterParam(event, 'id') ?? ''

  // Normalise to canonical ID — redirect if the URL wasn't already canonical
  let redirectNeeded = false

  if (id.endsWith('.json')) {
    id = id.slice(0, -5)
    redirectNeeded = true
  }

  const prefix = collection.replace(/s$/, '') + '-'
  if (id.startsWith(prefix)) {
    id = id.slice(prefix.length)
    redirectNeeded = true
  }

  if (redirectNeeded) {
    return sendRedirect(event, `/${collection}/${id}`, 301)
  }

  setHeader(event, 'Cache-Control', 'public, max-age=3600, must-revalidate')
  setHeader(event, 'Content-Type', 'application/json')

  const blobKey = `${collection}/${id}.json`

  try {
    const meta = await blob.head(blobKey)
    if (meta.customMetadata?.contentEncoding) {
      setHeader(event, 'Content-Encoding', meta.customMetadata.contentEncoding)
    }
  } catch {
    // File not found — blob.serve will return 404
  }

  return blob.serve(event, blobKey)
})
