'use client'
import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import Sidebar from '@/components/Sidebar'
import { supabase, Account } from '@/lib/supabase'

const COMPANY_ID = '00000000-0000-0000-0000-000000000001'
const TYPE_LABELS: Record<string, string> = {
  activo:'Activo', ingreso:'Ingreso', costo:'Costo directo',
  gasto:'Gasto operativo', impuesto:'Impuesto', nd:'No deducible'
}
const TYPE_COLORS: Record<string, string> = {
  activo:'bg-blue-50 text-blue-700', ingreso:'bg-green-50 text-green-700',
  costo:'bg-red-50 text-red-700', gasto:'bg-amber-50 text-amber-700',
  impuesto:'bg-purple-50 text-purple-700', nd:'bg-gray-100 text-gray-600'
}

export default function CoaPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading]   = useState(true)
  const [adding, setAdding]     = useState(false)
  const [form, setForm] = useState({ code:'', name:'', type:'ingreso', group_name:'Ingresos', keywords:'', deductible:true })

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data } = await supabase.from('accounts').select('*').eq('company_id', COMPANY_ID).order('code')
    setAccounts(data || [])
    setLoading(false)
  }

  async function addAccount() {
    if (!form.code || !form.name) return
    await supabase.from('accounts').insert({
      company_id: COMPANY_ID,
      code: form.code, name: form.name, type: form.type,
      group_name: form.group_name,
      keywords: form.keywords ? form.keywords.split(',').map(k => k.trim().toUpperCase()) : null,
      deductible: form.deductible
    })
    setForm({ code:'', name:'', type:'ingreso', group_name:'Ingresos', keywords:'', deductible:true })
    setAdding(false)
    loadData()
  }

  async function deleteAccount(id: string) {
    if (!confirm('¿Eliminar esta cuenta?')) return
    await supabase.from('accounts').delete().eq('id', id)
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
        <div className="bg-white border-b border-gray-100 px-6 py-3 flex items-center gap-3">
          <h1 className="text-base font-medium">Plan de cuentas</h1>
          <span className="text-xs text-gray-400">{accounts.length} cuentas</span>
          <button onClick={() => setAdding(!adding)} className="btn-primary text-xs ml-auto">
            <Plus size={13} /> Nueva cuenta
          </button>
        </div>

        {adding && (
          <div className="bg-teal-light border-b border-teal/20 px-6 py-4">
            <div className="grid grid-cols-6 gap-3 max-w-4xl">
              <div><label className="form-label">Código</label><input className="form-input" placeholder="6.1.01.07" value={form.code} onChange={e => setForm({...form, code:e.target.value})} /></div>
              <div className="col-span-2"><label className="form-label">Nombre</label><input className="form-input" placeholder="Nombre de la cuenta" value={form.name} onChange={e => setForm({...form, name:e.target.value})} /></div>
              <div><label className="form-label">Tipo</label>
                <select className="form-select" value={form.type} onChange={e => setForm({...form, type:e.target.value})}>
                  {Object.entries(TYPE_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div><label className="form-label">Palabras clave (auto)</label><input className="form-input" placeholder="NETFLIX, APPLE" value={form.keywords} onChange={e => setForm({...form, keywords:e.target.value})} /></div>
              <div className="flex items-end gap-2">
                <button onClick={addAccount} className="btn-primary text-xs flex-1">Crear</button>
                <button onClick={() => setAdding(false)} className="btn-secondary text-xs">✕</button>
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {loading
            ? <div className="flex items-center justify-center h-40 text-gray-400 text-sm">Cargando...</div>
            : Object.entries(grouped).map(([group, accs]) => (
              <div key={group}>
                <div className="px-5 py-2 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wider">{group}</div>
                {accs.map(a => (
                  <div key={a.id} className="flex items-center gap-3 px-5 py-3 border-b border-gray-100 hover:bg-gray-50 group">
                    <span className="text-xs font-mono text-gray-400 w-24 flex-shrink-0">{a.code}</span>
                    <span className="text-sm text-gray-700 flex-1">{a.name}</span>
                    {a.keywords?.length ? <span className="text-xs text-gray-400 hidden group-hover:block">{a.keywords.join(', ')}</span> : null}
                    <span className={`badge text-xs ${TYPE_COLORS[a.type]}`}>{TYPE_LABELS[a.type]}</span>
                    {!a.deductible && <span className="badge bg-red-50 text-red-600 text-xs">No deducible</span>}
                    <button onClick={() => deleteAccount(a.id)} className="text-gray-200 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            ))
          }
        </div>
      </main>
    </div>
  )
}
