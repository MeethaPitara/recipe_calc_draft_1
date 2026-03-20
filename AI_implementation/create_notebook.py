"""
Script to generate reverse_engine_stage1.ipynb
Run: python AI_implementation/create_notebook.py
"""
import json, os

def code_cell(source, cell_id=None):
    return {
        "cell_type": "code",
        "execution_count": None,
        "metadata": {},
        "outputs": [],
        "source": source.split("\n") if isinstance(source, str) else source,
        "id": cell_id or ""
    }

def md_cell(source, cell_id=None):
    return {
        "cell_type": "markdown",
        "metadata": {},
        "source": source.split("\n") if isinstance(source, str) else source,
        "id": cell_id or ""
    }

# Fix: each line needs \n except the last
def fix_lines(cell):
    lines = cell["source"]
    if isinstance(lines, list) and len(lines) > 1:
        cell["source"] = [l + "\n" if i < len(lines)-1 else l for i, l in enumerate(lines)]
    return cell

cells = []

# ── Cell 1: Installs ──
cells.append(fix_lines(code_cell(
"""# Cell 1 — Install dependencies
# !pip install pulp pydantic langchain langchain-openai"""
, "cell-1")))

# ── Cell 2: Ingredient Database ──
cells.append(fix_lines(code_cell(
'''# Cell 2 — Ingredient Database
INGREDIENT_DB = {
    "Toned Milk 3%": {
        "fat_pct": 3.0, "msnf_pct": 8.5, "sugars_pct": 4.8,
        "water_pct": 87.7, "category": "dairy", "locked": False,
        "note": "Standard toned milk"
    },
    "Cream 25%": {
        "fat_pct": 25.0, "msnf_pct": 6.5, "sugars_pct": 3.0,
        "water_pct": 64.0, "category": "dairy", "locked": False,
        "note": "Dairy cream 25% fat"
    },
    "Skimmed Milk Powder": {
        "fat_pct": 0.1, "msnf_pct": 95.0, "sugars_pct": 51.0,
        "water_pct": 3.5, "category": "dairy_powder", "locked": False,
        "note": "SMP — high MSNF source"
    },
    "Condensed Milk Nestle": {
        "fat_pct": 8.0, "msnf_pct": 20.0, "sugars_pct": 55.0,
        "water_pct": 27.0, "category": "dairy", "locked": False,
        "note": "Sweetened condensed milk"
    },
    "Sucrose/sugar": {
        "fat_pct": 0.0, "msnf_pct": 0.0, "sugars_pct": 100.0,
        "water_pct": 0.0, "category": "sugar", "locked": False,
        "note": "Table sugar"
    },
    "Dextrose monohydrate": {
        "fat_pct": 0.0, "msnf_pct": 0.0, "sugars_pct": 91.0,
        "water_pct": 9.0, "category": "sugar", "locked": False,
        "note": "Dextrose mono — high sweetening power"
    },
    "Glucose Syrup (40-42DE)": {
        "fat_pct": 0.0, "msnf_pct": 0.0, "sugars_pct": 78.0,
        "water_pct": 22.0, "category": "sugar", "locked": False,
        "note": "Glucose syrup 40-42 DE"
    },
    "Stabilizer": {
        "fat_pct": 0.0, "msnf_pct": 0.0, "sugars_pct": 0.0,
        "water_pct": 5.0, "category": "stabilizer", "locked": True,
        "note": "Stabilizer blend — LOCKED"
    },
}

print(f"Loaded {len(INGREDIENT_DB)} ingredients into INGREDIENT_DB")
for name, props in INGREDIENT_DB.items():
    lock_tag = " 🔒" if props["locked"] else ""
    print(f"  • {name}: fat={props['fat_pct']}%, msnf={props['msnf_pct']}%, sugars={props['sugars_pct']}%{lock_tag}")'''
, "cell-2")))

