const VALID_COLLECTIONS = ['maps', 'sectors'] as const
type Collection = (typeof VALID_COLLECTIONS)[number]

interface IndexEntry {
  id: string
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

  // Delete file from R2 and remove its per-entry KV key (atomic, no read needed)
  await blob.delete(`${collection}/${id}.json`)
  await kv.del(`${collection}:${id}`)

  return { ok: true, id }
})
