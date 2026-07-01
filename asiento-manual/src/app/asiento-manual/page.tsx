'use client'
import { useEffect, useState } from 'react'
import { Plus, Trash2, Check, RotateCcw } from 'lucide-react'
import Sidebar from '@/components/Sidebar'
import { supabase, Account, JournalEntry } from '@/lib/supabase'

const COMPANY_ID = '00000000-0000-0000-0000-000000000001'
const fmt = (n: number) => n > 0 ? '$' + n.toLocaleString('en-US',{minimumFractionDigits:2}) : ''

type Line = { account_id: string; debit: number; credit: number }

export default function AsientoManualPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [entries, setEntries]   = useState<JournalEntry[]>([])
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [reversing, setReversing] = useState<string|null>(null)
  const [success, setSuccess]   = useState('')

  const [date, setDate]     = useState(new Date().toISOString().split('T')[0])
  const [desc, setDesc]     = useState('')
  const [notes, setNotes]   = useState('')
  const [lines, setLines]   = useState<Line[]>([
    { account_id:'', debit:0, credit:0 },
    { account_id:'', debit:0, credit:0 },
  ])

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const [{ data: a }, { data: e }] = await Promise.all([
      supabase.from('accounts').select('*').eq('company_id', COMPANY_ID).order('code'),
      supabase.from('journal_entries')
        .select('*, lines:journal_lines(*, account:accounts(*))')
        .eq('company_id', COMPANY_ID)
        .eq('is_manual', true)
        .order('date', { ascending: false })
        .limit(20),
    ])
    setAccounts(a || [])
    setEntries(e || [])
    setLoading(false)
  }

  const totalDebe  = lines.reduce((s,l) => s + (l.debit||0), 0)
  const totalHaber = lines.reduce((s,l) => s + (l.credit||0), 0)
  const balanced   = Math.abs(totalDebe - totalHaber) < 0.01 && totalDebe > 0

  function updateLine(i: number, field: keyof Line, val: string|number) {
    setLines(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: val } : l))
  }

  function addLine() { setLines(prev => [...prev, { account_id:'', debit:0, credit:0 }]) }
  function removeLine(i: number) { if (lines.length > 2) setLines(prev => prev.filter((_,idx) => idx !== i)) }

  async function save() {
    if (!balanced || !desc) return
    setSaving(true)
    const { data: entry } = await supabase.from('journal_entries').insert({
      company_id: COMPANY_ID, date, description: desc, notes,
      reference: `MAN-${Date.now()}`, is_manual: true, reversed: false,
    }).select().single()

    if (entry) {
      await supabase.from('journal_lines').insert(
        lines.filter(l => l.account_id && (l.debit > 0 || l.credit > 0))
          .map(l => ({ entry_id: entry.id, account_id: l.account_id, debit: l.debit||0, credit: l.credit||0 }))
      )
    }
    setDesc(''); setNotes('')
    setLines([{account_id:'',debit:0,credit:0},{account_id:'',debit:0,credit:0}])
    setSuccess('Asiento registrado exitosamente')
    setTimeout(() => setSuccess(''), 3000)
    setSaving(false)
    loadData()
  }

  async function reversar(entry: JournalEntry) {
    if (!confirm(`¿Revertir el asiento "${entry.description}"? Se generará un asiento espejo con signo contrario.`)) return
    setReversing(entry.id)

    const { data: reversal } = await supabase.from('journal_entries').insert({
      company_id: COMPANY_ID,
      date: new Date().toISOString().split('T')[0],
      description: `REVERSIÓN: ${entry.description}`,
      reference: `REV-${entry.id.slice(0,8)}`,
      is_manual: true,
      reversed: false,
      reversal_of: entry.id,
      notes: `Reversión del asiento del ${entry.date}`,
    }).select().single()

    if (reversal && entry.lines) {
      await supabase.from('journal_lines').insert(
        entry.lines.map((l: any) => ({
          entry_id: reversal.id,
          account_id: l.account_id,
          debit: l.credit,   // invertir
          credit: l.debit,   // invertir
        }))
      )
      // Marcar original como revertido
      await supabase.from('journal_entries').update({ reversed: true }).eq('id', entry.id)
    }
    setReversing(null)
    setSuccess('Asiento de reversión generado')
    setTimeout(() => setSuccess(''), 3000)
    loadData()
  }

  const grouped: Record<string, Account[]> = {}
  accounts.forEach(a => {
    const g = a.group_name || 'Otros'
    if (!grouped[g]) grouped[g] = []
    grouped[g].push(a)
  })

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="bg-white border-b border-gray-100 px-6 py-3">
          <h1 className="text-base font-medium">Asiento manual</h1>
          <p className="text-xs text-gray-400 mt-0.5">Para operaciones que no vienen del extracto bancario: pasivos, crédito, ajustes</p>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <div className="grid grid-cols-2 gap-5 max-w-6xl">

            {/* FORMULARIO */}
            <div className="card">
              <div className="card-header"><span className="card-title">Nuevo asiento</span></div>
              <div className="p-4">
                {success && <div className="mb-3 text-xs text-teal bg-teal-light border border-teal/20 rounded-lg px-3 py-2 flex items-center gap-2"><Check size={13}/>{success}</div>}

                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div><label className="form-label">Fecha</label><input type="date" className="form-input" value={date} onChange={e => setDate(e.target.value)}/></div>
                  <div><label className="form-label">Descripción</label><input className="form-input" placeholder="Ej: Pago cuota préstamo Acima" value={desc} onChange={e => setDesc(e.target.value)}/></div>
                </div>
                <div className="mb-3"><label className="form-label">Notas internas (opcional)</label><input className="form-input" placeholder="Referencia, número de factura, etc." value={notes} onChange={e => setNotes(e.target.value)}/></div>

                {/* Líneas del asiento */}
                <div className="border border-gray-200 rounded-lg overflow-hidden mb-3">
                  <div className="grid grid-cols-12 gap-1 bg-gray-50 px-3 py-1.5 text-xs text-gray-400 font-medium">
                    <span className="col-span-5">Cuenta</span>
                    <span className="col-span-3 text-right">Debe</span>
                    <span className="col-span-3 text-right">Haber</span>
                    <span className="col-span-1"></span>
                  </div>
                  {lines.map((l, i) => (
                    <div key={i} className="grid grid-cols-12 gap-1 px-3 py-1.5 border-t border-gray-100 items-center">
                      <div className="col-span-5">
                        <select className="form-select text-xs py-1" value={l.account_id} onChange={e => updateLine(i,'account_id',e.target.value)}>
                          <option value="">— Cuenta —</option>
                          {Object.entries(grouped).map(([g, accs]) => (
                            <optgroup key={g} label={g}>
                              {accs.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                            </optgroup>
                          ))}
                        </select>
                      </div>
                      <div className="col-span-3">
                        <input type="number" min="0" step="0.01" className="form-input text-xs py-1 text-right" placeholder="0.00"
                          value={l.debit||''} onChange={e => updateLine(i,'debit',parseFloat(e.target.value)||0)}/>
                      </div>
                      <div className="col-span-3">
                        <input type="number" min="0" step="0.01" className="form-input text-xs py-1 text-right" placeholder="0.00"
                          value={l.credit||''} onChange={e => updateLine(i,'credit',parseFloat(e.target.value)||0)}/>
                      </div>
                      <div className="col-span-1 flex justify-center">
                        <button onClick={() => removeLine(i)} className="text-gray-300 hover:text-red-400"><Trash2 size={12}/></button>
                      </div>
                    </div>
                  ))}
                  {/* Totales */}
                  <div className="grid grid-cols-12 gap-1 px-3 py-2 bg-gray-50 border-t border-gray-200">
                    <span className="col-span-5 text-xs font-medium text-gray-500">Totales</span>
                    <span className={`col-span-3 text-right text-xs font-semibold ${balanced ? 'text-teal' : 'text-red-600'}`}>{fmt(totalDebe)}</span>
                    <span className={`col-span-3 text-right text-xs font-semibold ${balanced ? 'text-teal' : 'text-red-600'}`}>{fmt(totalHaber)}</span>
                    <span className="col-span-1"></span>
                  </div>
                </div>

                {!balanced && totalDebe > 0 && (
                  <div className="text-xs text-red-600 bg-red-50 rounded px-3 py-2 mb-3">
                    El asiento no está cuadrado · Diferencia: ${Math.abs(totalDebe - totalHaber).toFixed(2)}
                  </div>
                )}

                <div className="flex gap-2">
                  <button onClick={addLine} className="btn-secondary text-xs"><Plus size={12}/> Añadir línea</button>
                  <button onClick={save} disabled={!balanced||!desc||saving} className="btn-primary text-xs ml-auto">
                    {saving ? 'Guardando...' : <><Check size={12}/> Registrar asiento</>}
                  </button>
                </div>
              </div>
            </div>

            {/* ASIENTOS MANUALES REGISTRADOS */}
            <div className="card">
              <div className="card-header"><span className="card-title">Asientos manuales registrados</span></div>
              <div className="overflow-y-auto" style={{maxHeight:520}}>
                {loading
                  ? <div className="p-6 text-center text-gray-400 text-sm">Cargando...</div>
                  : entries.length === 0
                    ? <div className="p-6 text-center text-gray-400 text-sm">No hay asientos manuales aún</div>
                    : entries.map(e => (
                      <div key={e.id} className={`border-b border-gray-100 px-4 py-3 ${(e as any).reversed ? 'opacity-50 bg-gray-50' : ''}`}>
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <div className="text-xs font-medium text-gray-700">{e.description}</div>
                            <div className="text-xs text-gray-400 mt-0.5">{e.date} {(e as any).reversal_of && <span className="ml-1 text-purple-500">· Reversión</span>}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            {(e as any).reversed
                              ? <span className="badge badge-pending text-xs">Revertido</span>
                              : (
                                <button onClick={() => reversar(e)} disabled={reversing === e.id}
                                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-colors border border-gray-200 rounded px-2 py-1">
                                  <RotateCcw size={11}/> {reversing === e.id ? '...' : 'Revertir'}
                                </button>
                              )
                            }
                          </div>
                        </div>
                        {e.lines?.map((l: any, i: number) => (
                          <div key={i} className={`grid grid-cols-3 text-xs py-0.5 ${i === 0 ? '' : 'pl-4'}`}>
                            <span className="text-gray-500 col-span-1">{(l.account as any)?.name || '—'}</span>
                            <span className="text-right amount-in">{l.debit > 0 ? fmt(l.debit) : ''}</span>
                            <span className="text-right amount-out">{l.credit > 0 ? fmt(l.credit) : ''}</span>
                          </div>
                        ))}
                      </div>
                    ))
                }
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
