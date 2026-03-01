<template>
  <div class="page">
    <h1>Screeps Private Server Maps</h1>

    <section>
      <h2>Installation</h2>
      <p>
        These maps require
        <a href="https://github.com/ScreepsMods/screepsmod-admin-utils" target="_blank">screepsmod-admin-utils</a>.
      </p>
      <p>Add to your <code>config.yml</code>:</p>
      <pre><code>mods:
  - screepsmod-admin-utils

serverConfig:
  map: &lt;id&gt;  # ID from the table below; utils.importMap is called automatically</code></pre>
      <p>Or import manually from the server CLI:</p>
      <pre><code>utils.importMap('&lt;id&gt;')</code></pre>
      <p>
        Alternatively, if you have
        <a href="https://github.com/ScreepsMods/screepsmod-map-tool" target="_blank">screepsmod-map-tool</a>
        installed, you can drag and drop a downloaded JSON file directly into the map tool UI.
      </p>
    </section>

    <section>
      <h2>Maps</h2>
      <p v-if="mapsStatus === 'pending'">Loading…</p>
      <p v-else-if="mapsStatus === 'error'">Failed to load map index.</p>
      <table v-else>
        <thead>
          <tr>
            <th>ID</th>
            <th>Width</th>
            <th>Height</th>
            <th>Download</th>
            <th>View</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="map in sortedMaps" :key="map.id" class="clickable" @click="navigateTo(`/maps/${map.id}/view`)">
            <td>{{ map.id }}</td>
            <td>{{ map.width }}</td>
            <td>{{ map.height }}</td>
            <td><a :href="`/maps/${map.id}`" @click.stop>JSON</a></td>
            <td><NuxtLink :to="`/maps/${map.id}/view`" @click.stop>View</NuxtLink></td>
          </tr>
        </tbody>
      </table>
    </section>

  </div>
</template>

<script setup lang="ts">
interface MapEntry {
  id: string
  width: number
  height: number
}

const { data: maps, status: mapsStatus } = await useFetch<MapEntry[]>('/maps/index.json')

const pad = (v: string | number, len: number) => String(v ?? '').padStart(len, '0')
const isGenerated = (id: string) => /^[0-9a-f]{8}$/.test(id)

const sortedMaps = computed(() => {
  if (!maps.value) return []
  return [...maps.value].sort((a, b) => {
    const aGen = isGenerated(a.id) ? 1 : 0
    const bGen = isGenerated(b.id) ? 1 : 0
    if (aGen !== bGen) return aGen - bGen
    if (!aGen) return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
    const ka = pad(a.width || 10000, 6) + pad(a.height || 10000, 6) + '-' + a.id
    const kb = pad(b.width || 10000, 6) + pad(b.height || 10000, 6) + '-' + b.id
    return ka < kb ? -1 : ka > kb ? 1 : 0
  })
})
</script>

<style scoped>
.page {
  max-width: 900px;
  margin: 0 auto;
  padding: 1.5rem 1rem;
}

h1 { margin-top: 0; }
h2 { margin-top: 2rem; color: #ccc; }

p { color: #aaa; line-height: 1.6; }

table {
  border-collapse: collapse;
  width: 100%;
}

th {
  text-align: left;
  padding: 0.4rem 0.75rem;
  border-bottom: 1px solid #333;
  color: #888;
  font-weight: normal;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

td {
  text-align: left;
  padding: 0.4rem 0.75rem;
  border-bottom: 1px solid #222;
  font-family: monospace;
  font-size: 0.9rem;
}

tr.clickable { cursor: pointer; }
tr.clickable:hover td { background: #1a1a1a; }
</style>
