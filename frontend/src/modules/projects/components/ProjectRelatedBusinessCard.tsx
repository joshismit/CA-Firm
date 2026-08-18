// src/modules/projects/components/ProjectRelatedBusinessCard.tsx
// "Related Business" - honest, not fabricated. Project.clientId references the Client model
// (backend/prisma/schema.prisma: Project.client -> Client), and Client wraps a Business via a
// businessId FK - but no Client module/routes are mounted (only auth/business/contacts/crm/
// documents/projects/tasks have real APIs; see backend/src/app.ts). There is no endpoint that
// resolves a clientId to its underlying Business, so this card shows the real, raw clientId rather
// than inventing a lookup or silently calling the Business API with the wrong ID.
import { Building2 } from 'lucide-react'
import { Card, CardHeader } from '@/components/shared/Card/Card'

export interface ProjectRelatedBusinessCardProps {
  clientId: string
}

export function ProjectRelatedBusinessCard({ clientId }: ProjectRelatedBusinessCardProps) {
  return (
    <Card>
      <CardHeader title="Related Business" />
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-[var(--radius-md)] bg-[var(--color-surface)] flex items-center justify-center shrink-0">
          <Building2 className="w-4 h-4 text-[var(--color-text-muted)]" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">Client ID</p>
          <p className="mt-0.5 font-mono text-[12px] text-[var(--color-text-body)] break-all">{clientId}</p>
          <p className="mt-2 text-[11px] text-[var(--color-text-muted)]">
            Business name and details aren't shown here - there's no Clients API yet to resolve this ID
            to the underlying business.
          </p>
        </div>
      </div>
    </Card>
  )
}
