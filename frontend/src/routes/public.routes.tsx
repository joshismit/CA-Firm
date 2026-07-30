// Unauthenticated routes (login, register, forgot/reset password, invite-accept), rendered inside AuthLayout.

import type { RouteObject } from 'react-router-dom'
import { GuestRoute } from './guards/GuestRoute'
import { AuthLayout } from '@/layouts/AuthLayout/AuthLayout'
import { LoginPage, RegisterPage, ForgotPasswordPage, ResetPasswordPage, AcceptInvitePage } from '@/modules/auth/pages'

export const publicRoutes: RouteObject = {
  element: <GuestRoute />,
  children: [
    {
      element: <AuthLayout />,
      children: [
        { path: 'login', element: <LoginPage /> },
        { path: 'register', element: <RegisterPage /> },
        { path: 'forgot-password', element: <ForgotPasswordPage /> },
        { path: 'reset-password', element: <ResetPasswordPage /> },
        { path: 'invite/:token', element: <AcceptInvitePage /> },
      ],
    },
  ],
}
