// src/modules/documents/pages/DocumentFoldersPage.tsx
// Folder browser for one Business (PRD §7.1 rule 9: folder tree, breadcrumbs, create/rename/delete
// folder dialogs, category navigation). Three panes: CategoryNav (left rail) -> FolderTree (middle)
// -> selected folder's documents (right, reusing the same DataTable/documentTableColumns as
// DocumentListPage). Category + selected folder are kept in the URL (search params) so the browser
// back/forward buttons and shareable links both work.
import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { FolderPlus, Upload } from 'lucide-react'
import { PageLayout, PageHeader, PageContent, PageActions } from '@/components/page'
import { DataTable } from '@/components/tables'
import { Card } from '@/components/shared/Card/Card'
import { Button } from '@/components/ui/button'
import { Spinner, ErrorState } from '@/components/feedback'
import { Can } from '@/components/common/Can'
import { PERMISSIONS } from '@/config/permissions.config'
import { normalizeApiError } from '@/services/api-error'
import { useBusinessQuery } from '@/modules/business/hooks'
import { useDocumentsQuery, useFoldersQuery } from '../hooks'
import {
  CategoryNav,
  FolderTree,
  FolderBreadcrumbs,
  CreateFolderDialog,
  RenameFolderDialog,
  DeleteFolderDialog,
  documentTableColumns,
} from '../components'
import { DOCUMENT_CATEGORY_VALUES } from '../constants'
import type { DocumentCategory, DocumentFile, DocumentFolder } from '../types'

export function DocumentFoldersPage() {
  const { businessId = '' } = useParams<{ businessId: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const category = (searchParams.get('category') as DocumentCategory | null) ?? DOCUMENT_CATEGORY_VALUES[0]
  const selectedFolderId = searchParams.get('folderId')

  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [renameTarget, setRenameTarget] = useState<DocumentFolder | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DocumentFolder | null>(null)

  const businessQuery = useBusinessQuery(businessId)
  const foldersQuery = useFoldersQuery(businessId, { category })
  const folders = foldersQuery.data ?? []

  const selectedFolder = folders.find((f) => f.id === selectedFolderId) ?? null

  const documentsQuery = useDocumentsQuery({
    businessId,
    folderId: selectedFolderId ?? undefined,
    limit: 50,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  })

  const setCategory = (next: DocumentCategory) => {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev)
      params.set('category', next)
      params.delete('folderId')
      return params
    })
  }

  const setSelectedFolderId = (next: string | null) => {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev)
      if (next) params.set('folderId', next)
      else params.delete('folderId')
      return params
    })
  }

  return (
    <PageLayout>
      <PageHeader
        title="Document Folders"
        description={businessQuery.data ? businessQuery.data.name : undefined}
        actions={
          <PageActions>
            <Can permission={PERMISSIONS.DOCUMENTS_CREATE}>
              <Button
                variant="outline"
                leadingIcon={<FolderPlus className="w-3.5 h-3.5" />}
                onClick={() => setCreateDialogOpen(true)}
              >
                New folder
              </Button>
              <Button
                leadingIcon={<Upload className="w-3.5 h-3.5" />}
                onClick={() =>
                  navigate('/documents/upload', {
                    state: { businessId, category, folderId: selectedFolderId ?? undefined },
                  })
                }
              >
                Upload here
              </Button>
            </Can>
          </PageActions>
        }
      />

      <PageContent>
        <div className="grid grid-cols-1 md:grid-cols-[180px_260px_1fr] gap-4">
          <Card padding="sm">
            <CategoryNav value={category} onChange={setCategory} />
          </Card>

          <Card padding="sm">
            {foldersQuery.isLoading ? (
              <Spinner fullScreen={false} label="Loading folders…" className="py-8" />
            ) : foldersQuery.isError ? (
              <ErrorState
                title="Couldn't load folders"
                message={normalizeApiError(foldersQuery.error).message}
                onRetry={foldersQuery.refetch}
                className="py-8"
              />
            ) : (
              <FolderTree
                folders={folders}
                selectedFolderId={selectedFolderId}
                onSelect={setSelectedFolderId}
                onRename={setRenameTarget}
                onDelete={setDeleteTarget}
              />
            )}
          </Card>

          <div className="space-y-3">
            <FolderBreadcrumbs category={category} folders={folders} selectedFolderId={selectedFolderId} onSelect={setSelectedFolderId} />

            <DataTable<DocumentFile>
              columns={documentTableColumns}
              data={documentsQuery.data?.data ?? []}
              isLoading={documentsQuery.isLoading}
              isError={documentsQuery.isError}
              errorMessage={documentsQuery.isError ? normalizeApiError(documentsQuery.error).message : undefined}
              onRetry={documentsQuery.refetch}
              emptyTitle="No documents here yet"
              emptyDescription={
                selectedFolderId ? 'Documents uploaded to this folder will appear here.' : 'Select a folder, or upload directly into this category.'
              }
              pageIndex={0}
              pageSize={50}
              pageCount={1}
              totalRows={documentsQuery.data?.meta?.total}
              onPageChange={() => {}}
              onPageSizeChange={() => {}}
              getRowId={(row) => row.id}
              onRowClick={(row) => navigate(`/documents/${row.id}`)}
            />
          </div>
        </div>
      </PageContent>

      <CreateFolderDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        businessId={businessId}
        category={category}
        parentFolderId={selectedFolderId}
        parentFolderName={selectedFolder?.name}
        onCreated={setSelectedFolderId}
      />
      <RenameFolderDialog folder={renameTarget} businessId={businessId} onClose={() => setRenameTarget(null)} />
      <DeleteFolderDialog
        folder={deleteTarget}
        businessId={businessId}
        onClose={() => {
          if (deleteTarget && deleteTarget.id === selectedFolderId) setSelectedFolderId(null)
          setDeleteTarget(null)
        }}
      />
    </PageLayout>
  )
}
