'use client'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, ArrowLeftRight, BookOpen, Table2, ListTree, TrendingUp, Scale, BarChart3, Upload, PenLine, ChevronDown } from 'lucide-react'
import clsx from 'clsx'

const NAV = [
  { section: 'Principal' },
  { label: 'Dashboard',            href: '/',               icon: LayoutDashboard },
  { label: 'Conciliar extracto',   href: '/conciliar',      icon: ArrowLeftRight, badge: true },
  { section: 'Contabilidad' },
  { label: 'Libro diario',         href: '/diario',         icon: BookOpen },
  { label: 'Libro mayor',          href: '/mayor',          icon: Table2 },
  { label: 'Plan de cuentas',      href: '/coa',            icon: ListTree },
  { label: 'Asiento manual',       href: '/asiento-manual', icon: PenLine },
  { section: 'Reportes' },
  { label: 'Estado de resultados', href: '/reportes',       icon: TrendingUp },
  { label: 'Balance general',      href: '/balance',        icon: Scale },
  { label: 'Pendientes',           href: '/pendientes',     icon: BarChart3 },
  { section: 'Gestión' },
  { label: 'Subir extracto',       href: '/upload',         icon: Upload },
]

export default function Sidebar({ pendingCount = 0 }: { pendingCount?: number }) {
  const pathname = usePathname()
  const router   = useRouter()

  return (
    <aside className="w-52 min-w-[208px] flex flex-col" style={{ background: '#042C53' }}>
      <div className="px-4 py-4 border-b border-white/10">
        <div className="text-white font-semibold text-sm">FinClear</div>
        <div className="text-white/40 text-xs mt-0.5">Conciliaciones Pro</div>
      </div>

      <button className="mx-3 mt-3 flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 hover:bg-white/10 transition-colors">
        <div className="w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ background: '#1D9E75' }}>LL</div>
        <div className="text-left min-w-0">
          <div className="text-xs text-white/85 font-medium leading-tight truncate">Legacy Luxury Limo</div>
          <div className="text-xs text-white/35 leading-tight">Corp</div>
        </div>
        <ChevronDown size={12} className="text-white/30 ml-auto flex-shrink-0" />
      </button>

      <nav className="flex-1 px-2 py-3 overflow-y-auto">
        {NAV.map((item, i) => {
          if ('section' in item) return (
            <div key={i} className="text-white/30 font-medium px-3 mt-3 mb-1 tracking-wide uppercase" style={{ fontSize: 9 }}>{item.section}</div>
          )
          const Icon = item.icon!
          const href = item.href!
          const active = pathname === href || (href !== '/' && pathname.startsWith(href))
          return (
            <div key={i} className={clsx('nav-item', active && 'active')} onClick={() => router.push(href)}>
              <Icon size={14} />
              <span>{item.label}</span>
              {item.badge && pendingCount > 0 && (
                <span className="ml-auto text-xs bg-red-600 text-white px-1.5 py-0.5 rounded-full font-medium" style={{ fontSize: 9 }}>{pendingCount}</span>
              )}
            </div>
          )
        })}
      </nav>
    </aside>
  )
}
