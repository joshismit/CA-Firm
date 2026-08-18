// Small shared utility types (ID, Nullable<T>, Option, SortDirection) used across modules.

export type ID = string

export type Nullable<T> = T | null

export interface Option<T = string> {
  label: string
  value: T
}

export type SortDirection = 'asc' | 'desc'
