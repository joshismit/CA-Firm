import { useEffect } from 'react'
import { RouterProvider } from 'react-router-dom'
import { router } from './app/router'

function App() {
  useEffect(() => {
    // Axios interceptors (services/interceptors.ts) run outside React Router context, so a 401
    // is signaled here via a plain window event rather than a direct navigate() call.
    const handleUnauthorized = () => router.navigate('/login', { replace: true })
    window.addEventListener('auth:unauthorized', handleUnauthorized)
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized)
  }, [])

  return <RouterProvider router={router} />
}

export default App
