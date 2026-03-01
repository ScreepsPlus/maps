<template>
  <div class="viewer">
    <header class="bar">
      <NuxtLink to="/" class="back">← All maps</NuxtLink>

      <div class="map-select" @keydown="onSelectKeydown">
        <input
          ref="searchRef"
          v-model="searchQuery"
          class="map-search"
          :placeholder="id"
          autocomplete="off"
          spellcheck="false"
          @focus="dropdownOpen = true"
          @blur="dropdownOpen = false"
        />
        <ul v-if="dropdownOpen && filteredMaps.length" class="map-dropdown">
          <li
            v-for="(map, i) in filteredMaps"
            :key="map.id"
            :class="{ active: i === activeIndex }"
            @mousedown.prevent="selectMap(map.id)"
          >
            <span class="dd-id">{{ map.id }}</span>
            <span v-if="map.width && map.height" class="dd-dim">{{ map.width }}×{{ map.height }}</span>
          </li>
        </ul>
      </div>

      <a :href="`/maps/${id}`" class="dl">Download JSON</a>
    </header>

    <div v-if="error" class="message">Failed to load map.</div>
    <div v-else-if="!mapData" class="message">Loading…</div>

    <div
      v-else
      ref="containerRef"
      class="canvas-wrap"
      :class="{ grabbing: dragging }"
      @wheel.prevent="onWheel"
      @mousedown="onMouseDown"
      @mousemove="onContainerMouseMove"
      @mouseleave="hoveredRoom = null"
      @touchstart.prevent="onTouchStart"
      @touchmove.prevent="onTouchMove"
      @touchend="onTouchEnd"
    >
      <div v-if="!rendered" class="overlay">
        <span class="spinner" />
        Rendering…
      </div>

      <canvas
        ref="canvasRef"
        class="map-canvas"
        :style="{ transform: canvasTransform }"
      />

      <div v-if="rendered && hoveredRoom" class="room-label">
        <span class="rl-name">{{ hoveredRoom.name }}</span>
        <span v-if="hoveredRoom.sources" class="rl-sources">{{ hoveredRoom.sources }} source{{ hoveredRoom.sources > 1 ? 's' : '' }}</span>
        <span v-if="hoveredRoom.mineral" class="rl-mineral">{{ hoveredRoom.mineral }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface RoomObject {
  type: string
  x: number
  y: number
  mineralType?: string
}

interface Room {
  room: string
  terrain: string
  objects?: RoomObject[]
}

interface MapData {
  width: string
  height: string
  rooms: Room[]
}

interface RoomInfo {
  name: string
  sources: number
  mineral: string | null
}

const route = useRoute()
const id = route.params.id as string

useHead({ title: `Map ${id} – Screeps Maps` })

interface MapEntry { id: string; width: number; height: number }

const mapData = ref<MapData | null>(null)
const error = ref(false)
const mapsList = ref<MapEntry[]>([])

// Searchable dropdown state
const searchRef = ref<HTMLInputElement | null>(null)
const searchQuery = ref('')
const dropdownOpen = ref(false)
const activeIndex = ref(0)

const filteredMaps = computed(() => {
  const q = searchQuery.value.toLowerCase()
  const all = mapsList.value
  if (!q) return all
  return all.filter((m) => m.id.toLowerCase().includes(q))
})

watch(filteredMaps, () => { activeIndex.value = 0 })

function selectMap(mapId: string) {
  dropdownOpen.value = false
  searchQuery.value = ''
  navigateTo(`/maps/${mapId}/view`)
}

function onSelectKeydown(e: KeyboardEvent) {
  if (!dropdownOpen.value) {
    if (e.key === 'Enter' || e.key === 'ArrowDown') dropdownOpen.value = true
    return
  }
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    activeIndex.value = Math.min(activeIndex.value + 1, filteredMaps.value.length - 1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    activeIndex.value = Math.max(activeIndex.value - 1, 0)
  } else if (e.key === 'Enter') {
    const map = filteredMaps.value[activeIndex.value]
    if (map) selectMap(map.id)
  } else if (e.key === 'Escape') {
    dropdownOpen.value = false
    searchQuery.value = ''
  }
}

// Pan/zoom state
const scale = ref(1)
const tx = ref(0)
const ty = ref(0)
const canvasTransform = computed(
  () => `translate(${tx.value}px, ${ty.value}px) scale(${scale.value})`
)

const containerRef = ref<HTMLDivElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const dragging = ref(false)
const rendered = ref(false)
const hoveredRoom = ref<RoomInfo | null>(null)

let lastX = 0
let lastY = 0

function onMouseDown(e: MouseEvent) {
  dragging.value = true
  lastX = e.clientX
  lastY = e.clientY
}

function onMouseMove(e: MouseEvent) {
  if (!dragging.value) return
  tx.value += e.clientX - lastX
  ty.value += e.clientY - lastY
  lastX = e.clientX
  lastY = e.clientY
}

function onMouseUp() {
  dragging.value = false
}

function onWheel(e: WheelEvent) {
  const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1
  const rect = containerRef.value!.getBoundingClientRect()
  const mx = e.clientX - rect.left
  const my = e.clientY - rect.top
  tx.value = mx - (mx - tx.value) * factor
  ty.value = my - (my - ty.value) * factor
  scale.value *= factor
}

// Touch state
const touches = new Map<number, { x: number; y: number }>()

function onTouchStart(e: TouchEvent) {
  for (const t of e.changedTouches) {
    touches.set(t.identifier, { x: t.clientX, y: t.clientY })
  }
  if (e.touches.length === 1) {
    dragging.value = true
    lastX = e.touches[0].clientX
    lastY = e.touches[0].clientY
  }
}

function onTouchMove(e: TouchEvent) {
  if (e.touches.length === 1 && dragging.value) {
    const t = e.touches[0]
    tx.value += t.clientX - lastX
    ty.value += t.clientY - lastY
    lastX = t.clientX
    lastY = t.clientY
  } else if (e.touches.length === 2) {
    const t1 = e.touches[0]
    const t2 = e.touches[1]
    const prev1 = touches.get(t1.identifier)
    const prev2 = touches.get(t2.identifier)
    if (prev1 && prev2) {
      const prevDist = Math.hypot(prev1.x - prev2.x, prev1.y - prev2.y)
      const newDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY)
      if (prevDist > 0) {
        const factor = newDist / prevDist
        const cx = (t1.clientX + t2.clientX) / 2
        const cy = (t1.clientY + t2.clientY) / 2
        const rect = containerRef.value!.getBoundingClientRect()
        const mx = cx - rect.left
        const my = cy - rect.top
        tx.value = mx - (mx - tx.value) * factor
        ty.value = my - (my - ty.value) * factor
        scale.value *= factor
      }
    }
    touches.set(t1.identifier, { x: t1.clientX, y: t1.clientY })
    touches.set(t2.identifier, { x: t2.clientX, y: t2.clientY })
  }
}

