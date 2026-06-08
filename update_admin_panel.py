import re

with open("src/pages/AdminPanel.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Update interface
interface_target = "notes: string | null;"
interface_replacement = """notes: string | null;
  supplier_data_sheet_url?: string;
  formulation_warnings?: string[];"""
content = content.replace(interface_target, interface_replacement)

# Update form JSX
form_target = """              <div className="md:col-span-2">
                <Label htmlFor="notes">Notes</Label>"""
form_replacement = """              <div>
                <Label htmlFor="supplier_data_sheet_url">Supplier Data Sheet URL</Label>
                <Input
                  id="supplier_data_sheet_url"
                  placeholder="https://..."
                  value={formData.supplier_data_sheet_url || ""}
                  onChange={(e) => setFormData({ ...formData, supplier_data_sheet_url: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="formulation_warnings">Formulation Warnings (comma-separated)</Label>
                <Input
                  id="formulation_warnings"
                  placeholder="e.g. Contains nuts, High acid"
                  value={formData.formulation_warnings?.join(", ") || ""}
                  onChange={(e) => setFormData({ ...formData, formulation_warnings: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })}
                />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="notes">Notes</Label>"""
content = content.replace(form_target, form_replacement)

with open("src/pages/AdminPanel.tsx", "w", encoding="utf-8") as f:
    f.write(content)
