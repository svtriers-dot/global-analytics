/**
 * AddWidgetModal — модальное окно добавления нового виджета.
 * Шаг 1: выбрать тип виджета.
 * Шаг 2: настроить источник данных и параметры.
 */

import { useState } from 'react'
import type { WidgetConfig, WidgetType, DataSource, Period } from '../types/dashboard'
import { generateId } from '../types/dashboard'

interface Props {
  onAdd: (widget: WidgetConfig) => void
  onClose: () => void
}

const WB_INDICATORS = [
  { code: 'NY.GDP.PCAP.CD', label: 'ВВП на душу населения ($)' },
  { code: 'NY.GDP.MKTP.CD', label: 'ВВП всего ($)' },
  { code: 'FP.CPI.TOTL.ZG', label: 'Инфляция (%)' },
  { code: 'SL.UEM.TOTL.ZS', label: 'Безработица (%)' },
  { code: 'SP.POP.TOTL',    label: 'Население' },
]

const FRED_SERIES = [
  { id: 'FEDFUNDS',  label: 'Fed Funds Rate' },
  { id: 'DGS10',    label: '10Y Treasury Yield' },
  { id: 'ECBDFR',   label: 'ECB Deposit Rate' },
  { id: 'T10YIE',   label: '10Y Breakeven Inflation' },
  { id: 'M2SL',     label: 'M2 Money Supply' },
  { id: 'CPIAUCSL', label: 'CPI (US)' },
  { id: 'UNRATE',   label: 'Unemployment Rate (US)' },
]

const COUNTRIES = [
  { code: 'US', label: 'США' },
  { code: 'CN', label: 'Китай' },
  { code: 'DE', label: 'Германия' },
  { code: 'JP', label: 'Япония' },
  { code: 'GB', label: 'Великобритания' },
  { code: 'FR', label: 'Франция' },
  { code: 'IN', label: 'Индия' },
  { code: 'BR', label: 'Бразилия' },
  { code: 'CA', label: 'Канада' },
  { code: 'KR', label: 'Южная Корея' },
  { code: 'RU', label: 'Россия' },
  { code: 'AU', label: 'Австралия' },
  { code: 'IT', label: 'Италия' },
  { code: 'ES', label: 'Испания' },
  { code: 'MX', label: 'Мексика' },
  { code: 'TR', label: 'Турция' },
  { code: 'SA', label: 'Саудовская Аравия' },
  { code: 'PL', label: 'Польша' },
  { code: 'NL', label: 'Нидерланды' },
  { code: 'CH', label: 'Швейцария' },
]

type Step = 'type' | 'config'

