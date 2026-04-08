/** Типы для дашборда с виджетами (Этап 3) */

export type WidgetType = 'kpi' | 'line' | 'bar'

export type DataSource = 'world_bank' | 'fred'

export type Period = '1y' | '5y' | '10y'

// ── Конфигурация виджета ──────────────────────────────────────────────

export interface WidgetConfig {
  id: string            // UUID, генерируется при создании
  type: WidgetType
  title: string         // заголовок виджета

  // Источник данных
  source: DataSource

  // World Bank
  indicator?: string    // код индикатора (NY.GDP.PCAP.CD и т.д.)
  country?: string      // ISO2-код (US, DE, CN...)

  // FRED
  seriesId?: string     // код серии (FEDFUNDS, DGS10...)

  // Общие параметры
  period?: Period       // глубина истории для line-графиков
}

// ── Хранилище в localStorage ──────────────────────────────────────────

export interface DashboardState {
  version: number
  widgets: WidgetConfig[]
}

const STORAGE_KEY = 'ga_dashboard_v1'

export const DEFAULT_WIDGETS: WidgetConfig[] = [
  {
    id: 'default-1',
    type: 'kpi',
    title: 'ВВП на душу — США',
    source: 'world_bank',
    indicator: 'NY.GDP.PCAP.CD',
    country: 'US',
  },
  {
    id: 'default-2',
    type: 'line',
    title: 'Fed Funds Rate',
    source: 'fred',
    seriesId: 'FEDFUNDS',
    period: '5y',
  },
  {
    id: 'default-3',
    type: 'line',
    title: 'ВВП на душу — Германия (история)',
    source: 'world_bank',
    indicator: 'NY.GDP.PCAP.CD',
    country: 'DE',
    period: '10y',
  },
  {
    id: 'default-4',
    type: 'kpi',
    title: 'Инфляция — Китай',
    source: 'world_bank',
    indicator: 'FP.CPI.TOTL.ZG',
    country: 'CN',
  },
  {
    id: 'default-5',
    type: 'line',
    title: '10Y Treasury Yield',
    source: 'fred',
    seriesId: 'DGS10',
    period: '5y',
  },
  {
    id: 'default-6',
    type: 'bar',
    title: 'ВВП на душу — топ страны',
    source: 'world_bank',
    indicator: 'NY.GDP.PCAP.CD',
  },
]

export function loadDashboard(): WidgetConfig[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_WIDGETS
    const state: DashboardState = JSON.parse(raw)
    if (state.version === 1 && Array.isArray(state.widgets)) {
      return state.widgets
    }
  } catch {
    // ignore
  }
  return DEFAULT_WIDGETS
}

export function saveDashboard(widgets: WidgetConfig[]): void {
  const state: DashboardState = { version: 1, widgets }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export function generateId(): string {
  return `w-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}
