'use client'
import { useEffect, useState } from 'react'
import Sidebar from '@/components/Sidebar'
import { supabase, Account, JournalEntry } from '@/lib/supabase'

const COMPANY_ID = '00000000-0000-0000-0000-000000000001'
const fmt = (n: number) => '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2 })
const TYPE_BORDER: Record<string, string> = {
  activo:'border-t-2 border-blue-400', ingreso:'border-t-2 border-teal-mid',
  costo:'border-t-2 border-red-400', gasto:'border-t-2 border-amber-400',
  impuesto:'border-t-2 border-purple-400', nd:'border-t-2 border-gray-300'
}

export default function MayorPage() {
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

  const saldos: Record<string, { debe: number; haber: number }> = {}
  accounts.forEach(a => saldos[a.id] = { debe: 0, haber: 0 })
  entries.forEach(e => e.lines?.forEach(l => {
    if (saldos[l.account_id]) {
      saldos[l.account_id].debe  += l.debit
      saldos[l.account_id].haber += l.credit
    }
  }))

  const getSaldo = (acc: Account) => {
    const s = saldos[acc.id]
    if (!s) return 0
    return acc.type === 'ingreso' ? s.haber - s.debe : s.debe - s.haber
  }

  const active = accounts.filter(a => saldos[a.id]?.debe > 0 || saldos[a.id]?.haber > 0)

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="bg-white border-b border-gray-100 px-6 py-3 flex items-center">
          <h1 className="text-base font-medium">Libro mayor</h1>
          <span className="text-xs text-gray-400 ml-2">{active.length} cuentas con movimiento</span>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {loading
            ? <div className="flex items-center justify-center h-40 text-gray-400 text-sm">Cargando...</div>
            : active.length === 0
              ? <div className="flex items-center justify-center h-40 text-gray-400 text-sm">Sin asientos registrados aún.</div>
              : (
                <div className="grid grid-cols-2 gap-4">
                  {active.map(acc => {
                    const s = saldos[acc.id]
                    const saldo = getSaldo(acc)
                    return (
                      <div key={acc.id} className={`card ${TYPE_BORDER[acc.type] || ''}`}>
                        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                          <div>
                            <div className="text-sm font-medium text-gray-700">{acc.name}</div>
                            <div className="text-xs font-mono text-gray-400 mt-0.5">{acc.code}</div>
                          </div>
                          <div className={`text-lg font-medium ${saldo >= 0 ? 'text-teal' : 'text-red-700'}`}>{fmt(saldo)}</div>
                        </div>
                        <div className="grid grid-cols-3 text-xs">
                          <div className="px-4 py-3 border-r border-gray-100">
                            <div className="text-gray-400 mb-1">Debe</div>
                            <div className="font-medium text-gray-700">{fmt(s?.debe || 0)}</div>
                          </div>
                          <div className="px-4 py-3 border-r border-gray-100">
                            <div className="text-gray-400 mb-1">Haber</div>
                            <div className="font-medium text-gray-700">{fmt(s?.haber || 0)}</div>
                          </div>
                          <div className="px-4 py-3">
                            <div className="text-gray-400 mb-1">Saldo</div>
                            <div className={`font-medium ${saldo >= 0 ? 'text-teal' : 'text-red-700'}`}>{fmt(Math.abs(saldo))}</div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
          }
        </div>
      </main>
    </div>
  )
}
