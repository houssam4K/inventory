import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import { PACKAGING_TYPES, type PackagingTransaction } from "./types"

const BRAND = "RawTrack"
const ACCENT = [32, 32, 32] as [number, number, number]  // near-black primary
const MUTED = [100, 100, 100] as [number, number, number]
const LOSS_COLOR = [180, 100, 20] as [number, number, number]
const OK_COLOR = [30, 130, 80] as [number, number, number]
const SURPLUS_COLOR = [30, 80, 180] as [number, number, number]

function fmt(n: number) {
  return n.toLocaleString() + " DA"
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-DZ", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function addHeader(doc: jsPDF, title: string, subtitle: string) {
  const pageW = doc.internal.pageSize.getWidth()

  // Brand
  doc.setFontSize(10)
  doc.setTextColor(...MUTED)
  doc.text(BRAND, 14, 12)

  // Generated date (right-aligned)
  const genLabel = `Generated: ${new Date().toLocaleDateString("fr-DZ", { day: "2-digit", month: "short", year: "numeric" })}`
  doc.text(genLabel, pageW - 14, 12, { align: "right" })

  // Separator line
  doc.setDrawColor(220, 220, 220)
  doc.setLineWidth(0.3)
  doc.line(14, 15, pageW - 14, 15)

  // Title
  doc.setFontSize(18)
  doc.setTextColor(...ACCENT)
  doc.setFont("helvetica", "bold")
  doc.text(title, 14, 26)

  // Subtitle
  doc.setFontSize(10)
  doc.setTextColor(...MUTED)
  doc.setFont("helvetica", "normal")
  doc.text(subtitle, 14, 33)

  return 40  // return Y cursor after header
}

function addPageNumbers(doc: jsPDF) {
  const total = (doc.internal as unknown as { getNumberOfPages(): number }).getNumberOfPages()
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  for (let i = 1; i <= total; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(...MUTED)
    doc.text(`Page ${i} / ${total}`, pageW - 14, pageH - 8, { align: "right" })
    doc.setTextColor(...MUTED)
    doc.text(BRAND, 14, pageH - 8)
  }
}

// ---------- Finance PDF ----------

interface FinancePdfRow {
  date: string
  quantity: number
  unit_price: number
  invoice_number: string | null
  suppliers: { name: string }
  raw_materials: { name: string; unit_of_measure: string }
}

interface SupplierBreakdown {
  name: string
  total: number
  count: number
}

export function exportFinancePDF(
  rows: FinancePdfRow[],
  month: string,
  bySupplier: SupplierBreakdown[]
) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" })
  const [y, m] = month.split("-").map(Number)
  const monthLabel = new Date(y, m - 1).toLocaleDateString("fr-DZ", { year: "numeric", month: "long" })

  let cursor = addHeader(doc, "Purchases Report", monthLabel)

  const totalSpend = rows.reduce((acc, r) => acc + r.quantity * r.unit_price, 0)

  // Summary box
  doc.setFontSize(9)
  doc.setTextColor(...MUTED)
  doc.text(`Total spend:`, 14, cursor + 5)
  doc.setFontSize(12)
  doc.setTextColor(...ACCENT)
  doc.setFont("helvetica", "bold")
  doc.text(fmt(totalSpend), 40, cursor + 5)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(9)
  doc.setTextColor(...MUTED)
  doc.text(`Shipments: ${rows.length}`, 14, cursor + 11)

  cursor += 18

  // Per-supplier breakdown (small chips)
  if (bySupplier.length > 0) {
    doc.setFontSize(8)
    doc.setTextColor(...MUTED)
    doc.text("By Supplier:", 14, cursor)
    let xOff = 14
    cursor += 4
    bySupplier.forEach((s) => {
      const label = `${s.name}: ${fmt(s.total)} (${s.count})`
      doc.setFontSize(8)
      doc.setTextColor(60, 60, 60)
      doc.text(label, xOff, cursor)
      xOff += doc.getStringUnitWidth(label) * 8 * 0.352 + 8
      if (xOff > 240) { xOff = 14; cursor += 5 }
    })
    cursor += 6
  }

  // Main purchases table
  autoTable(doc, {
    startY: cursor,
    head: [["Date", "Supplier", "Material", "Unit", "Qty", "Unit Price", "Total", "Invoice"]],
    body: rows.map((r) => [
      fmtDate(r.date),
      r.suppliers.name,
      r.raw_materials.name,
      r.raw_materials.unit_of_measure,
      r.quantity,
      r.unit_price > 0 ? fmt(r.unit_price) : "—",
      r.unit_price > 0 ? fmt(r.quantity * r.unit_price) : "—",
      r.invoice_number ?? "—",
    ]),
    foot: [["", "", "", "", "", "TOTAL", fmt(totalSpend), ""]],
    headStyles: { fillColor: [32, 32, 32], fontSize: 8, fontStyle: "bold" },
    footStyles: { fillColor: [240, 240, 240], textColor: [32, 32, 32], fontStyle: "bold", fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    columnStyles: {
      0: { cellWidth: 24 },
      1: { cellWidth: 38 },
      2: { cellWidth: 45 },
      3: { cellWidth: 18 },
      4: { cellWidth: 18, halign: "right" },
      5: { cellWidth: 28, halign: "right" },
      6: { cellWidth: 28, halign: "right", fontStyle: "bold" },
      7: { cellWidth: 28 },
    },
    margin: { left: 14, right: 14 },
  })

  addPageNumbers(doc)
  doc.save(`purchases-${month}.pdf`)
}

