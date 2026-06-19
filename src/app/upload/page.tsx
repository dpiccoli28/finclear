'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, Sparkles, Check, AlertTriangle } from 'lucide-react'
import Sidebar from '@/components/Sidebar'
import { supabase, Account } from '@/lib/supabase'
import { classifyTransactions } from '@/lib/classifier'
import { parsePDFInBrowser } from '@/lib/parser-client'

const COMPANY_ID = '00000000-0000-0000-0000-000000000001'

export default function UploadPage() {
  const router    = useRouter()
  const fileRef   = useRef<HTMLInputElement>(null)
  const [file, setFile]       = useState<File | null>(null)
  const [bank, setBank]       = useState('Citibank')
  const [period, setPeriod]   = useState('2026-01')
  const [begBal, setBegBal]   = useState('1507.73')
  const [endBal, setEndBal]   = useState('1578.22')
  const [status, setStatus]   = useState<'idle'|'parsing'|'classified'|'saving'|'done'>('idle')
  const [preview, setPreview] = useState<any[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [error, setError]     = useState('')

  async function handleFile(f: File) {
    setFile(f); setError(''); setStatus('parsing')
    try {
      const { data: accData } = await supabase.from('accounts').select('*').eq('company_id', COMPANY_ID)
      const accs = accData || []
      setAccounts(accs)

      const raw = await parsePDFInBrowser(f)
      const classified = classifyTransactions(raw, accs)
      setPreview(classified.map((t: any) => ({
        ...t, suggested_account: accs.find((a: Account) => a.id === t.suggested_account_id)
      })))
      setStatus('classified')
    } catch (e: any) {
      setError('Error procesando el archivo: ' + e.message)
      setStatus('idle')
    }
  }

  async function saveAll() {
    setStatus('saving')
    const [y, m] = period.split('-')
    const daysInMonth = new Date(parseInt(y), parseInt(m), 0).getDate()

    const { data: stmt } = await supabase.from('statements').insert({
      company_id: COMPANY_ID, bank,
      account_number: '9349775037',
      period_start: `${period}-01`,
      period_end: `${period}-${daysInMonth}`,
      beginning_balance: parseFloat(begBal),
      ending_balance: parseFloat(endBal),
      filename: file?.name || ''
    }).select().single()

    if (!stmt) { setError('Error guardando el extracto'); setStatus('classified'); return }

    await supabase.from('transactions').insert(
      preview.map((t: any) => ({
        company_id: COMPANY_ID,
        statement_id: stmt.id,
        date: t.date,
        description: t.description,
        debit: t.debit,
        credit: t.credit,
        account_id: t.suggested_account_id || null,
        auto_classified: t.auto_classified,
        confidence: t.confidence,
        is_non_deductible: t.is_non_deductible,
        status: 'pending'
      }))
    )

    setStatus('done')
    setTimeout(() => router.push('/conciliar'), 1500)
  }

  const fmt = (n: number) => '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2 })
  const autoCount = preview.filter((t: any) => t.auto_classified).length

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="bg-white border-b border-gray-100 px-6 py-3">
          <h1 className="text-base font-medium">Subir extracto bancario</h1>
        </div>
        <div className="flex-1 overflow-y-auto p-6 max-w-3xl">

          <div className="card mb-5">
            <div className="card-header"><span className="card-title">Información del extracto</span></div>
            <div className="p-4 grid grid-cols-2 gap-4">
              <div>
                <label className="form-label">Banco</label>
                <select className="form-select" value={bank} onChange={e => setBank(e.target.value)}>
                  <option>Citibank</option><option>Chase Bank</option><option>Bank of America</option><option>Wells Fargo</option>
                </select>
              </div>
              <div>
                <label className="form-label">Período (YYYY-MM)</label>
                <input className="form-input" value={period} onChange={e => setPeriod(e.target.value)} placeholder="2026-01" />
              </div>
              <div>
                <label className="form-label">Saldo inicial</label>
                <input className="form-input" value={begBal} onChange={e => setBegBal(e.target.value)} />
              </div>
              <div>
                <label className="form-label">Saldo final</label>
                <input className="form-input" value={endBal} onChange={e => setEndBal(e.target.value)} />
              </div>
            </div>
          </div>

          {status === 'idle' && (
            <div
              className="border-2 border-dashed border-gray-200 rounded-xl p-10 text-center cursor-pointer hover:border-teal transition-colors"
              onClick={() => fileRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
            >
              <Upload size={32} className="mx-auto text-gray-300 mb-3" />
              <p className="text-sm font-medium text-gray-600">Arrastra el PDF del extracto aquí</p>
              <p className="text-xs text-gray-400 mt-1">PDF de Citibank · se procesa en el navegador, nada se envía a servidores externos</p>
              <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
            </div>
          )}

          {status === 'parsing' && (
            <div className="card p-8 text-center">
              <Sparkles size={28} className="mx-auto text-teal mb-3 animate-pulse" />
              <p className="text-sm font-medium text-gray-700">Leyendo PDF y clasificando transacciones...</p>
              <p className="text-xs text-gray-400 mt-1">Esto puede tomar unos segundos</p>
            </div>
          )}

          {error && (
            <div className="mt-3 flex items-center gap-2 text-red-600 text-sm bg-red-50 rounded-lg px-4 py-3 border border-red-200">
              <AlertTriangle size={14} />{error}
            </div>
          )}

          {(status === 'classified' || status === 'saving' || status === 'done') && (
            <>
              <div className="flex items-center gap-3 bg-teal-light border border-teal/20 rounded-xl px-4 py-3 mb-4 text-sm text-teal">
                <Sparkles size={15} />
                <span>
                  <strong>{preview.length} transacciones detectadas</strong> ·
                  <strong className="ml-1">{autoCount} clasificadas automáticamente</strong>
                  {preview.length - autoCount > 0 && ` · ${preview.length - autoCount} requieren revisión`}
                </span>
              </div>

              <div className="card mb-4">
                <div className="overflow-x-auto">
                  <table className="table-base">
                    <thead><tr>
                      <th>Fecha</th><th>Descripción</th>
                      <th className="text-right">Débito</th><th className="text-right">Crédito</th>
                      <th>Cuenta sugerida</th><th>Conf.</th>
                    </tr></thead>
                    <tbody>
                      {preview.slice(0, 25).map((t: any, i) => (
                        <tr key={i}>
                          <td className="text-xs text-gray-400 whitespace-nowrap">{t.date}</td>
                          <td className="text-xs max-w-xs truncate">{t.description}</td>
                          <td className="text-right amount-out text-xs">{t.debit > 0 ? fmt(t.debit) : '—'}</td>
                          <td className="text-right amount-in text-xs">{t.credit > 0 ? fmt(t.credit) : '—'}</td>
                          <td className="text-xs">
                            {t.suggested_account
                              ? <span className="text-teal">{t.suggested_account.name}</span>
                              : <span className="text-amber-500">Sin sugerencia — revisar</span>}
                          </td>
                          <td className={`text-xs font-medium ${t.confidence >= 90 ? 'text-teal' : t.confidence > 0 ? 'text-amber-600' : 'text-gray-300'}`}>
                            {t.confidence > 0 ? `${t.confidence}%` : '—'}
                          </td>
                        </tr>
                      ))}
                      {preview.length > 25 && (
                        <tr><td colSpan={6} className="text-center py-3 text-xs text-gray-400">... y {preview.length - 25} transacciones más</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {status === 'done'
                ? <div className="flex items-center gap-2 text-teal bg-teal-light rounded-xl px-4 py-3 text-sm font-medium"><Check size={16} /> Guardado exitosamente. Redirigiendo a conciliación...</div>
                : <button onClick={saveAll} disabled={status === 'saving'} className="btn-primary">
                    {status === 'saving'
                      ? 'Guardando en Supabase...'
                      : <><Check size={14} /> Guardar y pasar a conciliar ({preview.length} transacciones)</>}
                  </button>
              }
            </>
          )}
        </div>
      </main>
    </div>
  )
}