# ── Cell 3: Pydantic Models ──
cells.append(fix_lines(code_cell(
'''# Cell 3 — Pydantic Models
from pydantic import BaseModel, Field
from typing import Optional

class IngredientEntry(BaseModel):
    fat_pct: float = 0.0
    msnf_pct: float = 0.0
    sugars_pct: float = 0.0
    water_pct: float = 0.0
    category: str = "other"
    locked: bool = False
    note: str = ""

class ProductionTargets(BaseModel):
    lossPct: float = Field(ge=0, le=20)
    mixDensity: float = Field(ge=0.9, le=1.2)
    overrunPct: float = Field(ge=0, le=150)
    skuSizeLiters: float = Field(gt=0)
    targetVolumeLiters: float = Field(gt=0)

class OptimizationTargets(BaseModel):
    fat_pct: Optional[float] = None
    msnf_pct: Optional[float] = None
    sugars_pct: Optional[float] = None

class BatchMetrics(BaseModel):
    gross_liquid_volume_L: float
    batch_mass_g: float
    n_skus: int
    scale_factor: float

class RecipeMetrics(BaseModel):
    total_mass_g: float
    fat_pct: float
    msnf_pct: float
    sugars_pct: float
    water_pct: float
    total_solids_pct: float

class IngredientDiff(BaseModel):
    ingredient: str
    original_g: float
    proposed_g: float
    delta_g: float
    delta_pct: float

class OptimizationResult(BaseModel):
    success: bool
    solver_status: str
    strategy: str
    batch: BatchMetrics
    metrics_before: RecipeMetrics
    metrics_after: RecipeMetrics
    original_recipe: dict
    proposed_recipe: dict
    diffs: list
    warnings: list
    message: str

print("✅ Pydantic models loaded.")'''
, "cell-3")))

# ── Cell 4: Batch Sizing ──
cells.append(fix_lines(code_cell(
'''# Cell 4 — Batch Sizing (Production Math)
import math

def compute_batch_sizing(
    recipe: list[dict],
    targets: ProductionTargets
) -> BatchMetrics:
    """
    Mirrors Level 1–3 production planning engine exactly.
    """
    pre_overrun_volume_L = targets.targetVolumeLiters / (1 + targets.overrunPct / 100)
    gross_liquid_volume_L = pre_overrun_volume_L / (1 - targets.lossPct / 100)
    batch_mass_g = gross_liquid_volume_L * 1000 * targets.mixDensity
    n_skus = math.ceil(targets.targetVolumeLiters / targets.skuSizeLiters)

    recipe_total_g = sum(item["quantity_g"] for item in recipe)
    scale_factor = batch_mass_g / recipe_total_g

    return BatchMetrics(
        gross_liquid_volume_L=round(gross_liquid_volume_L, 2),
        batch_mass_g=round(batch_mass_g, 2),
        n_skus=n_skus,
        scale_factor=round(scale_factor, 6)
    )

print("✅ compute_batch_sizing() ready.")'''
, "cell-4")))

# ── Cell 5: Recipe Metrics ──
cells.append(fix_lines(code_cell(
'''# Cell 5 — Recipe Metrics Calculator
def compute_recipe_metrics(recipe: dict[str, float]) -> RecipeMetrics:
    """
    Given {ingredient_name: grams}, compute nutritional metrics.
    """
    total = sum(recipe.values())
    if total == 0:
        return RecipeMetrics(total_mass_g=0, fat_pct=0, msnf_pct=0,
                             sugars_pct=0, water_pct=0, total_solids_pct=0)

    fat_g = msnf_g = sugars_g = water_g = 0.0
    for name, grams in recipe.items():
        ing = INGREDIENT_DB.get(name)
        if not ing:
            continue
        fat_g    += grams * ing["fat_pct"] / 100
        msnf_g   += grams * ing["msnf_pct"] / 100
        sugars_g += grams * ing["sugars_pct"] / 100
        water_g  += grams * ing["water_pct"] / 100

    return RecipeMetrics(
        total_mass_g=round(total, 2),
        fat_pct=round(fat_g / total * 100, 3),
        msnf_pct=round(msnf_g / total * 100, 3),
        sugars_pct=round(sugars_g / total * 100, 3),
        water_pct=round(water_g / total * 100, 3),
        total_solids_pct=round((1 - water_g / total) * 100, 3)
    )

print("✅ compute_recipe_metrics() ready.")'''
, "cell-5")))

