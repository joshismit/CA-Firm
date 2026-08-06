// Nested settings routes (profile, firm, billing, team, integrations) mounted under the protected route group.

import type { RouteObject } from 'react-router-dom'
import {
  SettingsHomePage,
  ProfileSettingsPage,
  FirmSettingsPage,
  BillingSettingsPage,
  TeamSettingsPage,
  IntegrationsSettingsPage,
  DashboardDefaultsSettingsPage,
} from '@/modules/settings/pages'
import { WhiteLabelSettingsPage } from '@/modules/white-label'

export const settingsRoutes: RouteObject[] = [
  { index: true, element: <SettingsHomePage /> },
  { path: 'profile', element: <ProfileSettingsPage /> },
  { path: 'firm', element: <FirmSettingsPage /> },
  { path: 'billing', element: <BillingSettingsPage /> },
  { path: 'team', element: <TeamSettingsPage /> },
  { path: 'white-label', element: <WhiteLabelSettingsPage /> },
  { path: 'integrations', element: <IntegrationsSettingsPage /> },
  { path: 'dashboard-defaults', element: <DashboardDefaultsSettingsPage /> },
]
