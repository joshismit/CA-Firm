// src/modules/audit/components/AuditFilters.tsx
// Filter controls for the Audit Logs list - rendered inside DataTable's toolbarFilters slot.
// actorId is a plain UUID input - no Users-lookup API exists to back a picker (same precedent as
// ProjectForm's managerId field). targetType is free text since AuditLogEntry.targetType is
// itself a free-form string, not a closed enum.
import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { AUDIT_EVENT_OPTIONS } from '../constants'
import type { AuditEventType } from '../types'

const EVENT_FILTER_OPTIONS = [{ value: '__all__', label: 'All events' }, ...AUDIT_EVENT_OPTIONS]

export interface AuditFiltersProps {
  eventType: AuditEventType | undefined
  onEventTypeChange: (eventType: AuditEventType | undefined) => void
  actorId: string
  onActorIdChange: (actorId: string) => void
  targetType: string
  onTargetTypeChange: (targetType: string) => void
}

export function AuditFilters({
  eventType,
  onEventTypeChange,
  actorId,
  onActorIdChange,
  targetType,
  onTargetTypeChange,
}: AuditFiltersProps) {
  return (
    <>
      <Select
        value={eventType ?? '__all__'}
        onChange={(value) => onEventTypeChange(value === '__all__' ? undefined : (value as AuditEventType))}
        options={EVENT_FILTER_OPTIONS}
        className="h-8 w-[160px]"
        placeholder="Event type"
      />
      <Input
        value={actorId}
        onChange={(e) => onActorIdChange(e.target.value)}
        placeholder="Filter by actor ID (UUID)"
        className="h-8 w-[200px]"
        aria-label="Filter by actor ID"
      />
      <Input
        value={targetType}
        onChange={(e) => onTargetTypeChange(e.target.value)}
        placeholder="Filter by target type"
        className="h-8 w-[180px]"
        aria-label="Filter by target type"
      />
    </>
  )
}
