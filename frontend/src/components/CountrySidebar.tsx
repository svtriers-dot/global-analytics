import { useEffect, useState } from 'react'
import { fetchCountryCard } from '../api/geo'
import type { CountryCardResponse, SelectedCountry } from '../types/geo'

type Props = {
  country: SelectedCountry | null
  onClose: () => void
}

function formatValue(value: number, unit: string): string {
  if (unit === '$') {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(value)
  }
  if (unit === '%') return `${value.toFixed(1)}%`
  return new Intl.NumberFormat('ru-RU', { notation: 'compact' }).format(value)
}

export default function CountrySidebar({ country, onClose }: Props) {
  const [card, setCard] = useState<CountryCardResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!country) { setCard(null); setError(null); return }
    setLoading(true)
    setError(null)
    setCard(null)

    // Таймаут 10 секунд — если API не ответил, показываем ошибку
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10_000)

    fetchCountryCard(country.iso2)
      .then(data => { setCard(data); setError(null) })
      .catch(() => setError('Не удалось загрузить данные по стране'))
      .finally(() => { setLoading(false); clearTimeout(timer) })
  }, [country?.iso2])

  if (!country) return null

  return (
    <div style={{
      position: 'absolute',
      top: 0,
      right: 0,
      width: 300,
      height: '100%',
      background: 'var(--color-surface)',
      borderLeft: '1px solid var(--color-border)',
      padding: 24,
      zIndex: 1000,
      overflowY: 'auto',
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
    }}>
      {/* Заголовок */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{country.name}</div>
          <div style={{ color: 'var(--color-text-muted)', fontSize: 12, marginTop: 2 }}>
            {country.iso3}
            {country.value !== undefined && (
              <span> · {new Intl.NumberFormat('ru-RU').format(Math.round(country.value))}</span>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--color-text-muted)',
            fontSize: 20,
            lineHeight: 1,
            cursor: 'pointer',
            padding: 4,
          }}
        >×</button>
      </div>

      {/* Показатели */}
      {loading && (
        <div style={{ color: 'var(--color-text-muted)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span>
          Загрузка данных...
        </div>
      )}

      {!loading && error && (
        <div style={{
          color: 'var(--color-danger)', fontSize: 13,
          padding: '10px 12px',
          background: 'rgba(248,113,113,0.08)',
          borderRadius: 'var(--radius)',
          border: '1px solid rgba(248,113,113,0.2)',
        }}>
          {error}
        </div>
      )}

      {!loading && !error && card && Object.keys(card.indicators).length === 0 && (
        <div style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
          Нет данных по этой стране
        </div>
      )}

      {!loading && !error && card && Object.entries(card.indicators).map(([code, ind]) => (
        <div key={code} style={{
          background: 'var(--color-bg)',
          borderRadius: 'var(--radius)',
          padding: '12px 14px',
        }}>
          <div style={{ color: 'var(--color-text-muted)', fontSize: 11, marginBottom: 4 }}>
            {ind.label} · {ind.year}
          </div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>
            {formatValue(ind.value, ind.unit)}
          </div>
        </div>
      ))}

      <div style={{ marginTop: 'auto', color: 'var(--color-text-muted)', fontSize: 11 }}>
        Источник: World Bank Open Data
      </div>
    </div>
  )
}
