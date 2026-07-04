import { Building2, CircleHelp, Home, Map, Menu, Users, X } from 'lucide-react'
import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import unisinosLogo from '../../assets/unisinos-logo-white.png'

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
        <NavLink to="/" className="brand" aria-label="Unisinos - página inicial">
          <img className="brand__logo" src={unisinosLogo} alt="Unisinos" />
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
              <Icon size={19} strokeWidth={1.9} aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="topbar__actions">
          <a className="help-action" href="/#como-navegar">
            <CircleHelp size={18} strokeWidth={1.9} aria-hidden="true" />
            <span>Ajuda</span>
          </a>
          <button className="cei-action" type="button" title="Núcleo CEI — em breve">
            <Users size={19} strokeWidth={1.9} aria-hidden="true" />
            <span>Núcleo CEI</span>
          </button>
        </div>
      </div>
    </header>
  )
}
