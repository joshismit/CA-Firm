// Unauthenticated routes (login, register, forgot/reset password, invite-accept), rendered inside AuthLayout.

import type { RouteObject } from 'react-router-dom'
import { GuestRoute } from './guards/GuestRoute'
import { AuthLayout } from '@/layouts/AuthLayout/AuthLayout'
import { LoginPage } from '@/modules/auth/pages/LoginPage'
import { ComingSoon } from '@/components/common/ComingSoon'

export const publicRoutes: RouteObject = {
  element: <GuestRoute />,
  children: [
    {
      element: <AuthLayout />,
      children: [
        { path: 'login', element: <LoginPage /> },
        { path: 'register', element: <ComingSoon name="Register" /> },
        { path: 'forgot-password', element: <ComingSoon name="Forgot Password" /> },
        { path: 'reset-password', element: <ComingSoon name="Reset Password" /> },
        { path: 'invite/:token', element: <ComingSoon name="Accept Invitation" /> },
      ],
    },
  ],
}
