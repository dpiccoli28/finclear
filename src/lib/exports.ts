'use client'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import { JournalEntry, Transaction, Account } from './supabase'

const NAVY = [4, 44, 83] as [number,number,number]
const TEAL = [15, 110, 86] as [number,number,number]
const RED  = [163, 45, 45] as [number,number,number]

function addHeader(doc: jsPDF, title: string, subtitle: string) {
  doc.setFillColor(...NAVY)
  doc.rect(0, 0, 210, 22, 'F')
  doc.setTextColor(255,255,255)
  doc.setFontSize(14); doc.setFont('helvetica','bold')
  doc.text('FinClear', 14, 10)
  doc.setFontSize(9); doc.setFont('helvetica','normal')
  doc.text('Legacy Luxury Limo Corp', 14, 16)
  doc.setFontSize(11); doc.setFont('helvetica','bold')
  doc.text(title, 105, 10, { align: 'center' })
  doc.setFontSize(8); doc.setFont('helvetica','normal')
  doc.text(subtitle, 105, 16, { align: 'center' })
  const today = new Date().toLocaleDateString('es-ES')
  doc.text(`Generado: ${today}`, 196, 10, { align: 'right' })
  doc.setTextColor(0,0,0)
}

function addFooter(doc: jsPDF) {
  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setFontSize(7); doc.setTextColor(150,150,150)
    doc.text('FinClear · Sistema de conciliaciones contables', 14, 290)
    doc.text(`Página ${i} de ${pages}`, 196, 290, { align: 'right' })
  }
}

export function exportPendingReport(pending: Transaction[], accounts: Account[]) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  addHeader(doc, 'Transacciones Pendientes de Clasificar', 'Para consulta con la empresa')

  const total = pending.reduce((a,t) => a + (t.debit||t.credit), 0)

  doc.setFontSize(10); doc.setTextColor(80,80,80)
  doc.text(`Se encontraron ${pending.length} transacciones sin clasificar por un total de $${total.toFixed(2)}.`, 14, 30)
  doc.text('Por favor, indique el concepto de cada una para registrar correctamente los asientos contables.', 14, 36)

  const rows = pending.map(t => [
    t.date, t.description,
    t.debit > 0 ? `$${t.debit.toFixed(2)}` : '—',
    t.credit > 0 ? `$${t.credit.toFixed(2)}` : '—',
    '___________________________________'
  ])

  autoTable(doc, {
    startY: 42,
    head: [['Fecha','Descripción bancaria','Débito','Crédito','Cuenta / Concepto']],
    body: rows,
    foot: [['','Total pendiente','','','$' + total.toFixed(2)]],
    headStyles: { fillColor: NAVY, fontSize: 9, fontStyle: 'bold' },
    footStyles: { fillColor: NAVY, textColor: [255,255,255], fontStyle: 'bold' },
    bodyStyles: { fontSize: 9 },
    alternateRowStyles: { fillColor: [248,248,248] },
    columnStyles: { 1: { cellWidth: 70 }, 4: { cellWidth: 55 } },
    margin: { left: 14, right: 14 }
  })

  // Questions section
  const questions = [
    { concept: 'Acima Digital LLC', q: '¿A qué activo corresponde este financiamiento? (vehículo, equipo u otro)' },
    { concept: 'Transferencias Legacy L', q: '¿Son pagos de impuestos, nómina u otro? Indique detalle.' },
    { concept: 'Arelisa / Bivian S', q: '¿Son empleados, socios o proveedores? ¿Sueldo, honorario o distribución?' },
    { concept: 'Hawthorne Chevrolet', q: '¿Mantenimiento, repuesto o compra de vehículo? ¿A qué unidad?' },
    { concept: 'Wal-Mart / Home Depot / 99 Cents', q: '¿Qué se compró? ¿Suministros, materiales, artículos de oficina?' },
    { concept: 'A Plus Credit Service', q: '¿Qué servicio es? ¿Tiene relación con la operación de la empresa?' },
  ]

  const finalY = (doc as any).lastAutoTable.finalY + 10
  doc.setFontSize(11); doc.setFont('helvetica','bold'); doc.setTextColor(...NAVY)
  doc.text('Preguntas para la empresa', 14, finalY)

  autoTable(doc, {
    startY: finalY + 4,
    head: [['#','Concepto','Pregunta']],
    body: questions.map((q,i) => [String(i+1), q.concept, q.q]),
    headStyles: { fillColor: NAVY, fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    columnStyles: { 0: { cellWidth: 8 }, 1: { cellWidth: 50 } },
    alternateRowStyles: { fillColor: [248,248,248] },
    margin: { left: 14, right: 14 }
  })

  addFooter(doc)
  doc.save('pendientes-enero-2026.pdf')
}

