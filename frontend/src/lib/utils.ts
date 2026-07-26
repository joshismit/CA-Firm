// src/lib/utils.ts
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Utility to merge Tailwind CSS classes with proper deduplication.
 * Always use this instead of string concatenation for className props.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format a number as Indian Rupees (₹)
 * Uses Indian number format: 1,00,000
 */
export function formatINR(amount: number, decimals = 2): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount)
}

/**
 * Format a number in Indian notation without currency symbol
 */
export function formatIndianNumber(num: number): string {
  return new Intl.NumberFormat('en-IN').format(num)
}

/**
 * Format a number as compact Indian-notation currency (K/L/Cr), e.g. ₹48.2L, ₹1.3Cr.
 * Used for large headline figures (KPI cards) where the full grouped amount is too wide.
 */
export function formatCompactINR(amount: number, decimals = 1): string {
  const abs = Math.abs(amount)
  const sign = amount < 0 ? '-' : ''

  if (abs >= 1_00_00_000) return `${sign}₹${(abs / 1_00_00_000).toFixed(decimals)}Cr`
  if (abs >= 1_00_000) return `${sign}₹${(abs / 1_00_000).toFixed(decimals)}L`
  if (abs >= 1_000) return `${sign}₹${(abs / 1_000).toFixed(decimals)}K`
  return `${sign}₹${abs.toLocaleString('en-IN')}`
}

/**
 * Format date in Indian format DD/MM/YYYY
 */
export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d)
}

/**
 * Format date with month name: 15 Jul 2025
 */
export function formatDateLong(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d)
}

/**
 * Returns initials from a name string (up to 2 characters)
 */
export function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map(n => n[0])
    .join('')
    .toUpperCase()
}

/**
 * Deterministic color index from a string (for avatar fallback colors)
 */
export function getColorIndex(str: string, max = 8): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  return Math.abs(hash) % max
}

/**
 * Truncate a string to a given length
 */
export function truncate(str: string, length = 40): string {
  return str.length > length ? str.slice(0, length) + '…' : str
}

/**
 * Check if a value is empty (null, undefined, empty string, empty array)
 */
export function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true
  if (typeof value === 'string') return value.trim().length === 0
  if (Array.isArray(value)) return value.length === 0
  return false
}
