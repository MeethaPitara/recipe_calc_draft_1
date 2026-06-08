import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useIngredients } from "@/contexts/IngredientsContext";
import { IngredientService } from "@/services/ingredientService";
import { Plus, Loader2, Scan } from "lucide-react";
import type { IngredientData, VerificationStatus } from "@/types/ingredients";
import { apiPost } from "@/lib/apiClient";

interface AddIngredientDialogProps {
  onIngredientAdded?: (ingredient: IngredientData) => void;
  trigger?: React.ReactNode;
  hideTrigger?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  prefilledData?: Partial<IngredientData>;
}

export function AddIngredientDialog({
  onIngredientAdded,
  trigger,
  hideTrigger,
  open: controlledOpen,
  onOpenChange: externalOnOpenChange,
  prefilledData,
}: AddIngredientDialogProps) {
  const { toast } = useToast();
  const { refetch } = useIngredients();
  const [isLoading, setIsLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : undefined;

  const handleOpenChange = (newOpen: boolean) => {
    if (externalOnOpenChange) {
      externalOnOpenChange(newOpen);
    }
  };

  const [formData, setFormData] = useState({
    name: prefilledData?.name || "",
    category: (prefilledData?.category ||
      "other") as IngredientData["category"],
    water_pct: prefilledData?.water_pct || 0,
    sugars_pct: prefilledData?.sugars_pct || 0,
    fat_pct: prefilledData?.fat_pct || 0,
    msnf_pct: prefilledData?.msnf_pct || 0,
    other_solids_pct: prefilledData?.other_solids_pct || 0,
    sp_coeff: prefilledData?.sp_coeff,
    pac_coeff: prefilledData?.pac_coeff,
    cost_per_kg: prefilledData?.cost_per_kg,
    notes: prefilledData?.notes || ([] as string[]),
    tags: prefilledData?.tags || ([] as string[]),
    lactose_pct: prefilledData?.lactose_pct || 0,
    verification_status: (prefilledData?.verification_status ||
      "user_entered") as VerificationStatus,
    verified_source: prefilledData?.verified_source || "",
    supplier_data_sheet_url: prefilledData?.supplier_data_sheet_url || "",
    formulation_warnings:
      prefilledData?.formulation_warnings || ([] as string[]),
  });

  // Update form when prefilledData changes
  useEffect(() => {
    if (prefilledData) {
      setFormData({
        name: prefilledData.name || "",
        category: (prefilledData.category ||
          "other") as IngredientData["category"],
        water_pct: prefilledData.water_pct || 0,
        sugars_pct: prefilledData.sugars_pct || 0,
        fat_pct: prefilledData.fat_pct || 0,
        msnf_pct: prefilledData.msnf_pct || 0,
        other_solids_pct: prefilledData.other_solids_pct || 0,
        sp_coeff: prefilledData.sp_coeff,
        pac_coeff: prefilledData.pac_coeff,
        cost_per_kg: prefilledData.cost_per_kg,
        notes: prefilledData.notes || [],
        tags: prefilledData.tags || [],
        lactose_pct: prefilledData.lactose_pct || 0,
        verification_status: (prefilledData.verification_status ||
          "user_entered") as VerificationStatus,
        verified_source: prefilledData.verified_source || "",
        supplier_data_sheet_url: prefilledData.supplier_data_sheet_url || "",
        formulation_warnings: prefilledData.formulation_warnings || [],
      });
    }
  }, [prefilledData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setIsLoading(true);
    try {
      const newIngredient = await IngredientService.addIngredient(formData);

      toast({
        title: "Success",
        description: `${formData.name} has been added to the database.`,
      });

      // Refresh global ingredients list
      await refetch();

      if (onIngredientAdded) {
        onIngredientAdded(newIngredient);
      }

      // Force a small delay to ensure the dialog closes smoothly
      setTimeout(() => {
        // Reset form
        setFormData({
          name: "",
          category: "other",
          water_pct: 0,
          sugars_pct: 0,
          fat_pct: 0,
          msnf_pct: 0,
          other_solids_pct: 0,
          sp_coeff: undefined,
          pac_coeff: undefined,
          cost_per_kg: undefined,
          notes: [],
          tags: [],
          lactose_pct: 0,
          verification_status: "user_entered" as VerificationStatus,
          verified_source: "",
          supplier_data_sheet_url: "",
          formulation_warnings: [],
        });
      }, 100);

      handleOpenChange(false);
    } catch (error) {
      console.error("Error adding ingredient:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to add ingredient",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleScanImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        try {
          const base64Data = reader.result?.toString().split(",")[1];
          const mimeType = file.type;
          if (!base64Data) throw new Error("Failed to read image");

          const prompt = `Analyze this nutrition label and return ONLY a valid JSON object matching this structure EXACTLY. Do not include markdown code block syntax (like \`\`\`json). Just the raw JSON brackets.

{
  "name": "derived from the brand or main ingredient name if available",
  "category": "Pick one: dairy, sugar, stabilizer, fruit, flavor, fat, other",
  "water_pct": 0,
  "sugars_pct": 0,
  "fat_pct": 0,
  "msnf_pct": 0,
  "other_solids_pct": 0,
  "lactose_pct": 0
}

Calculations rules (per 100g or 100ml):
1. fat_pct = Total Fat per 100g
2. sugars_pct = Total Sugars per 100g
3. msnf_pct = (For dairy items only) Protein per 100g + Lactose per 100g + ~1% ash.
4. other_solids_pct = Total Carbohydrate - Total Sugars + Dietary Fiber + Protein (for non-dairy only).
5. water_pct = 100 - (fat_pct + sugars_pct + msnf_pct + other_solids_pct).
6. Convert all values to percentages of the total (per 100g equivalent).
If a value is not explicitly on the label, derive it reasonably according to the ingredients or default to 0. Make sure the total of water_pct + sugars_pct + fat_pct + msnf_pct + other_solids_pct sum to closely 100.`;

          const response = await apiPost<{ result: string }>("/api/ai/vision", {
            systemPrompt:
              "You are a specialized AI nutrition label analyzer for a Gelato formulation app. Return ONLY raw JSON.",
            userPrompt: prompt,
            base64Image: base64Data,
            mimeType,
          });

          const responseText = response.result;

          let data;
          try {
            const cleanJson = responseText
              .replace(/```json/i, "")
              .replace(/```/g, "")
              .trim();
            data = JSON.parse(cleanJson);
          } catch (err) {
            throw new Error(
              "Failed to parse JSON out of response: " + responseText,
            );
          }

          setFormData((prev) => ({
            ...prev,
            name: data.name || prev.name,
            category: data.category || prev.category,
            water_pct: data.water_pct || 0,
            sugars_pct: data.sugars_pct || 0,
            fat_pct: data.fat_pct || 0,
            msnf_pct: data.msnf_pct || 0,
            other_solids_pct: data.other_solids_pct || 0,
            lactose_pct: data.lactose_pct || 0,
          }));

          toast({
            title: "Scan Complete",
            description:
              "Nutrition values have been auto-filled from the label.",
          });
        } catch (err: any) {
          toast({
            title: "Scanning Failed",
            description: err?.message || "Could not analyze the image",
            variant: "destructive",
          });
          console.error(err);
        } finally {
          setIsScanning(false);
          if (fileInputRef.current) fileInputRef.current.value = "";
        }
      };
      reader.onerror = () => {
        throw new Error("Error reading file");
      };
    } catch (err: any) {
      toast({
        title: "Scanning Failed",
        description: err?.message || "Could not analyze the image",
        variant: "destructive",
      });
      setIsScanning(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const totalComposition =
    formData.water_pct +
    formData.sugars_pct +
    formData.fat_pct +
    formData.msnf_pct +
    formData.other_solids_pct;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {!hideTrigger && (
        <DialogTrigger asChild>
          {trigger || (
            <Button variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-2" />
             Add New Ingredient
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-background border shadow-lg">
        <DialogHeader>
          <div className="flex flex-row justify-between items-start gap-4">
            <div>
              <DialogTitle>Add New Ingredient</DialogTitle>
              <DialogDescription>
               Create a new ingredient with its composition data.
              </DialogDescription>
            </div>
            <div className="shrink-0 pt-1">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                ref={fileInputRef}
                onChange={handleScanImage}
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isScanning}
              >
                {isScanning ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Scan className="h-4 w-4 mr-2" />
                )}
                {isScanning ? "Scanning..." : "Scan Label"}
              </Button>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label htmlFor="name">Ingredient Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="e.g., Whole Milk"
                required
              />
            </div>

            <div className="col-span-2">
              <Label htmlFor="category">Category *</Label>
              <Select
                value={formData.category}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    category: value as IngredientData["category"],
                  })
                }
              >
                <SelectTrigger className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dairy">Dairy</SelectItem>
                  <SelectItem value="sugar">Sugar</SelectItem>
                  <SelectItem value="stabilizer">Stabilizer</SelectItem>
                  <SelectItem value="fruit">Fruit</SelectItem>
                  <SelectItem value="flavor">Flavor</SelectItem>
                  <SelectItem value="fat">Fat</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="water">Water %</Label>
              <Input
                id="water"
                type="number"
                step="0.01"
                value={formData.water_pct || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    water_pct: parseFloat(e.target.value) || 0,
                  })
                }
              />
            </div>

            <div>
              <Label htmlFor="sugars">Sugars %</Label>
              <Input
                id="sugars"
                type="number"
                step="0.01"
                value={formData.sugars_pct || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    sugars_pct: parseFloat(e.target.value) || 0,
                  })
                }
              />
            </div>

            <div>
              <Label htmlFor="fat">Fat %</Label>
              <Input
                id="fat"
                type="number"
                step="0.01"
                value={formData.fat_pct || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    fat_pct: parseFloat(e.target.value) || 0,
                  })
                }
              />
            </div>

            <div>
              <Label htmlFor="msnf">MSNF %</Label>
              <Input
                id="msnf"
                type="number"
                step="0.01"
                value={formData.msnf_pct || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    msnf_pct: parseFloat(e.target.value) || 0,
                  })
                }
              />
            </div>

            <div>
              <Label htmlFor="lactose">Lactose %</Label>
              <Input
                id="lactose"
                type="number"
                step="0.01"
                value={formData.lactose_pct || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    lactose_pct: parseFloat(e.target.value) || 0,
                  })
                }
              />
            </div>

            <div className="col-span-2">
              <Label htmlFor="other_solids">Other Solids %</Label>
              <Input
                id="other_solids"
                type="number"
                step="0.01"
                value={formData.other_solids_pct}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    other_solids_pct: parseFloat(e.target.value) || 0,
                  })
                }
              />
            </div>

            <div>
              <Label htmlFor="sp_coeff">SP Coefficient (optional)</Label>
              <Input
                id="sp_coeff"
                type="number"
                step="0.01"
                placeholder="e.g., 1.0"
                value={formData.sp_coeff || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    sp_coeff: e.target.value
                      ? parseFloat(e.target.value)
                      : undefined,
                  })
                }
              />
            </div>

            <div>
              <Label htmlFor="pac_coeff">PAC Coefficient (optional)</Label>
              <Input
                id="pac_coeff"
                type="number"
                step="0.01"
                placeholder="e.g., 1.0"
                value={formData.pac_coeff || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    pac_coeff: e.target.value
                      ? parseFloat(e.target.value)
                      : undefined,
                  })
                }
              />
            </div>

            <div className="col-span-2">
              <Label htmlFor="cost">Cost per Kg (optional)</Label>
              <Input
                id="cost"
                type="number"
                step="0.01"
                placeholder="e.g., 250.00"
                value={formData.cost_per_kg || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    cost_per_kg: e.target.value
                      ? parseFloat(e.target.value)
                      : undefined,
                  })
                }
              />
            </div>

            <div className="col-span-2">
              <Label htmlFor="tags">Tags (comma-separated, optional)</Label>
              <Input
                id="tags"
                placeholder="e.g., organic, premium"
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    tags: e.target.value
                      .split(",")
                      .map((t) => t.trim())
                      .filter((t) => t),
                  })
                }
              />
            </div>

            <div className="col-span-2">
              <Label htmlFor="verification_status">
               Data Verification Status
              </Label>
              <Select
                value={formData.verification_status}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    verification_status: value as VerificationStatus,
                  })
                }
              >
                <SelectTrigger className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="verified">
                   Verified — Checked and usable
                  </SelectItem>
                  <SelectItem value="supplier_data">
                   Supplier Data — Based on spec sheet
                  </SelectItem>
                  <SelectItem value="lab_tested">
                   Lab Tested — Based on lab testing
                  </SelectItem>
                  <SelectItem value="estimated">
                   Estimated — Use carefully
                  </SelectItem>
                  <SelectItem value="ai_estimated">
                   AI Estimated — Not final
                  </SelectItem>
                  <SelectItem value="user_entered">
                   User Entered — Needs review
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2">
              <Label htmlFor="supplier_data_sheet_url">
               Supplier Data Sheet URL (optional)
              </Label>
              <Input
                id="supplier_data_sheet_url"
                placeholder="https://..."
                value={formData.supplier_data_sheet_url}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    supplier_data_sheet_url: e.target.value,
                  })
                }
              />
            </div>

            <div className="col-span-2">
              <Label htmlFor="formulation_warnings">
               Formulation Warnings (comma-separated, optional)
              </Label>
              <Input
                id="formulation_warnings"
                placeholder="e.g., High acid, Contains nuts"
                value={formData.formulation_warnings?.join(", ")}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    formulation_warnings: e.target.value
                      .split(",")
                      .map((t) => t.trim())
                      .filter((t) => t),
                  })
                }
              />
              {formData.formulation_warnings &&
                formData.formulation_warnings.length > 0 && (
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {formData.formulation_warnings.map((w, i) => (
                      <Badge key={i} variant="destructive">
                        {w}
                      </Badge>
                    ))}
                  </div>
                )}
            </div>

            <div className="col-span-2">
              <Label htmlFor="verified_source">Data Source (optional)</Label>
              <Input
                id="verified_source"
                placeholder="e.g., Amul spec sheet, NDDB lab report"
                value={formData.verified_source}
                onChange={(e) =>
                  setFormData({ ...formData, verified_source: e.target.value })
                }
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
             Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !formData.name}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                 Adding...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                 Add Ingredient
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
