import { Building2, CircleHelp, Home, Map, Menu, Users, X } from 'lucide-react'
import { useState } from 'react'
import { NavLink } from 'react-router-dom'

const navItems = [
  { to: '/', label: 'Início', icon: Home, end: true },
  { to: '/ranking-regional', label: 'Regiões funcionais', icon: Map, end: false },
  { to: '/municipios', label: 'Municípios', icon: Building2, end: false },
]

export function TopNavigation() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <header className="topbar">
      <div className="topbar__inner">
        <NavLink to="/" className="brand" aria-label="Radar dos Municípios do RS — página inicial">
          <span className="brand__mark" aria-hidden="true">R</span>
          <span className="brand__text">Radar dos Municípios <span>do RS</span></span>
        </NavLink>

        <button
          className="nav-toggle"
          type="button"
          aria-label={isOpen ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={isOpen}
          onClick={() => setIsOpen((current) => !current)}
        >
          {isOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>

        <nav className={isOpen ? 'primary-nav primary-nav--open' : 'primary-nav'} aria-label="Navegação principal">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setIsOpen(false)}
              className={({ isActive }) => isActive ? 'nav-link nav-link--active' : 'nav-link'}
            >
              <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="topbar__actions">
          <button className="help-action" type="button" title="Ajuda — em breve">
            <CircleHelp size={18} aria-hidden="true" />
            <span>Ajuda</span>
          </button>
          <button className="cei-action" type="button" title="Núcleo CEI — em breve">
            <Users size={18} aria-hidden="true" />
            <span>Núcleo CEI</span>
          </button>
        </div>
      </div>
    </header>
  )
}