# ── Cell 6: LP Optimizer ──
cells.append(fix_lines(code_cell(
'''# Cell 6 — LP Optimizer (PuLP / CBC)
from pulp import (
    LpProblem, LpMinimize, LpVariable, lpSum,
    PULP_CBC_CMD, LpStatus, value
)

# Mode-aware sugar caps from SUGAR_BOUNDS (TS port)
SUGAR_BOUNDS = {
    "gelato":    {"sucrose_max_pct": 22, "dextrose_max_pct": 8, "glucose_max_pct": 8},
    "ice_cream": {"sucrose_max_pct": 22, "dextrose_max_pct": 8, "glucose_max_pct": 8},
    "kulfi":     {"sucrose_max_pct": 20, "dextrose_max_pct": 6, "glucose_max_pct": 6},
    "sorbet":    {"sucrose_max_pct": 25, "dextrose_max_pct": 15, "glucose_max_pct": 12},
}

DEVIATION_WEIGHT = 10.0   # Pull hard toward targets
MOVEMENT_WEIGHT  = 0.001  # Prefer minimal ingredient changes

def run_lp_optimizer(
    scaled_recipe: dict[str, float],
    opt_targets: OptimizationTargets,
    mode: str = "gelato",
    mass_tolerance: float = 0.10,  # ±10% mass conservation
) -> dict:
    """
    LP solver ported from balanceRecipeLP() in optimize_balancer_v2.ts.
    Returns dict with keys: success, solver_status, proposed_recipe, warnings.
    """
    names = list(scaled_recipe.keys())
    initial = list(scaled_recipe.values())
    total_W = sum(initial)
    n = len(names)
    warnings = []

    prob = LpProblem("ReverseEngine_LP", LpMinimize)

    # Decision variables: grams per ingredient
    x = []
    pos = []
    neg = []
    bounds = SUGAR_BOUNDS.get(mode, SUGAR_BOUNDS["gelato"])

    for i, name in enumerate(names):
        ing = INGREDIENT_DB.get(name, {})
        locked = ing.get("locked", False)

        if locked:
            lo = initial[i]
            hi = initial[i]
        else:
            lo = 0
            hi = max(initial[i] * 5, 1500)

            # Sugar caps
            nm_lower = name.lower()
            if "sucrose" in nm_lower or nm_lower == "sucrose/sugar":
                hi = min(hi, total_W * bounds["sucrose_max_pct"] / 100)
            elif "dextrose" in nm_lower:
                hi = min(hi, total_W * bounds["dextrose_max_pct"] / 100)
            elif "glucose" in nm_lower:
                hi = min(hi, total_W * bounds["glucose_max_pct"] / 100)

        xi = LpVariable(f"x_{i}", lowBound=lo, upBound=hi)
        pi = LpVariable(f"pos_{i}", lowBound=0)
        ni = LpVariable(f"neg_{i}", lowBound=0)
        x.append(xi)
        pos.append(pi)
        neg.append(ni)

        # Movement linearisation: x_i - initial_i = pos_i - neg_i
        if not locked:
            prob += xi - initial[i] == pi - ni, f"move_{i}"
        else:
            prob += pi == 0, f"pos_lock_{i}"
            prob += ni == 0, f"neg_lock_{i}"

    # Slack variables for each active target
    fat_over   = LpVariable("fat_over", lowBound=0)
    fat_under  = LpVariable("fat_under", lowBound=0)
    msnf_over  = LpVariable("msnf_over", lowBound=0)
    msnf_under = LpVariable("msnf_under", lowBound=0)
    sug_over   = LpVariable("sug_over", lowBound=0)
    sug_under  = LpVariable("sug_under", lowBound=0)

    # ── Objective ──
    obj = MOVEMENT_WEIGHT * lpSum(pos[i] + neg[i] for i in range(n) if not INGREDIENT_DB.get(names[i], {}).get("locked", False))

    active_targets = 0
    if opt_targets.fat_pct is not None:
        obj += DEVIATION_WEIGHT * (fat_over + fat_under)
        active_targets += 1
    if opt_targets.msnf_pct is not None:
        obj += DEVIATION_WEIGHT * (msnf_over + msnf_under)
        active_targets += 1
    if opt_targets.sugars_pct is not None:
        obj += DEVIATION_WEIGHT * (sug_over + sug_under)
        active_targets += 1

    prob += obj, "total_cost"

    # ── Mass conservation ──
    prob += lpSum(x) >= total_W * (1 - mass_tolerance), "mass_lower"
    prob += lpSum(x) <= total_W * (1 + mass_tolerance), "mass_upper"

    # ── Composition equality constraints ──
    def coeff(i, field):
        return INGREDIENT_DB.get(names[i], {}).get(field, 0) / 100

    if opt_targets.fat_pct is not None:
        target_fat_g = (opt_targets.fat_pct / 100) * total_W
        prob += lpSum(x[i] * coeff(i, "fat_pct") for i in range(n)) - fat_over + fat_under == target_fat_g, "fat_eq"

    if opt_targets.msnf_pct is not None:
        target_msnf_g = (opt_targets.msnf_pct / 100) * total_W
        prob += lpSum(x[i] * coeff(i, "msnf_pct") for i in range(n)) - msnf_over + msnf_under == target_msnf_g, "msnf_eq"

    if opt_targets.sugars_pct is not None:
        target_sugars_g = (opt_targets.sugars_pct / 100) * total_W
        prob += lpSum(x[i] * coeff(i, "sugars_pct") for i in range(n)) - sug_over + sug_under == target_sugars_g, "sugars_eq"

    # ── Solve ──
    prob.solve(PULP_CBC_CMD(msg=0))

    status = LpStatus[prob.status]
    if status != "Optimal":
        return {
            "success": False,
            "solver_status": status,
            "proposed_recipe": dict(scaled_recipe),
            "warnings": [f"Solver status: {status}. Recipe unchanged."],
        }

    # Extract solution
    proposed = {}
    for i, name in enumerate(names):
        proposed[name] = max(0, value(x[i]))

    # Floating-point drift correction
    proposed_sum = sum(proposed.values())
    if abs(proposed_sum - total_W) > 1.0:
        factor = total_W / proposed_sum
        proposed = {k: v * factor for k, v in proposed.items()}
        warnings.append(f"Rescaled by {factor:.6f} to correct drift (Δ={proposed_sum - total_W:.2f}g)")

    return {
        "success": True,
        "solver_status": f"Optimal — Linear Programming (Simplex)",
        "proposed_recipe": proposed,
        "warnings": warnings,
    }

print("✅ run_lp_optimizer() ready.")'''
, "cell-6")))

