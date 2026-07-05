import { createBrowserRouter } from 'react-router-dom'
import { AppShell } from './AppShell'
import { HomePage } from '../features/home/HomePage'
import { MunicipalitiesPage } from '../features/municipalities/MunicipalitiesPage'
import { RegionsPage } from '../features/regions/RegionsPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'ranking-regional', element: <RegionsPage /> },
      { path: 'municipios', element: <MunicipalitiesPage /> },
    ],
  },
])
