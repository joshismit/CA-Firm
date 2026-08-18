// Unauthenticated routes (login, forgot/reset password, invite-accept), rendered inside AuthLayout.
// No self-service registration route - accounts are provisioned via invitation only (a master
// admin creates a tenant + owner, who then invites staff); see modules/auth/pages/AcceptInvitePage.

import type { RouteObject } from 'react-router-dom'
import { GuestRoute } from './guards/GuestRoute'
import { AuthLayout } from '@/layouts/AuthLayout/AuthLayout'
import { LoginPage, ForgotPasswordPage, ResetPasswordPage, AcceptInvitePage } from '@/modules/auth/pages'

export const publicRoutes: RouteObject = {
  element: <GuestRoute />,
  children: [
    {
      element: <AuthLayout />,
      children: [
        { path: 'login', element: <LoginPage /> },
        { path: 'forgot-password', element: <ForgotPasswordPage /> },
        { path: 'reset-password', element: <ResetPasswordPage /> },
        { path: 'invite/:token', element: <AcceptInvitePage /> },
      ],
    },
  ],
}
