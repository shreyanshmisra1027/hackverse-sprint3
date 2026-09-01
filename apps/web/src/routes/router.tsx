/// <reference types="vite/client" />
import { StrictMode, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider, createRouter, createRootRoute, createRoute, createBrowserHistory, Outlet, Link as TSRLink, useNavigate } from '@tanstack/react-router'
import { InevitableLanding } from '../components/inevitable-landing'
import { LoginForm, SignupForm } from '../components/auth-flow'
import { MessagingDashboard } from '../components/messaging-dashboard'
import '../index.css'

const rootRoute = createRootRoute({ component: () => <div><Outlet /></div> })

const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: () => <InevitableLanding /> })
const loginRoute = createRoute({ getParentRoute: () => rootRoute, path: '/login', component: () => <LoginForm /> })
const signupRoute = createRoute({ getParentRoute: () => rootRoute, path: '/signup', component: () => <SignupForm /> })
const dashboardRoute = createRoute({ getParentRoute: () => rootRoute, path: '/dashboard', component: () => <MessagingDashboard /> })

const routeTree = rootRoute.addChildren([indexRoute, loginRoute, signupRoute, dashboardRoute])

const router = createRouter({ routeTree, history: createBrowserHistory() })

declare module '@tanstack/react-router' {
  interface Register { router: typeof router }
}

export function Link({ to, ...props }: { to: string; children?: ReactNode } & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>) {
  return <TSRLink to={to} {...props} />
}

export { useNavigate }
export type { Router } from '@tanstack/react-router'

export function Bootstrap() {
  const rootElement = document.getElementById('root')!
  if (!rootElement.innerHTML) {
    const root = createRoot(rootElement)
    root.render(
      <StrictMode>
        <RouterProvider router={router} />
      </StrictMode>,
    )
  }
}
