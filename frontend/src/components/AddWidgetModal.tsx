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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 17, color: '#e2e8f0' }}>
            {step === 'type' ? 'Тип виджета' : 'Настройка виджета'}
          </h2>
          <button onClick={onClose} style={closeBtnStyle}>×</button>
        </div>

        {/* Шаг 1: выбор типа */}
        {step === 'type' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            {([
              { t: 'kpi',  emoji: '🔢', label: 'KPI',          desc: 'Одно актуальное значение' },
              { t: 'line', emoji: '📈', label: 'Линейный',     desc: 'График за период' },
              { t: 'bar',  emoji: '📊', label: 'Столбчатый',   desc: 'Топ стран по показателю' },
            ] as { t: WidgetType; emoji: string; label: string; desc: string }[]).map(({ t, emoji, label, desc }) => (
              <button
                key={t}
                onClick={() => { setType(t); setStep('config') }}
                style={{
                  background: '#252b3b', border: '1px solid #2d3348', borderRadius: 10,
                  padding: '20px 12px', cursor: 'pointer', textAlign: 'center',
                  transition: 'border-color 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = '#38bdf8')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = '#2d3348')}
              >
                <div style={{ fontSize: 28, marginBottom: 8 }}>{emoji}</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0', marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 11, color: '#64748b' }}>{desc}</div>
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

            {/* Страна (не для bar, не для FRED) */}
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
            <div style={{ background: '#1a1f2e', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#94a3b8' }}>
              📌 {buildTitle()}
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button onClick={() => setStep('type')} style={secondaryBtnStyle}>← Назад</button>
              <button onClick={handleAdd} style={primaryBtnStyle}>Добавить виджет</button>
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
      <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>{text}</div>
      {children}
    </div>
  )
}

function ToggleBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      padding: '6px 14px', borderRadius: 6, fontSize: 13, cursor: 'pointer',
      background: active ? '#1e3a5f' : '#252b3b',
      border: `1px solid ${active ? '#38bdf8' : '#2d3348'}`,
      color: active ? '#38bdf8' : '#94a3b8',
    }}>
      {children}
    </button>
  )
}

// ── Styles ─────────────────────────────────────────────────────────────

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0,
  background: 'rgba(0,0,0,0.6)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 1000,
}
const modalStyle: React.CSSProperties = {
  background: '#1e2130',
  border: '1px solid #2d3348',
  borderRadius: 14,
  padding: 24,
  width: 420,
  maxWidth: '95vw',
  boxShadow: '0 24px 48px rgba(0,0,0,0.5)',
}
const closeBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', fontSize: 22, cursor: 'pointer',
  color: '#64748b', padding: '0 4px', lineHeight: 1,
}
const selectStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', borderRadius: 6,
  background: '#252b3b', border: '1px solid #2d3348',
  color: '#e2e8f0', fontSize: 13, outline: 'none',
}
const primaryBtnStyle: React.CSSProperties = {
  flex: 1, padding: '10px 0', borderRadius: 8, border: 'none',
  background: '#1d4ed8', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
}
const secondaryBtnStyle: React.CSSProperties = {
  padding: '10px 18px', borderRadius: 8,
  background: '#252b3b', border: '1px solid #2d3348',
  color: '#94a3b8', fontSize: 14, cursor: 'pointer',
}
