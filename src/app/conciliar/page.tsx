'use client'
import { useEffect, useState } from 'react'
import { Sparkles, Check, FileText, ChevronDown, Eye, AlertTriangle } from 'lucide-react'
import Sidebar from '@/components/Sidebar'
import { supabase, Transaction, Account, Statement } from '@/lib/supabase'
import { exportPendingReport } from '@/lib/exports'
import clsx from 'clsx'

const COMPANY_ID = '00000000-0000-0000-0000-000000000001'
const BANK_ACCT_CODE = '1.1.01.01'
const fmt = (n: number) => '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function ConciliarPage() {
  const [txs, setTxs]             = useState<Transaction[]>([])
  const [accounts, setAccounts]   = useState<Account[]>([])
  const [bankAcc, setBankAcc]     = useState<Account | null>(null)
  const [statements, setStmts]    = useState<Statement[]>([])
  const [selStmt, setSelStmt]     = useState<string>('all')
  const [filter, setFilter]       = useState<'all'|'auto'|'pending'|'nd'|'confirmed'>('all')
  const [preview, setPreview]     = useState<Transaction | null>(null)
  const [saving, setSaving]       = useState<string | null>(null)
  const [loading, setLoading]     = useState(true)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const [{ data: txData }, { data: accData }, { data: stmtData }] = await Promise.all([
      supabase.from('transactions').select('*, account:accounts(*)').eq('company_id', COMPANY_ID).order('date'),
      supabase.from('accounts').select('*').eq('company_id', COMPANY_ID).order('code'),
      supabase.from('statements').select('*').eq('company_id', COMPANY_ID).order('period_start', { ascending: false }),
    ])
    setTxs(txData || [])
    setAccounts(accData || [])
    setBankAcc((accData || []).find(a => a.code === BANK_ACCT_CODE) || null)
    setStmts(stmtData || [])
    setLoading(false)
  }

  async function confirm(tx: Transaction, accountId: string) {
    if (!accountId || !bankAcc) return
    setSaving(tx.id)

    const acc = accounts.find(a => a.id === accountId)!
    const monto = tx.debit > 0 ? tx.debit : tx.credit
    const isCredit = tx.credit > 0

    // Create journal entry
    const { data: entry } = await supabase.from('journal_entries').insert({
      company_id: COMPANY_ID,
      transaction_id: tx.id,
      date: tx.date,
      description: tx.description,
      reference: `EXT-${tx.date}`,
    }).select().single()

    if (entry) {
      const lines = isCredit
        ? [{ entry_id: entry.id, account_id: bankAcc.id, debit: monto, credit: 0 },
           { entry_id: entry.id, account_id: accountId,  debit: 0,     credit: monto }]
        : [{ entry_id: entry.id, account_id: accountId,  debit: monto, credit: 0 },
           { entry_id: entry.id, account_id: bankAcc.id, debit: 0,     credit: monto }]

      await supabase.from('journal_lines').insert(lines)
    }

    // Update transaction
    await supabase.from('transactions').update({
      account_id: accountId,
      status: 'confirmed',
      is_non_deductible: acc.type === 'nd'
    }).eq('id', tx.id)

    await loadData()
    setSaving(null)
    setPreview(null)
  }

  async function updateAccount(txId: string, accountId: string) {
    setTxs(prev => prev.map(t => t.id === txId ? { ...t, account_id: accountId } : t))
  }

  async function confirmAll() {
    const autoTxs = txs.filter(t => t.auto_classified && t.status === 'pending' && t.account_id)
    for (const tx of autoTxs) await confirm(tx, tx.account_id!)
  }

  const filtered = txs.filter(t => {
    if (selStmt !== 'all' && t.statement_id !== selStmt) return false
    if (filter === 'auto')      return t.auto_classified && t.status === 'pending'
    if (filter === 'pending')   return !t.auto_classified && t.status === 'pending'
    if (filter === 'nd')        return t.is_non_deductible
    if (filter === 'confirmed') return t.status === 'confirmed'
    return true
  })

  const pending    = txs.filter(t => t.status === 'pending' && !t.auto_classified)
  const autoCount  = txs.filter(t => t.auto_classified && t.status === 'pending')
  const doneCount  = txs.filter(t => t.status === 'confirmed')
  const totalCred  = txs.reduce((s,t) => s+t.credit, 0)
  const totalDeb   = txs.reduce((s,t) => s+t.debit, 0)

  const byGroup = (label: string) => (a: Account) => a.group_name === label

  const groupedAccounts: Record<string, Account[]> = {}
  accounts.filter(a => a.type !== 'activo').forEach(a => {
    const g = a.group_name || 'Otros'
    if (!groupedAccounts[g]) groupedAccounts[g] = []
    groupedAccounts[g].push(a)
  })

  if (loading) return <div className="flex h-screen"><Sidebar /><main className="flex-1 flex items-center justify-center"><div className="text-gray-400 text-sm">Cargando...</div></main></div>

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar pendingCount={pending.length} />
      <main className="flex-1 flex flex-col overflow-hidden">

        <div className="bg-white border-b border-gray-100 px-6 py-3 flex items-center gap-3">
          <h1 className="text-base font-medium">Conciliar extracto</h1>
          <div className="ml-auto flex gap-2">
            <select className="form-select w-auto text-xs" value={selStmt} onChange={e => setSelStmt(e.target.value)}>
              <option value="all">Todos los extractos</option>
              {statements.map(s => <option key={s.id} value={s.id}>{s.bank} · {s.period_start} → {s.period_end}</option>)}
            </select>
            {pending.length > 0 && (
              <button onClick={() => exportPendingReport(pending, accounts)} className="btn-danger text-xs">
                <FileText size={13} /> Reporte pendientes PDF
              </button>
            )}
            <button onClick={confirmAll} className="btn-primary text-xs">
              <Check size={13} /> Confirmar automáticos
            </button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-5 border-b border-gray-100 bg-white">
          {[
            { label: 'Total créditos',    val: fmt(totalCred),        cls: 'text-teal' },
            { label: 'Total débitos',     val: fmt(totalDeb),         cls: 'text-red-700' },
            { label: 'Auto-clasificadas', val: String(autoCount.length), cls: 'text-blue-700' },
            { label: 'Sin clasificar',    val: String(pending.length),   cls: 'text-amber-700' },
            { label: 'Confirmadas',       val: String(doneCount.length), cls: 'text-teal' },
          ].map((k, i) => (
            <div key={i} className="px-5 py-3 border-r border-gray-100 last:border-r-0">
              <div className="text-xs text-gray-400 mb-1">{k.label}</div>
              <div className={`text-lg font-medium ${k.cls}`}>{k.val}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="bg-gray-50 border-b border-gray-100 px-5 py-2 flex gap-2 items-center">
          {(['all','auto','pending','nd','confirmed'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={clsx('text-xs px-3 py-1.5 rounded-lg border transition-colors', filter === f ? 'bg-navy text-white border-navy' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300')}>
              {{ all:'Todas', auto:'Automáticas', pending:'Sin clasificar', nd:'No deducibles', confirmed:'Confirmadas' }[f]}
            </button>
          ))}
          <span className="text-xs text-gray-400 ml-auto">{filtered.length} transacciones</span>
        </div>

        {/* Asiento preview */}
        {preview && (
          <div className="mx-5 mt-3 bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-2 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
              <span className="text-xs font-medium text-gray-600">Propuesta de asiento · {preview.date} · {preview.description}</span>
              <button onClick={() => setPreview(null)} className="ml-auto text-gray-400 hover:text-gray-600 text-xs">✕</button>
            </div>
            <div className="px-4 py-3">
              <div className="grid grid-cols-3 text-xs text-gray-400 pb-2 border-b border-gray-100 mb-2">
                <span>Cuenta</span><span className="text-right">Debe</span><span className="text-right">Haber</span>
              </div>
              {(() => {
                const acc = accounts.find(a => a.id === preview.account_id)
                const monto = preview.debit > 0 ? preview.debit : preview.credit
                const isIng = preview.credit > 0
                const rows = isIng
                  ? [{ cod:'1.1.01.01', nom:'Citibank N.A.', debe:fmt(monto), haber:'—', ind:false },
                     { cod: acc?.code||'', nom:acc?.name||'', debe:'—', haber:fmt(monto), ind:true }]
                  : [{ cod: acc?.code||'', nom:acc?.name||'', debe:fmt(monto), haber:'—', ind:false },
                     { cod:'1.1.01.01', nom:'Citibank N.A.', debe:'—', haber:fmt(monto), ind:true }]
                return rows.map((r, i) => (
                  <div key={i} className={clsx('grid grid-cols-3 text-xs py-1', r.ind && 'pl-4')}>
                    <span className="text-gray-600"><span className="font-mono text-gray-400">{r.cod}</span> {r.nom}</span>
                    <span className={clsx('text-right font-medium', r.debe!=='—'?'amount-in':'text-gray-300')}>{r.debe}</span>
                    <span className={clsx('text-right font-medium', r.haber!=='—'?'amount-out':'text-gray-300')}>{r.haber}</span>
                  </div>
                ))
              })()}
              {accounts.find(a => a.id === preview.account_id)?.type === 'nd' && (
                <div className="mt-2 text-xs text-red-600 flex items-center gap-1">
                  <AlertTriangle size={11} /> Registro financiero — no reduce base imponible fiscal
                </div>
              )}
            </div>
          </div>
        )}

        {/* Table */}
        <div className="flex-1 overflow-auto">
          <table className="table-base">
            <thead><tr>
              <th>Fecha</th><th>Descripción</th>
              <th className="text-right">Débito</th><th className="text-right">Crédito</th>
              <th>Cuenta contable</th><th>Tipo</th><th>Conf.</th><th></th>
            </tr></thead>
            <tbody>
              {filtered.map(tx => {
                const est = accounts.find(a => a.id === tx.account_id)
                const isDone = tx.status === 'confirmed'
                return (
                  <tr key={tx.id} className={isDone ? 'bg-green-50/40' : ''}>
                    <td className="text-xs text-gray-400 whitespace-nowrap">{tx.date}</td>
                    <td className="max-w-xs text-xs">{tx.description}</td>
                    <td className="text-right amount-out">{tx.debit > 0 ? fmt(tx.debit) : '—'}</td>
                    <td className="text-right amount-in">{tx.credit > 0 ? fmt(tx.credit) : '—'}</td>
                    <td style={{ minWidth: 200 }}>
                      {isDone
                        ? <span className="text-xs text-gray-500 font-mono">{est?.code} · {est?.name}</span>
                        : (
                          <select
                            className="form-select text-xs py-1"
                            value={tx.account_id || ''}
                            onChange={e => updateAccount(tx.id, e.target.value)}
                          >
                            <option value="">— Seleccionar —</option>
                            {Object.entries(groupedAccounts).map(([g, accs]) => (
                              <optgroup key={g} label={g}>
                                {accs.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                              </optgroup>
                            ))}
                          </select>
                        )
                      }
                    </td>
                    <td>
                      {isDone
                        ? <span className="badge badge-done"><Check size={9} /> Confirmado</span>
                        : tx.auto_classified
                          ? est?.type === 'nd'
                            ? <span className="badge badge-nd">No deducible</span>
                            : <span className="badge badge-auto"><Sparkles size={9} /> Auto</span>
                          : <span className="badge badge-pending">Sin clasificar</span>
                      }
                    </td>
                    <td className={clsx('text-xs font-medium', tx.confidence >= 95 ? 'text-teal' : tx.confidence >= 80 ? 'text-amber-600' : 'text-red-500')}>
                      {tx.confidence > 0 ? `${tx.confidence}%` : '—'}
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        {!isDone && (
                          <button
                            disabled={!tx.account_id || saving === tx.id}
                            onClick={() => confirm(tx, tx.account_id!)}
                            className="text-xs bg-teal text-white px-2 py-1 rounded disabled:opacity-40 hover:bg-teal-mid transition-colors"
                          >
                            {saving === tx.id ? '...' : 'Confirmar'}
                          </button>
                        )}
                        {tx.account_id && (
                          <button onClick={() => setPreview(preview?.id === tx.id ? null : tx)} className="text-gray-300 hover:text-gray-500">
                            <Eye size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="text-center py-10 text-gray-400 text-sm">No hay transacciones en esta vista</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  )
}
