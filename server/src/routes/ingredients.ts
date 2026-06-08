/**
 * Ingredients Routes
 * Migrated from src/services/ingredientService.ts
 *
 * GET    /api/ingredients         — List all
 * GET    /api/ingredients/search  — Search
 * GET    /api/ingredients/:id     — Get by ID
 * POST   /api/ingredients         — Create
 * PUT    /api/ingredients/:id     — Update
 * DELETE /api/ingredients/:id     — Delete
 */

import { Router } from "express";
import { supabase } from "../lib/supabaseClient.js";
import { requireAuth, optionalAuth } from "../middleware/auth.js";

const router = Router();

// ── GET / — List all ingredients ──
router.get("/", optionalAuth as any, async (req, res) => {
  try {
    const userEmail = req.user?.email;

    let query = supabase.from("ingredients").select("*").order("name");

    // Show system ingredients + user's own
    if (userEmail) {
      query = query.or(`user_email.is.null,user_email.eq.${userEmail}`);
    }

    const { data, error } = await query;
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    // Transform DB rows → frontend IngredientData shape
    const ingredients = (data || []).map(transformRow);
    res.json(ingredients);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /search?q= ──
router.get("/search", optionalAuth as any, async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    if (!q) {
      res.json([]);
      return;
    }

    const { data, error } = await supabase
      .from("ingredients")
      .select("*")
      .ilike("name", `%${q}%`)
      .order("name")
      .limit(20);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json((data || []).map(transformRow));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /:id ──
router.get("/:id", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("ingredients")
      .select("*")
      .eq("id", req.params.id)
      .single();

    if (error || !data) {
      res.status(404).json({ error: "Ingredient not found" });
      return;
    }

    res.json(transformRow(data));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST / — Create ──
router.post("/", requireAuth as any, async (req, res) => {
  try {
    const {
      name,
      category,
      fat_pct,
      msnf_pct,
      sugars_pct,
      water_pct,
      other_solids_pct,
      sp_coeff,
      pac_coeff,
      cost_per_kg,
      lactose_pct,
      verification_status,
      verified_at,
      verified_source,
      supplier_data_sheet_url,
      formulation_warnings,
    } = req.body;

    if (!name) {
      res.status(400).json({ error: "Ingredient name is required." });
      return;
    }

    const insertData: Record<string, any> = {
      name,
      category: category || "other",
      fat_pct: fat_pct || 0,
      msnf_pct: msnf_pct || 0,
      sugars_pct: sugars_pct || 0,
      water_pct: water_pct || 0,
      other_solids_pct: other_solids_pct || 0,
      user_email: req.user!.email,
      verification_status: verification_status || "user_entered",
    };

    if (sp_coeff != null) insertData.sp_coeff = sp_coeff;
    if (pac_coeff != null) insertData.pac_coeff = pac_coeff;
    if (cost_per_kg != null) insertData.cost_per_kg = cost_per_kg;
    if (lactose_pct != null) insertData.lactose_pct = lactose_pct;
    if (verified_at != null) insertData.verified_at = verified_at;
    if (verified_source != null) insertData.verified_source = verified_source;
    if (supplier_data_sheet_url !== undefined)
      insertData.supplier_data_sheet_url = supplier_data_sheet_url;
    if (formulation_warnings !== undefined)
      insertData.formulation_warnings = formulation_warnings;

    const { data, error } = await supabase
      .from("ingredients")
      .insert(insertData)
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.status(201).json(transformRow(data));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── PUT /:id — Update ──
router.put("/:id", requireAuth as any, async (req, res) => {
  try {
    const updates: Record<string, any> = {};
    const fields = [
      "name",
      "category",
      "fat_pct",
      "msnf_pct",
      "sugars_pct",
      "water_pct",
      "other_solids_pct",
      "sp_coeff",
      "pac_coeff",
      "cost_per_kg",
      "lactose_pct",
      "verification_status",
      "verified_at",
      "verified_source",
      "supplier_data_sheet_url",
      "formulation_warnings",
    ];

    for (const field of fields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    // --- Version History Snapshot ---
    // 1. Fetch current state
    const { data: currentState, error: fetchErr } = await supabase
      .from("ingredients")
      .select("*")
      .eq("id", req.params.id)
      .single();

    if (currentState && !fetchErr) {
      // 2. Get max version number for this ingredient
      const { data: versionsData } = await supabase
        .from("ingredient_versions")
        .select("version_number")
        .eq("ingredient_id", req.params.id)
        .order("version_number", { ascending: false })
        .limit(1);

      const nextVersion =
        versionsData && versionsData.length > 0
          ? versionsData[0].version_number + 1
          : 1;

      // 3. Insert snapshot
      await supabase.from("ingredient_versions").insert({
        ingredient_id: req.params.id,
        version_number: nextVersion,
        snapshot: currentState,
        changed_by: req.user?.id || null,
      });
    }
    // --- End Version History ---

    const { data, error } = await supabase
      .from("ingredients")
      .update(updates)
      .eq("id", req.params.id)
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json(transformRow(data));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /:id/versions ──
router.get("/:id/versions", requireAuth as any, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("ingredient_versions")
      .select("id, version_number, snapshot, changed_at")
      .eq("ingredient_id", req.params.id)
      .order("version_number", { ascending: false });

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json(data || []);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── DELETE /:id ──
router.delete("/:id", requireAuth as any, async (req, res) => {
  try {
    const { error } = await supabase
      .from("ingredients")
      .delete()
      .eq("id", req.params.id);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Helper: transform DB row → frontend IngredientData shape ──
function transformRow(row: any) {
  const safeNum = (val: any, fallback = 0) =>
    typeof val === "number" && !isNaN(val) ? val : fallback;

  return {
    id: row.id,
    name: row.name,
    category: row.category || "other",
    fat_pct: safeNum(row.fat_pct),
    msnf_pct: safeNum(row.msnf_pct),
    sugars_pct: safeNum(row.sugars_pct ?? row.sugar_pct),
    water_pct: safeNum(row.water_pct),
    other_solids_pct: safeNum(row.other_solids_pct),
    sp_coeff: row.sp_coeff ?? undefined,
    pac_coeff: row.pac_coeff ?? undefined,
    cost_per_kg: row.cost_per_kg ?? undefined,
    lactose_pct: row.lactose_pct ?? undefined,
    user_email: row.user_email ?? undefined,
    verification_status: row.verification_status ?? undefined,
    verified_at: row.verified_at ?? undefined,
    verified_source: row.verified_source ?? undefined,
    supplier_data_sheet_url: row.supplier_data_sheet_url ?? undefined,
    formulation_warnings: row.formulation_warnings ?? undefined,
  };
}

export { router as ingredientsRouter };
