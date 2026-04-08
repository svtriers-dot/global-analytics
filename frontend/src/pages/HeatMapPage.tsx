import { useEffect, useRef, useState, useCallback } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { fetchMapData } from '../api/geo'
import { fetchEarthquakes, fetchDisasterEvents } from '../api/disasters'
import type { MapDataResponse, SelectedCountry } from '../types/geo'
import CountrySidebar from '../components/CountrySidebar'
import { SHIPPING_ROUTES } from '../data/shippingRoutes'

// GeoJSON мира с ISO3-кодами (Natural Earth, ~500kb)
const GEOJSON_URL =
  'https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson'

// ─── Домены и слои (пункт 7) ─────────────────────────────────────────────────

const LAYER_DOMAINS = [
  {
    id: 'macro',
    label: 'Макроэкономика',
    icon: '📊',
    layers: [
      { id: 'NY.GDP.PCAP.CD', label: 'ВВП на душу' },
      { id: 'FP.CPI.TOTL.ZG', label: 'Инфляция' },
      { id: 'SL.UEM.TOTL.ZS', label: 'Безработица' },
      { id: 'SP.POP.TOTL',    label: 'Население' },
    ],
  },
  {
    id: 'trade',
    label: 'Торговля',
    icon: '🚢',
    layers: [
      { id: 'IS.SHP.GOOD.TU',     label: 'Морской трафик (TEU)' },
      { id: 'TG.VAL.TOTL.GD.ZS',  label: 'Торговля (% ВВП)' },
    ],
  },
  {
    id: 'risk',
    label: 'Риски',
    icon: '⚠️',
    layers: [
      { id: 'IC.PI.PSCT.IN', label: 'Полит. стабильность' },
      { id: 'SH.DYN.MORT',   label: 'Детская смертность' },
    ],
  },
]

// ─── Оверлеи (пункты 5, 6) ───────────────────────────────────────────────────

type OverlayId = 'shipping' | 'earthquakes' | 'disasters'

const OVERLAYS: { id: OverlayId; label: string; icon: string }[] = [
  { id: 'shipping',    label: 'Морские маршруты', icon: '🛳️' },
  { id: 'earthquakes', label: 'Землетрясения',    icon: '🌋' },
  { id: 'disasters',   label: 'Катастрофы',       icon: '🌊' },
]

// ─── Цветовой градиент ────────────────────────────────────────────────────────

function getColor(
  value: number | undefined,
  min: number,
  max: number,
  scale: 'linear' | 'log' = 'linear',
): string {
  if (value === undefined) return '#1e2130'
  let t: number
  if (scale === 'log' && value > 0 && min > 0 && max > min) {
    const logV = Math.log(Math.max(value, min))
    t = Math.max(0, Math.min(1, (logV - Math.log(min)) / (Math.log(max) - Math.log(min))))
  } else {
    t = Math.max(0, Math.min(1, (value - min) / (max - min || 1)))
  }
  const stops: [number, number, number][] = [
    [15, 52, 96], [26, 95, 180], [45, 180, 130], [250, 210, 50], [220, 60, 30],
  ]
  const idx = t * (stops.length - 1)
  const i = Math.floor(idx)
  const f = idx - i
  const c1 = stops[Math.min(i, stops.length - 1)]
  const c2 = stops[Math.min(i + 1, stops.length - 1)]
  return `rgb(${Math.round(c1[0] + f * (c2[0] - c1[0]))},${Math.round(c1[1] + f * (c2[1] - c1[1]))},${Math.round(c1[2] + f * (c2[2] - c1[2]))})`
}

// Цвет маркера землетрясения по магнитуде
function quakeColor(mag: number): string {
  if (mag >= 7.0) return '#f87171'   // красный — очень сильное
  if (mag >= 6.0) return '#f59e0b'   // оранжевый — сильное
  return '#fde68a'                   // жёлтый — умеренное
}

// Цвет маркера катастрофы по уровню алерта
function disasterColor(alert: string): string {
  if (alert === 'Red')    return '#f87171'
  if (alert === 'Orange') return '#f59e0b'
  return '#4ade80'
}

