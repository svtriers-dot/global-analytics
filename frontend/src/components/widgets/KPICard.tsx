/**
 * KPICard — карточка с одним числом.
 * Источники: World Bank (последнее значение), FRED (последнее значение серии).
 */

import { useEffect, useState } from 'react'
import { fetchWbCountryCard, fetchFredSeries } from '../../api/finance'
import type { WidgetConfig } from '../../types/dashboard'

interface Props {
  config: WidgetConfig
  onRemove: () => void
}

function formatValue(value: number, unit: string): string {
  if (unit === '$') {
    if (value >= 1_000_000_000_000) return `$${(value / 1e12).toFixed(1)}T`
    if (value >= 1_000_000_000)     return `$${(value / 1e9).toFixed(1)}B`
    if (value >= 1_000_000)         return `$${(value / 1e6).toFixed(1)}M`
    if (value >= 1_000)             return `$${(value / 1e3).toFixed(1)}K`
    return `$${value.toFixed(0)}`
  }
  if (unit === '%') return `${value.toFixed(2)}%`
  if (value >= 1_000_000_000) return `${(value / 1e9).toFixed(1)}B`
  if (value >= 1_000_000)     return `${(value / 1e6).toFixed(1)}M`
  if (value >= 1_000)         return `${(value / 1e3).toFixed(1)}K`
  return `${value.toFixed(1)}${unit ? ` ${unit}` : ''}`
}

export default function KPICard({ config, onRemove }: Props) {
  const [value, setValue] = useState<number | null>(null)
  const [unit, setUnit] = useState('')
  const [year, setYear] = useState('')
  const [dataSource, setDataSource] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setValue(null)
    setError(null)
    setLoading(true)

    // ── FRED source ───────────────────────────────────────────────────
    if (config.source === 'fred') {
      if (!config.seriesId) {
        setError('Не задан идентификатор серии')
        setLoading(false)
        return
      }
      fetchFredSeries(config.seriesId, '1y')
        .then(res => {
          if (res.error) {
            setError(
              res.error === 'fred_key_missing'
                ? 'FRED API ключ не настроен'
                : 'Ошибка загрузки'
            )
            return
          }
          if (res.series.length === 0) {
            setError('Нет данных')
            return
          }
          const last = res.series[res.series.length - 1]
          setValue(last.value)
          setUnit(res.unit)
          setYear(last.date.slice(0, 7))
          setDataSource('FRED')
        })
        .catch(() => setError('Ошибка загрузки'))
        .finally(() => setLoading(false))
      return
    }

    // ── World Bank source ─────────────────────────────────────────────
    if (!config.country || !config.indicator) {
      setError('Не задана страна или индикатор')
      setLoading(false)
      return
    }
    fetchWbCountryCard(config.country)
      .then(card => {
        const ind = card.indicators[config.indicator!]
        if (ind) {
          setValue(ind.value)
          setUnit(ind.unit)
          setYear(ind.year)
          setDataSource('World Bank')
        } else {
          setError('Нет данных')
        }
      })
      .catch(() => setError('Ошибка загрузки'))
      .finally(() => setLoading(false))
  }, [config.source, config.country, config.indicator, config.seriesId])

  return (
    <div style={cardStyle}>
      <WidgetHeader title={config.title} onRemove={onRemove} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '12px 16px 16px' }}>
        {loading && <span style={mutedStyle}>Загрузка…</span>}
        {error   && <span style={{ color: 'var(--color-danger)', fontSize: 12, textAlign: 'center' }}>{error}</span>}
        {!loading && !error && value !== null && (
          <>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 34, fontWeight: 600, color: 'var(--color-accent)', letterSpacing: '-1px', lineHeight: 1.1 }}>
              {formatValue(value, unit)}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text-muted)', marginTop: 8, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              {year}{year && dataSource ? '  ·  ' : ''}{dataSource}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Shared header (SitDeck-style) ─────────────────────────────────────────

export function WidgetHeader({ title, onRemove }: { title: string; onRemove: () => void }) {
  return (
    <div className="widget-header">
      <div className="widget-title">
        <span className="widget-drag">⠿</span>
        <span className="widget-title-text">{title}</span>
      </div>
      <button onClick={onRemove} className="widget-close" title="Удалить виджет">×</button>
    </div>
  )
}

// ── Shared styles ─────────────────────────────────────────────────────────

export const cardStyle: React.CSSProperties = {
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius)' as unknown as number,
  display: 'flex',
  flexDirection: 'column',
  minHeight: 160,
  overflow: 'hidden',
}

export const mutedStyle: React.CSSProperties = {
  color: 'var(--color-text-muted)',
  fontSize: 12,
  fontFamily: 'var(--font-mono)',
}
