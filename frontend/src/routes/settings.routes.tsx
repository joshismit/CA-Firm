// Nested settings routes (profile, firm, billing, team, integrations) mounted under the protected route group.

import type { RouteObject } from 'react-router-dom'
import { ComingSoon } from '@/components/common/ComingSoon'

export const settingsRoutes: RouteObject[] = [
  { index: true, element: <ComingSoon name="Settings" /> },
  { path: 'profile', element: <ComingSoon name="Profile Settings" /> },
  { path: 'firm', element: <ComingSoon name="Firm Settings" /> },
  { path: 'billing', element: <ComingSoon name="Billing Settings" /> },
  { path: 'team', element: <ComingSoon name="Team Settings" /> },
  { path: 'integrations', element: <ComingSoon name="Integrations" /> },
]
