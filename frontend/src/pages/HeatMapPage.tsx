// Этап 1: здесь будет интерактивная тепловая карта мира
// Сейчас — заглушка с правильной структурой

export default function HeatMapPage() {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Панель слоёв */}
      <div style={{
        padding: '12px 24px',
        background: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex',
        gap: '8px',
        alignItems: 'center',
      }}>
        <span style={{ color: 'var(--color-text-muted)', marginRight: 8 }}>Слой:</span>
        {['ВВП на душу населения', 'Инфляция', 'Индекс риска', 'Новостной фон'].map(layer => (
          <button key={layer} style={{
            padding: '5px 12px',
            borderRadius: 6,
            border: '1px solid var(--color-border)',
            background: 'transparent',
            color: 'var(--color-text-muted)',
            fontSize: 13,
            cursor: 'pointer',
          }}>
            {layer}
          </button>
        ))}
      </div>

      {/* Зона карты */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--color-bg)',
        color: 'var(--color-text-muted)',
        fontSize: 15,
      }}>
        🗺️ Тепловая карта — Этап 1
      </div>
    </div>
  )
}
