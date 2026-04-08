import { useEffect, useRef, useState, useCallback } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { fetchMapData } from '../api/geo'
import type { MapDataResponse, SelectedCountry } from '../types/geo'
import CountrySidebar from '../components/CountrySidebar'

// GeoJSON мира с ISO3-кодами (Natural Earth, ~500kb)
const GEOJSON_URL =
  'https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson'

const LAYERS = [
  { id: 'NY.GDP.PCAP.CD', label: 'ВВП на душу' },
  { id: 'FP.CPI.TOTL.ZG', label: 'Инфляция' },
  { id: 'SL.UEM.TOTL.ZS', label: 'Безработица' },
  { id: 'SP.POP.TOTL',    label: 'Население' },
]

// Цветовой градиент: тёмно-синий → голубой → зелёный → жёлтый → красный
function getColor(
  value: number | undefined,
  min: number,
  max: number,
  scale: 'linear' | 'log' = 'linear',
): string {
  if (value === undefined) return '#1e2130'

  let t: number
  if (scale === 'log' && value > 0 && min > 0 && max > min) {
    // Логарифмическая шкала: равномерно распределяет страны с log-нормальным
    // распределением (ВВП, население) по всему цветовому диапазону
    const logV   = Math.log(Math.max(value, min))
    const logMin = Math.log(min)
    const logMax = Math.log(max)
    t = Math.max(0, Math.min(1, (logV - logMin) / (logMax - logMin)))
  } else {
    t = Math.max(0, Math.min(1, (value - min) / (max - min || 1)))
  }
  const stops: [number, number, number][] = [
    [15,  52,  96],   // 0.0 тёмно-синий
    [26,  95,  180],  // 0.25 синий
    [45,  180, 130],  // 0.5 зелёный
    [250, 210, 50],   // 0.75 жёлтый
    [220, 60,  30],   // 1.0 красный
  ]
  const idx = t * (stops.length - 1)
  const i = Math.floor(idx)
  const f = idx - i
  const c1 = stops[Math.min(i, stops.length - 1)]
  const c2 = stops[Math.min(i + 1, stops.length - 1)]
  const r = Math.round(c1[0] + f * (c2[0] - c1[0]))
  const g = Math.round(c1[1] + f * (c2[1] - c1[1]))
  const b = Math.round(c1[2] + f * (c2[2] - c1[2]))
  return `rgb(${r},${g},${b})`
}