// ---------- Packaging PDF ----------

export function exportPackagingPDF(
  supplierName: string,
  transactions: PackagingTransaction[]
) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })

  const dateStr = new Date().toLocaleDateString("fr-DZ", { year: "numeric", month: "long", day: "numeric" })
  let cursor = addHeader(doc, `Packaging Report`, `${supplierName} — as of ${dateStr}`)

  // Balance per type
  const balance = PACKAGING_TYPES.map((pt) => {
    const sent = transactions
      .filter((t) => t.packaging_type === pt.value && t.transaction_type === "SENT")
      .reduce((a, t) => a + t.quantity, 0)
    const returned = transactions
      .filter((t) => t.packaging_type === pt.value && t.transaction_type === "RETURNED")
      .reduce((a, t) => a + t.quantity, 0)
    return { label: pt.label, sent, returned, balance: sent - returned }
  })

  cursor += 4

  doc.setFontSize(9)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(...ACCENT)
  doc.text("Balance Summary", 14, cursor)
  cursor += 4

  autoTable(doc, {
    startY: cursor,
    head: [["Packaging Type", "Sent", "Returned", "Balance (outstanding)"]],
    body: balance.map((b) => [b.label, b.sent, b.returned, b.balance]),
    headStyles: { fillColor: [32, 32, 32], fontSize: 9, fontStyle: "bold" },
    bodyStyles: { fontSize: 9 },
    columnStyles: {
      1: { halign: "right" },
      2: { halign: "right" },
      3: { halign: "right", fontStyle: "bold" },
    },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 3) {
        const val = Number(data.cell.raw)
        if (val > 0) data.cell.styles.textColor = LOSS_COLOR
        else if (val < 0) data.cell.styles.textColor = SURPLUS_COLOR
        else data.cell.styles.textColor = OK_COLOR
      }
    },
    margin: { left: 14, right: 14 },
  })

  const afterBalance = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY
  cursor = afterBalance + 10

  // Transaction history
  if (transactions.length > 0) {
    doc.setFontSize(9)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(...ACCENT)
    doc.text("Transaction History", 14, cursor)
    cursor += 4

    const sorted = [...transactions].sort((a, b) => b.date.localeCompare(a.date))

    autoTable(doc, {
      startY: cursor,
      head: [["Date", "Type", "Packaging", "Qty", "Note"]],
      body: sorted.map((t) => [
        fmtDate(t.date),
        t.transaction_type === "SENT" ? "Sent" : "Returned",
        PACKAGING_TYPES.find((p) => p.value === t.packaging_type)?.label ?? t.packaging_type,
        t.quantity,
        t.note ?? "—",
      ]),
      headStyles: { fillColor: [32, 32, 32], fontSize: 8, fontStyle: "bold" },
      bodyStyles: { fontSize: 8 },
      alternateRowStyles: { fillColor: [250, 250, 250] },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 1) {
          const val = data.cell.raw as string
          data.cell.styles.textColor = val === "Sent" ? [40, 80, 160] : [30, 130, 80]
          data.cell.styles.fontStyle = "bold"
        }
      },
      columnStyles: {
        0: { cellWidth: 28 },
        1: { cellWidth: 22 },
        2: { cellWidth: 28 },
        3: { cellWidth: 18, halign: "right" },
        4: { cellWidth: "auto" as unknown as number },
      },
      margin: { left: 14, right: 14 },
    })
  }

  addPageNumbers(doc)

  const filename = `packaging-${supplierName.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase()}-${new Date().toISOString().slice(0, 10)}.pdf`
  doc.save(filename)
}
