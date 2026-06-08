import re

with open("src/components/AddIngredientDialog.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Update formData state
form_state = "verified_source: prefilledData?.verified_source || '',"
new_form_state = """verified_source: prefilledData?.verified_source || '',
    supplier_data_sheet_url: prefilledData?.supplier_data_sheet_url || '',
    formulation_warnings: prefilledData?.formulation_warnings || [] as string[],"""
content = content.replace(form_state, new_form_state)

# Update form prefilled useEffect
effect_state = "verified_source: prefilledData.verified_source || '',"
new_effect_state = """verified_source: prefilledData.verified_source || '',
        supplier_data_sheet_url: prefilledData.supplier_data_sheet_url || '',
        formulation_warnings: prefilledData.formulation_warnings || [],"""
content = content.replace(effect_state, new_effect_state)

# Update form reset
reset_state = "verified_source: '',"
new_reset_state = """verified_source: '',
          supplier_data_sheet_url: '',
          formulation_warnings: [],"""
content = content.replace(reset_state, new_reset_state)

# Add badges import if not exists
if "Badge" not in content:
    content = content.replace("import { Button } from '@/components/ui/button';", "import { Button } from '@/components/ui/button';\nimport { Badge } from '@/components/ui/badge';")


# Add fields to form UI
ui_insertion = """            <div className="col-span-2">
              <Label htmlFor="verified_source">Data Source (optional)</Label>"""
new_ui = """            <div className="col-span-2">
              <Label htmlFor="supplier_data_sheet_url">Supplier Data Sheet URL (optional)</Label>
              <Input
                id="supplier_data_sheet_url"
                placeholder="https://..."
                value={formData.supplier_data_sheet_url}
                onChange={(e) => setFormData({ ...formData, supplier_data_sheet_url: e.target.value })}
              />
            </div>

            <div className="col-span-2">
              <Label htmlFor="formulation_warnings">Formulation Warnings (comma-separated, optional)</Label>
              <Input
                id="formulation_warnings"
                placeholder="e.g., High acid, Contains nuts"
                value={formData.formulation_warnings?.join(', ')}
                onChange={(e) => setFormData({ ...formData, formulation_warnings: e.target.value.split(',').map(t => t.trim()).filter(t => t) })}
              />
              {formData.formulation_warnings && formData.formulation_warnings.length > 0 && (
                <div className="flex gap-2 mt-2 flex-wrap">
                  {formData.formulation_warnings.map((w, i) => (
                     <Badge key={i} variant="destructive">{w}</Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="col-span-2">
              <Label htmlFor="verified_source">Data Source (optional)</Label>"""
content = content.replace(ui_insertion, new_ui)

with open("src/components/AddIngredientDialog.tsx", "w", encoding="utf-8") as f:
    f.write(content)
