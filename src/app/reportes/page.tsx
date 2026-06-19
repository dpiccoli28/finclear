'use client'
import { useEffect, useState } from 'react'
import { Download, FileText } from 'lucide-react'
import Sidebar from '@/components/Sidebar'
import { supabase, JournalEntry, Account } from '@/lib/supabase'
import { exportPnL } from '@/lib/exports'

const COMPANY_ID = '00000000-0000-0000-0000-000000000001'
const fmt = (n: number) => (n < 0 ? '-' : '') + '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2 })
const pct = (a: number, b: number) => b === 0 ? '—' : ((a / b) * 100).toFixed(1) + '%'

export default function ReportesPage() {
  const [entries, setEntries]   = useState<JournalEntry[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const [{ data: e }, { data: a }] = await Promise.all([
      supabase.from('journal_entries').select('*, lines:journal_lines(*, account:accounts(*))').eq('company_id', COMPANY_ID),
      supabase.from('accounts').select('*').eq('company_id', COMPANY_ID).order('code'),
    ])
    setEntries(e || [])
    setAccounts(a || [])
    setLoading(false)
  }

  // Calculate saldos from journal lines
  const saldos: Record<string, number> = {}
  accounts.forEach(a => saldos[a.id] = 0)
  entries.forEach(e => e.lines?.forEach(l => {
    const acc = accounts.find(a => a.id === l.account_id)
    if (!acc) return
    if (acc.type === 'ingreso') saldos[l.account_id] = (saldos[l.account_id]||0) + l.credit - l.debit
    else saldos[l.account_id] = (saldos[l.account_id]||0) + l.debit - l.credit
  }))

  const get = (id: string) => saldos[id] || 0

  const byType = (t: string) => accounts.filter(a => a.type === t)
  const sum    = (accs: Account[]) => accs.reduce((s, a) => s + get(a.id), 0)

  const totalIng  = sum(byType('ingreso'))
  const totalCos  = sum(byType('costo'))
  const utilBruta = totalIng - totalCos
  const totalGas  = sum(byType('gasto'))
  const totalImp  = sum(byType('impuesto'))
  const totalND   = sum(byType('nd'))
  const utilNeta  = utilBruta - totalGas - totalImp

  const Section = ({ label }: { label: string }) => (
    <tr><td colSpan={3} className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-2 border-b border-gray-100">{label}</td></tr>
  )
  const SubRow = ({ acc }: { acc: Account }) => (
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-2 text-xs font-mono text-gray-400 w-28">{acc.code}</td>
      <td className="px-2 py-2 text-xs text-gray-600">{acc.name}</td>
      <td className={`px-4 py-2 text-xs text-right font-medium ${get(acc.id) >= 0 ? 'text-teal' : 'text-red-700'}`}>{fmt(get(acc.id))}</td>
    </tr>
  )
  const TotalRow = ({ label, val, big }: { label: string; val: number; big?: boolean }) => (
    <tr className={big ? 'bg-navy' : 'border-t border-gray-200'}>
      <td colSpan={2} className={`px-4 py-2 font-semibold ${big ? 'text-white text-sm' : 'text-gray-700 text-xs'}`}>{label}</td>
      <td className={`px-4 py-2 text-right font-semibold ${big ? 'text-white text-base' : val >= 0 ? 'text-teal text-xs' : 'text-red-700 text-xs'}`}>{fmt(val)}</td>
    </tr>
  )

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="bg-white border-b border-gray-100 px-6 py-3 flex items-center gap-3">
          <h1 className="text-base font-medium">Estado de resultados</h1>
          <span className="text-xs text-gray-400">Legacy Luxury Limo Corp · Enero 2026</span>
          <div className="ml-auto flex gap-2">
            <button onClick={() => exportPnL(entries, accounts, 'Enero 2026')} className="btn-danger text-xs">
              <FileText size={13} /> PDF profesional
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading
            ? <div className="flex items-center justify-center h-40 text-gray-400 text-sm">Cargando...</div>
            : (
              <div className="max-w-2xl">
                {/* Summary cards */}
                <div className="grid grid-cols-3 gap-3 mb-6">
                  <div className="card p-4 border-t-2 border-teal-mid">
                    <div className="text-xs text-gray-400 mb-1">Total ingresos</div>
                    <div className="text-xl font-medium text-teal">{fmt(totalIng)}</div>
                  </div>
                  <div className="card p-4 border-t-2 border-red-400">
                    <div className="text-xs text-gray-400 mb-1">Total egresos</div>
                    <div className="text-xl font-medium text-red-700">{fmt(totalCos + totalGas + totalImp)}</div>
                  </div>
                  <div className={`card p-4 border-t-2 ${utilNeta >= 0 ? 'border-teal' : 'border-red-600'}`}>
                    <div className="text-xs text-gray-400 mb-1">Utilidad neta</div>
                    <div className={`text-xl font-medium ${utilNeta >= 0 ? 'text-teal' : 'text-red-700'}`}>{fmt(utilNeta)}</div>
                    <div className="text-xs text-gray-400 mt-1">Margen: {pct(utilNeta, totalIng)}</div>
                  </div>
                </div>

                {/* PnL table */}
                <div className="card">
                  <table className="w-full border-collapse text-sm">
                    <thead><tr className="bg-navy">
                      <th className="text-left text-xs text-white/70 font-medium px-4 py-2 w-28">Código</th>
                      <th className="text-left text-xs text-white/70 font-medium px-2 py-2">Concepto</th>
                      <th className="text-right text-xs text-white/70 font-medium px-4 py-2">Importe</th>
                    </tr></thead>
                    <tbody>
                      <Section label="Ingresos" />
                      {byType('ingreso').map(a => <SubRow key={a.id} acc={a} />)}
                      <TotalRow label="Total ingresos" val={totalIng} />

                      <Section label="Costos directos" />
                      {byType('costo').map(a => <SubRow key={a.id} acc={a} />)}
                      <TotalRow label="Utilidad bruta" val={utilBruta} />

                      <Section label="Gastos operativos" />
                      {byType('gasto').map(a => <SubRow key={a.id} acc={a} />)}

                      {byType('impuesto').length > 0 && <>
                        <Section label="Impuestos" />
                        {byType('impuesto').map(a => <SubRow key={a.id} acc={a} />)}
                      </>}

                      {byType('nd').length > 0 && <>
                        <Section label="No deducibles (registro financiero)" />
                        {byType('nd').map(a => <SubRow key={a.id} acc={a} />)}
                        <tr><td colSpan={3} className="px-4 py-1 text-xs text-gray-400 italic border-b border-gray-100">Los gastos no deducibles se registran a nivel financiero pero no reducen la base imponible fiscal.</td></tr>
                      </>}

                      <TotalRow label="UTILIDAD NETA" val={utilNeta} big />
                    </tbody>
                  </table>
                </div>
              </div>
            )
          }
        </div>
      </main>
    </div>
  )
}
