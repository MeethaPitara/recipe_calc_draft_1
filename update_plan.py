import re
import sys

with open("src/pages/QuickProductionPlan.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Add imports
if "Plus" not in content:
    content = content.replace('import { Loader2, ArrowLeft, Calculator, Variable, Save, History, Trash2 } from "lucide-react";', 
                              'import { Loader2, ArrowLeft, Calculator, Variable, Save, History, Trash2, Plus, X } from "lucide-react";')

# Add State
state_hook = r"const \[densityStr, setDensityStr\] = useState<string \| null>\(null\);"
new_state = """const [densityStr, setDensityStr] = useState<string | null>(null);
  const [fillWeightG, setFillWeightG] = useState<number>(0);
  const [fillWeightGStr, setFillWeightGStr] = useState<string | null>(null);
  const [wasteFactorPct, setWasteFactorPct] = useState<number>(0);
  const [wasteFactorPctStr, setWasteFactorPctStr] = useState<string | null>(null);
  const [machineCapacity, setMachineCapacity] = useState<number>(0);
  const [machineCapacityStr, setMachineCapacityStr] = useState<string | null>(null);
  const [packagingItems, setPackagingItems] = useState<{name: string, unitsNeededPerSku: number}[]>([]);"""
content = content.replace(state_hook, new_state)

# handleSavePlan
save_params = """const inputParams = {
        targetVolumeLiters: targetVolume,
        skuSizeLiters: skuSize,
        overrunPct: overrun,
        lossPct: loss,
        mixDensity: density,"""
new_save_params = """const inputParams = {
        targetVolumeLiters: targetVolume,
        skuSizeLiters: skuSize,
        overrunPct: overrun,
        lossPct: loss,
        mixDensity: density,
        fillWeightG,
        wasteFactorPct,
        machineCapacityKgPerHour: machineCapacity,
        packagingItems,"""
content = content.replace(save_params, new_save_params)

# loadPlanIntoState
load_params = """setTargetVolume(params.targetVolumeLiters);
    setSkuSize(params.skuSizeLiters);
    setOverrun(params.overrunPct);
    setLoss(params.lossPct);
    setDensity(params.mixDensity);"""
new_load_params = """setTargetVolume(params.targetVolumeLiters);
    setSkuSize(params.skuSizeLiters);
    setOverrun(params.overrunPct);
    setLoss(params.lossPct);
    setDensity(params.mixDensity);
    setFillWeightG(params.fillWeightG || 0);
    setWasteFactorPct(params.wasteFactorPct || 0);
    setMachineCapacity(params.machineCapacityKgPerHour || 0);
    setPackagingItems(params.packagingItems || []);"""
content = content.replace(load_params, new_load_params)

# Input
engine_input = """const input: ProductionInput = {
      recipe: engineRecipe,
      targetVolumeLiters: targetVolume,
      skuSizeLiters: skuSize,
      overrunPct: overrun,
      lossPct: loss,
      mixDensity: density,
    };"""
new_engine_input = """const input: ProductionInput = {
      recipe: engineRecipe,
      targetVolumeLiters: targetVolume,
      skuSizeLiters: skuSize,
      overrunPct: overrun,
      lossPct: loss,
      mixDensity: density,
      fillWeightG: fillWeightG || undefined,
      wasteFactorPct: wasteFactorPct || undefined,
      machineCapacityKgPerHour: machineCapacity || undefined,
      packagingItems: packagingItems.length > 0 ? packagingItems : undefined,
    };"""
content = content.replace(engine_input, new_engine_input)

# Effect deps
deps = """}, [
    selectedRecipeId,
    targetVolume,
    skuSize,
    overrun,
    loss,
    density,
    recipes,
    passedRecipe,
  ]);"""
new_deps = """}, [
    selectedRecipeId,
    targetVolume,
    skuSize,
    overrun,
    loss,
    density,
    fillWeightG,
    wasteFactorPct,
    machineCapacity,
    packagingItems,
    recipes,
    passedRecipe,
  ]);"""
content = content.replace(deps, new_deps)

# UI Form
ui_form_insertion_point = """<div className="space-y-2">
              <Label>Mix Density (kg/L)</Label>"""
advanced_ui = """<div className="pt-4 border-t space-y-4">
              <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Advanced Parameters</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Fill Weight (g)</Label>
                  <Input
                    type="number"
                    value={fillWeightGStr !== null ? fillWeightGStr : (fillWeightG || '')}
                    onChange={e => {
                      let v = e.target.value;
                      if (v.length > 1 && v.startsWith('0') && v[1] !== '.') v = v.replace(/^0+/, '');
                      setFillWeightGStr(v);
                      const parsed = parseFloat(v);
                      if (!isNaN(parsed)) setFillWeightG(parsed);
                    }}
                    onBlur={() => setFillWeightGStr(null)}
                    min={0}
                    placeholder="e.g. 450"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Waste Factor %</Label>
                  <Input
                    type="number"
                    value={wasteFactorPctStr !== null ? wasteFactorPctStr : (wasteFactorPct || '')}
                    onChange={e => {
                      let v = e.target.value;
                      if (v.length > 1 && v.startsWith('0') && v[1] !== '.') v = v.replace(/^0+/, '');
                      setWasteFactorPctStr(v);
                      const parsed = parseFloat(v);
                      if (!isNaN(parsed)) setWasteFactorPct(parsed);
                    }}
                    onBlur={() => setWasteFactorPctStr(null)}
                    min={0}
                    placeholder="Trim waste"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Machine Capacity (Kg/hr mix input)</Label>
                <Input
                  type="number"
                  value={machineCapacityStr !== null ? machineCapacityStr : (machineCapacity || '')}
                  onChange={e => {
                    let v = e.target.value;
                    if (v.length > 1 && v.startsWith('0') && v[1] !== '.') v = v.replace(/^0+/, '');
                    setMachineCapacityStr(v);
                    const parsed = parseFloat(v);
                    if (!isNaN(parsed)) setMachineCapacity(parsed);
                  }}
                  onBlur={() => setMachineCapacityStr(null)}
                  min={0}
                  placeholder="e.g. 150"
                />
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <Label>Packaging Components</Label>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-7 text-xs px-2"
                    onClick={() => setPackagingItems([...packagingItems, {name: '', unitsNeededPerSku: 1}])}
                  >
                    <Plus className="h-3 w-3 mr-1"/> Add Item
                  </Button>
                </div>
                {packagingItems.map((item, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <Input 
                      placeholder="Name (e.g. Tub)" 
                      value={item.name} 
                      onChange={(e) => {
                        const newItems = [...packagingItems];
                        newItems[i].name = e.target.value;
                        setPackagingItems(newItems);
                      }}
                      className="h-8"
                    />
                    <Input 
                      type="number"
                      placeholder="Qty/SKU" 
                      value={item.unitsNeededPerSku || ''} 
                      onChange={(e) => {
                        const newItems = [...packagingItems];
                        newItems[i].unitsNeededPerSku = parseFloat(e.target.value) || 0;
                        setPackagingItems(newItems);
                      }}
                      className="h-8 w-24"
                    />
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => {
                      setPackagingItems(packagingItems.filter((_, index) => index !== i));
                    }}>
                      <X className="h-4 w-4"/>
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Mix Density (kg/L)</Label>"""
content = content.replace(ui_form_insertion_point, advanced_ui)


# UI Output - Estimated Run Time & Units
# Replace the middle card
card_middle = """<Card>
              <CardContent className="pt-6 text-center">
                <div className="text-4xl font-bold mb-1">
                  {result ? formatNumber(result.skuStats.plannedVolume) : "-"}{" "}
                  <span className="text-base text-muted-foreground font-normal">
                    L
                  </span>
                </div>
                <div className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  Planned Frozen Vol
                </div>
              </CardContent>
            </Card>"""

new_card_middle = """<Card>
              <CardContent className="pt-6 text-center flex flex-col h-full justify-center relative">
                <div className="text-4xl font-bold mb-1">
                  {result ? formatNumber(result.skuStats.plannedVolume) : "-"}{" "}
                  <span className="text-base text-muted-foreground font-normal">L</span>
                </div>
                <div className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
                  Planned Frozen Vol
                </div>
                
                {result?.skuStats.unitsFromFillWeight !== undefined && (
                  <div className="mt-auto pt-2 border-t">
                    <div className="text-lg font-bold text-primary">{result.skuStats.unitsFromFillWeight}</div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wider">Units (By Fill Wt)</div>
                  </div>
                )}
              </CardContent>
            </Card>"""
content = content.replace(card_middle, new_card_middle)

card_right = """<Card className="bg-secondary/50">
              <CardContent className="pt-6 text-center">
                <div className="text-4xl font-bold mb-1">
                  {result ? formatNumber(result.skuStats.mixRequiredKg) : "-"}{" "}
                  <span className="text-base text-muted-foreground font-normal">
                    kg
                  </span>
                </div>
                <div className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  Mix Required
                </div>
                {result && (
                  <div className="text-xs text-muted-foreground mt-1">
                    Inc. {loss}% loss
                  </div>
                )}
              </CardContent>
            </Card>"""

new_card_right = """<Card className="bg-secondary/50">
              <CardContent className="pt-6 text-center flex flex-col h-full justify-center">
                <div className="text-4xl font-bold mb-1">
                  {result ? formatNumber(result.skuStats.mixRequiredKg) : "-"}{" "}
                  <span className="text-base text-muted-foreground font-normal">kg</span>
                </div>
                <div className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  Mix Required
                </div>
                {result && (
                  <div className="text-xs text-muted-foreground mt-1 mb-2">
                    Inc. {loss}% loss {wasteFactorPct > 0 && `& ${wasteFactorPct}% waste`}
                  </div>
                )}
                
                {(result?.skuStats.expectedWasteKg !== undefined || result?.skuStats.estimatedRunTimeHours !== undefined) && (
                   <div className="mt-auto pt-2 border-t border-primary/10 grid grid-cols-2 gap-2 text-left">
                     {result?.skuStats.expectedWasteKg !== undefined && (
                       <div>
                         <div className="text-xs text-muted-foreground">Est. Waste</div>
                         <div className="text-sm font-semibold">{formatNumber(result.skuStats.expectedWasteKg)} kg</div>
                       </div>
                     )}
                     {result?.skuStats.estimatedRunTimeHours !== undefined && (
                       <div>
                         <div className="text-xs text-muted-foreground">Run Time</div>
                         <div className="text-sm font-semibold">{formatNumber(result.skuStats.estimatedRunTimeHours)} hrs</div>
                       </div>
                     )}
                   </div>
                )}
              </CardContent>
            </Card>"""
content = content.replace(card_right, new_card_right)

# Add Packaging Results Table below Batch Table
batch_table = """</CardContent>
          </Card>"""

packaging_table = """</CardContent>
          </Card>

          {/* Packaging Requirements */}
          {result?.packagingRequirements && result.packagingRequirements.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Packaging Requirements</CardTitle>
                <CardDescription>
                  Calculated using {Math.max(result.skuStats.totalUnits, result.skuStats.unitsFromFillWeight || 0)} total units.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead className="text-right">Total Quantity Needed</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.packagingRequirements.map((req, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{req.name || 'Unnamed Item'}</TableCell>
                        <TableCell className="text-right font-mono text-base">
                          {req.totalUnits.toLocaleString('en-US')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}"""

# Replace only the first occurrence of `</CardContent>\n          </Card>` which is the end of the batch table.
content = content.replace(batch_table, packaging_table, 1)


with open("src/pages/QuickProductionPlan.tsx", "w", encoding="utf-8") as f:
    f.write(content)
