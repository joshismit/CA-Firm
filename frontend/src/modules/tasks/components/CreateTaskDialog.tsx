// src/modules/tasks/components/CreateTaskDialog.tsx
// Wires up the previously-dead useCreateTaskMutation/createTaskSchema (defined but never used by
// any component - see the frontend audit) into a real form. Reused by both the staff TasksPage
// ("New Task") and the client-portal create flow - the only difference between the two callers is
// which assignable-staff scope StaffAssigneePicker resolves (a CLIENT caller's own client is
// always used server-side regardless of what's passed here, per GET /tasks/assignable-staff).
import { useState } from 'react'
import type { z } from 'zod'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus } from 'lucide-react'
import {
  DialogRoot,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/forms/FormField'
import { normalizeApiError } from '@/services/api-error'
import { useCreateTaskMutation } from '../hooks'
import { createTaskSchema } from '../schemas'
import { StaffAssigneePicker } from './StaffAssigneePicker'

type CreateTaskFormInput = z.input<typeof createTaskSchema>
type CreateTaskFormValues = z.infer<typeof createTaskSchema>

function toDateInputValue(value: unknown): string {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value as string)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10)
}

export interface CreateTaskDialogProps {
  /** Defaults to a "New Task" button - pass a custom trigger (e.g. a client-portal "Create task" call-to-action) to reuse this dialog elsewhere. */
  trigger?: React.ReactNode
  /** Fires after a successful create, e.g. to navigate to the new task's detail page. */
  onCreated?: (taskId: string) => void
}

export function CreateTaskDialog({ trigger, onCreated }: CreateTaskDialogProps) {
  const [open, setOpen] = useState(false)
  const mutation = useCreateTaskMutation()

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateTaskFormInput, unknown, CreateTaskFormValues>({
    resolver: zodResolver(createTaskSchema),
  })

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) reset()
  }

  const onSubmit = (values: CreateTaskFormValues) => {
    mutation.mutate(
      {
        title: values.title,
        description: values.description,
        assigneeId: values.assigneeId,
        startDate: values.startDate?.toISOString(),
        dueDate: values.dueDate?.toISOString(),
      },
      {
        onSuccess: (task) => {
          handleOpenChange(false)
          onCreated?.(task.id)
        },
      }
    )
  }

  return (
    <DialogRoot open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm">
            <Plus className="w-3.5 h-3.5" />
            New Task
          </Button>
        )}
      </DialogTrigger>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>New task</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <DialogBody className="space-y-4">
            <FormField label="Title" htmlFor="title" error={errors.title?.message}>
              <Input id="title" invalid={!!errors.title} {...register('title')} />
            </FormField>

            <FormField label="Description" htmlFor="description" error={errors.description?.message}>
              <Input id="description" invalid={!!errors.description} {...register('description')} />
            </FormField>

            <FormField label="Assign to" htmlFor="assigneeId" error={errors.assigneeId?.message}>
              <Controller
                name="assigneeId"
                control={control}
                render={({ field }) => (
                  <StaffAssigneePicker value={field.value} onChange={field.onChange} placeholder="Unassigned" />
                )}
              />
            </FormField>

            <div className="grid grid-cols-2 gap-4">
              <FormField label="Start date" htmlFor="startDate" error={errors.startDate?.message as string | undefined}>
                <Controller
                  name="startDate"
                  control={control}
                  render={({ field }) => (
                    <Input
                      id="startDate"
                      type="date"
                      invalid={!!errors.startDate}
                      value={toDateInputValue(field.value)}
                      onChange={(e) => field.onChange(e.target.value === '' ? undefined : e.target.value)}
                    />
                  )}
                />
              </FormField>

              <FormField label="Due date" htmlFor="dueDate" error={errors.dueDate?.message as string | undefined}>
                <Controller
                  name="dueDate"
                  control={control}
                  render={({ field }) => (
                    <Input
                      id="dueDate"
                      type="date"
                      invalid={!!errors.dueDate}
                      value={toDateInputValue(field.value)}
                      onChange={(e) => field.onChange(e.target.value === '' ? undefined : e.target.value)}
                    />
                  )}
                />
              </FormField>
            </div>

            {mutation.isError && (
              <p className="text-[12px] text-[var(--color-danger)]">{normalizeApiError(mutation.error).message}</p>
            )}
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost" size="sm">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" size="sm" loading={mutation.isPending}>
              Create task
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </DialogRoot>
  )
}
