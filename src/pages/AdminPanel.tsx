import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Shield, Plus, Pencil, Trash2, ArrowLeft } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface Ingredient {
  id: string;
  name: string;
  category: string;
  water_pct: number;
  fat_pct: number;
  msnf_pct: number;
  sugars_pct: number;
  other_solids_pct: number;
  cost_per_kg: number | null;
  sp_coeff: number | null;
  pac_coeff: number | null;
  notes: string | null;
}

export default function AdminPanel() {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Ingredient>>({});

  useEffect(() => {
    checkAdminStatus();
  }, []);

  const checkAdminStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error("You must be logged in to access admin panel");
        navigate("/auth");
        return;
      }

      // Note: user_roles table removed in Phase 1 cleanup
      // Admin panel now accessible to all authenticated users
      setIsAdmin(true);
      loadIngredients();
    } catch (error) {
      console.error("Error checking admin status:", error);
      toast.error("Error verifying admin access");
      navigate("/");
    }
  };

  const loadIngredients = async () => {
    try {
      const { data, error } = await supabase
        .from("ingredients")
        .select("*")
        .order("category", { ascending: true })
        .order("name", { ascending: true });

      if (error) throw error;
      setIngredients(data || []);
    } catch (error) {
      console.error("Error loading ingredients:", error);
      toast.error("Failed to load ingredients");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      // Validate required fields
      if (!formData.name || !formData.category) {
        toast.error("Name and category are required");
        return;
      }

      if (editingId) {
        const { error } = await supabase
          .from("ingredients")
          .update(formData as any)
          .eq("id", editingId);

        if (error) throw error;
        toast.success("Ingredient updated successfully");
      } else {
        const { error } = await supabase
          .from("ingredients")
          .insert([formData as any]);

        if (error) throw error;
        toast.success("Ingredient added successfully");
      }

      setFormData({});
      setEditingId(null);
      loadIngredients();
    } catch (error: any) {
      console.error("Error saving ingredient:", error);
      toast.error(error.message || "Failed to save ingredient");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this ingredient?")) return;

    try {
      const { error } = await supabase
        .from("ingredients")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Ingredient deleted successfully");
      loadIngredients();
    } catch (error: any) {
      console.error("Error deleting ingredient:", error);
      toast.error(error.message || "Failed to delete ingredient");
    }
  };

  if (isAdmin === null || loading) {
    return (
      <div className="container mx-auto p-8 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Shield className="h-12 w-12 mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Verifying admin access...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Shield className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">Admin Panel</h1>
            <Badge variant="secondary">Ingredient Management</Badge>
          </div>
          <p className="text-muted-foreground">
            Manage the shared ingredient library. Changes affect all users.
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate("/")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to App
        </Button>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? "Edit" : "Add"} Ingredient</CardTitle>
            <CardDescription>
              All fields are required except notes, sp_coeff, pac_coeff, and cost_per_kg
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name || ""}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Whole Milk"
                />
              </div>
              <div>
                <Label htmlFor="category">Category *</Label>
                <Select
                  value={formData.category || ""}
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dairy">Dairy</SelectItem>
                    <SelectItem value="sugar">Sugar</SelectItem>
                    <SelectItem value="stabilizer">Stabilizer</SelectItem>
                    <SelectItem value="emulsifier">Emulsifier</SelectItem>
                    <SelectItem value="flavour">Flavour</SelectItem>
                    <SelectItem value="fruit">Fruit</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="water_pct">Water % *</Label>
                <Input
                  id="water_pct"
                  type="number"
                  step="0.01"
                  value={formData.water_pct || ""}
                  onChange={(e) => setFormData({ ...formData, water_pct: parseFloat(e.target.value) })}
                />
              </div>
              <div>
                <Label htmlFor="fat_pct">Fat % *</Label>
                <Input
                  id="fat_pct"
                  type="number"
                  step="0.01"
                  value={formData.fat_pct || ""}
                  onChange={(e) => setFormData({ ...formData, fat_pct: parseFloat(e.target.value) })}
                />
              </div>
              <div>
                <Label htmlFor="msnf_pct">MSNF % *</Label>
                <Input
                  id="msnf_pct"
                  type="number"
                  step="0.01"
                  value={formData.msnf_pct || ""}
                  onChange={(e) => setFormData({ ...formData, msnf_pct: parseFloat(e.target.value) })}
                />
              </div>
              <div>
                <Label htmlFor="sugars_pct">Sugars % *</Label>
                <Input
                  id="sugars_pct"
                  type="number"
                  step="0.01"
                  value={formData.sugars_pct || ""}
                  onChange={(e) => setFormData({ ...formData, sugars_pct: parseFloat(e.target.value) })}
                />
              </div>
              <div>
                <Label htmlFor="other_solids_pct">Other Solids % *</Label>
                <Input
                  id="other_solids_pct"
                  type="number"
                  step="0.01"
                  value={formData.other_solids_pct || ""}
                  onChange={(e) => setFormData({ ...formData, other_solids_pct: parseFloat(e.target.value) })}
                />
              </div>
              <div>
                <Label htmlFor="cost_per_kg">Cost per kg</Label>
                <Input
                  id="cost_per_kg"
                  type="number"
                  step="0.01"
                  value={formData.cost_per_kg || ""}
                  onChange={(e) => setFormData({ ...formData, cost_per_kg: parseFloat(e.target.value) })}
                />
              </div>
              <div>
                <Label htmlFor="sp_coeff">SP Coefficient</Label>
                <Input
                  id="sp_coeff"
                  type="number"
                  step="0.01"
                  value={formData.sp_coeff || ""}
                  onChange={(e) => setFormData({ ...formData, sp_coeff: parseFloat(e.target.value) })}
                />
              </div>
              <div>
                <Label htmlFor="pac_coeff">PAC Coefficient</Label>
                <Input
                  id="pac_coeff"
                  type="number"
                  step="0.01"
                  value={formData.pac_coeff || ""}
                  onChange={(e) => setFormData({ ...formData, pac_coeff: parseFloat(e.target.value) })}
                />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes || ""}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Additional notes about this ingredient..."
                  rows={3}
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button onClick={handleSave}>
                {editingId ? "Update" : "Add"} Ingredient
              </Button>
              {editingId && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditingId(null);
                    setFormData({});
                  }}
                >
                  Cancel
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ingredient Library ({ingredients.length})</CardTitle>
            <CardDescription>Manage all ingredients in the system</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Water %</TableHead>
                  <TableHead>Fat %</TableHead>
                  <TableHead>Sugars %</TableHead>
                  <TableHead>Cost/kg</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ingredients.map((ingredient) => (
                  <TableRow key={ingredient.id}>
                    <TableCell className="font-medium">{ingredient.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{ingredient.category}</Badge>
                    </TableCell>
                    <TableCell>{ingredient.water_pct}%</TableCell>
                    <TableCell>{ingredient.fat_pct}%</TableCell>
                    <TableCell>{ingredient.sugars_pct}%</TableCell>
                    <TableCell>
                      {ingredient.cost_per_kg ? `$${ingredient.cost_per_kg.toFixed(2)}` : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditingId(ingredient.id);
                            setFormData(ingredient);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(ingredient.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