function onTouchEnd(e: TouchEvent) {
  for (const t of e.changedTouches) touches.delete(t.identifier)
  if (e.touches.length === 0) dragging.value = false
}

// Parse room name like W3N5, E2S1 → grid coordinates
function parseRoomCoord(name: string): { x: number; y: number } | null {
  const m = name.match(/^([WE])(\d+)([NS])(\d+)$/)
  if (!m) return null
  return {
    x: m[1] === 'E' ? parseInt(m[2]) : -(parseInt(m[2]) + 1),
    y: m[3] === 'S' ? parseInt(m[4]) : -(parseInt(m[4]) + 1),
  }
}

// Screeps terrain colors (from screeps/backend-local utils)
// TERRAIN_MASK_WALL = 1, TERRAIN_MASK_SWAMP = 2
const C_WALL = [0, 0, 0] as const
const C_SWAMP = [35, 37, 19] as const
const C_BORDER = [50, 50, 50] as const
const C_PLAIN = [43, 43, 43] as const

const TILE = 2 // pixels per terrain tile
const ROOM_PX = 50 * TILE

// Grid col/row → room info, built during renderTerrain
let roomGrid = new Map<string, RoomInfo>()

function onContainerMouseMove(e: MouseEvent) {
  if (!rendered.value) return
  const rect = containerRef.value!.getBoundingClientRect()
  const cx = (e.clientX - rect.left - tx.value) / scale.value
  const cy = (e.clientY - rect.top - ty.value) / scale.value
  const col = Math.floor(cx / ROOM_PX)
  const row = Math.floor(cy / ROOM_PX)
  hoveredRoom.value = roomGrid.get(`${col},${row}`) ?? null
}

