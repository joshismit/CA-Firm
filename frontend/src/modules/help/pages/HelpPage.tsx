// src/modules/help/pages/HelpPage.tsx
// Static help content only - no backend to fetch from, so nothing here pretends to be dynamic data.
// FAQ uses native <details>/<summary> (Card-wrapped) rather than a new Accordion primitive - no
// accordion component exists elsewhere in the app, and <details> is natively keyboard-operable
// with zero extra JS.
import { Link } from 'react-router-dom'
import {
  Landmark,
  FolderOpen,
  CheckSquare,
  FileText,
  Users,
  ArrowRight,
  LifeBuoy,
} from 'lucide-react'
import { PageLayout, PageHeader, PageContent } from '@/components/page'
import { Card } from '@/components/shared/Card/Card'
import { cn } from '@/lib/utils'

const QUICK_LINKS = [
  { label: 'Businesses', description: 'Manage your client businesses.', path: '/business', icon: Landmark },
  { label: 'Documents', description: 'Upload and organize client files.', path: '/documents', icon: FolderOpen },
  { label: 'My Tasks', description: 'Track work assigned to you.', path: '/tasks/my', icon: CheckSquare },
  { label: 'Compliance', description: 'GST, ITR, TDS, and MCA filings.', path: '/gst', icon: FileText },
]

const FAQS = [
  {
    question: 'How do I add a new client?',
    answer:
      'Go to Clients → Add Client to create a business and its primary contact together, or add a business and contact separately from the Businesses and Contacts pages.',
  },
  {
    question: 'Where do I upload documents for a client?',
    answer:
      'Open Documents → Upload Document, or upload directly from a business\'s detail page using the "Documents" card.',
  },
  {
    question: 'Can I export data to a spreadsheet?',
    answer: 'Yes - every list page with an Export button lets you download the current, filtered view as CSV.',
  },
  {
    question: 'Why does a page show "not available yet"?',
    answer:
      'Some modules are frontend-complete but still waiting on their backend to be connected. Those pages show an honest error state instead of fake numbers, and will start working once the backend for that area ships.',
  },
  {
    question: 'How do I change my password or profile details?',
    answer: 'Go to Settings → Profile, reachable from the user menu in the top-right of any page.',
  },
]

export function HelpPage() {
  return (
    <PageLayout>
      <PageHeader title="Help & Support" description="Guides, answers, and where to go for more help." />
      <PageContent>
        <div>
          <h2 className="text-[13px] font-semibold text-[var(--color-text-heading)] mb-3">Quick links</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {QUICK_LINKS.map(({ label, description, path, icon: Icon }) => (
              <Link key={path} to={path} className="block h-full">
                <Card className="h-full hover:border-[var(--color-primary-300)] hover:shadow-[var(--shadow-md)] transition-all">
                  <div className="w-9 h-9 rounded-[var(--radius-md)] bg-[var(--color-primary-50)] flex items-center justify-center">
                    <Icon className="w-4 h-4 text-[var(--color-primary-600)]" />
                  </div>
                  <h3 className="mt-3 text-[13px] font-semibold text-[var(--color-text-heading)]">{label}</h3>
                  <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">{description}</p>
                </Card>
              </Link>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-[13px] font-semibold text-[var(--color-text-heading)] mb-3">Frequently asked questions</h2>
          <Card padding="sm" className="divide-y divide-[var(--color-border)]">
            {FAQS.map((faq) => (
              <details key={faq.question} className="group py-3 first:pt-0 last:pb-0">
                <summary
                  className={cn(
                    'flex items-center justify-between gap-3 cursor-pointer list-none',
                    'text-[13px] font-medium text-[var(--color-text-body)] px-2 py-1 rounded-[var(--radius-sm)]',
                    'focus-visible:outline-2 focus-visible:outline-[var(--color-border-focus)]'
                  )}
                >
                  {faq.question}
                  <ArrowRight className="w-3.5 h-3.5 text-[var(--color-text-muted)] shrink-0 transition-transform group-open:rotate-90" />
                </summary>
                <p className="mt-1.5 px-2 text-[12px] text-[var(--color-text-muted)]">{faq.answer}</p>
              </details>
            ))}
          </Card>
        </div>

        <Card>
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-[var(--radius-md)] bg-[var(--color-primary-50)] flex items-center justify-center shrink-0">
              <LifeBuoy className="w-4 h-4 text-[var(--color-primary-600)]" />
            </div>
            <div>
              <h3 className="text-[13px] font-semibold text-[var(--color-text-heading)]">Still need help?</h3>
              <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">
                Reach out to your firm's administrators - they can be found under Administration → Users.
              </p>
              <Link
                to="/staff/users"
                className="mt-2 inline-flex items-center gap-1 text-[12px] font-medium text-[var(--color-primary-600)]"
              >
                <Users className="w-3.5 h-3.5" />
                View administrators
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </Card>
      </PageContent>
    </PageLayout>
  )
}
