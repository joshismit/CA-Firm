# CA Firm ERP — Implementation Plan

## Goal
Scaffold the complete Vite + React 19 + TypeScript project, install all dependencies, wire up the design system (CSS variables, Tailwind v4 `@theme`, Shadcn UI), build the App Layout shell (Sidebar + Header), and render a live Dashboard page that demonstrates the full design system — all without any business logic.

---

## Phase 1 — Project Scaffolding

- Initialize Vite project in `d:\My Work\Bytesved\CA firm` with React + TypeScript template
- Configure `tsconfig`, `vite.config.ts`, path aliases (`@/`)
- Initialize Git

---

## Phase 2 — Dependency Installation

### Core
- `react-router-dom v7`
- `@tanstack/react-query`
- `react-hook-form`
- `zod`
- `@hookform/resolvers`

### UI
- `tailwindcss v4` + `@tailwindcss/vite`
- Shadcn UI (via CLI: button, input, dialog, dropdown-menu, badge, avatar, table, tabs, card, separator, tooltip, sheet, breadcrumb, skeleton, sonner, switch, select)
- `lucide-react`
- `clsx`, `tailwind-merge`

### Utilities
- `date-fns` (Indian date formatting)
- `recharts` (charts)
- `@radix-ui/react-*` (installed via Shadcn)

---

## Phase 3 — Design System Files

Create:
- `src/styles/variables.css` — all CSS custom properties
- `src/styles/colors.css` — raw color palette
- `src/styles/typography.css` — font scale utilities
- `src/styles/globals.css` — resets, scrollbar, selection
- `src/styles/tailwind.css` — Tailwind v4 `@theme` block
- `src/lib/tokens.ts` — TypeScript token mirror
- `src/lib/utils.ts` — `cn()` helper

---

## Phase 4 — App Layout Shell

Build:
- `AppLayout.tsx` — root layout wrapper
- `Sidebar.tsx` — collapsible, with all nav groups
- `SidebarNav.tsx` — nav items with active states
- `Header.tsx` — breadcrumb + actions + user menu
- `ThemeProvider.tsx` — dark/light mode toggle

Nav groups (sidebar):
- **Overview**: Dashboard, Analytics
- **Clients**: All Clients, Add Client
- **Compliance**: GST Returns, ITR, TDS, MCA/ROC
- **Billing**: Invoices, Expenses, Payments
- **Tasks**: My Tasks, Team Tasks
- **Documents**: Vault, Templates
- **Staff**: Team, Roles
- **Settings**: Firm Profile, Integrations

---

## Phase 5 — Core Shared Components

Build:
- `PageHeader` — title + breadcrumb + action buttons
- `StatusBadge` — semantic colored badges
- `AmountDisplay` — INR formatted amount
- `DataTable` — full-featured sortable table with pagination
- `EmptyState` — illustration + CTA
- `Loader / Skeleton` — shimmer loading

---

## Phase 6 — Dashboard Demo Page

Render a live Dashboard that shows the full design system:
- KPI cards (4 stat cards)
- Recent Clients table
- Task list widget
- GST filing status chart
- Revenue trend chart

---

## Verification Plan

- Run `npm run dev` and open browser
- Verify: Sidebar collapses, dark mode toggles, all nav items render
- Verify: Dashboard KPIs, table, charts visible
- Verify: No TypeScript errors (`tsc --noEmit`)
