import axios from 'axios'
import type { MapDataResponse, CountryCardResponse, IndicatorMeta } from '../types/geo'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

const api = axios.create({ baseURL: `${API_BASE}/api/geo` })

export async function fetchIndicators(): Promise<IndicatorMeta[]> {
  const { data } = await api.get('/indicators')
  return data
}

export async function fetchMapData(
  indicator: string,
  year?: number,
): Promise<MapDataResponse> {
  const { data } = await api.get('/map-data', {
    params: { indicator, ...(year ? { year } : {}) },
  })
  return data
}

export async function fetchCountryCard(
  iso2: string,
): Promise<CountryCardResponse> {
  const { data } = await api.get(`/country/${iso2}`)
  return data
}
