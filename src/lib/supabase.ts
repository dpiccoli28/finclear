import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseKey)

export type Account = {
  id: string; company_id: string; code: string; name: string
  type: 'activo'|'ingreso'|'costo'|'gasto'|'impuesto'|'nd'
  group_name: string; keywords: string[]|null; deductible: boolean
}

export type Transaction = {
  id: string; statement_id: string; company_id: string
  date: string; description: string; debit: number; credit: number
  account_id: string|null; auto_classified: boolean; confidence: number
  is_non_deductible: boolean; status: 'pending'|'confirmed'; notes: string|null
  account?: Account
}

export type JournalEntry = {
  id: string; company_id: string; transaction_id: string|null
  date: string; description: string; reference: string|null
  lines?: JournalLine[]
}

export type JournalLine = {
  id: string; entry_id: string; account_id: string
  debit: number; credit: number; account?: Account
}

export type Statement = {
  id: string; company_id: string; bank: string; account_number: string
  period_start: string; period_end: string
  beginning_balance: number; ending_balance: number; filename: string|null
}

export type Company = {
  id: string; name: string; ein: string|null; state: string|null
}
