export default defineNuxtConfig({
  modules: ['@nuxthub/core'],
  runtimeConfig: {
    uploadToken: '',
  },
  hub: {
    blob: true,
    kv: true,
  },
  nitro: {
    cloudflare: {
      wrangler: {
        name: 'screepsplus-maps',
        kv_namespaces: [{ binding: 'KV', id: '33681fe71b45423d9454a2b07ca59660' }],
        r2_buckets: [{ binding: 'BLOB', bucket_name: 'screepsplus-maps' }],
      },
    },
  },
})
