/**
 * DashboardPage — дашборд с настраиваемыми виджетами (Этап 3).
 *
 * Возможности:
 *  - 3 типа виджетов: KPI-карточка, линейный график, столбчатый график
 *  - Источники данных: World Bank (актуальные + история), FRED (временные ряды)
 *  - Добавление / удаление виджетов через модальное окно
 *  - Конфигурация сохраняется в localStorage между сессиями
 *  - 6 виджетов по умолчанию при первом входе
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
    <div style={{ padding: '20px 24px', minHeight: '100%' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#e2e8f0' }}>Дашборд</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleReset} style={secondaryBtnStyle} title="Сбросить к виджетам по умолчанию">↺ Сброс</button>
          <button onClick={() => setShowModal(true)} style={primaryBtnStyle}>+ Добавить виджет</button>
        </div>
      </div>

      {/* Пустой дашборд */}
      {widgets.length === 0 && (
        <div style={{ textAlign: 'center', marginTop: 80, color: '#475569' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
          <div style={{ fontSize: 15, marginBottom: 8 }}>Дашборд пуст</div>
          <div style={{ fontSize: 13, marginBottom: 24 }}>Добавь первый виджет, чтобы начать</div>
          <button onClick={() => setShowModal(true)} style={primaryBtnStyle}>+ Добавить виджет</button>
        </div>
      )}

      {/* Сетка виджетов */}
      {widgets.length > 0 && (
        <div style={gridStyle}>
          {widgets.map(widget => {
            const remove = () => handleRemove(widget.id)
            if (widget.type === 'kpi')  return <div key={widget.id} style={{ gridColumn: 'span 1' }}><KPICard config={widget} onRemove={remove} /></div>
            if (widget.type === 'line') return <div key={widget.id} style={{ gridColumn: 'span 2' }}><LineChartWidget config={widget} onRemove={remove} /></div>
            if (widget.type === 'bar')  return <div key={widget.id} style={{ gridColumn: 'span 2' }}><BarChartWidget config={widget} onRemove={remove} /></div>
            return null
          })}
        </div>
      )}

      {widgets.length > 0 && (
        <div style={{ marginTop: 16, fontSize: 12, color: '#334155', textAlign: 'center' }}>
          {widgets.length} виджет{widgets.length === 1 ? '' : widgets.length < 5 ? 'а' : 'ов'} · конфигурация сохранена в браузере
        </div>
      )}

      {showModal && <AddWidgetModal onAdd={handleAdd} onClose={() => setShowModal(false)} />}
    </div>
  )
}

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
  gap: 16,
  alignItems: 'start',
}
const primaryBtnStyle: React.CSSProperties = {
  padding: '8px 18px', borderRadius: 8, border: 'none',
  background: '#1d4ed8', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
}
const secondaryBtnStyle: React.CSSProperties = {
  padding: '8px 14px', borderRadius: 8,
  background: 'transparent', border: '1px solid #2d3348',
  color: '#64748b', fontSize: 13, cursor: 'pointer',
}
