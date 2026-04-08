/**
 * DashboardPage — дашборд с настраиваемыми виджетами (Этап 3).
 *
 * Возможности:
 *  - 3 типа виджетов: KPI-карточка, линейный график, столбчатый график
 *  - Источники данных: World Bank (актуальные + история), FRED (временные ряды)
 *  - FAB-кнопка для добавления виджетов (зелёная, как в SitDeck)
 *  - Сброс к виджетам по умолчанию
 *  - Конфигурация сохраняется в localStorage между сессиями
 */

import { useState } from 'react'
import { loadDashboard, saveDashboard, type WidgetConfig } from '../types/dashboard'
import KPICard from '../components/widgets/KPICard'
import LineChartWidget from '../components/widgets/LineChartWidget'
import BarChartWidget from '../components/widgets/BarChartWidget'
import AddWidgetModal from '../components/AddWidgetModal'

export default function DashboardPage() {
  const [widgets, setWidgets] = useState<WidgetConfig[]>(loadDashboard)
  const [showModal, setShowModal] = useState(false)

  function handleAdd(widget: WidgetConfig) {
    const next = [...widgets, widget]
    setWidgets(next)
    saveDashboard(next)
  }

  function handleRemove(id: string) {
    const next = widgets.filter(w => w.id !== id)
    setWidgets(next)
    saveDashboard(next)
  }

  function handleReset() {
    if (!confirm('Сбросить дашборд к виджетам по умолчанию?')) return
    localStorage.removeItem('ga_dashboard_v1')
    setWidgets(loadDashboard())
  }

  return (
    <div style={{ padding: '20px 24px', minHeight: '100%', position: 'relative' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>
          ⠿ Дашборд
        </h1>
        <button
          onClick={handleReset}
          style={resetBtnStyle}
          title="Сбросить к виджетам по умолчанию"
        >
          ↺ Сброс
        </button>
      </div>

      {/* Пустой дашборд */}
      {widgets.length === 0 && (
        <div style={{ textAlign: 'center', marginTop: 80, color: 'var(--color-text-muted)' }}>
          <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.4 }}>📊</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8, color: 'var(--color-text)' }}>
            Дашборд пуст
          </div>
          <div style={{ fontSize: 13, marginBottom: 28 }}>
            Нажмите <span style={{ color: 'var(--color-accent)', fontWeight: 600 }}>+</span> справа снизу, чтобы добавить виджет
          </div>
        </div>
      )}

      {/* Сетка виджетов */}
      {widgets.length > 0 && (
        <div style={gridStyle}>
          {widgets.map(widget => {
            const remove = () => handleRemove(widget.id)
            if (widget.type === 'kpi')  return <div key={widget.id} className="widget-col-1"><KPICard config={widget} onRemove={remove} /></div>
            if (widget.type === 'line') return <div key={widget.id} className="widget-col-2"><LineChartWidget config={widget} onRemove={remove} /></div>
            if (widget.type === 'bar')  return <div key={widget.id} className="widget-col-2"><BarChartWidget config={widget} onRemove={remove} /></div>
            return null
          })}
        </div>
      )}

      {/* Счётчик виджетов */}
      {widgets.length > 0 && (
        <div style={{ marginTop: 16, fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.06em', color: 'var(--color-text-muted)', textAlign: 'center', opacity: 0.6, textTransform: 'uppercase' }}>
          {widgets.length} widget{widgets.length !== 1 ? 's' : ''} · saved in browser
        </div>
      )}

      {/* FAB — зелёная кнопка добавления (как в SitDeck) */}
      <button
        className="dashboard-fab"
        onClick={() => setShowModal(true)}
        title="Добавить виджет"
      >
        +
      </button>

      {showModal && <AddWidgetModal onAdd={handleAdd} onClose={() => setShowModal(false)} />}
    </div>
  )
}

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
  gap: 12,
  alignItems: 'start',
}

const resetBtnStyle: React.CSSProperties = {
  padding: '6px 12px',
  borderRadius: 'var(--radius)' as unknown as number,
  background: 'transparent',
  border: '1px solid var(--color-border)',
  color: 'var(--color-text-muted)',
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  letterSpacing: '0.06em',
  cursor: 'pointer',
  transition: 'all 0.15s',
}
