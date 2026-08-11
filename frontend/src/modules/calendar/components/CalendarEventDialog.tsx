// src/modules/calendar/components/CalendarEventDialog.tsx
// Create/edit dialog for CalendarEvent - mirrors modules/tasks/components/CreateTaskDialog.tsx's
// structure exactly (DialogRoot/Content/Header/Body/Footer + react-hook-form + zodResolver).
import { useEffect } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Trash2 } from 'lucide-react'
import {
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { FormField } from '@/components/forms/FormField'
import { Skeleton } from '@/components/feedback'
import { normalizeApiError } from '@/services/api-error'
import { useBusinessesQuery } from '@/modules/business/hooks'
import { useAssignableStaffQuery } from '@/modules/tasks/hooks'
import {
  useCalendarEventQuery,
  useCreateCalendarEventMutation,
  useDeleteCalendarEventMutation,
  useUpdateCalendarEventMutation,
} from '../hooks'
import { calendarEventFormSchema, type CalendarEventFormInput, type CalendarEventFormValues } from '../schemas'
import { CALENDAR_EVENT_TYPE_OPTIONS } from '../constants'

function toDateTimeInputValue(value: Date | string | undefined): string {
  if (!value) return ''
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const EMPTY_DEFAULTS: CalendarEventFormValues = {
  title: '',
  description: undefined,
  eventType: 'OTHER',
  startAt: new Date(),
  endAt: undefined,
  allDay: false,
  location: undefined,
  meetingUrl: undefined,
  businessId: undefined,
  attendeeIds: [],
}

export interface CalendarEventDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Set to edit an existing event; omit to create a new one. */
  eventId?: string
  /** Pre-fills the business picker when creating from a business-scoped context (unused today, kept for future reuse). */
  defaultBusinessId?: string
}

export function CalendarEventDialog({ open, onOpenChange, eventId, defaultBusinessId }: CalendarEventDialogProps) {
  const isEditMode = !!eventId
  const eventQuery = useCalendarEventQuery(eventId)
  const createMutation = useCreateCalendarEventMutation()
  const updateMutation = useUpdateCalendarEventMutation(eventId ?? '')
  const deleteMutation = useDeleteCalendarEventMutation()
  const businessesQuery = useBusinessesQuery({ limit: 100 })

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<CalendarEventFormInput, unknown, CalendarEventFormValues>({
    resolver: zodResolver(calendarEventFormSchema),
    defaultValues: { ...EMPTY_DEFAULTS, businessId: defaultBusinessId },
  })

  const businessId = watch('businessId')
  const allDay = watch('allDay')
  const staffQuery = useAssignableStaffQuery(businessId ? { businessId } : {})

  useEffect(() => {
    if (!open) return
    if (isEditMode && eventQuery.data) {
      const event = eventQuery.data
      reset({
        title: event.title,
        description: event.description ?? undefined,
        eventType: event.eventType,
        startAt: new Date(event.startAt),
        endAt: event.endAt ? new Date(event.endAt) : undefined,
        allDay: event.allDay,
        location: event.location ?? undefined,
        meetingUrl: event.meetingUrl ?? undefined,
        businessId: event.business?.id,
        attendeeIds: event.attendees.map((a) => a.id),
      })
    } else if (!isEditMode) {
      reset({ ...EMPTY_DEFAULTS, businessId: defaultBusinessId })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isEditMode, eventQuery.data])

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next)
    if (!next) reset(EMPTY_DEFAULTS)
  }

  const onSubmit = (values: CalendarEventFormValues) => {
    const payload = {
      title: values.title,
      description: values.description,
      eventType: values.eventType,
      startAt: values.startAt.toISOString(),
      endAt: values.endAt?.toISOString(),
      allDay: values.allDay,
      location: values.location,
      meetingUrl: values.meetingUrl,
      businessId: values.businessId,
      attendeeIds: values.attendeeIds,
    }

    if (isEditMode) {
      updateMutation.mutate(payload, { onSuccess: () => handleOpenChange(false) })
    } else {
      createMutation.mutate(payload, { onSuccess: () => handleOpenChange(false) })
    }
  }

  const handleDelete = () => {
    if (!eventId) return
    deleteMutation.mutate(eventId, { onSuccess: () => handleOpenChange(false) })
  }

  const mutation = isEditMode ? updateMutation : createMutation
  const businessOptions = (businessesQuery.data?.data ?? []).map((b) => ({ value: b.id, label: b.name }))
  const staffOptions = staffQuery.data ?? []

  return (
    <DialogRoot open={open} onOpenChange={handleOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Edit event' : 'New event'}</DialogTitle>
        </DialogHeader>

        {isEditMode && eventQuery.isLoading ? (
          <DialogBody>
            <Skeleton variant="table" rows={5} height={32} />
          </DialogBody>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <DialogBody className="space-y-4">
              <FormField label="Title" htmlFor="event-title" error={errors.title?.message}>
                <Input id="event-title" invalid={!!errors.title} {...register('title')} />
              </FormField>

              <FormField label="Description" htmlFor="event-description" error={errors.description?.message}>
                <Input id="event-description" invalid={!!errors.description} {...register('description')} />
              </FormField>

              <div className="grid grid-cols-2 gap-4">
                <FormField label="Type" htmlFor="event-type">
                  <Controller
                    name="eventType"
                    control={control}
                    render={({ field }) => (
                      <Select value={field.value} onChange={field.onChange} options={CALENDAR_EVENT_TYPE_OPTIONS} />
                    )}
                  />
                </FormField>

                <FormField label="Client" htmlFor="event-business">
                  <Controller
                    name="businessId"
                    control={control}
                    render={({ field }) => (
                      <Select
                        value={field.value ?? '__none__'}
                        onChange={(value) => field.onChange(value === '__none__' ? undefined : value)}
                        options={[{ value: '__none__', label: 'No client' }, ...businessOptions]}
                        disabled={businessesQuery.isLoading}
                      />
                    )}
                  />
                </FormField>
              </div>

              <div className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2.5">
                <Label htmlFor="event-all-day">All-day event</Label>
                <Controller
                  name="allDay"
                  control={control}
                  render={({ field }) => (
                    <Switch id="event-all-day" checked={field.value} onCheckedChange={field.onChange} />
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField label="Start" htmlFor="event-start" error={errors.startAt?.message as string | undefined}>
                  <Controller
                    name="startAt"
                    control={control}
                    render={({ field }) => (
                      <Input
                        id="event-start"
                        type={allDay ? 'date' : 'datetime-local'}
                        invalid={!!errors.startAt}
                        value={
                          allDay
                            ? toDateTimeInputValue(field.value as Date | undefined).slice(0, 10)
                            : toDateTimeInputValue(field.value as Date | undefined)
                        }
                        onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : undefined)}
                      />
                    )}
                  />
                </FormField>

                <FormField label="End" htmlFor="event-end" error={errors.endAt?.message as string | undefined}>
                  <Controller
                    name="endAt"
                    control={control}
                    render={({ field }) => (
                      <Input
                        id="event-end"
                        type={allDay ? 'date' : 'datetime-local'}
                        invalid={!!errors.endAt}
                        value={
                          allDay
                            ? toDateTimeInputValue(field.value as Date | undefined).slice(0, 10)
                            : toDateTimeInputValue(field.value as Date | undefined)
                        }
                        onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : undefined)}
                      />
                    )}
                  />
                </FormField>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField label="Location" htmlFor="event-location" error={errors.location?.message}>
                  <Input id="event-location" invalid={!!errors.location} {...register('location')} />
                </FormField>

                <FormField label="Meeting URL" htmlFor="event-meeting-url" error={errors.meetingUrl?.message}>
                  <Input id="event-meeting-url" invalid={!!errors.meetingUrl} {...register('meetingUrl')} />
                </FormField>
              </div>

              <FormField label="Attendees" htmlFor="event-attendees">
                <Controller
                  name="attendeeIds"
                  control={control}
                  render={({ field }) => (
                    <div className="max-h-[140px] space-y-1.5 overflow-y-auto rounded-[var(--radius-md)] border border-[var(--color-border)] p-2.5">
                      {staffQuery.isLoading ? (
                        <p className="text-[12px] text-[var(--color-text-muted)]">Loading staff…</p>
                      ) : staffOptions.length === 0 ? (
                        <p className="text-[12px] text-[var(--color-text-muted)]">No eligible staff found.</p>
                      ) : (
                        staffOptions.map((staff) => {
                          const selectedIds = field.value ?? []
                          const checked = selectedIds.includes(staff.id)
                          const label = staff.lastName ? `${staff.firstName} ${staff.lastName}` : staff.firstName
                          return (
                            <label key={staff.id} className="flex items-center gap-2 text-[12.5px] text-[var(--color-text-body)]">
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(next) =>
                                  field.onChange(next ? [...selectedIds, staff.id] : selectedIds.filter((id) => id !== staff.id))
                                }
                              />
                              {label}
                            </label>
                          )
                        })
                      )}
                    </div>
                  )}
                />
              </FormField>

              {mutation.isError && (
                <p className="text-[12px] text-[var(--color-danger)]">{normalizeApiError(mutation.error).message}</p>
              )}
            </DialogBody>
            <DialogFooter className="justify-between">
              <div>
                {isEditMode && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleDelete}
                    loading={deleteMutation.isPending}
                    className="text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)]"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <DialogClose asChild>
                  <Button type="button" variant="ghost" size="sm">
                    Cancel
                  </Button>
                </DialogClose>
                <Button type="submit" size="sm" loading={mutation.isPending}>
                  {isEditMode ? 'Save changes' : 'Create event'}
                </Button>
              </div>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </DialogRoot>
  )
}
