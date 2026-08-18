// contacts API request functions, built on the shared Axios instance from src/services/axios.ts.
// Hits the real backend at ${env.apiBaseUrl}/contacts (backend/src/modules/contacts/routes/contact.routes.ts) -
// mirrors modules/business/api/index.ts now that the Contacts backend module exists.

import { apiClient } from '@/services/axios'
import type { ApiResponse, PaginatedResponse } from '@/types/api.types'
import type {
  AssignContactRolePayload,
  Contact,
  ContactListFilters,
  ContactRole,
  CreateContactPayload,
  UpdateContactPayload,
} from '../types'

export async function listContacts(filters: ContactListFilters): Promise<PaginatedResponse<Contact>> {
  const { data } = await apiClient.get<PaginatedResponse<Contact>>('/contacts', { params: filters })
  return data
}

export async function getContact(id: string): Promise<Contact> {
  const { data } = await apiClient.get<ApiResponse<Contact>>(`/contacts/${id}`)
  return data.data
}

export async function listContactRoles(contactId: string): Promise<ContactRole[]> {
  const { data } = await apiClient.get<ApiResponse<ContactRole[]>>(`/contacts/${contactId}/roles`)
  return data.data
}

export async function createContact(payload: CreateContactPayload): Promise<Contact> {
  const { data } = await apiClient.post<ApiResponse<Contact>>('/contacts', payload)
  return data.data
}

export async function updateContact(id: string, payload: UpdateContactPayload): Promise<Contact> {
  const { data } = await apiClient.patch<ApiResponse<Contact>>(`/contacts/${id}`, payload)
  return data.data
}

export async function deleteContact(id: string): Promise<void> {
  await apiClient.delete(`/contacts/${id}`)
}

export async function assignContactRole(payload: AssignContactRolePayload): Promise<ContactRole> {
  const { data } = await apiClient.post<ApiResponse<ContactRole>>('/contacts/roles', payload)
  return data.data
}
