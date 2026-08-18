// src/components/navigation/CommandPalette.tsx
// Global Ctrl+K / Cmd+K command palette, wired to store/ui.store.ts's commandMenuOpen state and
// the Header's search trigger button. Search categories:
//   - Pages: every item in constants/navigation.ts (always available, no API) — filtered by cmdk's
//     own built-in fuzzy matching against the live (undebounced) input, unchanged from before.
//   - Projects: a fixed first-8 batch, also cmdk-filtered locally — unchanged from before (Projects
//     is outside PRD §13.1's scope, which only covers Businesses/Contacts/CRM/Documents/Tasks).
//   - Businesses / Contacts / Leads / Documents / Tasks: real grouped results from the PRD §13.1
//     Global Search endpoint (`GET /search`, `useGlobalSearchQuery`) — already tenant-scoped,
//     permission-gated per category, and text-matched server-side, so each `CommandItem` is
//     `forceMount`ed to opt out of cmdk's own (redundant, and sometimes wrong — e.g. a Lead matched
//     on its linked Contact's email, which cmdk's local fuzzy scorer has no way to know about)
//     client-side re-filtering. A group only renders once it has at least one result.
//
// The search-endpoint groups only start fetching once the palette is open AND the (debounced) query
// is non-empty (`useGlobalSearchQuery`'s own `enabled` check) - nothing is fetched in the background
// while the palette is closed or the input is empty.
import { useEffect, useMemo, useState } from 'react'
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
import { Building2, Contact as ContactIcon, File, FileText, LayoutGrid, Target } from 'lucide-react'
import { useUiStore } from '@/store/ui.store'
import { NAV_GROUPS } from '@/constants/navigation'
import { useDebounce } from '@/hooks/use-debounce'
import { useProjectsQuery } from '@/modules/projects/hooks'
import { useGlobalSearchQuery } from '@/modules/search/hooks'
import type { SearchResultItem } from '@/modules/search/types'

const itemClass =
  'flex items-center gap-2.5 rounded-[var(--radius-md)] px-3 py-2 text-[13px] text-[var(--color-text-body)] ' +
  'cursor-pointer data-[selected=true]:bg-[var(--color-hover)] outline-none'

/** PRD §13.1 — one group per search-endpoint result category, rendered identically apart from icon/heading. */
function SearchResultGroup({
  heading,
  icon: Icon,
  items,
  onSelect,
}: {
  heading: string
  icon: typeof Building2
  items: SearchResultItem[]
  onSelect: (route: string) => void
}) {
  if (items.length === 0) return null

  return (
    <>
      <CommandGroup heading={heading} className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-muted)] px-2 py-1.5">
        {items.map((item) => (
          <CommandItem
            key={item.id}
            value={item.id}
            forceMount
            onSelect={() => onSelect(item.route)}
            className={itemClass}
          >
            <Icon className="w-4 h-4 text-[var(--color-text-muted)] shrink-0" />
            <span className="truncate">{item.title}</span>
            {item.subtitle && <span className="ml-auto truncate text-[11px] text-[var(--color-text-muted)]">{item.subtitle}</span>}
          </CommandItem>
        ))}
      </CommandGroup>
      <CommandSeparator className="my-2 h-px bg-[var(--color-border)]" />
    </>
  )
}

function CommandPaletteContent({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)

  const pages = useMemo(
    () => NAV_GROUPS.flatMap((group) => group.items.map((item) => ({ ...item, group: group.label }))),
    []
  )

  const { data: projectsData } = useProjectsQuery({ page: 1, limit: 8 })
  const { data: searchResults } = useGlobalSearchQuery(debouncedSearch, 8)

  const go = (path: string) => {
    navigate(path)
    onOpenChange(false)
  }

  return (
    <>
      <CommandInput
        value={search}
        onValueChange={setSearch}
        placeholder="Search pages, businesses, contacts, leads, documents, tasks…"
        className="w-full h-12 px-4 text-[14px] bg-transparent outline-none border-b border-[var(--color-border)] text-[var(--color-text-body)] placeholder:text-[var(--color-text-disabled)]"
      />
      <CommandList className="max-h-[400px] overflow-y-auto p-2">
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

        <SearchResultGroup heading="Businesses" icon={Building2} items={searchResults?.businesses ?? []} onSelect={go} />
        <SearchResultGroup heading="Contacts" icon={ContactIcon} items={searchResults?.contacts ?? []} onSelect={go} />
        <SearchResultGroup heading="Documents" icon={File} items={searchResults?.documents ?? []} onSelect={go} />
        <SearchResultGroup heading="Tasks" icon={FileText} items={searchResults?.tasks ?? []} onSelect={go} />
        <SearchResultGroup heading="Leads" icon={Target} items={searchResults?.leads ?? []} onSelect={go} />
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
