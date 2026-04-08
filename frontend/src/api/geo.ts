import axios from 'axios'
import type {
  MapDataResponse, CountryCardResponse, IndicatorMeta,
  CountryOption, CompareSeriesResponse, CompareSummaryResponse,
} from '../types/geo'

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

export async function fetchAllCountries(): Promise<CountryOption[]> {
  const { data } = await api.get('/countries')
  return data
}

export async function fetchCompareSeries(
  countries: string[],
  indicator: string,
  years: number,
): Promise<CompareSeriesResponse> {
  const { data } = await api.get('/compare', {
    params: { countries: countries.join(','), indicator, years },
  })
  return data
}

export async function fetchCompareSummary(
  countries: string[],
): Promise<CompareSummaryResponse> {
  const { data } = await api.get('/compare/summary', {
    params: { countries: countries.join(',') },
  })
  return data
}
