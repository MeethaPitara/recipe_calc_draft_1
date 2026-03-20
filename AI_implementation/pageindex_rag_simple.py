
# Commented out IPython magic to ensure Python compatibility.
# %pip install -q --upgrade pageindex

"""#### 0.2 Setup PageIndex"""

from pageindex import PageIndexClient
import pageindex.utils as utils

# Get your PageIndex API key from https://dash.pageindex.ai/api-keys
PAGEINDEX_API_KEY = "830e8d00ab1849c3ba03069d757d3cee"
pi_client = PageIndexClient(api_key=PAGEINDEX_API_KEY)

"""#### 0.3 Setup LLM

Choose your preferred LLM for reasoning-based retrieval. In this example, we use OpenAI’s GPT-4.1.
"""

import google.generativeai as genai
import asyncio

GEMINI_API_KEY = "AIzaSyBLN9mHm_zpnDmuyUblLIXJ1ppcPNLdq68"
genai.configure(api_key=GEMINI_API_KEY)

async def call_llm(prompt, model="gemini-2.5-flash", temperature=0):
    model_instance = genai.GenerativeModel(model)
    # Using asyncio.to_thread to safely run the synchronous call in an async context
    # This avoids the specific 'GenerateContentResponse' awaitable error
    response = await asyncio.to_thread(
        model_instance.generate_content,
        contents=prompt,
        generation_config={"temperature": temperature}
    )
    return response.text



"""## Step 1: PageIndex Tree Generation

#### 1.1 Submit a document for generating PageIndex tree
"""

import os, requests

# You can also use our GitHub repo to generate PageIndex tree
# https://github.com/VectifyAI/PageIndex

# Use the uploaded PDF file
pdf_file_name = "755294682-calculation-of-formulas-for-ice-cream-mix.pdf"
pdf_path = os.path.join("/content", pdf_file_name)

# No need to download as it's already uploaded
print(f"Using uploaded PDF: {pdf_path}")

doc_id = pi_client.submit_document(pdf_path)["doc_id"]
print('Document Submitted:', doc_id)

"""#### 1.2 Get the generated PageIndex tree structure"""

import time

print("Waiting for PageIndex server to process the document...")
while not pi_client.is_retrieval_ready(doc_id):
    print(".", end="", flush=True)
    time.sleep(5) # Pause for 5 seconds before pinging the API again

print("\nDocument is ready!")

# Now fetch the tree safely
tree = pi_client.get_tree(doc_id, node_summary=True)['result']
print('Simplified Tree Structure of the Document:')
utils.print_tree(tree)

"""## Step 2: Reasoning-Based Retrieval with Tree Search

#### 2.1 Use LLM for tree search and identify nodes that might contain relevant context
"""

import json

query = "What are the conclusions in this document?"

tree_without_text = utils.remove_fields(tree.copy(), fields=['text'])

search_prompt = f"""
You are given a question and a tree structure of a document.
Each node contains a node id, node title, and a corresponding summary.
Your task is to find all nodes that are likely to contain the answer to the question.

Question: {query}

Document tree structure:
{json.dumps(tree_without_text, indent=2)}

Please reply in the following JSON format:
{{
    "thinking": "<Your thinking process on which nodes are relevant to the question>",
    "node_list": ["node_id_1", "node_id_2", ..., "node_id_n"]
}}
Directly return the final JSON structure. Do not output anything else.
"""

# Added await here to resolve the coroutine
tree_search_result = await call_llm(search_prompt)

tree_search_result

"""#### 2.2 Print retrieved nodes and reasoning process"""

import json

node_map = utils.create_node_mapping(tree)

# Clean the LLM response to remove markdown code blocks if present
cleaned_result = tree_search_result.strip()
if cleaned_result.startswith("```"):
    # Remove the first and last lines (the ```json and ``` markers)
    lines = cleaned_result.split('\n')
    cleaned_result = '\n'.join(lines[1:-1])

try:
    tree_search_result_json = json.loads(cleaned_result)

    print('Reasoning Process:')
    utils.print_wrapped(tree_search_result_json.get('thinking', 'No thinking provided.'))

    print('\nRetrieved Nodes:')
    for node_id in tree_search_result_json.get("node_list", []):
        node = node_map.get(node_id)
        if node:
            print(f"Node ID: {node['node_id']}\t Page: {node['page_index']}\t Title: {node['title']}")
        else:
            print(f"Node ID: {node_id} not found in tree.")
