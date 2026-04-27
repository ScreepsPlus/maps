export default defineNuxtConfig({
  compatibilityDate: '2026-03-01',
  modules: ['@nuxthub/core'],
  css: ['~/assets/reset.css'],
  runtimeConfig: {
    uploadToken: '',
  },
  hub: {
    kv: true,
    blob: true,
  },
  $production: {
    nitro: {
      preset: 'cloudflare_module',
      cloudflare: {
        wrangler: {
          name: 'screepsplus-maps',
          limits: {
            maxDuration: 600,
          },
        },
      },
    },
    hub: {
      kv: {
        namespaceId: '33681fe71b45423d9454a2b07ca59660',
      },
      blob: {
        bucketName: 'screepsplus-maps',
      },
    },
  },
})