// Object colors as RGB tuples — written directly into ImageData
const OBJ_COLORS: Record<string, readonly [number, number, number]> = {
  source:     [255, 229, 109],
  controller: [215, 215, 215],
  keeperLair: [229,  64,  64],
  mineral:    [158, 158, 158],
}

function renderTerrain(canvas: HTMLCanvasElement, rooms: Room[]) {
  roomGrid = new Map()

  const parsed = rooms
    .map((r) => ({ room: r.room, terrain: r.terrain, objects: r.objects ?? [], coord: parseRoomCoord(r.room) }))
    .filter((r): r is { room: string; terrain: string; objects: RoomObject[]; coord: { x: number; y: number } } => r.coord !== null)

  if (!parsed.length) return

  const xs = parsed.map((r) => r.coord.x)
  const ys = parsed.map((r) => r.coord.y)
  const minX = Math.min(...xs)
  const minY = Math.min(...ys)
  const gridW = Math.max(...xs) - minX + 1
  const gridH = Math.max(...ys) - minY + 1

  canvas.width = gridW * ROOM_PX
  canvas.height = gridH * ROOM_PX

  const ctx = canvas.getContext('2d')!
  const imageData = ctx.createImageData(canvas.width, canvas.height)
  const data = imageData.data

  // Pre-fill with plain color
  for (let i = 0; i < data.length; i += 4) {
    data[i] = C_PLAIN[0]
    data[i + 1] = C_PLAIN[1]
    data[i + 2] = C_PLAIN[2]
    data[i + 3] = 255
  }

  for (const { room, terrain, objects, coord } of parsed) {
    const col = coord.x - minX
    const row = coord.y - minY

    const sources = objects.filter((o) => o.type === 'source').length
    const mineralObj = objects.find((o) => o.type === 'mineral')
    roomGrid.set(`${col},${row}`, {
      name: room,
      sources,
      mineral: mineralObj?.mineralType ?? null,
    })

    const rx = col * ROOM_PX
    const ry = row * ROOM_PX

    for (let y = 0; y < 50; y++) {
      for (let x = 0; x < 50; x++) {
        const t = terrain.charCodeAt(y * 50 + x) - 48 // '0'→0, '1'→1, '2'→2
        let c: readonly [number, number, number]
        if (t & 1) c = C_WALL
        else if (t & 2) c = C_SWAMP
        else if (x === 0 || x === 49 || y === 0 || y === 49) c = C_BORDER
        else c = C_PLAIN

        for (let dy = 0; dy < TILE; dy++) {
          for (let dx = 0; dx < TILE; dx++) {
            const i = ((ry + y * TILE + dy) * canvas.width + (rx + x * TILE + dx)) * 4
            data[i] = c[0]
            data[i + 1] = c[1]
            data[i + 2] = c[2]
            // alpha already 255 from pre-fill
          }
        }
      }
    }
  }

  // Write object pixels into ImageData on top of terrain
  for (const { objects, coord } of parsed) {
    const col = coord.x - minX
    const row = coord.y - minY
    const rx = col * ROOM_PX
    const ry = row * ROOM_PX

    for (const obj of objects) {
      const c = OBJ_COLORS[obj.type]
      if (!c) continue
      const ox = rx + obj.x * TILE
      const oy = ry + obj.y * TILE
      for (let dy = 0; dy < TILE; dy++) {
        for (let dx = 0; dx < TILE; dx++) {
          const i = ((oy + dy) * canvas.width + (ox + dx)) * 4
          data[i] = c[0]
          data[i + 1] = c[1]
          data[i + 2] = c[2]
        }
      }
    }
  }

  ctx.putImageData(imageData, 0, 0)
}

