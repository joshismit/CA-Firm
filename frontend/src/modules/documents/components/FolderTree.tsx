// src/modules/documents/components/FolderTree.tsx
// Adjacency-list folder tree (PRD §7.1 rule 3/9) - builds the parent/child tree client-side from
// the flat DocumentFolder[] list (see hooks/useFoldersQuery), same "fetch flat, nest in memory"
// approach as backend/src/modules/documents/routes/document-folder.routes.ts's own header comment
// on why the list endpoint isn't paginated: folder counts per Business/category are small.
import { useState } from 'react'
import { ChevronRight, ChevronDown, Folder, FolderOpen, Pencil, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DocumentFolder } from '../types'

export interface FolderTreeProps {
  folders: DocumentFolder[]
  selectedFolderId: string | null
  onSelect: (folderId: string | null) => void
  onRename: (folder: DocumentFolder) => void
  onDelete: (folder: DocumentFolder) => void
}

interface TreeNode {
  folder: DocumentFolder
  children: TreeNode[]
}

function buildTree(folders: DocumentFolder[]): TreeNode[] {
  const nodesById = new Map<string, TreeNode>(folders.map((folder) => [folder.id, { folder, children: [] }]))
  const roots: TreeNode[] = []

  for (const node of nodesById.values()) {
    const parentId = node.folder.parentFolderId
    const parent = parentId ? nodesById.get(parentId) : undefined
    if (parent) {
      parent.children.push(node)
    } else {
      roots.push(node)
    }
  }

  const byName = (a: TreeNode, b: TreeNode) => a.folder.name.localeCompare(b.folder.name)
  const sortRecursive = (nodes: TreeNode[]) => {
    nodes.sort(byName)
    nodes.forEach((n) => sortRecursive(n.children))
  }
  sortRecursive(roots)

  return roots
}

function TreeRow({
  node,
  depth,
  selectedFolderId,
  onSelect,
  onRename,
  onDelete,
}: {
  node: TreeNode
  depth: number
  selectedFolderId: string | null
  onSelect: (folderId: string | null) => void
  onRename: (folder: DocumentFolder) => void
  onDelete: (folder: DocumentFolder) => void
}) {
  const [expanded, setExpanded] = useState(true)
  const isSelected = node.folder.id === selectedFolderId
  const hasChildren = node.children.length > 0

  return (
    <div>
      <div
        className={cn(
          'group flex items-center gap-1 rounded-[var(--radius-md)] pr-1.5 py-1 text-[13px]',
          isSelected ? 'bg-[var(--color-primary-50)] text-[var(--color-primary-700)]' : 'hover:bg-[var(--color-hover)]'
        )}
        style={{ paddingLeft: `${depth * 16 + 4}px` }}
      >
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className={cn('shrink-0 p-0.5 rounded', !hasChildren && 'invisible')}
          aria-label={expanded ? 'Collapse' : 'Expand'}
        >
          {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </button>
        <button type="button" onClick={() => onSelect(node.folder.id)} className="flex items-center gap-1.5 min-w-0 flex-1 text-left">
          {isSelected ? <FolderOpen className="w-3.5 h-3.5 shrink-0" /> : <Folder className="w-3.5 h-3.5 shrink-0 text-[var(--color-text-muted)]" />}
          <span className="truncate">{node.folder.name}</span>
        </button>
        <button
          type="button"
          onClick={() => onRename(node.folder)}
          className="shrink-0 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-[var(--color-hover)] transition-opacity"
          aria-label={`Rename ${node.folder.name}`}
        >
          <Pencil className="w-3 h-3 text-[var(--color-text-muted)]" />
        </button>
        <button
          type="button"
          onClick={() => onDelete(node.folder)}
          className="shrink-0 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-[var(--color-hover)] transition-opacity"
          aria-label={`Delete ${node.folder.name}`}
        >
          <Trash2 className="w-3 h-3 text-[var(--color-danger-600)]" />
        </button>
      </div>
      {expanded && hasChildren && (
        <div>
          {node.children.map((child) => (
            <TreeRow
              key={child.folder.id}
              node={child}
              depth={depth + 1}
              selectedFolderId={selectedFolderId}
              onSelect={onSelect}
              onRename={onRename}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function FolderTree({ folders, selectedFolderId, onSelect, onRename, onDelete }: FolderTreeProps) {
  const tree = buildTree(folders)

  if (tree.length === 0) {
    return <p className="text-[12px] text-[var(--color-text-muted)] px-1 py-2">No folders in this category yet.</p>
  }

  return (
    <div role="tree" aria-label="Folders">
      {tree.map((node) => (
        <TreeRow
          key={node.folder.id}
          node={node}
          depth={0}
          selectedFolderId={selectedFolderId}
          onSelect={onSelect}
          onRename={onRename}
          onDelete={onDelete}
        />
      ))}
    </div>
  )
}
