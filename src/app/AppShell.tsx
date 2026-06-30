import { Outlet, useLocation } from 'react-router-dom'
import { GlobalFilters } from '../components/filters/GlobalFilters'
import { TopNavigation } from '../components/navigation/TopNavigation'

export function AppShell() {
  const { pathname } = useLocation()
  const isHome = pathname === '/'

  return (
    <div className="app-shell">
      <TopNavigation />
      <main className={isHome ? 'main-content main-content--home' : 'main-content'}>
        {!isHome ? <GlobalFilters compact={pathname === '/ranking-regional'} /> : null}
        <Outlet />
      </main>
    </div>
  )
}
