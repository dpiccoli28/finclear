import { Account } from './supabase'

export type RawTransaction = {
  date: string; description: string; debit: number; credit: number
}

export type ClassifiedTransaction = RawTransaction & {
  suggested_account_id: string | null
  confidence: number
  is_non_deductible: boolean
  auto_classified: boolean
}

export function classifyTransactions(
  raw: RawTransaction[],
  accounts: Account[]
): ClassifiedTransaction[] {
  return raw.map(tx => classify(tx, accounts))
}

function classify(tx: RawTransaction, accounts: Account[]): ClassifiedTransaction {
  const desc = tx.description.toUpperCase()
  let best: Account | null = null
  let bestScore = 0

  for (const acc of accounts) {
    if (acc.type === 'activo') continue
    if (!acc.keywords?.length) continue

    for (const kw of acc.keywords) {
      if (desc.includes(kw.toUpperCase())) {
        const score = kw.length // longer match = more specific
        if (score > bestScore) { bestScore = score; best = acc }
      }
    }
  }

  // Direction check: credits must map to income accounts, debits to expense/cost
  if (best) {
    if (tx.credit > 0 && !['ingreso'].includes(best.type)) best = null
    if (tx.debit > 0 && ['ingreso'].includes(best.type)) best = null
  }

  const confidence = best ? Math.min(99, 80 + bestScore) : 0

  return {
    ...tx,
    suggested_account_id: best?.id ?? null,
    confidence,
    is_non_deductible: best?.type === 'nd',
    auto_classified: best !== null
  }
}

// Parse Citibank-style PDF text into raw transactions
export function parseCitibankText(text: string): RawTransaction[] {
  const transactions: RawTransaction[] = []
  const lines = text.split('\n')

  // Pattern: date like 01/02, then description, then optional debit, credit, balance
  const datePattern = /^(\d{2}\/\d{2})\s+(.+?)\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})$/
  const simpleDatePattern = /^(\d{2}\/\d{2})\s+(.+?)\s+([\d,]+\.\d{2})$/

  let i = 0
  while (i < lines.length) {
    const line = lines[i].trim()

    const fullMatch = line.match(datePattern)
    if (fullMatch) {
      const [, date, desc, col1, col2, balance] = fullMatch
      const v1 = parseFloat(col1.replace(/,/g, ''))
      const v2 = parseFloat(col2.replace(/,/g, ''))
      const bal = parseFloat(balance.replace(/,/g, ''))

      // Determine if col1 is debit or credit by balance change
      const prevBal = transactions.length > 0
        ? transactions[transactions.length-1].credit > 0
          ? 0 : 0
        : null

      // Simple heuristic: if description contains credit keywords
      const isCredit = /CREDIT|PAYMENT CREDIT|TRANSFER CREDIT|INSTANT PAYMENT|ELECTRONIC CREDIT/i.test(desc)

      transactions.push({
        date: normalizeDate(date),
        description: cleanDesc(desc),
        debit: isCredit ? 0 : v1,
        credit: isCredit ? v1 : 0
      })
      i++
      continue
    }
    i++
  }

  return transactions
}

function normalizeDate(d: string): string {
  const [m, day] = d.split('/')
  return `2026-${m.padStart(2,'0')}-${day.padStart(2,'0')}`
}

function cleanDesc(d: string): string {
  return d.replace(/\s+/g, ' ').trim()
}