# ── Cell 7: Instruction Parser ──
cells.append(fix_lines(code_cell(
'''# Cell 7 — Custom Instruction Parser
import re

def parse_instruction(instruction: str) -> OptimizationTargets:
    """
    Extract fat_pct, msnf_pct, sugars_pct from a plain-text instruction string.
    Returns OptimizationTargets with None for fields not mentioned.
    """
    text = instruction.lower().strip()
    targets = {}

    # Fat patterns: "fat to 8", "fat 8%", "increase fat to 8.5"
    fat_match = re.search(r"fat\\s*(?:to\\s*)?([\\d.]+)\\s*%?", text)
    if fat_match:
        targets["fat_pct"] = float(fat_match.group(1))

    # MSNF patterns: "msnf 10", "MSNF to 10.5%"
    msnf_match = re.search(r"msnf\\s*(?:to\\s*)?([\\d.]+)\\s*%?", text)
    if msnf_match:
        targets["msnf_pct"] = float(msnf_match.group(1))

    # Sugars patterns: "sugars 18", "sugar to 20%"
    sugars_match = re.search(r"sugars?\\s*(?:to\\s*)?([\\d.]+)\\s*%?", text)
    if sugars_match:
        targets["sugars_pct"] = float(sugars_match.group(1))

    return OptimizationTargets(**targets)

# Quick test
_test = parse_instruction("Increase fat to 8%, MSNF to 10%, sugars to 20%")
print(f"✅ parse_instruction() ready.  Test parse: {_test}")'''
, "cell-7")))