export default function AddWidgetModal({ onAdd, onClose }: Props) {
  const [step, setStep] = useState<Step>('type')
  const [type, setType] = useState<WidgetType>('kpi')
  const [source, setSource] = useState<DataSource>('world_bank')
  const [indicator, setIndicator] = useState(WB_INDICATORS[0].code)
  const [seriesId, setSeriesId] = useState(FRED_SERIES[0].id)
  const [country, setCountry] = useState('US')
  const [period, setPeriod] = useState<Period>('5y')

  function buildTitle(): string {
    if (source === 'fred') {
      const s = FRED_SERIES.find(x => x.id === seriesId)
      return s?.label ?? seriesId
    }
    const ind = WB_INDICATORS.find(x => x.code === indicator)
    if (type === 'bar') return `${ind?.label ?? indicator} — топ стран`
    const c = COUNTRIES.find(x => x.code === country)
    return `${ind?.label ?? indicator} — ${c?.label ?? country}`
  }

  function handleAdd() {
    const config: WidgetConfig = {
      id: generateId(),
      type,
      title: buildTitle(),
      source,
      ...(source === 'world_bank' && { indicator }),
      ...(source === 'fred'       && { seriesId }),
      ...(source === 'world_bank' && type !== 'bar' && { country }),
      ...(type !== 'kpi' && { period }),
    }
    onAdd(config)
    onClose()
  }

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={e => e.stopPropagation()}>
        {/* Заголовок */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingBottom: 14, borderBottom: '1px solid var(--color-border)' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>
            ⠿ {step === 'type' ? 'Тип виджета' : 'Настройка виджета'}
          </span>
          <button onClick={onClose} style={closeBtnStyle}>×</button>
        </div>

        {/* Шаг 1: выбор типа */}
        {step === 'type' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            {([
              { t: 'kpi',  emoji: '🔢', label: 'KPI',        desc: 'Одно актуальное значение' },
              { t: 'line', emoji: '📈', label: 'Линейный',   desc: 'График за период' },
              { t: 'bar',  emoji: '📊', label: 'Столбчатый', desc: 'Топ стран' },
            ] as { t: WidgetType; emoji: string; label: string; desc: string }[]).map(({ t, emoji, label, desc }) => (
              <button
                key={t}
                onClick={() => { setType(t); setStep('config') }}
                style={{
                  background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 8,
                  padding: '18px 10px', cursor: 'pointer', textAlign: 'center',
                  transition: 'border-color 0.15s, background 0.15s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'var(--color-accent)'
                  e.currentTarget.style.background = 'var(--color-accent-dim)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'var(--color-border)'
                  e.currentTarget.style.background = 'var(--color-surface-2)'
                }}
              >
                <div style={{ fontSize: 26, marginBottom: 8 }}>{emoji}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, color: 'var(--color-text)', letterSpacing: '0.06em', marginBottom: 4 }}>{label.toUpperCase()}</div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{desc}</div>
              </button>
            ))}
          </div>
        )}

        {/* Шаг 2: настройка */}
        {step === 'config' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Источник */}
            <Label text="Источник данных">
              <div style={{ display: 'flex', gap: 8 }}>
                {([
                  { s: 'world_bank', label: '🌍 World Bank' },
                  ...(type !== 'bar' ? [{ s: 'fred', label: '🏦 FRED' }] : []),
                ] as { s: DataSource; label: string }[]).map(({ s, label }) => (
                  <ToggleBtn key={s} active={source === s} onClick={() => setSource(s)}>{label}</ToggleBtn>
                ))}
              </div>
            </Label>

            {/* World Bank */}
            {source === 'world_bank' && (
              <Label text="Индикатор">
                <select value={indicator} onChange={e => setIndicator(e.target.value)} style={selectStyle}>
                  {WB_INDICATORS.map(i => <option key={i.code} value={i.code}>{i.label}</option>)}
                </select>
              </Label>
            )}

            {/* FRED */}
            {source === 'fred' && (
              <Label text="Серия FRED">
                <select value={seriesId} onChange={e => setSeriesId(e.target.value)} style={selectStyle}>
                  {FRED_SERIES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </Label>
            )}

            {/* Страна */}
            {source === 'world_bank' && type !== 'bar' && (
              <Label text="Страна">
                <select value={country} onChange={e => setCountry(e.target.value)} style={selectStyle}>
                  {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
                </select>
              </Label>
            )}

            {/* Период (для line) */}
            {type === 'line' && (
              <Label text="Период">
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['1y', '5y', '10y'] as Period[]).map(p => (
                    <ToggleBtn key={p} active={period === p} onClick={() => setPeriod(p)}>
                      {p === '1y' ? '1 год' : p === '5y' ? '5 лет' : '10 лет'}
                    </ToggleBtn>
                  ))}
                </div>
              </Label>
            )}

            {/* Preview заголовка */}
            <div style={{
              background: 'var(--color-surface-2)',
              border: '1px solid var(--color-accent-dim)',
              borderRadius: 6, padding: '10px 14px',
              fontFamily: 'var(--font-mono)', fontSize: 11,
              color: 'var(--color-text-muted)', letterSpacing: '0.04em',
            }}>
              📌 {buildTitle()}
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button onClick={() => setStep('type')} style={secondaryBtnStyle}>← Назад</button>
              <button onClick={handleAdd} style={primaryBtnStyle}>Добавить</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────

function Label({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>{text}</div>
      {children}
    </div>
  )
}

function ToggleBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      padding: '6px 14px', borderRadius: 5, fontSize: 12, cursor: 'pointer',
      fontFamily: 'var(--font-mono)',
      background: active ? 'var(--color-accent-dim)' : 'var(--color-surface-2)',
      border: `1px solid ${active ? 'var(--color-accent)' : 'var(--color-border)'}`,
      color: active ? 'var(--color-accent)' : 'var(--color-text-muted)',
      transition: 'all 0.15s',
    }}>
      {children}
    </button>
  )
}

// ── Styles ─────────────────────────────────────────────────────────────

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0,
  background: 'rgba(0,0,0,0.7)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 1000,
  backdropFilter: 'blur(2px)',
}
const modalStyle: React.CSSProperties = {
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 10,
  padding: 24,
  width: 420,
  maxWidth: '95vw',
  boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
}
const closeBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', fontSize: 20, cursor: 'pointer',
  color: 'var(--color-text-muted)', padding: '0 4px', lineHeight: 1,
  opacity: 0.5,
  transition: 'opacity 0.15s',
}
const selectStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', borderRadius: 5,
  background: 'var(--color-surface-2)', border: '1px solid var(--color-border)',
  color: 'var(--color-text)', fontSize: 13, outline: 'none',
  fontFamily: 'inherit',
}
const primaryBtnStyle: React.CSSProperties = {
  flex: 1, padding: '10px 0', borderRadius: 6, border: 'none',
  background: 'var(--color-accent)', color: '#000',
  fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
  letterSpacing: '0.08em', cursor: 'pointer',
  transition: 'background 0.15s',
}
const secondaryBtnStyle: React.CSSProperties = {
  padding: '10px 18px', borderRadius: 6,
  background: 'var(--color-surface-2)', border: '1px solid var(--color-border)',
  color: 'var(--color-text-muted)',
  fontFamily: 'var(--font-mono)', fontSize: 11, cursor: 'pointer',
}