except json.JSONDecodeError as e:
    print(f"Failed to parse JSON. Raw output:\n{tree_search_result}")
    raise e

"""## Step 3: Answer Generation

#### 3.1 Extract relevant context from retrieved nodes
"""

node_list = tree_search_result_json["node_list"]
relevant_content = "\n\n".join(node_map[node_id]["text"] for node_id in node_list)

print('Retrieved Context:\n')
utils.print_wrapped(relevant_content[:1000] + '...')

"""#### 3.2 Generate answer based on retrieved context"""

answer_prompt = f"""
Answer the question based on the context:

Question: {query}
Context: {relevant_content}

Provide a clear, concise answer based only on the context provided.
"""

print('Generated Answer:\n')
answer = await call_llm(answer_prompt)
utils.print_wrapped(answer)

"""---

## 🎯 What's Next

This notebook has demonstrated a **basic**, **minimal** example of **reasoning-based**, **vectorless** RAG with PageIndex. The workflow illustrates the core idea:
> *Generating a hierarchical tree structure from a document, reasoning over that tree structure, and extracting relevant context, without relying on a vector database or top-k similarity search*.

While this notebook highlights a minimal workflow, the PageIndex framework is built to support **far more advanced** use cases. In upcoming tutorials, we will introduce:
* **Multi-Node Reasoning with Content Extraction** — Scale tree search to extract and select relevant content from multiple nodes.
* **Multi-Document Search** — Enable reasoning-based navigation across large document collections, extending beyond a single file.
* **Efficient Tree Search** — Improve tree search efficiency for long documents with a large number of nodes.
* **Expert Knowledge Integration and Preference Alignment** — Incorporate user preferences or expert insights by adding knowledge directly into the LLM tree search, without the need for fine-tuning.

## 🔎 Learn More About PageIndex
  <a href="https://vectify.ai">🏠 Homepage</a>&nbsp; • &nbsp;
  <a href="https://dash.pageindex.ai">🖥️ Dashboard</a>&nbsp; • &nbsp;
  <a href="https://docs.pageindex.ai/quickstart">📚 API Docs</a>&nbsp; • &nbsp;
  <a href="https://github.com/VectifyAI/PageIndex">📦 GitHub</a>&nbsp; • &nbsp;
  <a href="https://discord.com/invite/VuXuf29EUj">💬 Discord</a>&nbsp; • &nbsp;
  <a href="https://ii2abc2jejf.typeform.com/to/tK3AXl8T">✉️ Contact</a>

<br>

© 2025 [Vectify AI](https://vectify.ai)
"""

import numpy as np
from scipy.optimize import minimize
from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Literal

# ============================================================================
# PYDANTIC MODELS (For Agent Function Calling Schemas)
# ============================================================================

class IngredientData(BaseModel):
    id: str
    name: str
    fat_pct: float = 0.0
    msnf_pct: float = 0.0
    sugars_pct: float = 0.0
    ts_pct: float = 0.0

class RecipeItem(BaseModel):
    ingredient: IngredientData
    grams: float

class OptimizationTargets(BaseModel):
    fat: Optional[float] = Field(None, description="Target Fat percentage (e.g., 8.0)")
    msnf: Optional[float] = Field(None, description="Target MSNF percentage (e.g., 10.0)")
    sugars: Optional[float] = Field(None, description="Target Sugars percentage (e.g., 18.0)")

class OptimizerChange(BaseModel):
    id: str
    name: str
    old_mass: float
    new_mass: float
    delta: float

class OptimizerResult(BaseModel):
    success: bool
    status: Literal['OPTIMAL', 'INFEASIBLE', 'ERROR']
    optimized_recipe: List[RecipeItem]
    changes: List[OptimizerChange]
    message: str

# ============================================================================
# AGENT TOOL FUNCTION
# ============================================================================

