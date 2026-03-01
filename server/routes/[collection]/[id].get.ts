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

  const blobKey = `${collection}/${id}.json`

  let isGzip = false
  try {
    const meta = await blob.head(blobKey)
    isGzip = meta.customMetadata?.contentEncoding === 'gzip'
  } catch {
    throw createError({ statusCode: 404, message: 'Not found' })
  }

  setHeader(event, 'Content-Type', 'application/json')

  if (isGzip) {
    // Decompress server-side: CF Workers auto-compress responses, so setting
    // Content-Encoding: gzip would result in double-compression.
    const raw = await blob.get(blobKey)
    if (!raw) throw createError({ statusCode: 404, message: 'Not found' })
    return new Response(
      raw.stream().pipeThrough(new DecompressionStream('gzip')),
    ).text()
  }

  return blob.serve(event, blobKey)
})
