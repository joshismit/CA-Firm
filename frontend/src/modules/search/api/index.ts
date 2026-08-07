// Global search API request functions, built on the shared Axios instance from src/services/axios.ts.
// Hits the real backend at ${env.apiBaseUrl}/search (backend/src/modules/search/routes/search.routes.ts).
import { apiClient } from '@/services/axios'
import type { ApiResponse } from '@/types/api.types'
import type { SearchResults } from '../types'

export async function globalSearch(q: string, limit = 10): Promise<SearchResults> {
  const { data } = await apiClient.get<ApiResponse<SearchResults>>('/search', { params: { q, limit } })
  return data.data
}
