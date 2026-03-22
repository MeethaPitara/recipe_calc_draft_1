# 🍦 Meetha Pitara — Ice Cream & Gelato Formulation Engine

> A professional-grade, web-based recipe calculator and production planning tool for ice cream, gelato, kulfi, and sorbet formulation. Built for food technologists, production managers, and artisan ice cream makers.

![Vite](https://img.shields.io/badge/Vite-5.4-646CFF?logo=vite&logoColor=white)
![React](https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178C6?logo=typescript&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Backend-3ECF8E?logo=supabase&logoColor=white)
![Gemini AI](https://img.shields.io/badge/Gemini_AI-Powered-4285F4?logo=google&logoColor=white)

---

## 📋 Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [Environment Setup](#environment-setup)
- [Core Modules](#core-modules)
- [Development Timeline](#development-timeline)
---

## Overview

**Meetha Pitara** (meaning "Sweet Treasure" in Hindi) is a full-stack formulation engine designed for the frozen dessert industry. It provides:

- **Scientific Recipe Balancing** — validates recipes against industry-standard metrics (Fat%, MSNF%, PAC, POD, Total Solids).
- **Multi-Level Production Planning** — converts lab-scale recipes into factory-floor batch sheets with SKU counts, loss compensation, and overrun physics.
- **AI-Powered Recipe Optimization** — uses a Linear Programming solver backed by Gemini AI for intelligent recipe adjustments.
- **User Authentication & Data Isolation** — custom JWT-based auth with per-user recipe and plan persistence via Supabase.

---

## Key Features

### 🧮 Recipe Calculator (Phase 1 MVP — "The Validator")
- Real-time calculation of Fat, MSNF, Sugar, Total Solids, Water, PAC (Anti-Freezing Power), and POD (Sweetness Index).
- Dynamic target system with user-configurable goals and ±tolerance margins.
- Product-mode presets for Gelato, Ice Cream, Kulfi, and Sorbet.
- Ingredient search and custom ingredient creation with nutritional profiles.
- Recipe save/load with user-based data isolation (Supabase RLS).
- CSV import for bulk recipe entry.
- Recipe comparison (side-by-side diff).

### 🏭 Production Planning (3 Levels)
| Level | Name | Use Case |
|-------|------|----------|
```markdown
| **Level 1** | Quick Plan | Rapid scaling of recipes based on target production volume or weight. |
| **Level 2** | Base Planner | Strategic allocation of master base mixes across multiple flavors and SKU configurations. |
| **Level 3** | Exact Plan | Precision production sheets designed to fulfill specific SKU order quantities with automated loss compensation. |
```

All three levels handle:
- Discrete unit rounding (no partial tubs — `Math.ceil` / `Math.floor` as appropriate)
- Overrun physics (air expansion during freezing)
- Process loss compensation (pipe/batch freezer waste)
- Mix density conversion (Liters ↔ Kg)
- Scaled batch sheets with per-ingredient weights
- Save/Load plan history (per-user, email-based filtering)
- PDF export for batch sheets

```markdown
### 🤖 AI Flavour Engine (Two-Tier Intelligence)
A dual-tier intelligence suite powered by Gemini AI and deterministic solvers for recipe optimization and creation.
- **Level 1: The Optimizer**: Refines existing recipes based on specific goals (e.g., texture improvements or nutritional targets) while maintaining chemical balance and explaining adjustments.
- **Level 2: The Creator**: Generates complete, balanced recipes from scratch based on natural language flavor descriptions or specific ingredient constraints, ensuring all chemical parameters meet industry standards.

**Implementation Details:**
- **Hybrid Logic**: Combines LLM-based creative reasoning (Gemini Pro) with a deterministic Linear Programming solver to ensure mathematical precision in chemical balancing.
- **Constraint Mapping**: Natural language inputs are parsed into objective functions and constraints (Fat, MSNF, Sugar, PAC, POD) which are then solved to find the optimal ingredient ratios.
- **Scientific Validation**: Every AI-generated recipe is passed through the core formulation engine to verify compliance with industry-standard ranges before being presented to the user.
```

### 🔐 Authentication
- Custom JWT-based auth (migrated from Supabase Auth).
- bcrypt password hashing (client-side via `bcryptjs`).
- Cross-tab session sync via `localStorage` events.
- Protected routes with automatic redirect to `/auth`.
- User data stored in `app_users` table (Supabase).

### 📊 Additional Features
- Chemistry Dashboard (POD/PAC/DE effects visualization)
- Ingredient pairing suggestions
- Machine guidance (batch freezer settings)
- Glossary page (scientific term definitions)
- Admin panel (user management)
- Diagnostics panel (debug tracing)
- Mobile-responsive layout

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Build** | Vite 5.4 |
| **UI** | React 18.3 + TypeScript 5.5 |
| **Styling** | Tailwind CSS 3.4 + `tailwindcss-animate` |
| **Components** | shadcn/ui (Radix primitives) |
| **State** | Zustand (production planners), React Context (auth) |
| **Backend** | Supabase (PostgreSQL + REST API) |
| **Auth** | Custom JWT (jose + bcryptjs) |
| **AI** | Google Gemini API (`@google/generative-ai`) |
| **Optimization** | Linear Programming |
| **Charts** | Recharts |
| **Forms** | React Hook Form + Zod validation |
| **Testing** | Vitest + Testing Library |
| **PDF Export** | jsPDF |
| **Search** | Fuse.js (fuzzy ingredient search) |

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    React UI Layer                    │
│  Pages: Index, Auth, Database, AdminPanel,           │
│         QuickProductionPlan, Glossary, AIFlavourEngine│
├─────────────────────────────────────────────────────┤
│                   Hooks & Services                   │
│  useRecipeBalance, useRecipeSave, useAIAnalysis      │
│  recipeService, ingredientService, costingService    │
├───────────────┬──────────────┬───────────────────────┤
│  Calc Engine  │  Production  │   AI Pipeline         │
│  calc.v2.ts   │  L1/L2/L3    │   pipeline.ts         │
│  (Fat, MSNF,  │  engines     │   lpOptimizer.ts      │
│   PAC, POD)   │              │   geminiClient.ts     │
├───────────────┴──────────────┴───────────────────────┤
│               Auth Module (JWT)                      │
│  authService.ts → AuthContext.tsx                     │
├─────────────────────────────────────────────────────┤
│              Supabase (PostgreSQL)                    │
│  Tables: ingredients, recipes, recipe_items,          │
│          app_users, production_plans_l1/l2/l3         │
└─────────────────────────────────────────────────────┘
```

---

## Getting Started

### Prerequisites

- **Node.js** v18+ (recommended)
- **npm** v9+
- A [Supabase](https://supabase.com) project (for backend/database)
- A [Google AI Studio](https://aistudio.google.com) API key (for AI features)

### Installation

```bash
# 1. Clone the repository
git clone <repository-url>
cd recipe_calc_draft_1

# 2. Install dependencies
npm install

# 3. Start the dev server
npm run dev
```

The app will be available at `http://localhost:8080` (or the port shown in terminal).

---

## Environment Setup

Copy `.env.example` to `.env.local` and configure:

```bash
cp .env.example .env.local
```

| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_SUPABASE_URL` | Your Supabase project URL | ✅ |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Your Supabase anon/public key | ✅ |
| `VITE_GEMINI_API_KEY` | Google Gemini API key (for AI features) | For AI features |
| `VITE_JWT_SECRET` | Secret key for JWT signing | ✅ |
| `VITE_ENABLE_ADVANCED` | Enable advanced features (Reverse Engineer, Paste Studio, Optimizers) | Optional (`true`/`false`) |
| `NEXT_PUBLIC_DEBUG_MODE` | Enable verbose trace logging in console | Optional (`true`/`false`) |


## Core Modules

### 1. Calculation Engine (`src/lib/calc.v2.ts`)
The **Single Source of Truth** for all recipe math. Computes:
- **Fat%** — Total fat contribution from all ingredients
- **MSNF%** — Milk Solids Non-Fat (isolated from total fat)
- **Total Sugars%** — Combined sugar contribution
- **Total Solids%** — All non-water components
- **Water%** — Derived as `100 - Total Solids`
- **PAC** — Potere Anti-Congelante (Anti-Freezing Power) — controls scoopability at serving temperature
- **POD** — Potere Dolcificante (Sweetening Power) — relative sweetness vs sucrose

### 2. Production Engines (`src/lib/production/`)
Three independent engines sharing the same physics model:
- **Overrun**: `Frozen Volume = Mix Volume × (1 + Overrun%)`
- **Loss**: `Required Mix = Packed Mix / (1 - Loss%)`
- **Density**: `Mass (kg) = Volume (L) × Density`

### 3. AI Pipeline (`src/lib/ai/`)
```markdown
End-to-end in-browser intelligence that transforms user intent into professional formulations:
- **Natural Language Control**: Adjust recipe targets like fat, sugar, or PAC using simple commands.
- **Feasibility Guardrails**: Real-time evaluation of recipe stability and structural integrity.
- **Scientific Insights**: AI-driven explanations for the physical and chemical impacts of substitutions.
- **Automated Balancing**: Seamlessly bridge the gap between creative goals and mathematical precision.
```

### 4. Optimizer (`src/lib/optimizer/`)
Adapter-pattern wrapper around the LP solver supporting:
- Locked vs. free ingredients
- Sugar-type caps by product mode (gelato/ice cream/kulfi/sorbet)
- Mass conservation with ±10% tolerance
- Movement penalty (prefer minimal changes)

---

## Development Timeline

This project was developed iteratively over 6+ weeks with task-driven PRDs:

| Week | Major Tasks |
|------|------------|
| **Week 2** | Feature flag system, `calc.v2.ts` as Single Source of Truth, data pipeline audit, verbose trace logging |
| **Week 3** | Golden tests (correctness lock), user-based recipe persistence (Supabase RLS), dynamic target system |
| **Week 4** | Level 1 Production Mode (Quick Plan), Level 3 Production Mode (Exact Plan) |
| **Week 5** | Level 2 Production Mode (Base Planner), production plan save/load (L1/L2/L3), custom ingredients manager, optimizer resurrection (legacy LP integration) |
| **Week 6** | Reverse Engine AI Assistant (Python notebook), Gemini API integration, restructured AI pipeline (Agent + Optimizer + Food Scientist) |
| **Week 7** | Gemini API rate limit handling (exponential backoff), Python → TypeScript AI pipeline migration (full in-browser), TensorFlow import debugging |
| **Week 8** | Auth migration (Supabase Auth → Custom JWT), UI upscaling, timetable page |


---

## License

Private — All rights reserved.