// ─── Компонент ────────────────────────────────────────────────────────────────

export default function HeatMapPage() {
  const mapRef          = useRef<L.Map | null>(null)
  const geoLayerRef     = useRef<L.GeoJSON | null>(null)
  const geoJsonRef      = useRef<GeoJSON.FeatureCollection | null>(null)
  const shippingLayerRef  = useRef<L.LayerGroup | null>(null)
  const quakeLayerRef     = useRef<L.LayerGroup | null>(null)
  const disasterLayerRef  = useRef<L.LayerGroup | null>(null)

  const [activeLayer,     setActiveLayer]     = useState('NY.GDP.PCAP.CD')
  const [activeDomain,    setActiveDomain]    = useState('macro')
  const [activeOverlays,  setActiveOverlays]  = useState<Set<OverlayId>>(new Set())
  const [mapData,         setMapData]         = useState<MapDataResponse | null>(null)
  const [loading,         setLoading]         = useState(false)
  const [geoJsonReady,    setGeoJsonReady]    = useState(false)   // вместо setInterval-полинга
  const [overlayLoading,  setOverlayLoading]  = useState<Set<OverlayId>>(new Set())
  const [selectedCountry, setSelectedCountry] = useState<SelectedCountry | null>(null)

  // Инициализация карты
  useEffect(() => {
    if (mapRef.current) return
    const map = L.map('leaflet-map', {
      center: [20, 10], zoom: 2, minZoom: 2, maxZoom: 8,
      zoomControl: true, attributionControl: false,
    })
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png',
      { subdomains: 'abcd' }).addTo(map)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png',
      { subdomains: 'abcd', pane: 'shadowPane' }).addTo(map)
    mapRef.current = map
    return () => { map.remove(); mapRef.current = null }
  }, [])

  // Загрузка GeoJSON — один раз, устанавливаем флаг после загрузки
  useEffect(() => {
    fetch(GEOJSON_URL)
      .then(r => r.json())
      .then(d => {
        geoJsonRef.current = d
        setGeoJsonReady(true)  // сигнализируем что GeoJSON готов
      })
      .catch(() => {
        // GeoJSON не загрузился — карта останется пустой, но приложение не упадёт
        console.error('Не удалось загрузить GeoJSON стран')
      })
  }, [])

  // Загрузка данных при смене слоя
  useEffect(() => {
    setLoading(true)
    fetchMapData(activeLayer).then(setMapData).finally(() => setLoading(false))
  }, [activeLayer])

  // Перерисовка хитмапа
  const redrawLayer = useCallback(() => {
    const map = mapRef.current
    const geoJson = geoJsonRef.current
    if (!map || !geoJson || !mapData) return

    const valueMap: Record<string, number> = {}
    for (const d of mapData.data) valueMap[d.country_code] = d.value

    if (geoLayerRef.current) { geoLayerRef.current.remove(); geoLayerRef.current = null }

    const layer = L.geoJSON(geoJson, {
      style: (feature) => {
        const iso3  = feature?.properties?.['ISO3166-1-Alpha-3'] as string | undefined
        const value = iso3 ? valueMap[iso3] : undefined
        return {
          fillColor:   getColor(value, mapData.min, mapData.max, mapData.meta.scale ?? 'linear'),
          fillOpacity: 0.85,
          color:       '#0f1117',
          weight:      0.5,
        }
      },
      onEachFeature: (feature, featureLayer) => {
        const iso3  = feature.properties?.['ISO3166-1-Alpha-3'] as string
        const iso2  = feature.properties?.['ISO3166-1-Alpha-2'] as string
        const name  = feature.properties?.name as string
        const value = valueMap[iso3]
        featureLayer.on({
          mouseover: (e) => { e.target.setStyle({ weight: 2, color: '#fff', fillOpacity: 0.95 }); e.target.bringToFront() },
          mouseout:  (e) => { layer.resetStyle(e.target) },
          click:     ()  => { setSelectedCountry({ iso2, iso3, name, value }) },
        })
        const valStr = value !== undefined
          ? new Intl.NumberFormat('ru-RU').format(Math.round(value))
          : 'нет данных'
        featureLayer.bindTooltip(
          `<b>${name}</b><br/>${mapData.meta.label}: ${valStr}`,
          { sticky: true, className: 'map-tooltip' },
        )
      },
    }).addTo(map)
    geoLayerRef.current = layer
  }, [mapData])

  // Перерисовываем когда готовы и mapData, и GeoJSON
  useEffect(() => {
    if (geoJsonReady && mapData) redrawLayer()
  }, [geoJsonReady, mapData, redrawLayer])

  // ── Оверлей: морские маршруты ──────────────────────────────────────────────
  const toggleShippingRoutes = useCallback((enable: boolean) => {
    const map = mapRef.current
    if (!map) return
    if (!enable) {
      shippingLayerRef.current?.remove()
      shippingLayerRef.current = null
      return
    }
    if (shippingLayerRef.current) return  // уже отображается

    const group = L.layerGroup()
    for (const route of SHIPPING_ROUTES) {
      const latlngs = route.path.map(([lon, lat]) => [lat, lon] as [number, number])
      L.polyline(latlngs, {
        color:     route.type === 'major' ? '#4f8ef7' : '#7a7f9a',
        weight:    route.type === 'major' ? 2 : 1,
        opacity:   route.type === 'major' ? 0.7 : 0.4,
        dashArray: route.type === 'secondary' ? '6 4' : undefined,
      }).bindTooltip(route.name, { sticky: true, className: 'map-tooltip' })
        .addTo(group)
    }
    group.addTo(map)
    shippingLayerRef.current = group
  }, [])

  // ── Оверлей: землетрясения ─────────────────────────────────────────────────
  const toggleEarthquakes = useCallback(async (enable: boolean) => {
    const map = mapRef.current
    if (!map) return
    if (!enable) {
      quakeLayerRef.current?.remove()
      quakeLayerRef.current = null
      return
    }
    if (quakeLayerRef.current) return

    setOverlayLoading(prev => new Set([...prev, 'earthquakes']))
    try {
      const data = await fetchEarthquakes(4.5)
      const group = L.layerGroup()
      for (const eq of data.events) {
        const color  = quakeColor(eq.mag)
        const radius = Math.max(4, eq.mag * 2)
        L.circleMarker([eq.lat, eq.lon], {
          radius,
          fillColor:   color,
          color:       '#0f1117',
          weight:      1,
          fillOpacity: 0.75,
        }).bindTooltip(
          `<b>М${eq.mag}</b> — ${eq.place}<br/>${eq.time ? new Date(eq.time).toLocaleDateString('ru-RU') : ''}`,
          { sticky: true, className: 'map-tooltip' },
        ).addTo(group)
      }
      group.addTo(map)
      quakeLayerRef.current = group
    } finally {
      setOverlayLoading(prev => { const s = new Set(prev); s.delete('earthquakes'); return s })
    }
  }, [])

  // ── Оверлей: стихийные бедствия ────────────────────────────────────────────
  const toggleDisasters = useCallback(async (enable: boolean) => {
    const map = mapRef.current
    if (!map) return
    if (!enable) {
      disasterLayerRef.current?.remove()
      disasterLayerRef.current = null
      return
    }
    if (disasterLayerRef.current) return

    setOverlayLoading(prev => new Set([...prev, 'disasters']))
    try {
      const data = await fetchDisasterEvents()
      const group = L.layerGroup()
      for (const ev of data.events) {
        const color = disasterColor(ev.alert)
        L.circleMarker([ev.lat, ev.lon], {
          radius: 7, fillColor: color, color: '#0f1117', weight: 1.5, fillOpacity: 0.85,
        }).bindTooltip(
          `<b>${ev.type_label}</b>: ${ev.name || ev.country}<br/>Уровень: ${ev.alert}`,
          { sticky: true, className: 'map-tooltip' },
        ).addTo(group)
      }
      group.addTo(map)
      disasterLayerRef.current = group
    } finally {
      setOverlayLoading(prev => { const s = new Set(prev); s.delete('disasters'); return s })
    }
  }, [])

  // Переключение оверлея
  const handleOverlayToggle = useCallback((id: OverlayId) => {
    const willEnable = !activeOverlays.has(id)
    setActiveOverlays(prev => {
      const next = new Set(prev)
      willEnable ? next.add(id) : next.delete(id)
      return next
    })
    if (id === 'shipping')    toggleShippingRoutes(willEnable)
    if (id === 'earthquakes') toggleEarthquakes(willEnable)
    if (id === 'disasters')   toggleDisasters(willEnable)
  }, [activeOverlays, toggleShippingRoutes, toggleEarthquakes, toggleDisasters])

  const currentDomain  = LAYER_DOMAINS.find(d => d.id === activeDomain)!
  const activeLayerMeta = LAYER_DOMAINS.flatMap(d => d.layers).find(l => l.id === activeLayer)

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>

      {/* ── Панель управления ── */}
      <div style={{
        padding: '8px 16px',
        background: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex',
        gap: 12,
        alignItems: 'center',
        flexWrap: 'wrap',
      }}>

        {/* ── Домены (пункт 7) ── */}
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)', marginRight: 2 }}>Домен:</span>
          {LAYER_DOMAINS.map(domain => (
            <button
              key={domain.id}
              onClick={() => {
                setActiveDomain(domain.id)
                setActiveLayer(domain.layers[0].id)
              }}
              style={{
                padding: '4px 10px',
                borderRadius: 6,
                border: `1px solid ${activeDomain === domain.id ? 'var(--color-accent)' : 'var(--color-border)'}`,
                background: activeDomain === domain.id ? 'rgba(79,142,247,0.15)' : 'transparent',
                color: activeDomain === domain.id ? 'var(--color-accent)' : 'var(--color-text-muted)',
                fontSize: 12,
                fontWeight: activeDomain === domain.id ? 600 : 400,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {domain.icon} {domain.label}
            </button>
          ))}
        </div>

        {/* Разделитель */}
        <div style={{ width: 1, height: 20, background: 'var(--color-border)' }} />

        {/* ── Слои текущего домена ── */}
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)', marginRight: 2 }}>Слой:</span>
          {currentDomain.layers.map(layer => (
            <button
              key={layer.id}
              onClick={() => setActiveLayer(layer.id)}
              style={{
                padding: '4px 12px',
                borderRadius: 6,
                border: `1px solid ${activeLayer === layer.id ? 'var(--color-accent)' : 'var(--color-border)'}`,
                background: activeLayer === layer.id ? 'rgba(79,142,247,0.15)' : 'transparent',
                color: activeLayer === layer.id ? 'var(--color-accent)' : 'var(--color-text-muted)',
                fontSize: 13,
                fontWeight: activeLayer === layer.id ? 600 : 400,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {layer.label}
            </button>
          ))}
        </div>

        {/* Разделитель */}
        <div style={{ width: 1, height: 20, background: 'var(--color-border)' }} />

        {/* ── Оверлеи (пункты 5 и 6) ── */}
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)', marginRight: 2 }}>Оверлей:</span>
          {OVERLAYS.map(ov => {
            const isActive  = activeOverlays.has(ov.id)
            const isLoading = overlayLoading.has(ov.id)
            return (
              <button
                key={ov.id}
                onClick={() => handleOverlayToggle(ov.id)}
                disabled={isLoading}
                style={{
                  padding: '4px 10px',
                  borderRadius: 6,
                  border: `1px solid ${isActive ? '#4ade80' : 'var(--color-border)'}`,
                  background: isActive ? 'rgba(74,222,128,0.12)' : 'transparent',
                  color: isActive ? '#4ade80' : 'var(--color-text-muted)',
                  fontSize: 12,
                  fontWeight: isActive ? 600 : 400,
                  cursor: isLoading ? 'wait' : 'pointer',
                  opacity: isLoading ? 0.6 : 1,
                  transition: 'all 0.15s',
                }}
              >
                {isLoading ? '⟳' : ov.icon} {ov.label}
              </button>
            )
          })}
        </div>

        {/* Статус загрузки */}
        {loading && (
          <span style={{ color: 'var(--color-text-muted)', fontSize: 12, marginLeft: 4 }}>
            ⟳ Загрузка...
          </span>
        )}
        {mapData && !loading && (
          <span style={{ color: 'var(--color-text-muted)', fontSize: 12, marginLeft: 4 }}>
            {activeLayerMeta?.label} · {mapData.year} · {mapData.data.length} стран
          </span>
        )}
      </div>

      {/* ── Карта ── */}
      <div style={{ flex: 1, position: 'relative' }}>
        <div id="leaflet-map" style={{ width: '100%', height: '100%' }} />

        {/* Легенда хитмапа */}
        {mapData && (
          <div style={{
            position: 'absolute', bottom: 24, left: 24,
            background: 'rgba(26,29,39,0.92)',
            border: '1px solid var(--color-border)',
            borderRadius: 8, padding: '10px 14px', zIndex: 800, minWidth: 180,
          }}>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 6 }}>
              {mapData.meta.label}
            </div>
            <div style={{
              height: 10, borderRadius: 4,
              background: 'linear-gradient(to right, rgb(15,52,96), rgb(26,95,180), rgb(45,180,130), rgb(250,210,50), rgb(220,60,30))',
              marginBottom: 4,
            }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--color-text-muted)' }}>
              <span>{new Intl.NumberFormat('ru-RU', { notation: 'compact' }).format(mapData.min)}</span>
              <span>{new Intl.NumberFormat('ru-RU', { notation: 'compact' }).format(mapData.max)}</span>
            </div>
          </div>
        )}

        {/* Легенда оверлеев */}
        {activeOverlays.size > 0 && (
          <div style={{
            position: 'absolute', bottom: 24, right: selectedCountry ? 340 : 24,
            background: 'rgba(26,29,39,0.92)',
            border: '1px solid var(--color-border)',
            borderRadius: 8, padding: '10px 14px', zIndex: 800,
            display: 'flex', flexDirection: 'column', gap: 6,
          }}>
            {activeOverlays.has('shipping') && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                <div style={{ display: 'flex', gap: 4 }}>
                  <div style={{ width: 20, height: 2, background: '#4f8ef7', marginTop: 5 }} />
                  <div style={{ width: 20, height: 2, background: '#7a7f9a', marginTop: 5, borderStyle: 'dashed' }} />
                </div>
                <span style={{ color: 'var(--color-text-muted)' }}>Морские маршруты</span>
              </div>
            )}
            {activeOverlays.has('earthquakes') && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                <div style={{ display: 'flex', gap: 4 }}>
                  {[['#fde68a', '≥4.5'], ['#f59e0b', '≥6.0'], ['#f87171', '≥7.0']].map(([c, l]) => (
                    <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: c, display: 'inline-block' }} />
                      <span style={{ color: 'var(--color-text-muted)' }}>{l}</span>
                    </span>
                  ))}
                </div>
                <span style={{ color: 'var(--color-text-muted)' }}>Землетрясения</span>
              </div>
            )}
            {activeOverlays.has('disasters') && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#f87171', display: 'inline-block' }} />
                <span style={{ color: 'var(--color-text-muted)' }}>Красный / </span>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} />
                <span style={{ color: 'var(--color-text-muted)' }}>Оранжевый алерт</span>
              </div>
            )}
          </div>
        )}

        <CountrySidebar country={selectedCountry} onClose={() => setSelectedCountry(null)} />
      </div>

      <style>{`
        .map-tooltip {
          background: #1a1d27; border: 1px solid #2a2d3a; color: #e8eaf0;
          font-size: 13px; border-radius: 6px; padding: 6px 10px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.4);
        }
        .map-tooltip::before { display: none; }
        #leaflet-map { background: #0f1117; }
      `}</style>
    </div>
  )
}
