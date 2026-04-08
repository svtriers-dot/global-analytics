/** API-клиент для финансовых данных (FRED, Alpha Vantage) и World Bank history */

import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

const api = axios.create({ baseURL: `${API_BASE}/api` })

// ── FRED ──────────────────────────────────────────────────────────────

export interface FredPoint { date: string; value: number }
export interface FredSeries {
  series_id: string
  label: string
  unit: string
  period: string
  series: FredPoint[]
  error?: string
}

export interface FredRateItem {
  series_id: string
  label: string
  unit: string
  value: number
  date: string
}

export async function fetchFredSeries(
  seriesId: string,
  period: '1m' | '1y' | '5y' = '5y',
): Promise<FredSeries> {
  const { data } = await api.get(`/finance/series/${seriesId}`, { params: { period } })
  return data
}

export async function fetchFredRates(): Promise<FredRateItem[]> {
  const { data } = await api.get('/finance/rates')
  return data
}

export function listFredSeries() {
  return api.get('/finance/series').then(r => r.data)
}

// ── World Bank history ────────────────────────────────────────────────

export interface WbPoint { year: string; value: number }
export interface WbSeries {
  indicator: string
  label: string
  unit: string
  country: string
  series: WbPoint[]
}

export async function fetchWbHistory(
  iso2: string,
  indicator: string,
  years: number = 10,
): Promise<WbSeries> {
  const { data } = await api.get(
    `/geo/country/${iso2}/history/${indicator}`,
    { params: { years } }
  )
  return data
}

// ── World Bank latest (KPI) ───────────────────────────────────────────

export interface WbCard {
  country: string
  indicators: Record<string, { label: string; unit: string; value: number; year: string }>
}

export async function fetchWbCountryCard(iso2: string): Promise<WbCard> {
  const { data } = await api.get(`/geo/country/${iso2}`)
  return data
}

// ── World Bank map data (bar chart top countries) ─────────────────────

export interface WbMapPoint { country_code: string; country_name: string; value: number; year: string }
export interface WbMapData {
  indicator: string
  meta: { label: string; unit: string }
  year: string
  min: number
  max: number
  data: WbMapPoint[]
}

export async function fetchWbMapData(indicator: string): Promise<WbMapData> {
  const { data } = await api.get('/geo/map-data', { params: { indicator } })
  return data
}
