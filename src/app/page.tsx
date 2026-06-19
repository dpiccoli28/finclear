'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { TrendingUp, TrendingDown, Landmark, Clock, AlertTriangle, ArrowRight, Sparkles } from 'lucide-react'
import Sidebar from '@/components/Sidebar'
import { supabase, Transaction, Account, JournalEntry } from '@/lib/supabase'

const COMPANY_ID = '00000000-0000-0000-0000-000000000001'
const fmt = (n: number) => '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function Dashboard() {
  const router = useRouter()
  const [txs, setTxs] = useState<Transaction[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const [{ data: txData }, { data: accData }, { data: entData }] = await Promise.all([
      supabase.from('transactions').select('*, account:accounts(*)').eq('company_id', COMPANY_ID).order('date', { ascending: false }).limit(50),
      supabase.from('accounts').select('*').eq('company_id', COMPANY_ID),
      supabase.from('journal_entries').select('*, lines:journal_lines(*, account:accounts(*))').eq('company_id', COMPANY_ID).order('date', { ascending: false }).limit(10),
    ])
    setTxs(txData || [])
    setAccounts(accData || [])
    setEntries(entData || [])
    setLoading(false)
  }

  const pending   = txs.filter(t => t.status === 'pending' && !t.auto_classified)
  const confirmed = txs.filter(t => t.status === 'confirmed')
  const totalIn   = txs.filter(t => t.status === 'confirmed').reduce((s, t) => s + t.credit, 0)
  const totalOut  = txs.filter(t => t.status === 'confirmed').reduce((s, t) => s + t.debit, 0)

  const accMap: Record<string, Account> = {}
  accounts.forEach(a => accMap[a.id] = a)

  if (loading) return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 flex items-center justify-center">
        <div className="text-gray-400 text-sm">Cargando...</div>
      </main>
    </div>
  )

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar pendingCount={pending.length} />
      <main className="flex-1 flex flex-col overflow-hidden">

        {/* Topbar */}
        <div className="bg-white border-b border-gray-100 px-6 py-3 flex items-center gap-3">
          <h1 className="text-base font-medium text-gray-800">Dashboard</h1>
          <div className="ml-auto flex gap-2">
            <select className="form-select w-auto text-xs">
              <option>Enero 2026</option>
              <option>Diciembre 2025</option>
            </select>
            <button onClick={() => router.push('/upload')} className="btn-secondary text-xs">
              Subir extracto
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">

          {/* KPIs */}
          <div className="grid grid-cols-4 gap-3 mb-5">
            {[
              { label: 'Ingresos confirmados', value: fmt(totalIn), icon: TrendingUp, color: 'text-teal border-t-2 border-teal-mid' },
              { label: 'Egresos confirmados',  value: fmt(totalOut), icon: TrendingDown, color: 'text-red-700 border-t-2 border-red-400' },
              { label: 'Utilidad neta',        value: fmt(totalIn - totalOut), icon: Landmark, color: (totalIn-totalOut) >= 0 ? 'text-teal border-t-2 border-blue-400' : 'text-red-700 border-t-2 border-red-400' },
              { label: 'Sin clasificar',       value: String(pending.length), icon: Clock, color: 'text-amber-700 border-t-2 border-amber-400' },
            ].map((k, i) => (
              <div key={i} className={`card p-4 ${k.color}`}>
                <div className="text-xs text-gray-400 mb-1 flex items-center gap-1"><k.icon size={12} />{k.label}</div>
                <div className={`text-2xl font-medium ${k.color.split(' ')[0]}`}>{k.value}</div>
              </div>
            ))}
          </div>

          {/* Alert */}
          {pending.length > 0 && (
            <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-5 text-sm text-amber-800">
              <AlertTriangle size={16} />
              <span><strong>{pending.length} transacciones</strong> del extracto esperan ser clasificadas y contabilizadas.</span>
              <button onClick={() => router.push('/conciliar')} className="ml-auto flex items-center gap-1 text-amber-700 font-medium hover:text-amber-900">
                Ir a conciliar <ArrowRight size={14} />
              </button>
            </div>
          )}

          {/* Recent journal entries */}
          <div className="card">
            <div className="card-header justify-between">
              <span className="card-title">Últimos asientos registrados</span>
              <button onClick={() => router.push('/diario')} className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1">Ver libro diario <ArrowRight size={12} /></button>
            </div>
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead><tr><th>Fecha</th><th>Descripción</th><th>Cuenta Debe</th><th>Cuenta Haber</th><th className="text-right">Monto</th><th>Tipo</th></tr></thead>
                <tbody>
                  {entries.length === 0 && (
                    <tr><td colSpan={6} className="text-center py-8 text-gray-400">No hay asientos registrados aún. Sube un extracto para empezar.</td></tr>
                  )}
                  {entries.map(e => {
                    const debeL  = e.lines?.find(l => l.debit  > 0)
                    const haberL = e.lines?.find(l => l.credit > 0)
                    const monto  = debeL?.debit || haberL?.credit || 0
                    const tipo   = (debeL?.account as any)?.type
                    return (
                      <tr key={e.id}>
                        <td className="text-xs text-gray-400 whitespace-nowrap">{e.date}</td>
                        <td className="max-w-xs truncate">{e.description}</td>
                        <td className="text-xs font-mono text-gray-500">{(debeL?.account as any)?.code} · {(debeL?.account as any)?.name}</td>
                        <td className="text-xs font-mono text-gray-500">{(haberL?.account as any)?.code} · {(haberL?.account as any)?.name}</td>
                        <td className={`text-right ${tipo === 'ingreso' ? 'amount-in' : 'amount-out'}`}>{fmt(monto)}</td>
                        <td>
                          <span className={`badge ${tipo === 'ingreso' ? 'badge-done' : tipo === 'nd' ? 'badge-nd' : tipo === 'impuesto' ? 'badge-tax' : 'badge-pending'}`}>
                            {tipo === 'ingreso' ? 'Ingreso' : tipo === 'costo' ? 'Costo' : tipo === 'gasto' ? 'Gasto' : tipo === 'impuesto' ? 'Impuesto' : tipo === 'nd' ? 'No ded.' : '—'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </main>
    </div>
  )
}
