// contacts-scoped React hooks - data-fetching wrappers (TanStack Query) and local UI state.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/services/query-keys'
import {
  assignContactRole,
  createContact,
  deleteContact,
  getContact,
  listContactRoles,
  listContacts,
  updateContact,
} from '../api'
import type { AssignContactRolePayload, ContactListFilters, CreateContactPayload, UpdateContactPayload } from '../types'

export function useContactsQuery(filters: ContactListFilters) {
  return useQuery({ queryKey: queryKeys.contacts.list(filters), queryFn: () => listContacts(filters) })
}

export function useContactQuery(id: string) {
  return useQuery({ queryKey: queryKeys.contacts.detail(id), queryFn: () => getContact(id), enabled: !!id })
}

export function useContactRolesQuery(contactId: string) {
  return useQuery({
    queryKey: queryKeys.contacts.roles(contactId),
    queryFn: () => listContactRoles(contactId),
    enabled: !!contactId,
  })
}

export function useCreateContactMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateContactPayload) => createContact(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.contacts.lists() }),
  })
}

export function useUpdateContactMutation(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: UpdateContactPayload) => updateContact(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.contacts.detail(id) })
      qc.invalidateQueries({ queryKey: queryKeys.contacts.lists() })
    },
  })
}

export function useDeleteContactMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteContact(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.contacts.lists() }),
  })
}

export function useAssignContactRoleMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: AssignContactRolePayload) => assignContactRole(payload),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: queryKeys.contacts.detail(variables.contactId) })
      qc.invalidateQueries({ queryKey: queryKeys.contacts.roles(variables.contactId) })
    },
  })
}