# ── Cell 8: Main Orchestrator ──
cells.append(fix_lines(code_cell(
'''# Cell 8 — Main Orchestrator
def run_reverse_engine(
    recipe: list[dict],
    production_targets: dict,
    custom_instruction: str,
    mode: str = "gelato"
) -> OptimizationResult:
    """
    Wires Steps 1-5: batch sizing → scale → parse → LP → diff.
    """
    warnings = []

    # ── Step 1: Batch sizing ──
    prod = ProductionTargets(**production_targets)
    batch = compute_batch_sizing(recipe, prod)

    # ── Step 2: Proportional scale ──
    scaled = {}
    for item in recipe:
        name = item["ingredient"]
        if name not in INGREDIENT_DB:
            warnings.append(f"⚠️ '{name}' not in INGREDIENT_DB — treated as inert")
        scaled[name] = item["quantity_g"] * batch.scale_factor

    metrics_before = compute_recipe_metrics(scaled)

    # ── Step 3: Parse custom instruction ──
    opt_targets = parse_instruction(custom_instruction)
    has_targets = any([opt_targets.fat_pct, opt_targets.msnf_pct, opt_targets.sugars_pct])

    if not has_targets:
        # Scale only — skip LP
        return OptimizationResult(
            success=True,
            solver_status="N/A — Scale Only",
            strategy="Proportional scaling only (no composition targets parsed)",
            batch=batch,
            metrics_before=metrics_before,
            metrics_after=metrics_before,
            original_recipe=dict(scaled),
            proposed_recipe=dict(scaled),
            diffs=[],
            warnings=warnings,
            message="Recipe scaled proportionally. No composition targets were specified."
        )

    # ── Step 4: LP Optimizer ──
    lp_result = run_lp_optimizer(scaled, opt_targets, mode=mode)
    proposed = lp_result["proposed_recipe"]
    warnings.extend(lp_result.get("warnings", []))

    metrics_after = compute_recipe_metrics(proposed)

    # ── Step 5: Diff calculation ──
    diffs = []
    for name in scaled:
        orig_g = scaled[name]
        prop_g = proposed.get(name, 0)
        delta_g = prop_g - orig_g
        if abs(delta_g) > 0.5:
            delta_pct = (delta_g / orig_g * 100) if orig_g > 0 else 0
            diffs.append(IngredientDiff(
                ingredient=name,
                original_g=round(orig_g, 2),
                proposed_g=round(prop_g, 2),
                delta_g=round(delta_g, 2),
                delta_pct=round(delta_pct, 2)
            ))

    diffs.sort(key=lambda d: abs(d.delta_g), reverse=True)

    strategy_parts = []
    if opt_targets.fat_pct is not None:
        strategy_parts.append(f"Fat→{opt_targets.fat_pct}%")
    if opt_targets.msnf_pct is not None:
        strategy_parts.append(f"MSNF→{opt_targets.msnf_pct}%")
    if opt_targets.sugars_pct is not None:
        strategy_parts.append(f"Sugars→{opt_targets.sugars_pct}%")

    return OptimizationResult(
        success=lp_result["success"],
        solver_status=lp_result["solver_status"],
        strategy=f"LP Optimization targeting {', '.join(strategy_parts)}",
        batch=batch,
        metrics_before=metrics_before,
        metrics_after=metrics_after,
        original_recipe=dict(scaled),
        proposed_recipe=proposed,
        diffs=[d.model_dump() for d in diffs],
        warnings=warnings,
        message="LP solver converged. Review proposed changes below." if lp_result["success"]
                else f"LP solver failed ({lp_result['solver_status']}). Showing scaled recipe."
    )

print("✅ run_reverse_engine() ready.")'''
, "cell-8")))

