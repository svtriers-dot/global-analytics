import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_URL ?? ''
const api = axios.create({ baseURL: `${API_BASE}/api/disasters` })

export type EarthquakeEvent = {
  lon:   number
  lat:   number
  depth: number | null
  mag:   number
  place: string
  time:  number | null
  url:   string
}

export type EarthquakesResponse = {
  count:  number
  events: EarthquakeEvent[]
  source: string
  feed:   string
}

export type DisasterEvent = {
  lon:        number
  lat:        number
  type:       string
  type_label: string
  name:       string
  alert:      'Red' | 'Orange' | string
  country:    string
  from_date:  string
  url:        string
}

export type DisastersResponse = {
  count:  number
  events: DisasterEvent[]
  source: string
  error?: string
}

export async function fetchEarthquakes(minMagnitude = 4.5): Promise<EarthquakesResponse> {
  const { data } = await api.get('/earthquakes', {
    params: { min_magnitude: minMagnitude },
  })
  return data
}

export async function fetchDisasterEvents(): Promise<DisastersResponse> {
  const { data } = await api.get('/events')
  return data
}
