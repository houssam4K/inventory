import * as React from "react"
import { ClipboardList } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { supabase } from "@/lib/supabase"
import type { RawMaterial } from "@/lib/types"

interface Props {
  open: boolean
  onClose: () => void
  onDone: () => void
}

export function NewInventoryDialog({ open, onClose, onDone }: Props) {
  const [materials, setMaterials] = React.useState<RawMaterial[]>([])
  const [loadingMaterials, setLoadingMaterials] = React.useState(false)
  const [date, setDate] = React.useState("")
  const [note, setNote] = React.useState("")
  const [realQtys, setRealQtys] = React.useState<Record<string, string>>({})
  const [error, setError] = React.useState("")
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    setDate(new Date().toISOString().slice(0, 10))
    setNote("")
    setRealQtys({})
    setError("")
    setLoadingMaterials(true)
    supabase
      .from("raw_materials")
      .select("*")
      .order("name")
      .then(({ data }) => {
        setMaterials((data as RawMaterial[]) ?? [])
        setLoadingMaterials(false)
      })
  }, [open])

  function setQty(id: string, val: string) {
    setRealQtys((prev) => ({ ...prev, [id]: val }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")

    if (!date) { setError("Date is required."); return }

    const entries = materials.filter((m) => {
      const v = realQtys[m.id]
      return v !== undefined && v.trim() !== "" && !isNaN(parseFloat(v)) && parseFloat(v) >= 0
    })

    if (entries.length === 0) {
      setError("Enter at least one material's real quantity to save.")
      return
    }

    setSaving(true)

    // Create the session
    const { data: sessionData, error: sessErr } = await supabase
      .from("inventory_sessions")
      .insert({ date, note: note.trim() || null })
      .select("id")
      .single()

    if (sessErr) { setError(sessErr.message); setSaving(false); return }

    // Insert entries
    const inserts = entries.map((m) => ({
      session_id: sessionData.id,
      raw_material_id: m.id,
      theoretical_quantity: m.current_quantity,
      real_quantity: parseFloat(realQtys[m.id]),
    }))

    const { error: entErr } = await supabase.from("inventory_entries").insert(inserts)
    if (entErr) { setError(entErr.message); setSaving(false); return }

    setSaving(false)
    onDone()
  }

  const filledCount = materials.filter((m) => {
    const v = realQtys[m.id]
    return v !== undefined && v.trim() !== "" && !isNaN(parseFloat(v)) && parseFloat(v) >= 0
  }).length

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="size-5 text-primary" />
            New Physical Inventory
          </DialogTitle>
          <DialogDescription>
            Enter the physically counted quantities. Leave a field blank to skip that material.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 min-h-0 flex-1">
          <div className="grid grid-cols-2 gap-3 shrink-0">
            <div className="flex flex-col gap-2">
              <Label htmlFor="inv-date">Date</Label>
              <Input
                id="inv-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="inv-note">Note (optional)</Label>
              <Input
                id="inv-note"
                placeholder="e.g. Weekly check"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          </div>

          <Separator className="shrink-0" />

          {/* Materials table */}
          <div className="overflow-y-auto flex-1 -mx-1 px-1">
            {loadingMaterials ? (
              <div className="flex flex-col gap-2">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : materials.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No materials found. Add materials in Stock Status first.
              </p>
            ) : (
              <div className="flex flex-col gap-1">
                <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 px-2 pb-1">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Material</span>
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide text-right min-w-[80px]">Theoretical</span>
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide text-center min-w-[110px]">Real (counted)</span>
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide text-right min-w-[60px]">Écart</span>
                </div>
                {materials.map((m) => {
                  const raw = realQtys[m.id] ?? ""
                  const real = raw.trim() !== "" && !isNaN(parseFloat(raw)) ? parseFloat(raw) : null
                  const ecart = real !== null ? m.current_quantity - real : null
                  return (
                    <div
                      key={m.id}
                      className="grid grid-cols-[1fr_auto_auto_auto] gap-3 items-center rounded-lg px-2 py-1.5 hover:bg-muted/40 transition-colors"
                    >
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-medium truncate">{m.name}</span>
                        <span className="text-xs text-muted-foreground">{m.unit_of_measure}</span>
                      </div>
                      <span className="text-sm tabular-nums text-muted-foreground text-right min-w-[80px]">
                        {m.current_quantity}
                      </span>
                      <div className="min-w-[110px]">
                        <Input
                          type="number"
                          min="0"
                          step="any"
                          placeholder="—"
                          value={raw}
                          onChange={(e) => setQty(m.id, e.target.value)}
                          className="h-8 text-center tabular-nums"
                        />
                      </div>
                      <span
                        className={`text-sm tabular-nums font-medium text-right min-w-[60px] ${
                          ecart === null
                            ? "text-muted-foreground/40"
                            : ecart > 0
                            ? "text-amber-600 dark:text-amber-400"
                            : ecart < 0
                            ? "text-blue-600 dark:text-blue-400"
                            : "text-emerald-600 dark:text-emerald-400"
                        }`}
                      >
                        {ecart === null ? "—" : ecart > 0 ? `−${ecart}` : ecart < 0 ? `+${Math.abs(ecart)}` : "0"}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="shrink-0 flex flex-col gap-3">
            {filledCount > 0 && (
              <p className="text-xs text-muted-foreground text-center">
                {filledCount} material{filledCount !== 1 ? "s" : ""} will be saved in this session.
              </p>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={saving || loadingMaterials}>
                {saving ? "Saving..." : "Save Inventory"}
              </Button>
            </DialogFooter>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
