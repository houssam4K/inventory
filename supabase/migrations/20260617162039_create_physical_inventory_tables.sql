
CREATE TABLE inventory_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL DEFAULT current_date,
  note text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE inventory_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES inventory_sessions(id) ON DELETE CASCADE,
  raw_material_id uuid NOT NULL REFERENCES raw_materials(id),
  theoretical_quantity numeric NOT NULL,
  real_quantity numeric NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(session_id, raw_material_id)
);

-- RLS
ALTER TABLE inventory_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_inventory_sessions" ON inventory_sessions FOR SELECT TO anon USING (true);
CREATE POLICY "insert_inventory_sessions" ON inventory_sessions FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "update_inventory_sessions" ON inventory_sessions FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "delete_inventory_sessions" ON inventory_sessions FOR DELETE TO anon USING (true);

CREATE POLICY "select_inventory_entries" ON inventory_entries FOR SELECT TO anon USING (true);
CREATE POLICY "insert_inventory_entries" ON inventory_entries FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "update_inventory_entries" ON inventory_entries FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "delete_inventory_entries" ON inventory_entries FOR DELETE TO anon USING (true);
