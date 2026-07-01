'use client'
import { useEffect, useState } from 'react'
import { FileText } from 'lucide-react'
import Sidebar from '@/components/Sidebar'
import { supabase, Account, JournalEntry } from '@/lib/supabase'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const COMPANY_ID = '00000000-0000-0000-0000-000000000001'
const fmt = (n: number) => '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2 })

export default function BalancePage() {
  const [entries, setEntries]   = useState<JournalEntry[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const [{ data: e }, { data: a }] = await Promise.all([
      supabase.from('journal_entries').select('*, lines:journal_lines(*, account:accounts(*))').eq('company_id', COMPANY_ID).eq('reversed', false),
      supabase.from('accounts').select('*').eq('company_id', COMPANY_ID).order('code'),
    ])
    setEntries(e || [])
    setAccounts(a || [])
    setLoading(false)
  }

  // Calcular saldos desde asientos
  const saldos: Record<string, number> = {}
  accounts.forEach(a => saldos[a.id] = 0)
  entries.forEach(e => e.lines?.forEach((l: any) => {
    const acc = accounts.find(a => a.id === l.account_id)
    if (!acc) return
    if (['activo','gasto','costo'].includes(acc.type)) {
      saldos[l.account_id] = (saldos[l.account_id] || 0) + l.debit - l.credit
    } else {
      saldos[l.account_id] = (saldos[l.account_id] || 0) + l.credit - l.debit
    }
  }))

  // Calcular utilidad del período (ingresos - costos - gastos)
  const ingresos = accounts.filter(a => a.type === 'ingreso')
  const costos   = accounts.filter(a => a.type === 'costo')
  const gastos   = accounts.filter(a => a.type === 'gasto')
  const totalIng = ingresos.reduce((s, a) => s + (saldos[a.id] || 0), 0)
  const totalCos = costos.reduce((s, a) => s + (saldos[a.id] || 0), 0)
  const totalGas = gastos.reduce((s, a) => s + (saldos[a.id] || 0), 0)
  const utilidad = totalIng - totalCos - totalGas

  const byType  = (t: string) => accounts.filter(a => a.type === t && (saldos[a.id] || 0) !== 0)
  const sumType = (t: string) => byType(t).reduce((s, a) => s + (saldos[a.id] || 0), 0)

  const totalActivos   = sumType('activo')
  const totalPasivos   = sumType('pasivo')
  const totalPatrimonio = sumType('patrimonio') + utilidad
  const ecuacion = totalActivos === (totalPasivos + totalPatrimonio)

  // Agrupar activos por grupo
  const activosCorrientes = accounts.filter(a => a.type === 'activo' && a.group_name === 'Activos corrientes' && (saldos[a.id]||0) !== 0)
  const activosFijos      = accounts.filter(a => a.type === 'activo' && a.group_name === 'Activos fijos' && (saldos[a.id]||0) !== 0)
  const activosOtros      = accounts.filter(a => a.type === 'activo' && !['Activos corrientes','Activos fijos'].includes(a.group_name||'') && (saldos[a.id]||0) !== 0)
  const pasivosCorrientes = accounts.filter(a => a.type === 'pasivo' && a.group_name === 'Pasivos corrientes' && (saldos[a.id]||0) !== 0)
  const pasivosNoCorrientes = accounts.filter(a => a.type === 'pasivo' && a.group_name === 'Pasivos no corrientes' && (saldos[a.id]||0) !== 0)
  const patrimonio        = accounts.filter(a => a.type === 'patrimonio' && (saldos[a.id]||0) !== 0)

  function exportPDF() {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const NAVY: [number,number,number] = [4, 44, 83]

    doc.setFillColor(...NAVY); doc.rect(0,0,210,22,'F')
    doc.setTextColor(255,255,255); doc.setFontSize(14); doc.setFont('helvetica','bold')
    doc.text('FinClear', 14, 10)
    doc.setFontSize(9); doc.setFont('helvetica','normal')
    doc.text('Legacy Luxury Limo Corp', 14, 16)
    doc.setFontSize(12); doc.setFont('helvetica','bold')
    doc.text('Estado de Situación Financiera', 105, 10, { align:'center' })
    doc.setFontSize(8); doc.setFont('helvetica','normal')
    doc.text(new Date().toLocaleDateString('es-ES'), 105, 16, { align:'center' })
    doc.setTextColor(0,0,0)

    const rows: any[] = []
    const sec = (l: string) => rows.push([{ content: l, colSpan: 2, styles: { fillColor: [230,241,251], fontStyle:'bold', textColor: NAVY }}])
    const sub = (name: string, val: number) => rows.push([name, { content: fmt(val), styles: { halign:'right' }}])
    const tot = (name: string, val: number) => rows.push([{ content: name, styles:{fontStyle:'bold'}}, { content: fmt(val), styles:{halign:'right',fontStyle:'bold'}}])

    sec('ACTIVOS CORRIENTES')
    ;[...activosCorrientes, ...activosOtros].forEach(a => sub(a.name, saldos[a.id]||0))
    tot('Total activos corrientes', [...activosCorrientes,...activosOtros].reduce((s,a)=>s+(saldos[a.id]||0),0))
    if (activosFijos.length) { sec('ACTIVOS FIJOS'); activosFijos.forEach(a => sub(a.name, saldos[a.id]||0)) }
    tot('TOTAL ACTIVOS', totalActivos)
    sec('PASIVOS CORRIENTES')
    pasivosCorrientes.forEach(a => sub(a.name, saldos[a.id]||0))
    if (pasivosNoCorrientes.length) { sec('PASIVOS NO CORRIENTES'); pasivosNoCorrientes.forEach(a => sub(a.name, saldos[a.id]||0)) }
    tot('TOTAL PASIVOS', totalPasivos)
    sec('PATRIMONIO')
    patrimonio.forEach(a => sub(a.name, saldos[a.id]||0))
    sub('Utilidad del período', utilidad)
    tot('TOTAL PATRIMONIO', totalPatrimonio)
    rows.push([{ content:`TOTAL PASIVOS + PATRIMONIO`, styles:{fillColor:NAVY,textColor:[255,255,255],fontStyle:'bold'}},{content:fmt(totalPasivos+totalPatrimonio),styles:{fillColor:NAVY,textColor:[255,255,255],fontStyle:'bold',halign:'right'}}])

    autoTable(doc, { startY:28, head:[['Concepto','Importe']], body:rows, headStyles:{fillColor:NAVY,fontSize:9}, bodyStyles:{fontSize:10}, columnStyles:{1:{halign:'right',cellWidth:45}}, margin:{left:14,right:14} })
    doc.save('balance-general.pdf')
  }

  const SectionHeader = ({ label }: { label: string }) => (
    <div className="px-4 py-2 bg-gray-50 border-y border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</div>
  )
  const AccountRow = ({ acc }: { acc: Account }) => (
    <div className="flex items-center px-4 py-2.5 border-b border-gray-100 hover:bg-gray-50">
      <span className="text-xs font-mono text-gray-400 w-24 flex-shrink-0">{acc.code}</span>
      <span className="text-sm text-gray-700 flex-1">{acc.name}</span>
      <span className="text-sm font-medium text-gray-800">{fmt(saldos[acc.id]||0)}</span>
    </div>
  )
  const TotalRow = ({ label, val, big }: { label:string; val:number; big?:boolean }) => (
    <div className={`flex items-center px-4 py-2.5 border-b border-gray-200 ${big ? 'bg-navy' : 'bg-gray-100'}`}>
      <span className={`flex-1 font-semibold ${big ? 'text-white text-sm' : 'text-gray-700 text-xs'}`}>{label}</span>
      <span className={`font-semibold ${big ? 'text-white text-base' : 'text-gray-800 text-sm'}`}>{fmt(val)}</span>
    </div>
  )

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="bg-white border-b border-gray-100 px-6 py-3 flex items-center gap-3">
          <h1 className="text-base font-medium">Estado de situación financiera</h1>
          <span className="text-xs text-gray-400">Legacy Luxury Limo Corp · {new Date().toLocaleDateString('es-ES')}</span>
          {!ecuacion && totalActivos > 0 && (
            <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-1 rounded">⚠ Activos ≠ Pasivos + Patrimonio · revisar asientos</span>
          )}
          <div className="ml-auto">
            <button onClick={exportPDF} className="btn-danger text-xs"><FileText size={13}/> Exportar PDF</button>
          </div>
        </div>

        {loading
          ? <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">Cargando...</div>
          : (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="grid grid-cols-2 gap-5 max-w-5xl">

              {/* ACTIVOS */}
              <div className="card">
                <div className="card-header" style={{background:'#042C53'}}>
                  <span className="text-sm font-semibold text-white">ACTIVOS</span>
                  <span className="ml-auto text-sm font-semibold text-white">{fmt(totalActivos)}</span>
                </div>
                {(activosCorrientes.length > 0 || activosOtros.length > 0) && <>
                  <SectionHeader label="Activos corrientes" />
                  {[...activosCorrientes, ...activosOtros].map(a => <AccountRow key={a.id} acc={a} />)}
                  <TotalRow label="Total corrientes" val={[...activosCorrientes,...activosOtros].reduce((s,a)=>s+(saldos[a.id]||0),0)} />
                </>}
                {activosFijos.length > 0 && <>
                  <SectionHeader label="Activos fijos" />
                  {activosFijos.map(a => <AccountRow key={a.id} acc={a} />)}
                  <TotalRow label="Total activos fijos" val={activosFijos.reduce((s,a)=>s+(saldos[a.id]||0),0)} />
                </>}
                {totalActivos === 0 && <div className="px-4 py-6 text-xs text-gray-400 text-center">Sin movimientos registrados aún</div>}
                <TotalRow label="TOTAL ACTIVOS" val={totalActivos} big />
              </div>

              {/* PASIVOS + PATRIMONIO */}
              <div className="card">
                <div className="card-header" style={{background:'#042C53'}}>
                  <span className="text-sm font-semibold text-white">PASIVOS Y PATRIMONIO</span>
                  <span className="ml-auto text-sm font-semibold text-white">{fmt(totalPasivos + totalPatrimonio)}</span>
                </div>
                {pasivosCorrientes.length > 0 && <>
                  <SectionHeader label="Pasivos corrientes" />
                  {pasivosCorrientes.map(a => <AccountRow key={a.id} acc={a} />)}
                  <TotalRow label="Total pasivos corrientes" val={pasivosCorrientes.reduce((s,a)=>s+(saldos[a.id]||0),0)} />
                </>}
                {pasivosNoCorrientes.length > 0 && <>
                  <SectionHeader label="Pasivos no corrientes" />
                  {pasivosNoCorrientes.map(a => <AccountRow key={a.id} acc={a} />)}
                  <TotalRow label="Total pasivos no corrientes" val={pasivosNoCorrientes.reduce((s,a)=>s+(saldos[a.id]||0),0)} />
                </>}
                <TotalRow label="TOTAL PASIVOS" val={totalPasivos} big />

                <SectionHeader label="Patrimonio" />
                {patrimonio.map(a => <AccountRow key={a.id} acc={a} />)}
                <div className="flex items-center px-4 py-2.5 border-b border-gray-100 hover:bg-gray-50">
                  <span className="text-xs font-mono text-gray-400 w-24 flex-shrink-0">—</span>
                  <span className="text-sm text-gray-700 flex-1 italic">Utilidad del período</span>
                  <span className={`text-sm font-medium ${utilidad >= 0 ? 'text-teal' : 'text-red-700'}`}>{fmt(utilidad)}</span>
                </div>
                <TotalRow label="TOTAL PATRIMONIO" val={totalPatrimonio} big />
              </div>

            </div>

            {/* Ecuación contable */}
            <div className={`mt-4 max-w-5xl flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium ${ecuacion || totalActivos === 0 ? 'bg-green-50 border-green-200 text-green-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
              {ecuacion || totalActivos === 0
                ? '✓ Ecuación contable en equilibrio: Activos = Pasivos + Patrimonio'
                : `⚠ Diferencia: Activos (${fmt(totalActivos)}) ≠ Pasivos + Patrimonio (${fmt(totalPasivos + totalPatrimonio)})`}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
