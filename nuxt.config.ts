export default defineNuxtConfig({
  modules: ['@nuxthub/core'],
  runtimeConfig: {
    uploadToken: '',
  },
  nitro: {
    cloudflare: {
      wrangler: {
        name: 'screepsplus-maps',
      },
    },
  },
  hub: {
    kv: {
      driver: 'cloudflare-kv-binding',
      namespaceId: '33681fe71b45423d9454a2b07ca59660',
    },
    blob: {
      driver: 'cloudflare-r2',
      bucketName: 'screepsplus-maps',
    },
  },
})