def optimize_recipe_tool(
    current_recipe: List[Dict],
    total_target_mass: float,
    targets: Dict[str, float],
    locked_ingredient_ids: List[str]
) -> Dict:
    """
    Tool for AI Agents to mathematically optimize an ice cream/gelato recipe.
    Adjusts free ingredients to hit specific Fat, MSNF, and Sugar targets while
    keeping the total batch weight perfectly constant.

    Args:
        current_recipe: List of dicts with 'ingredient' (id, name, fat_pct, msnf_pct, sugars_pct) and 'grams'.
        total_target_mass: Float of the target total grams.
        targets: Dict containing 'fat', 'msnf', and/or 'sugars' target percentages.
        locked_ingredient_ids: List of ingredient IDs that CANNOT be changed (e.g., pastes, stabilizers).
    """
    try:
        # 1. Parse Inputs
        items = [RecipeItem(**item) for item in current_recipe]
        n_ingredients = len(items)

        if n_ingredients == 0:
            return OptimizerResult(
                success=False, status='ERROR', optimized_recipe=[], changes=[],
                message="Recipe is empty."
            ).model_dump()

        # 2. Setup Bounds (Locks vs Free)
        bounds = []
        initial_guess = []
        free_count = 0

        for item in items:
            initial_guess.append(item.grams)
            if item.ingredient.id in locked_ingredient_ids:
                # Locked: min and max are exactly the current weight
                bounds.append((item.grams, item.grams))
            else:
                # Free: can go down to 0, or up to 10x current weight
                bounds.append((0.0, max(1500.0, item.grams * 10.0)))
                free_count += 1

        if free_count == 0:
            return OptimizerResult(
                success=False, status='INFEASIBLE', optimized_recipe=items, changes=[],
                message="All ingredients are locked. Unlock at least one to optimize."
            ).model_dump()

        # 3. Define Objective Function (Score: Lower is better)
        def objective_function(x):
            current_mass = np.sum(x)
            if current_mass == 0: return 99999.0

            # Calculate current percentages
            fat_sum = sum(x[i] * (items[i].ingredient.fat_pct / 100.0) for i in range(n_ingredients))
            msnf_sum = sum(x[i] * (items[i].ingredient.msnf_pct / 100.0) for i in range(n_ingredients))
            sugars_sum = sum(x[i] * (items[i].ingredient.sugars_pct / 100.0) for i in range(n_ingredients))

            fat_pct = (fat_sum / current_mass) * 100.0
            msnf_pct = (msnf_sum / current_mass) * 100.0
            sugars_pct = (sugars_sum / current_mass) * 100.0

            score = 0.0
            # Weight the penalties exactly like the TS logic
            if 'fat' in targets: score += abs(fat_pct - targets['fat']) * 1.5
            if 'msnf' in targets: score += abs(msnf_pct - targets['msnf']) * 1.5
            if 'sugars' in targets: score += abs(sugars_pct - targets['sugars']) * 1.0

            # Penalty for moving away from original recipe (prefer minimal changes)
            movement_penalty = sum(abs(x[i] - items[i].grams) for i in range(n_ingredients)) * 0.001

            return score + movement_penalty

        # 4. Define Constraints (Total mass must equal target mass)
        def mass_constraint(x):
            return np.sum(x) - total_target_mass

        constraints = [{'type': 'eq', 'fun': mass_constraint}]

        # 5. Run Scipy SLSQP Optimizer
        result = minimize(
            objective_function,
            np.array(initial_guess),
            method='SLSQP',
            bounds=bounds,
            constraints=constraints,
            options={'ftol': 1e-6, 'maxiter': 500}
        )

        # 6. Format the Results
        optimized_items = []
        changes = []

        for i, item in enumerate(items):
            new_mass = round(float(result.x[i]), 1)
            delta = round(new_mass - item.grams, 1)

            optimized_items.append(RecipeItem(
                ingredient=item.ingredient,
                grams=new_mass
            ))

            if abs(delta) > 0.1:
                changes.append(OptimizerChange(
                    id=item.ingredient.id,
                    name=item.ingredient.name,
                    old_mass=round(item.grams, 1),
                    new_mass=new_mass,
                    delta=delta
                ))

        if result.success and result.fun < 2.0: # If objective score is very low, we hit targets
            return OptimizerResult(
                success=True,
                status='OPTIMAL',
                optimized_recipe=optimized_items,
                changes=changes,
                message="Optimal solution found using SLSQP."
            ).model_dump()
        else:
            return OptimizerResult(
                success=False,
                status='INFEASIBLE',
                optimized_recipe=items,
                changes=[],
                message="Solver could not find a feasible solution to perfectly hit all targets. Try unlocking more ingredients."
            ).model_dump()

    except Exception as e:
        return OptimizerResult(
            success=False, status='ERROR', optimized_recipe=[], changes=[], message=str(e)
        ).model_dump()

