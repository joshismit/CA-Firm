// src/modules/dashboard/components/CustomizeDashboardDrawer.tsx
// "Customize Dashboard" side panel - show/hide widgets and reorder them with up/down controls
// (no drag-and-drop library is wired into this app yet, so up/down is the supported ordering UI,
// same tradeoff QuickActionsWidget-adjacent list UIs in this app already make). Only ever lists
// widgets the caller's own permissions allow (see useDashboardLayout's header comment) - there is
// no way to reveal a widget for a module the caller can't read.
import { useEffect, useState } from 'react'
import { LayoutGrid, ChevronUp, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
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
import { useDashboardLayout, useUpdateDashboardPreferencesMutation, type DashboardLayoutEntry } from '../hooks'

function moveEntry(entries: DashboardLayoutEntry[], index: number, direction: -1 | 1): DashboardLayoutEntry[] {
  const target = index + direction
  if (target < 0 || target >= entries.length) return entries
  const next = [...entries]
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}

export function CustomizeDashboardDrawer() {
  const { entries, isLoading } = useDashboardLayout()
  const mutation = useUpdateDashboardPreferencesMutation()

  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<DashboardLayoutEntry[]>(entries)

  // Re-seeds the draft from the latest saved layout each time the drawer opens - not on every
  // background refetch, so it never clobbers an in-progress edit mid-session.
  useEffect(() => {
    if (open) setDraft(entries)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function handleSave() {
    mutation.mutate(
      { widgets: draft.map((entry) => ({ widgetId: entry.widget.id, visible: entry.visible })) },
      { onSuccess: () => setOpen(false) }
    )
  }

  return (
    <DrawerRoot open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button variant="secondary" leadingIcon={<LayoutGrid className="w-3.5 h-3.5" />}>
          Customize Dashboard
        </Button>
      </DrawerTrigger>
      <DrawerContent side="right" size="md">
        <DrawerHeader>
          <DrawerTitle>Customize Dashboard</DrawerTitle>
          <DrawerDescription>Show or hide widgets and reorder them. Changes apply after you save.</DrawerDescription>
        </DrawerHeader>
        <DrawerBody>
          {isLoading ? (
            <p className="text-[12px] text-[var(--color-text-muted)]">Loading your layout…</p>
          ) : draft.length === 0 ? (
            <p className="text-[12px] text-[var(--color-text-muted)]">No widgets are available for your account.</p>
          ) : (
            <ul className="space-y-1.5">
              {draft.map((entry, index) => (
                <li
                  key={entry.widget.id}
                  className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[12.5px] font-medium text-[var(--color-text-body)] truncate">{entry.widget.label}</p>
                    <p className="text-[11px] text-[var(--color-text-muted)] truncate">{entry.widget.description}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      aria-label={`Move ${entry.widget.label} up`}
                      disabled={index === 0}
                      onClick={() => setDraft((prev) => moveEntry(prev, index, -1))}
                      className="p-1 rounded-[var(--radius-sm)] text-[var(--color-text-muted)] hover:bg-[var(--color-hover)] disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Move ${entry.widget.label} down`}
                      disabled={index === draft.length - 1}
                      onClick={() => setDraft((prev) => moveEntry(prev, index, 1))}
                      className="p-1 rounded-[var(--radius-sm)] text-[var(--color-text-muted)] hover:bg-[var(--color-hover)] disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                    <Switch
                      checked={entry.visible}
                      onCheckedChange={(visible) =>
                        setDraft((prev) => prev.map((e, i) => (i === index ? { ...e, visible } : e)))
                      }
                      aria-label={`Show ${entry.widget.label}`}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
          {mutation.isError && (
            <p className="mt-3 text-[12px] text-[var(--color-danger)]">{normalizeApiError(mutation.error).message}</p>
          )}
        </DrawerBody>
        <DrawerFooter>
          <Button variant="secondary" onClick={() => setOpen(false)} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button onClick={handleSave} loading={mutation.isPending} disabled={draft.length === 0}>
            Save
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </DrawerRoot>
  )
}
