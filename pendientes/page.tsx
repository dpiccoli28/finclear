'use client'
import { useEffect, useState } from 'react'
import { FileText, Sparkles, Clock, AlertTriangle } from 'lucide-react'
import Sidebar from '@/components/Sidebar'
import { supabase, Transaction, Account } from '@/lib/supabase'
import { exportPendingReport } from '@/lib/exports'

const COMPANY_ID = '00000000-0000-0000-0000-000000000001'
const fmt = (n: number) => '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2 })

export default function PendientesPage() {
  const [txs, setTxs]           = useState<Transaction[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading]   = useState(true)
  const [tab, setTab]           = useState<'sinclasificar'|'sinfirmar'>('sinclasificar')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const [{ data: t }, { data: a }] = await Promise.all([
      supabase.from('transactions').select('*, account:accounts(*)').eq('company_id', COMPANY_ID).order('date'),
      supabase.from('accounts').select('*').eq('company_id', COMPANY_ID),
    ])
    setTxs(t || [])
    setAccounts(a || [])
    setLoading(false)
  }

  const sinClasificar = txs.filter(t => t.status === 'pending' && !t.auto_classified && !t.account_id)
  const sinConfirmar  = txs.filter(t => t.status === 'pending' && t.auto_classified && t.account_id)
  const current       = tab === 'sinclasificar' ? sinClasificar : sinConfirmar

  const totalSinClas  = sinClasificar.reduce((s,t) => s+(t.debit||t.credit), 0)
  const totalSinConf  = sinConfirmar.reduce((s,t) => s+(t.debit||t.credit), 0)

  const accMap: Record<string, Account> = {}
  accounts.forEach(a => accMap[a.id] = a)

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar pendingCount={sinClasificar.length} />
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="bg-white border-b border-gray-100 px-6 py-3 flex items-center gap-3">
          <h1 className="text-base font-medium">Reporte de pendientes</h1>
          <div className="ml-auto flex gap-2">
            {tab === 'sinclasificar' && sinClasificar.length > 0 && (
              <button onClick={() => exportPendingReport(sinClasificar, accounts)} className="btn-danger text-xs">
                <FileText size={13}/> Exportar PDF para empresa
              </button>
            )}
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 border-b border-gray-100 bg-white">
          <div className="px-6 py-4 border-r border-gray-100 flex items-center gap-4 cursor-pointer hover:bg-gray-50" onClick={() => setTab('sinclasificar')}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${tab==='sinclasificar'?'bg-red-100':'bg-gray-100'}`}>
              <AlertTriangle size={18} className={tab==='sinclasificar'?'text-red-600':'text-gray-400'} />
            </div>
            <div>
              <div className="text-xs text-gray-400 mb-0.5">Sin clasificar</div>
              <div className={`text-2xl font-medium ${tab==='sinclasificar'?'text-red-600':'text-gray-700'}`}>{sinClasificar.length}</div>
              <div className="text-xs text-gray-400">{fmt(totalSinClas)} sin contabilizar</div>
            </div>
            {tab==='sinclasificar' && <div className="ml-auto w-1 h-10 bg-red-500 rounded-full"/>}
          </div>
          <div className="px-6 py-4 flex items-center gap-4 cursor-pointer hover:bg-gray-50" onClick={() => setTab('sinfirmar')}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${tab==='sinfirmar'?'bg-amber-100':'bg-gray-100'}`}>
              <Sparkles size={18} className={tab==='sinfirmar'?'text-amber-600':'text-gray-400'} />
            </div>
            <div>
              <div className="text-xs text-gray-400 mb-0.5">Auto-clasificadas sin confirmar</div>
              <div className={`text-2xl font-medium ${tab==='sinfirmar'?'text-amber-600':'text-gray-700'}`}>{sinConfirmar.length}</div>
              <div className="text-xs text-gray-400">{fmt(totalSinConf)} esperando confirmación</div>
            </div>
            {tab==='sinfirmar' && <div className="ml-auto w-1 h-10 bg-amber-500 rounded-full"/>}
          </div>
        </div>

        {/* Info banner */}
        {tab === 'sinclasificar' && sinClasificar.length > 0 && (
          <div className="mx-5 mt-4 flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
            <AlertTriangle size={15}/>
            <span>Estas <strong>{sinClasificar.length} transacciones</strong> no pudieron clasificarse automáticamente. Usa el botón PDF para generar las preguntas a la empresa.</span>
          </div>
        )}
        {tab === 'sinfirmar' && sinConfirmar.length > 0 && (
          <div className="mx-5 mt-4 flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700">
            <Sparkles size={15}/>
            <span>El sistema clasificó estas <strong>{sinConfirmar.length} transacciones</strong> automáticamente pero aún no has confirmado los asientos. Ve a <strong>Conciliar</strong> para confirmarlas.</span>
          </div>
        )}

        {/* Table */}
        <div className="flex-1 overflow-auto mt-4">
          {loading
            ? <div className="flex items-center justify-center h-40 text-gray-400 text-sm">Cargando...</div>
            : current.length === 0
              ? (
                <div className="flex flex-col items-center justify-center h-40 gap-2">
                  <div className="text-3xl">✓</div>
                  <div className="text-gray-500 font-medium text-sm">
                    {tab === 'sinclasificar' ? 'No hay transacciones sin clasificar' : 'No hay transacciones pendientes de confirmar'}
                  </div>
                </div>
              )
              : (
                <table className="table-base">
                  <thead><tr>
                    <th>Fecha</th>
                    <th>Descripción</th>
                    <th className="text-right">Débito</th>
                    <th className="text-right">Crédito</th>
                    {tab === 'sinfirmar' && <th>Cuenta sugerida</th>}
                    {tab === 'sinfirmar' && <th>Confianza</th>}
                    <th>Estado</th>
                  </tr></thead>
                  <tbody>
                    {current.map(tx => (
                      <tr key={tx.id}>
                        <td className="text-xs text-gray-400 whitespace-nowrap">{tx.date}</td>
                        <td className="text-xs max-w-xs">{tx.description}</td>
                        <td className="text-right amount-out text-xs">{tx.debit > 0 ? fmt(tx.debit) : '—'}</td>
                        <td className="text-right amount-in text-xs">{tx.credit > 0 ? fmt(tx.credit) : '—'}</td>
                        {tab === 'sinfirmar' && (
                          <td className="text-xs text-teal">{tx.account_id ? (accMap[tx.account_id]?.name || '—') : '—'}</td>
                        )}
                        {tab === 'sinfirmar' && (
                          <td className={`text-xs font-medium ${tx.confidence >= 90 ? 'text-teal' : tx.confidence >= 80 ? 'text-amber-600' : 'text-red-500'}`}>
                            {tx.confidence > 0 ? `${tx.confidence}%` : '—'}
                          </td>
                        )}
                        <td>
                          {tab === 'sinclasificar'
                            ? <span className="badge badge-pending"><AlertTriangle size={9}/> Sin clasificar</span>
                            : <span className="badge badge-auto"><Sparkles size={9}/> Auto · sin confirmar</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-800">
                      <td colSpan={tab === 'sinfirmar' ? 2 : 2} className="text-white font-medium text-xs px-3 py-2">Total</td>
                      <td className="text-right text-white font-medium text-xs px-3 py-2">{fmt(current.reduce((s,t)=>s+t.debit,0))}</td>
                      <td className="text-right text-white font-medium text-xs px-3 py-2">{fmt(current.reduce((s,t)=>s+t.credit,0))}</td>
                      {tab === 'sinfirmar' && <td colSpan={3}></td>}
                      {tab === 'sinclasificar' && <td></td>}
                    </tr>
                  </tfoot>
                </table>
              )
          }
        </div>
      </main>
    </div>
  )
}
