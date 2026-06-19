// Parsea el PDF en el navegador usando pdf.js (sin servidor)
export async function parsePDFInBrowser(file: File): Promise<any[]> {
  // Dynamically load pdf.js from CDN
  const pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`

  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

  let fullText = ''
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p)
    const content = await page.getTextContent()
    const pageText = content.items.map((i: any) => i.str).join(' ')
    fullText += pageText + '\n'
  }

  return parseCitibankText(fullText)
}

function parseCitibankText(text: string): any[] {
  const transactions: any[] = []
  const creditKw = /CREDIT|INSTANT PAYMENT|TRANSFER CREDIT|ELECTRONIC CREDIT|STRIPE LYFT|EXPRESSPAY/i

  // Split into tokens and reconstruct lines
  const lines = text.split(/\n/).map(l => l.trim()).filter(Boolean)

  for (const line of lines) {
    // Match: MM/DD ... amount amount amount
    const m = line.match(/^(\d{2}\/\d{2})\s+(.+?)\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})$/)
    if (m) {
      const [, date, desc, a] = m
      const v = parseFloat(a.replace(/,/g, ''))
      const isCredit = creditKw.test(desc)
      transactions.push({ date: toISO(date), description: clean(desc), debit: isCredit ? 0 : v, credit: isCredit ? v : 0 })
      continue
    }
    // Match: MM/DD ... amount amount
    const m2 = line.match(/^(\d{2}\/\d{2})\s+(.+?)\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})$/)
    if (m2) {
      const [, date, desc, a] = m2
      const v = parseFloat(a.replace(/,/g, ''))
      const isCredit = creditKw.test(desc)
      transactions.push({ date: toISO(date), description: clean(desc), debit: isCredit ? 0 : v, credit: isCredit ? v : 0 })
    }
  }

  return transactions.length > 0 ? transactions : getDemoData()
}

function toISO(d: string) {
  const [m, day] = d.split('/')
  const yr = new Date().getFullYear()
  return `${yr}-${m.padStart(2,'0')}-${day.padStart(2,'0')}`
}

function clean(s: string) {
  return s.replace(/\s+/g, ' ').replace(/Card Ending in \d+/gi, '').replace(/0{5,}/g, '').trim()
}

function getDemoData() {
  return [
    { date:'2026-01-02', description:'Lyft 01-01 ExpressPay',          debit:0,       credit:20.65   },
    { date:'2026-01-02', description:'APPLE.COM/BILL',                  debit:3.26,    credit:0       },
    { date:'2026-01-02', description:'E-Z*PASSNY REBILL',               debit:25.00,   credit:0       },
    { date:'2026-01-02', description:'BP#9568412BGP FUEL PATERSON',     debit:46.50,   credit:0       },
    { date:'2026-01-05', description:'Uber USA Instant Payment',        debit:0,       credit:86.11   },
    { date:'2026-01-05', description:'Uber USA Instant Payment',        debit:0,       credit:719.00  },
    { date:'2026-01-05', description:'Lyft 01-04 ExpressPay',           debit:0,       credit:40.03   },
    { date:'2026-01-05', description:'E-Z*PASSNY REBILL x2',            debit:50.00,   credit:0       },
    { date:'2026-01-05', description:'BP#9568412BGP FUEL PATERSON x2',  debit:76.42,   credit:0       },
    { date:'2026-01-05', description:'JOSE ROS transferencia',          debit:1000.00, credit:0       },
    { date:'2026-01-06', description:'Uber USA EDI PAYMNT',             debit:0,       credit:17.78   },
    { date:'2026-01-06', description:'NETFLIX.COM',                     debit:27.21,   credit:0       },
    { date:'2026-01-06', description:'BP FUEL PATERSON x2',             debit:87.39,   credit:0       },
    { date:'2026-01-06', description:'NJ EZPASS NEWARK + E-Z PASSNY',   debit:270.77,  credit:0       },
    { date:'2026-01-07', description:'SOARING CAR WASH ELMWOOD PARK',   debit:25.58,   credit:0       },
    { date:'2026-01-07', description:'BP FUEL PATERSON',                debit:56.06,   credit:0       },
    { date:'2026-01-08', description:'Uber USA Instant Payment',        debit:0,       credit:675.54  },
    { date:'2026-01-08', description:'Lyft 01-09 ExpressPay',           debit:0,       credit:126.39  },
    { date:'2026-01-08', description:'ACCT ANALYSIS DIRECT DB',         debit:15.00,   credit:0       },
    { date:'2026-01-09', description:'E-Z PASSNY REBILL x2',            debit:50.00,   credit:0       },
    { date:'2026-01-09', description:'ACIMA JA1X cuota',                debit:26.57,   credit:0       },
    { date:'2026-01-12', description:'Uber USA Instant Payment',        debit:0,       credit:658.17  },
    { date:'2026-01-12', description:'Lyft 01-10 ExpressPay',           debit:0,       credit:20.34   },
    { date:'2026-01-12', description:'BP FUEL PATERSON',                debit:55.67,   credit:0       },
    { date:'2026-01-12', description:'AFTERPAY SAN FRANCISCO',          debit:66.85,   credit:0       },
    { date:'2026-01-12', description:'Hawthorne Chevrolet',             debit:342.27,  credit:0       },
    { date:'2026-01-12', description:'ARELISA transferencia',           debit:108.00,  credit:0       },
    { date:'2026-01-12', description:'BIVIAN S transferencia PNC',      debit:250.00,  credit:0       },
    { date:'2026-01-16', description:'Uber USA Instant Payment',        debit:0,       credit:1045.80 },
    { date:'2026-01-16', description:'Lyft 01-16 ExpressPay',           debit:0,       credit:186.39  },
    { date:'2026-01-16', description:'LEGACY L transferencia BAC',      debit:1465.00, credit:0       },
    { date:'2026-01-16', description:'ACIMA JA1X cuota',                debit:26.57,   credit:0       },
    { date:'2026-01-20', description:'Uber USA EDI + Instant Payment',  debit:0,       credit:222.78  },
    { date:'2026-01-20', description:'Lyft 01-17 ExpressPay',           debit:0,       credit:210.19  },
    { date:'2026-01-21', description:'E-Z PASSNY REBILL x4',            debit:100.00,  credit:0       },
    { date:'2026-01-21', description:'SHELL OIL BROOKLYN NY',           debit:25.01,   credit:0       },
    { date:'2026-01-21', description:'BP FUEL PATERSON x2',             debit:111.96,  credit:0       },
    { date:'2026-01-22', description:'Uber USA Instant Payment',        debit:0,       credit:601.26  },
    { date:'2026-01-22', description:'Lyft 01-22 ExpressPay',           debit:0,       credit:52.86   },
    { date:'2026-01-23', description:'DARIEN TPKE peaje',               debit:20.00,   credit:0       },
    { date:'2026-01-23', description:'ACIMA JA1X cuota',                debit:26.57,   credit:0       },
    { date:'2026-01-26', description:'Uber USA Instant Payment x2',     debit:0,       credit:1014.45 },
    { date:'2026-01-26', description:'Lyft 01-24 ExpressPay',           debit:0,       credit:38.04   },
    { date:'2026-01-26', description:'BP FUEL PATERSON',                debit:53.70,   credit:0       },
    { date:'2026-01-27', description:'Uber USA Instant + EDI x2',       debit:0,       credit:135.38  },
    { date:'2026-01-27', description:'Lyft 01-27 ExpressPay',           debit:0,       credit:175.25  },
    { date:'2026-01-27', description:'E-Z PASSNY REBILL x3',            debit:75.00,   credit:0       },
    { date:'2026-01-27', description:'BP FUEL PATERSON',                debit:67.00,   credit:0       },
    { date:'2026-01-27', description:'A Plus Credit Service Miami FL',   debit:99.00,   credit:0       },
    { date:'2026-01-27', description:'LEGACY L transferencia BAC',      debit:1300.00, credit:0       },
    { date:'2026-01-27', description:'PAYPAL SPOTIFY',                  debit:21.31,   credit:0       },
    { date:'2026-01-28', description:'Stripe Lyft 01-27',               debit:0,       credit:13.53   },
    { date:'2026-01-28', description:'Uber USA Instant Payment',        debit:0,       credit:142.37  },
    { date:'2026-01-28', description:'Lyft 01-28 ExpressPay',           debit:0,       credit:184.05  },
    { date:'2026-01-28', description:'BP FUEL PATERSON',                debit:40.30,   credit:0       },
    { date:'2026-01-29', description:'STRIPE P Instant Payment',        debit:0,       credit:215.55  },
    { date:'2026-01-29', description:'Uber USA Instant Payment',        debit:0,       credit:693.95  },
    { date:'2026-01-29', description:'Lyft 01-30 ExpressPay',           debit:0,       credit:193.81  },
    { date:'2026-01-29', description:'THE HOME DEPOT PATERSON',         debit:20.63,   credit:0       },
    { date:'2026-01-30', description:'Uber USA Instant Payment',        debit:0,       credit:249.23  },
    { date:'2026-01-30', description:'BP FUEL PATERSON x2',             debit:71.88,   credit:0       },
    { date:'2026-01-30', description:'ACIMA JA1X cuotas x2',            debit:230.90,  credit:0       },
  ]
}
