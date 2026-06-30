import { createBrowserRouter } from 'react-router-dom'
import { App } from '../App'
import { HomePage } from '../features/home/HomePage'
import { MunicipalitiesPage } from '../features/municipalities/MunicipalitiesPage'
import { RegionsPage } from '../features/regions/RegionsPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'ranking-regional', element: <RegionsPage /> },
      { path: 'municipios', element: <MunicipalitiesPage /> },
    ],
  },
])
