// Nested settings routes (profile, firm, billing, team, integrations) mounted under the protected route group.

import type { RouteObject } from 'react-router-dom'
import {
  SettingsHomePage,
  ProfileSettingsPage,
  FirmSettingsPage,
  BillingSettingsPage,
  TeamSettingsPage,
  IntegrationsSettingsPage,
} from '@/modules/settings/pages'

export const settingsRoutes: RouteObject[] = [
  { index: true, element: <SettingsHomePage /> },
  { path: 'profile', element: <ProfileSettingsPage /> },
  { path: 'firm', element: <FirmSettingsPage /> },
  { path: 'billing', element: <BillingSettingsPage /> },
  { path: 'team', element: <TeamSettingsPage /> },
  { path: 'integrations', element: <IntegrationsSettingsPage /> },
]
