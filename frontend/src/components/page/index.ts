// Shared page-composition framework - every future module page follows:
//   <PageLayout>
//     <PageHeader title="..." actions={<PageActions>...</PageActions>} />
//     <PageToolbar><PageSearch .../><PageFilters>...</PageFilters></PageToolbar>
//     <PageContent><DataTable .../></PageContent>
//   </PageLayout>
//
// PageHeader and PageEmpty are deliberately NOT redefined here - they already exist and are
// actively used (components/shared/PageHeader/PageHeader.tsx, components/feedback/EmptyState.tsx).
// Re-exporting them keeps this a single, complete import surface for page composition without
// duplicating either component.

export * from './PageLayout'
export * from './PageToolbar'
export * from './PageFilters'
export * from './PageSearch'
export * from './PageActions'
export * from './PageContent'
export * from './PageSidebar'
export * from './PageFooter'

export { PageHeader } from '@/components/shared/PageHeader/PageHeader'
export { EmptyState as PageEmpty } from '@/components/feedback'
