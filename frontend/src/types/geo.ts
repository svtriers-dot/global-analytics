export type IndicatorMeta = {
  code: string
  label: string
  unit: string
}

export type CountryDataPoint = {
  country_code: string   // ISO3 (USA, DEU, CHN...)
  country_name: string
  value: number
  year: string
}

export type MapDataResponse = {
  indicator: string
  meta: { label: string; unit: string; scale?: 'linear' | 'log' }
  year: string | null
  min: number
  max: number
  data: CountryDataPoint[]
}

export type IndicatorValue = {
  label: string
  unit: string
  value: number
  year: string
}

export type CountryCardResponse = {
  country: string
  indicators: Record<string, IndicatorValue>
}

export type SelectedCountry = {
  iso2: string
  iso3: string
  name: string
  value?: number
}