function fitToContainer() {
  const container = containerRef.value
  const canvas = canvasRef.value
  if (!container || !canvas) return
  const s = Math.min(container.clientWidth / canvas.width, container.clientHeight / canvas.height) * 0.95
  scale.value = s
  tx.value = (container.clientWidth - canvas.width * s) / 2
  ty.value = (container.clientHeight - canvas.height * s) / 2
}

onMounted(async () => {
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)

  $fetch<MapEntry[]>('/maps/index.json').then((list) => { mapsList.value = list })

  try {
    mapData.value = await $fetch<MapData>(`/maps/${id}`)
  } catch {
    error.value = true
    return
  }

  await nextTick() // ensure canvas-wrap is in the DOM
  if (!canvasRef.value) return
  // Yield so the "Rendering…" overlay paints before the blocking work
  await new Promise((r) => setTimeout(r, 0))
  renderTerrain(canvasRef.value, mapData.value.rooms)
  fitToContainer()
  rendered.value = true
})


onUnmounted(() => {
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('mouseup', onMouseUp)
})
</script>

<style scoped>
.viewer {
  display: flex;
  flex-direction: column;
  height: 100dvh;
  background: #111;
  color: #eee;
  font-family: sans-serif;
}

.bar {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.5rem 1rem;
  background: #1a1a1a;
  border-bottom: 1px solid #333;
  flex-shrink: 0;
}

.back {
  color: #0af;
  text-decoration: none;
  white-space: nowrap;
}

.map-select {
  position: relative;
  flex: 1;
  min-width: 0;
}

.map-search {
  width: 100%;
  background: transparent;
  border: none;
  border-bottom: 1px solid #444;
  color: #ccc;
  font-family: monospace;
  font-size: 1rem;
  padding: 0.1rem 0;
  outline: none;
}

.map-search:focus {
  border-bottom-color: #0af;
  color: #fff;
}

.map-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  max-height: 260px;
  overflow-y: auto;
  background: #1e1e1e;
  border: 1px solid #333;
  border-radius: 4px;
  list-style: none;
  margin: 0;
  padding: 0;
  z-index: 100;
}

.map-dropdown li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.35rem 0.75rem;
  font-family: monospace;
  font-size: 0.875rem;
  color: #ccc;
  cursor: pointer;
}

.map-dropdown li:hover,
.map-dropdown li.active {
  background: #2a2a2a;
  color: #fff;
}

.dd-dim {
  color: #666;
  font-size: 0.8rem;
  flex-shrink: 0;
}

.dl {
  color: #0af;
  text-decoration: none;
  font-size: 0.875rem;
  white-space: nowrap;
}

.canvas-wrap {
  flex: 1;
  overflow: hidden;
  cursor: grab;
  user-select: none;
  position: relative;
}

.canvas-wrap.grabbing {
  cursor: grabbing;
}

.map-canvas {
  position: absolute;
  top: 0;
  left: 0;
  transform-origin: 0 0;
  image-rendering: pixelated;
}

.overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  background: #111;
  color: #888;
  font-size: 1rem;
  z-index: 1;
}

.spinner {
  width: 18px;
  height: 18px;
  border: 2px solid #333;
  border-top-color: #0af;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  flex-shrink: 0;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.room-label {
  position: absolute;
  bottom: 0.75rem;
  left: 0.75rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: rgba(0, 0, 0, 0.7);
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  font-family: monospace;
  font-size: 0.875rem;
  pointer-events: none;
  z-index: 2;
}

.rl-name  { color: #eee; }
.rl-sources { color: #ffe56d; }
.rl-mineral { color: #9e9e9e; }

.message {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.1rem;
  color: #888;
}
</style>
