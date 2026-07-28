import { ArrowUp } from 'lucide-react'
import { useEffect, useState, type MouseEvent } from 'react'

const VISIBILITY_THRESHOLD = 600

export function ScrollToTopButton() {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const updateVisibility = () => setIsVisible(window.scrollY > VISIBILITY_THRESHOLD)

    updateVisibility()
    window.addEventListener('scroll', updateVisibility, { passive: true })

    return () => window.removeEventListener('scroll', updateVisibility)
  }, [])

  const scrollToTop = (event: MouseEvent<HTMLButtonElement>) => {
    event.currentTarget.blur()
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    window.scrollTo({
      top: 0,
      behavior: reduceMotion ? 'auto' : 'smooth',
    })
  }

  return (
    <button
      className={isVisible ? 'scroll-to-top is-visible' : 'scroll-to-top'}
      type="button"
      aria-label="Voltar ao topo da página"
      title="Voltar ao topo"
      tabIndex={isVisible ? 0 : -1}
      onClick={scrollToTop}
    >
      <ArrowUp size={18} strokeWidth={2.4} aria-hidden="true" />
      <span className="scroll-to-top__label">Voltar ao topo</span>
    </button>
  )
}
