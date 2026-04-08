/**
 * BarChartWidget — горизонтальная столбчатая диаграмма.
 * Показывает топ-15 стран по выбранному индикатору (World Bank map-data).
 */

import { useEffect, useState } from 'react'
import {
  ResponsiveContainer, BarChart, Bar,
  XAxis, YAxis, Tooltip, Cell,
} from 'recharts'
import { fetchWbMapData } from '../../api/finance'
import type { WidgetConfig } from '../../types/dashboard'
import { WidgetHeader, cardStyle, mutedStyle } from './KPICard'

interface Props {
  config: WidgetConfig
  onRemove: () => void
}

interface Point { name: string; value: number; code: string }

const BAR_COLOR = '#818cf8'
const BAR_TOP_COLOR = '#f59e0b'

function abbreviate(name: string): string {
  const map: Record<string, string> = {
    'United States': 'USA', 'United Kingdom': 'UK',
    'Russian Federation': 'Russia', 'Korea, Rep.': 'S.Korea',
    'Iran, Islamic Rep.': 'Iran', 'Venezuela, RB': 'Venezuela',
    'Egypt, Arab Rep.': 'Egypt', 'Czech Republic': 'Czechia',
    'Slovak Republic': 'Slovakia',
  }
  return map[name] ?? (name.length > 12 ? name.slice(0, 11) + '…' : name)
}

function formatVal(v: number, unit: string): string {
  if (unit === '$') {
    if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`
    if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`
    return `$${v.toFixed(0)}`
  }
  if (unit === '%') return `${v.toFixed(1)}%`
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`
  return `${v.toFixed(0)}`
}

export default function BarChartWidget({ config, onRemove }: Props) {
  const [data, setData] = useState<Point[]>([])
  const [unit, setUnit] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const indicator = config.indicator ?? 'NY.GDP.PCAP.CD'

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetchWbMapData(indicator)
      .then(res => {
        setUnit(res.meta.unit)
        // Сортируем по убыванию, берём топ-15
        const top = [...res.data]
          .sort((a, b) => b.value - a.value)
          .slice(0, 15)
          .map(d => ({ name: abbreviate(d.country_name), value: d.value, code: d.country_code }))
        setData(top)
      })
      .catch(e => setError(e.message ?? 'Ошибка загрузки'))
      .finally(() => setLoading(false))
  }, [indicator])

  const chartHeight = Math.max(200, data.length * 24)

  return (
    <div style={{ ...cardStyle, minHeight: 280 }}>
      <WidgetHeader title={config.title} onRemove={onRemove} />

      {loading && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={mutedStyle}>Загрузка…</span>
        </div>
      )}
      {error && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <span style={{ color: '#ef4444', fontSize: 13 }}>{error}</span>
        </div>
      )}
      {!loading && !error && data.length > 0 && (
        <div style={{ padding: '8px 4px 8px 0', overflowY: 'auto' }}>
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 0, right: 48, bottom: 0, left: 4 }}
            >
              <XAxis
                type="number"
                tick={{ fill: '#64748b', fontSize: 9 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={v => formatVal(v, unit)}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={68}
                tick={{ fill: '#94a3b8', fontSize: 10 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{ background: '#1a1f2e', border: '1px solid #2d3348', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: '#94a3b8' }}
                itemStyle={{ color: BAR_TOP_COLOR }}
                formatter={(v: number) => [formatVal(v, unit), '']}
              />
              <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={18}>
                {data.map((_, i) => (
                  <Cell key={i} fill={i === 0 ? BAR_TOP_COLOR : BAR_COLOR} fillOpacity={1 - i * 0.03} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
