import { useState, useEffect, useRef, useCallback } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import {
  fetchAllCountries,
  fetchCompareSeries,
  fetchCompareSummary,
} from '../api/geo'
import type {
  CountryOption,
  CompareSeriesResponse,
  CompareSummaryResponse,
} from '../types/geo'

// ─── Константы ───────────────────────────────────────────────────────────────

const COUNTRY_COLORS = ['#4f8ef7', '#4ade80', '#f59e0b', '#f87171', '#a78bfa']

const INDICATORS = [
  { code: 'NY.GDP.PCAP.CD', label: 'ВВП на душу населения', unit: '$' },
  { code: 'FP.CPI.TOTL.ZG', label: 'Инфляция',              unit: '%' },
  { code: 'SL.UEM.TOTL.ZS', label: 'Безработица',            unit: '%' },
  { code: 'SP.POP.TOTL',    label: 'Население',              unit: ''  },
  { code: 'NY.GDP.MKTP.CD', label: 'ВВП (всего)',            unit: '$' },
]

const PERIODS = [
  { value: 5,  label: '5 лет'  },
  { value: 10, label: '10 лет' },
  { value: 20, label: '20 лет' },
]

// ─── Утилиты ─────────────────────────────────────────────────────────────────

function formatLargeNumber(v: number): string {
  if (v >= 1_000_000_000_000) return `${(v / 1e12).toFixed(1)}T`
  if (v >= 1_000_000_000)     return `${(v / 1e9).toFixed(1)}B`
  if (v >= 1_000_000)         return `${(v / 1e6).toFixed(1)}M`
  if (v >= 1_000)             return `${(v / 1e3).toFixed(0)}k`
  return String(v)
}

// Слияние временных рядов нескольких стран в плоский массив для Recharts
function mergeForChart(data: CompareSeriesResponse): Record<string, unknown>[] {
  const yearMap = new Map<string, Record<string, unknown>>()
  for (const [iso2, countryData] of Object.entries(data.countries)) {
    for (const pt of countryData.series) {
      if (!yearMap.has(pt.year)) yearMap.set(pt.year, { year: pt.year })
      yearMap.get(pt.year)![iso2] = pt.value
    }
  }
  return Array.from(yearMap.values()).sort((a, b) =>
    String(a.year).localeCompare(String(b.year))
  )
}

// Экспорт SVG-графика в PNG через canvas
function exportChartAsPNG(chartEl: HTMLDivElement | null) {
  if (!chartEl) return
  const svg = chartEl.querySelector('svg')
  if (!svg) return

  const clone = svg.cloneNode(true) as SVGElement
  const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
  rect.setAttribute('width', '100%')
  rect.setAttribute('height', '100%')
  rect.setAttribute('fill', '#0f1117')
  clone.insertBefore(rect, clone.firstChild)

  const svgData = new XMLSerializer().serializeToString(clone)
  const canvas  = document.createElement('canvas')
  const ctx     = canvas.getContext('2d')
  if (!ctx) return  // браузер не поддерживает canvas (крайне редко)

  canvas.width  = svg.clientWidth  || 800
  canvas.height = svg.clientHeight || 400

  const img = new Image()
  img.onload = () => {
    ctx.fillStyle = '#0f1117'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0)
    const link     = document.createElement('a')
    link.download  = 'comparison.png'
    link.href      = canvas.toDataURL('image/png')
    link.click()
  }
  img.onerror = () => console.error('Не удалось конвертировать SVG в PNG')
  img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)))
}

// Экспорт сводной таблицы в CSV
function exportSummaryAsCSV(
  selected: CountryOption[],
  summaryData: CompareSummaryResponse,
) {
  const header = ['Показатель', ...selected.map(c => summaryData[c.iso2]?.name || c.name)]
  const rows   = [header]

  for (const ind of INDICATORS) {
    const row = [ind.label]
    for (const c of selected) {
      const val = summaryData[c.iso2]?.indicators?.[ind.code]?.value
      row.push(val != null ? String(val) : '—')
    }
    rows.push(row)
  }

  const csv  = rows.map(r => r.map(cell => `"${cell}"`).join(',')).join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href  = url
  link.download = 'comparison.csv'
  link.click()
  URL.revokeObjectURL(url)
}

// ─── Компонент ───────────────────────────────────────────────────────────────

