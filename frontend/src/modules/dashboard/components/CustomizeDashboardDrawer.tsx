// src/modules/dashboard/components/CustomizeDashboardDrawer.tsx
// "Customize Dashboard" side panel - show/hide widgets, drag-and-drop reorder (PRD §10.4,
// @dnd-kit - PointerSensor + KeyboardSensor so reordering works with a mouse and a keyboard),
// collapse/pin per widget, a whole-dashboard refresh interval, and "Restore Defaults" (deletes the
// caller's personal layout, falling back to their tenant's configured role default or the
// registry default - PRD §10.3). Only ever lists widgets the caller's own permissions allow (see
// useDashboardLayout's header comment) - there is no way to reveal a widget for a module the
// caller can't read.
import { useEffect, useState } from 'react'
import { LayoutGrid, GripVertical, ChevronsDownUp, ChevronsUpDown, Pin, PinOff, RotateCcw } from 'lucide-react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Select } from '@/components/ui/select'
import {
  DrawerRoot,
  DrawerTrigger,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerBody,
  DrawerFooter,
} from '@/components/ui/drawer'
import { normalizeApiError } from '@/services/api-error'
import {
  useDashboardLayout,
  useUpdateDashboardPreferencesMutation,
  useResetDashboardPreferencesMutation,
  type DashboardLayoutEntry,
} from '../hooks'

const REFRESH_OPTIONS = [
  { value: 'off', label: 'Manual only' },
  { value: '60', label: 'Every 1 minute' },
  { value: '300', label: 'Every 5 minutes' },
  { value: '900', label: 'Every 15 minutes' },
]

interface SortableRowProps {
  entry: DashboardLayoutEntry
  onToggleVisible: (visible: boolean) => void
  onToggleCollapsed: () => void
  onTogglePinned: () => void
}

