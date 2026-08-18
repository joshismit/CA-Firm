// Single shared Axios instance (baseURL, default headers). All modules/*/api files import this instead of creating their own client.
// Interceptors are attached separately from services/interceptors.ts (see bootstrapHttp), keeping this file a pure client factory.

import axios from 'axios'
import { env } from '@/config/env'

export const apiClient = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: 15000,
})