# ── Cell 9: Report + Apply ──
cells.append(fix_lines(code_cell(
'''# Cell 9 — Markdown Report + Apply Gate
from IPython.display import display, Markdown

def render_report(result: OptimizationResult):
    """Render a clean markdown report in Jupyter cell output."""
    lines = []
    b = result.batch
    mb = result.metrics_before
    ma = result.metrics_after

    # 1. Status header
    lines.append(f"## 🧊 Reverse Engine Report")
    lines.append(f"**Status:** {result.solver_status}  ")
    lines.append(f"**Strategy:** {result.strategy}  ")
    lines.append("")

    # 2. Production Batch table
    lines.append("### 📦 Production Batch")
    lines.append("| Metric | Value |")
    lines.append("|---|---|")
    lines.append(f"| Gross Liquid Volume | {b.gross_liquid_volume_L:,.2f} L |")
    lines.append(f"| Batch Mass | {b.batch_mass_g:,.2f} g ({b.batch_mass_g/1000:,.2f} kg) |")
    lines.append(f"| SKU Count | {b.n_skus:,} units |")
    lines.append(f"| Scale Factor | {b.scale_factor:.6f} |")
    lines.append("")

    # 3. Metrics Comparison
    lines.append("### 📊 Metrics Comparison")
    lines.append("| Metric | Before | After | Δ |")
    lines.append("|---|---|---|---|")
    for label, bv, av in [
        ("Fat %", mb.fat_pct, ma.fat_pct),
        ("MSNF %", mb.msnf_pct, ma.msnf_pct),
        ("Sugars %", mb.sugars_pct, ma.sugars_pct),
        ("Water %", mb.water_pct, ma.water_pct),
        ("Total Solids %", mb.total_solids_pct, ma.total_solids_pct),
    ]:
        delta = av - bv
        arrow = "▲" if delta > 0.01 else ("▼" if delta < -0.01 else "—")
        lines.append(f"| {label} | {bv:.2f} | {av:.2f} | {arrow} {delta:+.2f} |")
    lines.append("")

    # 4. Ingredient Changes
    if result.diffs:
        lines.append("### 🔄 Ingredient Changes (sorted by |Δ|)")
        lines.append("| Ingredient | Original (g) | Proposed (g) | Δ (g) | Δ % |")
        lines.append("|---|---|---|---|---|")
        for d in result.diffs:
            arrow = "▲" if d["delta_g"] > 0 else "▼"
            lines.append(f"| {d['ingredient']} | {d['original_g']:,.2f} | {d['proposed_g']:,.2f} | {arrow} {d['delta_g']:+,.2f} | {d['delta_pct']:+.1f}% |")
        lines.append("")

    # 5. Full Proposed BOM
    lines.append("### 📋 Full Proposed Recipe (BOM)")
    lines.append("| Ingredient | Grams | % of Batch |")
    lines.append("|---|---|---|")
    total = sum(result.proposed_recipe.values())
    for name, grams in sorted(result.proposed_recipe.items(), key=lambda x: -x[1]):
        pct = grams / total * 100 if total > 0 else 0
        lines.append(f"| {name} | {grams:,.2f} | {pct:.2f}% |")
    lines.append("")

    # 6. Warnings
    if result.warnings:
        lines.append("### ⚠️ Warnings")
        for w in result.warnings:
            lines.append(f"- {w}")
        lines.append("")

    # 7. Footer
    lines.append("---")
    lines.append("⚠️ **PROPOSED ONLY.** Call `apply_result(result)` to confirm.")

    display(Markdown("\\n".join(lines)))


def apply_result(result: OptimizationResult) -> dict:
    """
    Accept proposed recipe. Returns proposed_recipe dict.
    Does NOT modify any global state automatically.
    """
    if not result.success:
        print("⚠️  WARNING: The solver did not converge. Applying may use a sub-optimal recipe.")
    print("✅ Result applied. Returning proposed_recipe dict.")
    return dict(result.proposed_recipe)

print("✅ render_report() and apply_result() ready.")'''
, "cell-9")))

