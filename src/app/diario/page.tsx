'use client'
import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import Sidebar from '@/components/Sidebar'
import { supabase, JournalEntry, Account } from '@/lib/supabase'
import { exportJournalExcel } from '@/lib/exports'

const COMPANY_ID = '00000000-0000-0000-0000-000000000001'
const fmt = (n: number) => n > 0 ? '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2 }) : ''

export default function DiarioPage() {
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const [{ data: e }, { data: a }] = await Promise.all([
      supabase.from('journal_entries').select('*, lines:journal_lines(*, account:accounts(*))').eq('company_id', COMPANY_ID).order('date'),
      supabase.from('accounts').select('*').eq('company_id', COMPANY_ID),
    ])
    setEntries(e || [])
    setAccounts(a || [])
    setLoading(false)
  }

  const totalDebe  = entries.reduce((s, e) => s + (e.lines?.reduce((ss, l) => ss + l.debit, 0) || 0), 0)
  const totalHaber = entries.reduce((s, e) => s + (e.lines?.reduce((ss, l) => ss + l.credit, 0) || 0), 0)

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="bg-white border-b border-gray-100 px-6 py-3 flex items-center gap-3">
          <h1 className="text-base font-medium">Libro diario</h1>
          <span className="text-xs text-gray-400">{entries.length} asientos</span>
          <div className="ml-auto">
            <button onClick={() => exportJournalExcel(entries, accounts, '2026-01')} className="btn-secondary text-xs">
              <Download size={13} /> Exportar Excel
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          {loading
            ? <div className="flex items-center justify-center h-40 text-gray-400 text-sm">Cargando...</div>
            : entries.length === 0
              ? <div className="flex items-center justify-center h-40 text-gray-400 text-sm">No hay asientos. Concilia el extracto primero.</div>
              : (
                <table className="table-base">
                  <thead><tr>
                    <th>Fecha</th><th>#</th><th>Descripción</th>
                    <th>Cód.</th><th>Cuenta</th>
                    <th className="text-right">Debe</th><th className="text-right">Haber</th>
                  </tr></thead>
                  <tbody>
                    {entries.map((e, ei) => (
                      e.lines?.map((l, li) => (
                        <tr key={`${e.id}-${li}`} className={li === 0 ? 'bg-gray-50/50' : ''}>
                          <td className="text-xs text-gray-400 whitespace-nowrap">{li === 0 ? e.date : ''}</td>
                          <td className="text-xs text-gray-400 font-mono">{li === 0 ? String(ei+1).padStart(3,'0') : ''}</td>
                          <td className={`text-xs max-w-xs truncate ${li === 0 ? 'font-medium text-gray-700' : 'pl-4 text-gray-400'}`}>
                            {li === 0 ? e.description : ''}
                          </td>
                          <td className="text-xs font-mono text-gray-400">{(l.account as any)?.code}</td>
                          <td className="text-xs text-gray-600">{(l.account as any)?.name}</td>
                          <td className="text-right text-xs amount-in">{fmt(l.debit)}</td>
                          <td className="text-right text-xs amount-out">{fmt(l.credit)}</td>
                        </tr>
                      ))
                    ))}
                    <tr className="bg-gray-800">
                      <td colSpan={5} className="text-white font-medium text-xs px-3 py-2">Totales</td>
                      <td className="text-right text-white font-medium text-xs px-3 py-2">${totalDebe.toFixed(2)}</td>
                      <td className="text-right text-white font-medium text-xs px-3 py-2">${totalHaber.toFixed(2)}</td>
                    </tr>
                  </tbody>
                </table>
              )
          }
        </div>
      </main>
    </div>
  )
}
