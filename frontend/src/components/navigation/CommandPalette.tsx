// src/components/navigation/CommandPalette.tsx
// Global Ctrl+K / Cmd+K command palette, wired to store/ui.store.ts's commandMenuOpen state and
// the Header's search trigger button. Search categories:
//   - Pages: every item in constants/navigation.ts (always available, no API)
//   - Projects / Tasks: real results from the live backend (the only two modules with a real API)
//   - Clients: architecture only - no Clients API exists yet, so this stays a placeholder
//     (see backend status: only Projects/Tasks are implemented) rather than inventing one.
//
// Data queries only run while the palette is open: the outer <CommandPalette> mounts the keyboard
// listener unconditionally, but only renders <CommandPaletteContent> (which calls the Projects/Tasks
// query hooks) when open - so nothing is fetched in the background while the palette is closed.
import { useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from 'cmdk'
import { FileText, LayoutGrid, Users } from 'lucide-react'
import { useUiStore } from '@/store/ui.store'
import { NAV_GROUPS } from '@/constants/navigation'
import { useProjectsQuery } from '@/modules/projects/hooks'
import { useTasksQuery } from '@/modules/tasks/hooks'

const itemClass =
  'flex items-center gap-2.5 rounded-[var(--radius-md)] px-3 py-2 text-[13px] text-[var(--color-text-body)] ' +
  'cursor-pointer data-[selected=true]:bg-[var(--color-hover)] outline-none'

function CommandPaletteContent({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
  const navigate = useNavigate()

  const pages = useMemo(
    () => NAV_GROUPS.flatMap((group) => group.items.map((item) => ({ ...item, group: group.label }))),
    []
  )

  const { data: projectsData } = useProjectsQuery({ page: 1, limit: 8 })
  const { data: tasksData } = useTasksQuery({ page: 1, limit: 8 })

  const go = (path: string) => {
    navigate(path)
    onOpenChange(false)
  }

  return (
    <>
      <CommandInput
        placeholder="Search pages, projects, tasks…"
        className="w-full h-12 px-4 text-[14px] bg-transparent outline-none border-b border-[var(--color-border)] text-[var(--color-text-body)] placeholder:text-[var(--color-text-disabled)]"
      />
      <CommandList className="max-h-[360px] overflow-y-auto p-2">
        <CommandEmpty className="py-8 text-center text-[13px] text-[var(--color-text-muted)]">
          No results found.
        </CommandEmpty>

        <CommandGroup heading="Pages" className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-muted)] px-2 py-1.5">
          {pages.map((page) => {
            const Icon = page.icon
            return (
              <CommandItem key={page.path} value={`${page.label} ${page.group}`} onSelect={() => go(page.path)} className={itemClass}>
                <Icon className="w-4 h-4 text-[var(--color-text-muted)]" />
                <span>{page.label}</span>
                <span className="ml-auto text-[11px] text-[var(--color-text-muted)]">{page.group}</span>
              </CommandItem>
            )
          })}
        </CommandGroup>

        <CommandSeparator className="my-2 h-px bg-[var(--color-border)]" />

        <CommandGroup heading="Projects" className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-muted)] px-2 py-1.5">
          {(projectsData?.data ?? []).map((project) => (
            <CommandItem
              key={project.id}
              value={`${project.name} ${project.code}`}
              onSelect={() => go(`/projects/${project.id}`)}
              className={itemClass}
            >
              <LayoutGrid className="w-4 h-4 text-[var(--color-text-muted)]" />
              <span className="truncate">{project.name}</span>
              <span className="ml-auto font-mono text-[11px] text-[var(--color-text-muted)]">{project.code}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator className="my-2 h-px bg-[var(--color-border)]" />

        <CommandGroup heading="Tasks" className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-muted)] px-2 py-1.5">
          {(tasksData?.data ?? []).map((task) => (
            <CommandItem key={task.id} value={task.title} onSelect={() => go(`/tasks/${task.id}`)} className={itemClass}>
              <FileText className="w-4 h-4 text-[var(--color-text-muted)]" />
              <span className="truncate">{task.title}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator className="my-2 h-px bg-[var(--color-border)]" />

        <CommandGroup heading="Clients" className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-muted)] px-2 py-1.5">
          <CommandItem disabled value="clients-unavailable" className={itemClass + ' opacity-50 cursor-not-allowed'}>
            <Users className="w-4 h-4 text-[var(--color-text-muted)]" />
            {/* TODO: replace with a real client search once a Clients API exists. */}
            <span>Client search will be available once the Clients API is live</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </>
  )
}

export function CommandPalette() {
  const open = useUiStore((s) => s.commandMenuOpen)
  const setOpen = useUiStore((s) => s.setCommandMenuOpen)

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen(!open)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, setOpen])

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      label="Command palette"
      overlayClassName="fixed inset-0 z-[var(--z-modal)] bg-[var(--color-overlay)] backdrop-blur-[2px]"
      contentClassName="fixed left-1/2 top-[15%] z-[var(--z-modal)] w-full max-w-[560px] -translate-x-1/2 overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-card)] shadow-[var(--shadow-xl)]"
    >
      <CommandPaletteContent onOpenChange={setOpen} />
    </CommandDialog>
  )
}
