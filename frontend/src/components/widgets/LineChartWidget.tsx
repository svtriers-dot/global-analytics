/**
 * LineChartWidget — линейный график временного ряда.
 * Источники: FRED (серия), World Bank (история страны).
 */

import { useEffect, useState } from 'react'
import {
  ResponsiveContainer, LineChart, Line,
  XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts'
import { fetchFredSeries, fetchWbHistory } from '../../api/finance'
import type { WidgetConfig } from '../../types/dashboard'
import { WidgetHeader, cardStyle, mutedStyle } from './KPICard'

interface Props {
  config: WidgetConfig
  onRemove: () => void
}

interface Point { date: string; value: number }

// Период → глубина World Bank в годах
const PERIOD_YEARS: Record<string, number> = { '1y': 5, '5y': 10, '10y': 20 }

// Период → FRED период
const PERIOD_FRED: Record<string, '1m' | '1y' | '5y'> = {
  '1y': '1y', '5y': '5y', '10y': '5y',
}

function formatYAxis(v: number): string {
  if (Math.abs(v) >= 1e12) return `${(v / 1e12).toFixed(0)}T`
  if (Math.abs(v) >= 1e9)  return `${(v / 1e9).toFixed(0)}B`
  if (Math.abs(v) >= 1e6)  return `${(v / 1e6).toFixed(0)}M`
  if (Math.abs(v) >= 1e3)  return `${(v / 1e3).toFixed(0)}K`
  return `${v}`
}

export default function LineChartWidget({ config, onRemove }: Props) {
  const [data, setData] = useState<Point[]>([])
  const [unit, setUnit] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const period = config.period ?? '5y'

  useEffect(() => {
    setLoading(true)
    setError(null)

    const load = async () => {
      if (config.source === 'fred' && config.seriesId) {
        const res = await fetchFredSeries(config.seriesId, PERIOD_FRED[period] ?? '5y')
        if (res.error) {
          throw new Error(
            res.error === 'fred_key_missing'
              ? 'FRED API ключ не настроен'
              : res.error
          )
        }
        setUnit(res.unit)
        setData(res.series.map(p => ({ date: p.date, value: p.value })))
      } else if (config.source === 'world_bank' && config.country && config.indicator) {
        const res = await fetchWbHistory(config.country, config.indicator, PERIOD_YEARS[period] ?? 10)
        setUnit(res.unit)
        setData(res.series.map(p => ({ date: p.year, value: p.value })))
      } else {
        throw new Error('Неполная конфигурация виджета')
      }
    }

    load()
      .catch(e => setError(e.message ?? 'Ошибка загрузки'))
      .finally(() => setLoading(false))
  }, [config.source, config.seriesId, config.country, config.indicator, period])

  return (
    <div style={{ ...cardStyle, minHeight: 240 }}>
      <WidgetHeader title={config.title} onRemove={onRemove} />

      {loading && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={mutedStyle}>Загрузка…</span>
        </div>
      )}
      {error && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <span style={{ color: 'var(--color-danger)', fontSize: 12 }}>{error}</span>
        </div>
      )}
      {!loading && !error && data.length === 0 && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={mutedStyle}>Нет данных</span>
        </div>
      )}
      {!loading && !error && data.length > 0 && (
        <div style={{ flex: 1, padding: '8px 8px 4px', minHeight: 180 }}>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={data} margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis
                dataKey="date"
                tick={{ fill: 'var(--color-text-muted)', fontSize: 10, fontFamily: 'var(--font-mono)' }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
                tickFormatter={d => d.slice(0, 4)}
              />
              <YAxis
                tick={{ fill: 'var(--color-text-muted)', fontSize: 10, fontFamily: 'var(--font-mono)' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={formatYAxis}
                width={48}
              />
              <Tooltip
                contentStyle={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 6, fontSize: 12, fontFamily: 'var(--font-mono)' }}
                labelStyle={{ color: 'var(--color-text-muted)' }}
                itemStyle={{ color: 'var(--color-accent)' }}
                formatter={(v: number) => [`${v}${unit ? ' ' + unit : ''}`, '']}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="var(--color-accent)"
                strokeWidth={1.5}
                dot={false}
                activeDot={{ r: 4, fill: 'var(--color-accent)', stroke: 'var(--color-bg)', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
          {unit && (
            <div style={{ textAlign: 'right', fontSize: 10, color: 'var(--color-text-muted)', paddingRight: 12, fontFamily: 'var(--font-mono)', letterSpacing: '0.06em' }}>{unit}</div>
          )}
        </div>
      )}
    </div>
  )
}