# ── Cell 10: LangChain Tool ──
cells.append(fix_lines(code_cell(
'''# Cell 10 — LangChain Tool + System Prompt
import json as _json
from langchain_core.tools import tool

@tool
def reverse_engine_tool(input_json: str) -> str:
    """
    Reverse Engine AI Tool.
    Accepts a JSON string with: recipe, production_targets, custom_instruction, mode (optional).
    Returns the OptimizationResult as JSON.
    """
    data = _json.loads(input_json)
    result = run_reverse_engine(
        recipe=data["recipe"],
        production_targets=data["production_targets"],
        custom_instruction=data["custom_instruction"],
        mode=data.get("mode", "gelato")
    )
    return result.model_dump_json(indent=2)

SYSTEM_PROMPT = """You are an expert ice cream and gelato production formulation assistant.

Your ONLY job is to:
1. Call `reverse_engine_tool` with the user's recipe, production targets, and instruction.
2. Read the JSON output and explain in plain language:
   a. How many litres/tubs will be produced and how it was calculated
   b. What the batch mass is and how overrun + loss were factored
   c. Which ingredients change, by exactly how much (from the diff only)
   d. WHY each change helps hit the target
      (e.g. "Cream 25% increased because it carries 25% fat — adding more directly raises fat%")
3. Always end with:
   "⚠️ These are PROPOSED changes. Reply with 'apply' to confirm."

You must NEVER:
- Invent or hallucinate ingredient quantities not present in the tool's output
- Suggest changes to LOCKED ingredients
- Auto-apply changes
- Contradict the solver output
"""

print("✅ reverse_engine_tool and SYSTEM_PROMPT defined.")'''
, "cell-10")))

# ── Cell 11: Agent Init ──
cells.append(fix_lines(code_cell(
'''# Cell 11 — Agent Initialisation (requires OPENAI_API_KEY)
import os
from langchain_openai import ChatOpenAI
from langchain.agents import AgentExecutor, create_openai_tools_agent
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder

# Set your key here or via environment variable
# os.environ["OPENAI_API_KEY"] = "sk-..."

llm = ChatOpenAI(model="gpt-4o", temperature=0)

prompt = ChatPromptTemplate.from_messages([
    ("system", SYSTEM_PROMPT),
    ("human", "{input}"),
    MessagesPlaceholder("agent_scratchpad"),
])

tools = [reverse_engine_tool]
agent = create_openai_tools_agent(llm, tools, prompt)
agent_executor = AgentExecutor(agent=agent, tools=tools, verbose=True)

print("✅ LangChain agent initialised (model=gpt-4o, temperature=0)")'''
, "cell-11")))

