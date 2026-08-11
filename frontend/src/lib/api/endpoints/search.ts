import { api } from '../client'

export interface SearchHit {
  type: string
  label: string
  title: string
  subtitle: string
  url: string
}

export interface SearchResponse {
  query: string
  results: SearchHit[]
}

export const searchApi = {
  query: (q: string, signal?: AbortSignal) =>
    api.get<SearchResponse>('/search/', { params: { q }, signal }),
}

export default searchApi