export default function ComparePage() {
  const [allCountries,     setAllCountries]     = useState<CountryOption[]>([])
  const [countriesLoading, setCountriesLoading] = useState(true)
  const [selected,         setSelected]         = useState<CountryOption[]>([])
  const [indicator,        setIndicator]        = useState('NY.GDP.PCAP.CD')
  const [years,            setYears]            = useState(10)

  const [seriesData,  setSeriesData]  = useState<CompareSeriesResponse | null>(null)
  const [summaryData, setSummaryData] = useState<CompareSummaryResponse | null>(null)
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState<string | null>(null)

  // Дропдаун выбора страны
  const [search,       setSearch]       = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const chartRef    = useRef<HTMLDivElement>(null)

  // Загрузка списка стран при монтировании
  useEffect(() => {
    setCountriesLoading(true)
    fetchAllCountries()
      .then(setAllCountries)
      .catch(() => {/* список не загрузился — пользователь увидит пустой дропдаун */})
      .finally(() => setCountriesLoading(false))
  }, [])

  // Закрытие дропдауна при клике вне него
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const filtered = allCountries.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) &&
    !selected.find(s => s.iso2 === c.iso2)
  )

  const addCountry = useCallback((country: CountryOption) => {
    if (selected.length >= 5) return
    setSelected(prev => [...prev, country])
    setSearch('')
    setDropdownOpen(false)
  }, [selected.length])

  const removeCountry = (iso2: string) => {
    setSelected(prev => prev.filter(c => c.iso2 !== iso2))
    setSeriesData(null)
    setSummaryData(null)
  }

  const handleCompare = async () => {
    if (selected.length < 2) return
    setLoading(true)
    setError(null)
    try {
      const codes = selected.map(c => c.iso2)
      const [series, summary] = await Promise.all([
        fetchCompareSeries(codes, indicator, years),
        fetchCompareSummary(codes),
      ])
      setSeriesData(series)
      setSummaryData(summary)
    } catch {
      setError('Ошибка загрузки данных. Проверьте подключение к бэкенду.')
    } finally {
      setLoading(false)
    }
  }

  const chartData = seriesData ? mergeForChart(seriesData) : []
  const indicatorMeta = INDICATORS.find(i => i.code === indicator)

  return (
    <div className="compare-page">

      {/* ── Панель управления ── */}
      <div className="compare-controls">

        {/* Мультиселект стран */}
        <div className="country-selector" ref={dropdownRef}>
          <div
            className="selected-tags"
            onClick={() => { if (selected.length < 5) setDropdownOpen(true) }}
          >
            {selected.map((c, i) => (
              <span
                key={c.iso2}
                className="country-tag"
                style={{ borderColor: COUNTRY_COLORS[i] }}
              >
                <span className="tag-dot" style={{ background: COUNTRY_COLORS[i] }} />
                {c.name}
                <button
                  className="tag-remove"
                  onClick={e => { e.stopPropagation(); removeCountry(c.iso2) }}
                >×</button>
              </span>
            ))}

            {selected.length < 5 && (
              <input
                className="country-input"
                value={search}
                onChange={e => { setSearch(e.target.value); setDropdownOpen(true) }}
                onFocus={() => setDropdownOpen(true)}
                disabled={countriesLoading}
                placeholder={
                  countriesLoading
                    ? 'Загрузка стран...'
                    : selected.length === 0 ? 'Выберите страны (2–5)...' : '+ Добавить страну...'
                }
              />
            )}
          </div>

          {dropdownOpen && filtered.length > 0 && (
            <div className="country-dropdown">
              {filtered.slice(0, 60).map(c => (
                <div
                  key={c.iso2}
                  className="country-option"
                  onMouseDown={() => addCountry(c)}
                >
                  <span className="option-name">{c.name}</span>
                  <span className="option-region">{c.region}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Индикатор */}
        <select
          className="compare-select"
          value={indicator}
          onChange={e => { setIndicator(e.target.value); setSeriesData(null) }}
        >
          {INDICATORS.map(i => (
            <option key={i.code} value={i.code}>{i.label}</option>
          ))}
        </select>

        {/* Период */}
        <select
          className="compare-select"
          value={years}
          onChange={e => { setYears(Number(e.target.value)); setSeriesData(null) }}
        >
          {PERIODS.map(p => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>

        {/* Кнопка */}
        <button
          className="btn-primary"
          onClick={handleCompare}
          disabled={selected.length < 2 || loading}
        >
          {loading ? 'Загрузка...' : 'Сравнить'}
        </button>

        {/* Экспорт */}
        {seriesData && summaryData && (
          <div className="export-buttons">
            <button
              className="btn-secondary"
              onClick={() => exportSummaryAsCSV(selected, summaryData)}
            >↓ CSV</button>
            <button
              className="btn-secondary"
              onClick={() => exportChartAsPNG(chartRef.current)}
            >↓ PNG</button>
          </div>
        )}
      </div>

      {/* ── Ошибка ── */}
      {error && <div className="compare-error">{error}</div>}

      {/* ── График ── */}
      {seriesData && (
        <div className="compare-chart-wrap" ref={chartRef}>
          <div className="compare-section-title">
            {seriesData.label}
            {seriesData.unit && <span className="unit-badge">{seriesData.unit}</span>}
            <span className="period-badge">за {years} лет</span>
          </div>
          <ResponsiveContainer width="100%" height={340}>
            <LineChart data={chartData} margin={{ top: 8, right: 32, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis
                dataKey="year"
                stroke="var(--color-text-muted)"
                tick={{ fontSize: 12 }}
              />
              <YAxis
                stroke="var(--color-text-muted)"
                tick={{ fontSize: 11 }}
                tickFormatter={formatLargeNumber}
                width={60}
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 8,
                  fontSize: 13,
                }}
                labelStyle={{ color: 'var(--color-text-muted)', marginBottom: 4 }}
                formatter={(value: unknown, name: string) => {
                  const countryName = seriesData.countries[name]?.name || name
                  const numVal = typeof value === 'number' ? value : Number(value)
                  return [
                    `${numVal.toLocaleString('ru-RU')} ${seriesData.unit}`,
                    countryName,
                  ]
                }}
              />
              <Legend
                formatter={value => seriesData.countries[value]?.name || value}
                wrapperStyle={{ paddingTop: 12, fontSize: 13 }}
              />
              {selected.map((c, i) => (
                <Line
                  key={c.iso2}
                  type="monotone"
                  dataKey={c.iso2}
                  stroke={COUNTRY_COLORS[i]}
                  strokeWidth={2.5}
                  dot={false}
                  connectNulls
                  activeDot={{ r: 5 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Сводная таблица ── */}
      {summaryData && (
        <div className="compare-table-wrap">
          <div className="compare-section-title">Ключевые показатели</div>
          <div className="compare-table-scroll">
            <table className="compare-table">
              <thead>
                <tr>
                  <th className="th-indicator">Показатель</th>
                  {selected.map((c, i) => (
                    <th key={c.iso2} style={{ color: COUNTRY_COLORS[i] }}>
                      {summaryData[c.iso2]?.name || c.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {INDICATORS.map((ind, rowIdx) => (
                  <tr key={ind.code} className={rowIdx % 2 === 0 ? 'row-even' : ''}>
                    <td className="td-label">{ind.label}</td>
                    {selected.map(c => {
                      const entry = summaryData[c.iso2]?.indicators?.[ind.code]
                      return (
                        <td key={c.iso2} className="td-value">
                          {entry != null ? (
                            <>
                              <span className="val-number">
                                {entry.value.toLocaleString('ru-RU')}
                              </span>
                              {entry.unit && (
                                <span className="val-unit"> {entry.unit}</span>
                              )}
                              <span className="val-year">{entry.year}</span>
                            </>
                          ) : (
                            <span className="val-empty">—</span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Пустое состояние ── */}
      {!seriesData && !loading && !error && (
        <div className="compare-empty">
          <div className="compare-empty-icon">🌍</div>
          <div className="compare-empty-title">Выберите страны для сравнения</div>
          <div className="compare-empty-hint">
            Выберите 2–5 стран, индикатор и период — затем нажмите «Сравнить»
          </div>
          {selected.length === 1 && (
            <div className="compare-empty-warn">
              Нужно ещё как минимум одну страну
            </div>
          )}
        </div>
      )}

      {/* Подсказка про индикатор */}
      {indicatorMeta && (
        <div className="compare-footer-hint">
          Источник данных: World Bank Open Data · {indicatorMeta.label}
          {indicatorMeta.unit && ` (${indicatorMeta.unit})`}
        </div>
      )}
    </div>
  )
}