export function exportPnL(
  entries: JournalEntry[],
  accounts: Account[],
  period: string
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  addHeader(doc, 'Estado de Resultados', period)

  const saldos: Record<string, { debe: number; haber: number; acc: Account }> = {}
  accounts.forEach(a => { saldos[a.id] = { debe: 0, haber: 0, acc: a } })

  entries.forEach(e => {
    e.lines?.forEach(l => {
      if (saldos[l.account_id]) {
        saldos[l.account_id].debe  += l.debit
        saldos[l.account_id].haber += l.credit
      }
    })
  })

  const getSaldo = (id: string) => {
    const s = saldos[id]; if (!s) return 0
    return s.acc.type === 'ingreso' ? s.haber - s.debe : s.debe - s.haber
  }

  const ingresos  = accounts.filter(a => a.type === 'ingreso')
  const costos    = accounts.filter(a => a.type === 'costo')
  const gastos    = accounts.filter(a => a.type === 'gasto')
  const impuestos = accounts.filter(a => a.type === 'impuesto')
  const nd        = accounts.filter(a => a.type === 'nd')

  const totalIng = ingresos.reduce((s,a) => s + getSaldo(a.id), 0)
  const totalCos = costos.reduce((s,a)   => s + getSaldo(a.id), 0)
  const utilBruta = totalIng - totalCos
  const totalGas  = gastos.reduce((s,a)  => s + getSaldo(a.id), 0)
  const totalImp  = impuestos.reduce((s,a) => s + getSaldo(a.id), 0)
  const totalND   = nd.reduce((s,a)      => s + getSaldo(a.id), 0)
  const utilNeta  = utilBruta - totalGas - totalImp

  const fmt = (n: number) => n < 0 ? `-$${Math.abs(n).toFixed(2)}` : `$${n.toFixed(2)}`

  const rows: any[] = []
  const section = (label: string) => rows.push([{ content: label, colSpan: 3, styles: { fillColor: [230,241,251], fontStyle: 'bold', textColor: NAVY } }])
  const subrow  = (name: string, val: number) => rows.push(['', name, fmt(val)])
  const totrow  = (name: string, val: number, color?: [number,number,number]) => rows.push([{ content: name, colSpan: 2, styles: { fontStyle:'bold' } }, { content: fmt(val), styles: { fontStyle:'bold', textColor: color||(val>=0?TEAL:RED) } }])

  section('INGRESOS')
  ingresos.forEach(a => subrow(a.name, getSaldo(a.id)))
  totrow('Total ingresos', totalIng, TEAL)
  section('COSTOS DIRECTOS')
  costos.forEach(a => subrow(a.name, getSaldo(a.id)))
  totrow('Utilidad bruta', utilBruta, utilBruta >= 0 ? TEAL : RED)
  section('GASTOS OPERATIVOS')
  gastos.forEach(a => subrow(a.name, getSaldo(a.id)))
  if (impuestos.length) {
    section('IMPUESTOS')
    impuestos.forEach(a => subrow(a.name, getSaldo(a.id)))
  }
  if (nd.length) {
    section('NO DEDUCIBLES (registro financiero)')
    nd.forEach(a => subrow(a.name, getSaldo(a.id)))
  }
  rows.push([{ content: 'UTILIDAD NETA', colSpan: 2, styles: { fontStyle:'bold', fontSize:12, fillColor: NAVY, textColor:[255,255,255] } }, { content: fmt(utilNeta), styles: { fontStyle:'bold', fontSize:12, fillColor: NAVY, textColor:[255,255,255] } }])

  autoTable(doc, {
    startY: 28,
    head: [['Código','Concepto','Monto']],
    body: rows,
    headStyles: { fillColor: NAVY, fontSize: 9 },
    bodyStyles: { fontSize: 10 },
    columnStyles: { 0: { cellWidth: 25 }, 2: { halign: 'right', cellWidth: 35 } },
    margin: { left: 14, right: 14 }
  })

  addFooter(doc)
  doc.save(`estado-resultados-${period.replace(/\s/g,'-')}.pdf`)
}

export function exportJournalExcel(entries: JournalEntry[], accounts: Account[], period: string) {
  const accMap: Record<string, Account> = {}
  accounts.forEach(a => accMap[a.id] = a)

  const rows: any[] = [['Fecha','Referencia','Descripción','Cuenta','Nombre cuenta','Debe','Haber']]
  entries.forEach(e => {
    e.lines?.forEach((l, i) => {
      rows.push([
        e.date, e.reference||'', i===0 ? e.description : '',
        accMap[l.account_id]?.code||'',
        accMap[l.account_id]?.name||'',
        l.debit > 0 ? l.debit : '',
        l.credit > 0 ? l.credit : ''
      ])
    })
    rows.push(['','','','','','',''])
  })

  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = [{ wch:12},{wch:14},{wch:40},{wch:14},{wch:30},{wch:12},{wch:12}]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Libro Diario')
  XLSX.writeFile(wb, `libro-diario-${period}.xlsx`)
}
