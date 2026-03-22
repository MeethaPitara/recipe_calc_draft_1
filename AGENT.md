# Meetha Pitara - AI Agent Context

## Project Overview
**Meetha Pitara** is a professional-grade ice cream, gelato, kulfi, and sorbet formulation engine built for food technologists and artisan makers. It combines scientific recipe balancing (Fat, MSNF, PAC, POD, Total Solids) with deep production planning and AI-powered optimization.

### Tech Stack
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui.
- **Backend / DB**: Supabase (PostgreSQL), Custom JWT Auth.
- **AI / Math Analytics**: Google Gemini API (`@google/generative-ai`), Linear Programming (`javascript-lp-solver`).

## Core Components
### 1. Calculation Engine (`calc.v2.ts`)
The single source of truth for math, driving metrics like Fat%, MSNF%, Sugars%, PAC (Anti-Freezing Power), and POD (Sweetness).

### 2. Production Planning
Three distinct levels for operational scaling:
- **Level 1**: Quick Plan (rapid basic scaling).
- **Level 2**: Base Planner (base mixes mapping into SKUs).
- **Level 3**: Exact Plan (precision fulfillment with loss compensation).

### 3. AI Flavour Engine Pipeline
An integrated 3-stage pipeline working sequentially:
1. **Food Engineer** (Gemini AI): Reads user prompts to adjust ingredients conceptually.
2. **Optimizer Tool** (LP Solver): Mathematically balances parameters (Fat, MSNF, Sugars) using Simplex algorithms to output an optimized recipe structure that minimizes distance from the original.
3. **Food Scientist** (Gemini AI): Evaluates and explains the technical characteristics of the final optimized recipe.

## Tasks Completed To Date
The application has transitioned from a manual recipe validator to an intelligent formulation suite:
- Implemented robust UI for three-level Production Planning.
- Migrated legacy Supabase authentication to a Custom JWT system.
- Ported the entire AI pipeline from Python notebooks to a browser-native TypeScript workflow.
- Repaired Gemini rate-limit exceptions using exponential backoff retry logic.
- Constructed the Level 1 feature of the AI Flavour Engine, enabling users to seamlessly optimize dynamic recipes directly from their Supabase database.
- Enhanced the frontend to securely render Markdown analytics directly from AI output.
- Re-engineered the inner LP optimization matrices to respect ingredient scale locking and enforce exact target constraints.

---

## ⚠️ **CRITICAL INSTRUCTION FOR ALL AGENTS** ⚠️
Every time a task is executed, or any code modifications are made to the codebase, **you MUST log the change into `TIMELINE.md`**. Append the event at the end of the file in sequential order, stating the date, time, and the exact changes made.
