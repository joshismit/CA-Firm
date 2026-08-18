// src/components/shared/Kanban/KanbanBoard.tsx
// Generic drag-and-drop Kanban board - column shape, drag state, and drop handling only. Native
// HTML5 drag-and-drop (draggable/onDragStart/onDragOver/onDrop) rather than a new dependency.
// Card content and columns are fully caller-supplied, so this has no CRM-specific knowledge and is
// reusable by any future module with a stage/status-like grouping.
//
// Drag-and-drop alone isn't keyboard-operable, so every card render also receives a `moveTo`
// callback - callers should expose it through a real focusable control (e.g. a <Select>), not rely
// on dragging as the only way to move an item between columns.
import { useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface KanbanColumn<T> {
  id: string
  title: string
  items: T[]
}

export interface KanbanCardHelpers {
  moveTo: (columnId: string) => void
}

export interface KanbanBoardProps<T> {
  columns: KanbanColumn<T>[]
  getItemId: (item: T) => string
  renderCard: (item: T, helpers: KanbanCardHelpers) => ReactNode
  renderColumnHeader?: (column: KanbanColumn<T>) => ReactNode
  onMove: (itemId: string, fromColumnId: string, toColumnId: string) => void
  emptyColumnLabel?: string
  className?: string
}

export function KanbanBoard<T>({
  columns,
  getItemId,
  renderCard,
  renderColumnHeader,
  onMove,
  emptyColumnLabel = 'No items',
  className,
}: KanbanBoardProps<T>) {
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null)

  function columnOf(itemId: string): string | undefined {
    return columns.find((c) => c.items.some((item) => getItemId(item) === itemId))?.id
  }

  function handleDrop(toColumnId: string) {
    if (draggingId) {
      const fromColumnId = columnOf(draggingId);
      if (fromColumnId && fromColumnId !== toColumnId) onMove(draggingId, fromColumnId, toColumnId)
    }
    setDraggingId(null)
    setDragOverColumn(null)
  }

  return (
    <div className={cn('flex gap-3 overflow-x-auto pb-2', className)}>
      {columns.map((column) => (
        <div
          key={column.id}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOverColumn(column.id)
          }}
          onDragLeave={() => setDragOverColumn((c) => (c === column.id ? null : c))}
          onDrop={(e) => {
            e.preventDefault()
            handleDrop(column.id)
          }}
          className={cn(
            'flex-1 min-w-[260px] max-w-[320px] flex flex-col rounded-[var(--radius-lg)] border bg-[var(--color-surface)] transition-colors',
            dragOverColumn === column.id ? 'border-[var(--color-primary-400)]' : 'border-[var(--color-border)]'
          )}
        >
          <div className="px-3 py-2.5 border-b border-[var(--color-border)] flex items-center justify-between shrink-0 gap-2">
            {renderColumnHeader ? (
              renderColumnHeader(column)
            ) : (
              <>
                <span className="text-[12px] font-semibold text-[var(--color-text-heading)] truncate">{column.title}</span>
                <span className="text-[11px] text-[var(--color-text-muted)] shrink-0">{column.items.length}</span>
              </>
            )}
          </div>

          <div className="flex-1 p-2 space-y-2 overflow-y-auto min-h-[100px] max-h-[calc(100vh-340px)]">
            {column.items.length === 0 ? (
              <p className="text-[11px] text-[var(--color-text-muted)] text-center py-6">{emptyColumnLabel}</p>
            ) : (
              column.items.map((item) => {
                const itemId = getItemId(item)
                return (
                  <div
                    key={itemId}
                    draggable
                    onDragStart={() => setDraggingId(itemId)}
                    onDragEnd={() => setDraggingId(null)}
                    className={cn('cursor-grab active:cursor-grabbing', draggingId === itemId && 'opacity-50')}
                  >
                    {renderCard(item, { moveTo: (toColumnId) => onMove(itemId, column.id, toColumnId) })}
                  </div>
                )
              })
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