export default function HeatMapPage() {
  const mapRef         = useRef<L.Map | null>(null)
  const geoLayerRef    = useRef<L.GeoJSON | null>(null)
  const geoJsonRef     = useRef<GeoJSON.FeatureCollection | null>(null)

  const [activeLayer,    setActiveLayer]    = useState(LAYERS[0].id)
  const [mapData,        setMapData]        = useState<MapDataResponse | null>(null)
  const [loading,        setLoading]        = useState(false)
  const [selectedCountry, setSelectedCountry] = useState<SelectedCountry | null>(null)

  // Инициализация карты (один раз)
  useEffect(() => {
    if (mapRef.current) return
    const map = L.map('leaflet-map', {
      center: [20, 10],
      zoom: 2,
      minZoom: 2,
      maxZoom: 8,
      zoomControl: true,
      attributionControl: false,
    })

    L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png',
      { subdomains: 'abcd' },
    ).addTo(map)

    // Только названия городов/стран поверх нашей заливки
    L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png',
      { subdomains: 'abcd', pane: 'shadowPane' },
    ).addTo(map)

    mapRef.current = map
    return () => { map.remove(); mapRef.current = null }
  }, [])

  // Загрузка GeoJSON (один раз)
  useEffect(() => {
    fetch(GEOJSON_URL)
      .then(r => r.json())
      .then(data => { geoJsonRef.current = data })
  }, [])

  // Загрузка данных при смене слоя
  useEffect(() => {
    setLoading(true)
    fetchMapData(activeLayer)
      .then(setMapData)
      .finally(() => setLoading(false))
  }, [activeLayer])

  // Перерисовка слоя при новых данных
  const redrawLayer = useCallback(() => {
    const map = mapRef.current
    const geoJson = geoJsonRef.current
    if (!map || !geoJson || !mapData) return

    // Индекс: iso3 → value
    const valueMap: Record<string, number> = {}
    for (const d of mapData.data) valueMap[d.country_code] = d.value

    // Удаляем старый слой
    if (geoLayerRef.current) {
      geoLayerRef.current.remove()
      geoLayerRef.current = null
    }

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
        const name  = feature.properties?.name  as string
        const value = valueMap[iso3]

        featureLayer.on({
          mouseover: (e) => {
            e.target.setStyle({ weight: 2, color: '#fff', fillOpacity: 0.95 })
            e.target.bringToFront()
          },
          mouseout: (e) => {
            layer.resetStyle(e.target)
          },
          click: () => {
            setSelectedCountry({ iso2, iso3, name, value })
          },
        })

        // Тултип
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

  useEffect(() => { redrawLayer() }, [redrawLayer])

  // Ждём загрузки GeoJSON, потом перерисовываем
  useEffect(() => {
    const interval = setInterval(() => {
      if (geoJsonRef.current && mapData) {
        redrawLayer()
        clearInterval(interval)
      }
    }, 200)
    return () => clearInterval(interval)
  }, [mapData, redrawLayer])

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>

      {/* Панель слоёв */}
      <div style={{
        padding: '10px 20px',
        background: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex',
        gap: 6,
        alignItems: 'center',
        flexWrap: 'wrap',
      }}>
        <span style={{ color: 'var(--color-text-muted)', fontSize: 12, marginRight: 4 }}>
          Слой:
        </span>
        {LAYERS.map(layer => (
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
        {loading && (
          <span style={{ color: 'var(--color-text-muted)', fontSize: 12, marginLeft: 8 }}>
            ⟳ Загрузка...
          </span>
        )}
        {mapData && !loading && (
          <span style={{ color: 'var(--color-text-muted)', fontSize: 12, marginLeft: 8 }}>
            Данные за {mapData.year} · {mapData.data.length} стран
          </span>
        )}
      </div>

      {/* Карта */}
      <div style={{ flex: 1, position: 'relative' }}>
        <div id="leaflet-map" style={{ width: '100%', height: '100%' }} />

        {/* Легенда */}
        {mapData && (
          <div style={{
            position: 'absolute',
            bottom: 24,
            left: 24,
            background: 'rgba(26,29,39,0.92)',
            border: '1px solid var(--color-border)',
            borderRadius: 8,
            padding: '10px 14px',
            zIndex: 800,
            minWidth: 180,
          }}>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 6 }}>
              {mapData.meta.label}
            </div>
            <div style={{
              height: 10,
              borderRadius: 4,
              background: 'linear-gradient(to right, rgb(15,52,96), rgb(26,95,180), rgb(45,180,130), rgb(250,210,50), rgb(220,60,30))',
              marginBottom: 4,
            }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--color-text-muted)' }}>
              <span>{new Intl.NumberFormat('ru-RU', { notation: 'compact' }).format(mapData.min)}</span>
              <span>{new Intl.NumberFormat('ru-RU', { notation: 'compact' }).format(mapData.max)}</span>
            </div>
          </div>
        )}

        {/* Сайдбар страны */}
        <CountrySidebar
          country={selectedCountry}
          onClose={() => setSelectedCountry(null)}
        />
      </div>

      {/* Стили тултипа Leaflet */}
      <style>{`
        .map-tooltip {
          background: #1a1d27;
          border: 1px solid #2a2d3a;
          color: #e8eaf0;
          font-size: 13px;
          border-radius: 6px;
          padding: 6px 10px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.4);
        }
        .map-tooltip::before { display: none; }
        #leaflet-map { background: #0f1117; }
      `}</style>
    </div>
  )
}