# ── Cell 12: Test Cell ──
cells.append(fix_lines(code_cell(
'''# Cell 12 — Test Cell (exact inputs from PRD §3)
TEST_RECIPE = [
    {"ingredient": "Toned Milk 3%",           "quantity_g": 507970.39},
    {"ingredient": "Cream 25%",               "quantity_g": 142300.70},
    {"ingredient": "Sucrose/sugar",           "quantity_g": 101766.56},
    {"ingredient": "Dextrose monohydrate",    "quantity_g": 15523.71},
    {"ingredient": "Glucose Syrup (40-42DE)", "quantity_g": 36221.99},
    {"ingredient": "Condensed Milk Nestle",   "quantity_g": 15523.71},
    {"ingredient": "Stabilizer",              "quantity_g": 5174.57},
    {"ingredient": "Skimmed Milk Powder",     "quantity_g": 37946.85},
]

TEST_PRODUCTION_TARGETS = {
    "lossPct": 5,
    "mixDensity": 1.04,
    "overrunPct": 27,
    "skuSizeLiters": 0.75,
    "targetVolumeLiters": 1000,
}

TEST_INSTRUCTION = "Increase fat to 8%, MSNF to 10%, sugars to 20%"

result = run_reverse_engine(
    recipe=TEST_RECIPE,
    production_targets=TEST_PRODUCTION_TARGETS,
    custom_instruction=TEST_INSTRUCTION,
    mode="gelato"
)

render_report(result)'''
, "cell-12")))

# ── Cell 13: Agent Test ──
cells.append(fix_lines(code_cell(
'''# Cell 13 — Agent Test Cell (requires OPENAI_API_KEY)
import json as _json2

agent_input = _json2.dumps({
    "recipe": TEST_RECIPE,
    "production_targets": TEST_PRODUCTION_TARGETS,
    "custom_instruction": TEST_INSTRUCTION,
    "mode": "gelato"
})

response = agent_executor.invoke({
    "input": f"Here is my recipe and production setup. Please optimize it.\\n\\n{agent_input}"
})

print("\\n" + "=" * 60)
print("AGENT RESPONSE:")
print("=" * 60)
print(response["output"])'''
, "cell-13")))

# ── Cell 14: Add Ingredient ──
cells.append(fix_lines(code_cell(
'''# Cell 14 — Runtime Ingredient Extension
def add_ingredient(
    name: str,
    fat_pct: float = 0,
    msnf_pct: float = 0,
    sugars_pct: float = 0,
    water_pct: float = 0,
    category: str = "other",
    locked: bool = False,
    note: str = ""
):
    """
    Add a custom ingredient to INGREDIENT_DB at runtime.
    Not persisted to disk (Supabase integration is a future step).
    """
    INGREDIENT_DB[name] = {
        "fat_pct": fat_pct,
        "msnf_pct": msnf_pct,
        "sugars_pct": sugars_pct,
        "water_pct": water_pct,
        "category": category,
        "locked": locked,
        "note": note,
    }
    lock_tag = " 🔒" if locked else ""
    print(f"✅ Added '{name}' to INGREDIENT_DB{lock_tag}")
    print(f"   fat={fat_pct}%, msnf={msnf_pct}%, sugars={sugars_pct}%, water={water_pct}%")

# Example usage:
# add_ingredient("Butter 82%", fat_pct=82, msnf_pct=1.0, sugars_pct=0.5, water_pct=16, category="dairy")
print("✅ add_ingredient() ready.")'''
, "cell-14")))


# ── Build notebook ──
nb = {
    "nbformat": 4,
    "nbformat_minor": 5,
    "metadata": {
        "kernelspec": {
            "display_name": "Python 3",
            "language": "python",
            "name": "python3"
        },
        "language_info": {
            "name": "python",
            "version": "3.11.0"
        }
    },
    "cells": cells
}

out_path = os.path.join(os.path.dirname(__file__), "reverse_engine_stage1.ipynb")
with open(out_path, "w", encoding="utf-8") as f:
    json.dump(nb, f, indent=1, ensure_ascii=False)

print(f"✅ Notebook written to {out_path}")