function SortableRow({ entry, onToggleVisible, onToggleCollapsed, onTogglePinned }: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: entry.widget.id })

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] px-2 py-2.5 bg-[var(--color-card)]"
      data-dragging={isDragging || undefined}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Drag to reorder ${entry.widget.label}`}
        className="p-1 rounded-[var(--radius-sm)] text-[var(--color-text-muted)] hover:bg-[var(--color-hover)] cursor-grab active:cursor-grabbing shrink-0"
      >
        <GripVertical className="w-3.5 h-3.5" />
      </button>

      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] font-medium text-[var(--color-text-body)] truncate">{entry.widget.label}</p>
        <p className="text-[11px] text-[var(--color-text-muted)] truncate">{entry.widget.description}</p>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          aria-label={entry.pinned ? `Unpin ${entry.widget.label}` : `Pin ${entry.widget.label}`}
          aria-pressed={entry.pinned}
          onClick={onTogglePinned}
          className="p-1 rounded-[var(--radius-sm)] text-[var(--color-text-muted)] hover:bg-[var(--color-hover)] data-[active]:text-[var(--color-primary-600)]"
          data-active={entry.pinned || undefined}
        >
          {entry.pinned ? <Pin className="w-3.5 h-3.5 fill-current" /> : <PinOff className="w-3.5 h-3.5" />}
        </button>
        <button
          type="button"
          aria-label={entry.collapsed ? `Expand ${entry.widget.label}` : `Collapse ${entry.widget.label}`}
          aria-pressed={entry.collapsed}
          onClick={onToggleCollapsed}
          className="p-1 rounded-[var(--radius-sm)] text-[var(--color-text-muted)] hover:bg-[var(--color-hover)]"
        >
          {entry.collapsed ? <ChevronsUpDown className="w-3.5 h-3.5" /> : <ChevronsDownUp className="w-3.5 h-3.5" />}
        </button>
        <Switch checked={entry.visible} onCheckedChange={onToggleVisible} aria-label={`Show ${entry.widget.label}`} />
      </div>
    </li>
  )
}

export function CustomizeDashboardDrawer() {
  const { entries, isLoading, refreshIntervalSeconds } = useDashboardLayout()
  const mutation = useUpdateDashboardPreferencesMutation()
  const resetMutation = useResetDashboardPreferencesMutation()

  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<DashboardLayoutEntry[]>(entries)
  const [draftRefresh, setDraftRefresh] = useState<string>(refreshIntervalSeconds ? String(refreshIntervalSeconds) : 'off')

  // Re-seeds the draft from the latest saved layout each time the drawer opens - not on every
  // background refetch, so it never clobbers an in-progress edit mid-session.
  useEffect(() => {
    if (open) {
      setDraft(entries)
      setDraftRefresh(refreshIntervalSeconds ? String(refreshIntervalSeconds) : 'off')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setDraft((prev) => {
      const oldIndex = prev.findIndex((e) => e.widget.id === active.id)
      const newIndex = prev.findIndex((e) => e.widget.id === over.id)
      if (oldIndex === -1 || newIndex === -1) return prev
      return arrayMove(prev, oldIndex, newIndex)
    })
  }

  function updateEntry(index: number, patch: Partial<DashboardLayoutEntry>) {
    setDraft((prev) => prev.map((e, i) => (i === index ? { ...e, ...patch } : e)))
  }

  function handleSave() {
    mutation.mutate(
      {
        widgets: draft.map((entry) => ({
          widgetId: entry.widget.id,
          visible: entry.visible,
          collapsed: entry.collapsed,
          pinned: entry.pinned,
        })),
        refreshIntervalSeconds: draftRefresh === 'off' ? null : Number(draftRefresh),
      },
      { onSuccess: () => setOpen(false) }
    )
  }

  function handleRestoreDefaults() {
    resetMutation.mutate(undefined, { onSuccess: () => setOpen(false) })
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <DrawerRoot open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>
          <Button variant="secondary" leadingIcon={<LayoutGrid className="w-3.5 h-3.5" />}>
            Customize Dashboard
          </Button>
        </DrawerTrigger>
        <DrawerContent side="right" size="md">
          <DrawerHeader>
            <DrawerTitle>Customize Dashboard</DrawerTitle>
            <DrawerDescription>Drag to reorder, pin, collapse, or hide widgets. Changes apply after you save.</DrawerDescription>
          </DrawerHeader>
          <DrawerBody>
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="text-[12px] font-medium text-[var(--color-text-secondary)]">Auto-refresh</span>
              <Select value={draftRefresh} onChange={setDraftRefresh} options={REFRESH_OPTIONS} className="w-[180px]" aria-label="Dashboard auto-refresh interval" />
            </div>

            {isLoading ? (
              <p className="text-[12px] text-[var(--color-text-muted)]">Loading your layout…</p>
            ) : draft.length === 0 ? (
              <p className="text-[12px] text-[var(--color-text-muted)]">No widgets are available for your account.</p>
            ) : (
              <SortableContext items={draft.map((e) => e.widget.id)} strategy={verticalListSortingStrategy}>
                <ul className="space-y-1.5">
                  {draft.map((entry, index) => (
                    <SortableRow
                      key={entry.widget.id}
                      entry={entry}
                      onToggleVisible={(visible) => updateEntry(index, { visible })}
                      onToggleCollapsed={() => updateEntry(index, { collapsed: !entry.collapsed })}
                      onTogglePinned={() => updateEntry(index, { pinned: !entry.pinned })}
                    />
                  ))}
                </ul>
              </SortableContext>
            )}
            {(mutation.isError || resetMutation.isError) && (
              <p className="mt-3 text-[12px] text-[var(--color-danger)]">
                {normalizeApiError((mutation.error ?? resetMutation.error)!).message}
              </p>
            )}
          </DrawerBody>
          <DrawerFooter>
            <Button
              variant="secondary"
              leadingIcon={<RotateCcw className="w-3.5 h-3.5" />}
              onClick={handleRestoreDefaults}
              loading={resetMutation.isPending}
              disabled={mutation.isPending}
            >
              Restore Defaults
            </Button>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={mutation.isPending}>
              Cancel
            </Button>
            <Button onClick={handleSave} loading={mutation.isPending} disabled={draft.length === 0}>
              Save
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </DrawerRoot>
    </DndContext>
  )
}
