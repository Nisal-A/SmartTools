# SmartTools — Modular Multi-Tool Business Platform (MERN Monolith)

> **Repository:** `https://github.com/Nisal-A/SmartTools.git`

SmartTools is a centralized, guest-ready MERN modular monolith platform hosting independent business tools—including **Invoice Generator**, **Quotation Generator**, and **SEO Analyzer**—backed by a single MongoDB database (`smart_tools_db`), centralized JWT + HttpOnly refresh authentication, strict role-based isolation (`user` vs `admin`), multi-size Puppeteer PDF generation (`A4`, `A5`, `LETTER`, `LEGAL`, `B5`, `THERMAL_80`), a separate **Profile Management & Shared Customers** section, unified **Document History**, **Dashboard**, and an **Admin Governance Console** with immutable audit logging.

---

## Architecture Highlights

- **Modular Monolith Structure:**
  - `shared/` — Single source of truth for paper dimensions (`paperSizes.js`), deterministic integer-cent financial math (`financialMath.js`), and shared Zod validation schemas.
  - `backend/` — Node.js + Express + Mongoose + Puppeteer Warm Chromium Pool (`backend/src/modules/*`).
  - `frontend/` — React + Vite + Tailwind CSS + React Hook Form + Zod (`frontend/src/*`).
- **Guest-Ready + Cloud Sync:** Visitors can immediately create, preview, print, and download multi-size PDFs without signing up. Clicking **Save to Cloud** opens an in-place Auth Modal that seamlessly migrates browser `localStorage` drafts to MongoDB.
- **Strict Role & Data Isolation:**
  - Standard users can only view/edit/export their own documents (`userId === req.user.id`); unauthorized IDs return `404 Not Found`.
  - Admin Governance endpoints (`/api/v1/admin/*`) enforce `requireAuth` + `requireAdmin` (`403 Forbidden` for standard users) and write immutable audit entries to `admin_audit_logs`.

---

## Quick Start & Setup

### 1. Prerequisites
- **Node.js** v20+
- **MongoDB** (local `mongodb://127.0.0.1:27017/smart_tools_db` or MongoDB Atlas).
  > *Note:* If local MongoDB is not running, `backend/src/config/db.js` automatically falls back to its built-in in-memory Mongoose engine for immediate local development and automated tests.

### 2. Configure Environment Variables

Create `backend/.env` (see `backend/.env.example`):

```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/smart_tools_db
JWT_ACCESS_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret-key
ADMIN_EMAIL=admin@smarttools.dev
ADMIN_PASSWORD=Admin@123456

# Optional Cloudinary credentials (safe base64 dev fallback is active when omitted)
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

### 3. Clone & Install Dependencies

```bash
git clone https://github.com/Nisal-A/SmartTools.git
cd SmartTools

# Shared core
cd shared && npm install

# Backend API & Puppeteer PDF Engine
cd ../backend && npm install

# Frontend React SPA
cd ../frontend && npm install
```

### 4. Seed the Initial Administrator (Idempotent)

```bash
cd backend
npm run seed:admin
```

Running `node src/scripts/seedAdmin.js` multiple times is idempotent and ensures the configured `ADMIN_EMAIL` account exists with `role: 'admin'`.

### 5. Run Backend & Frontend Development Servers

**Terminal 1 — Backend API (`http://localhost:5000`):**
```bash
cd backend
npm run dev
```

**Terminal 2 — Frontend SPA (`http://localhost:5173`):**
```bash
cd frontend
npm run dev
```

---

## Automated Verification & Test Suites

```bash
# Shared Core (paper sizes, financial math, Zod schemas)
cd shared && npm test

# Backend Auth, RBAC, Profiles, Logo Upload, Customers & Counters
cd backend && npm run test:auth

# Backend Unified Document History, Dashboard & Admin Governance Security Tests
cd backend && npm run test:history

# Multi-Size Puppeteer PDF Engine (A4, A5, LETTER, LEGAL, B5, THERMAL_80)
cd backend && npm run test:pdf

# Invoice & Quotation Module Integration Tests
cd backend && node tests/verifyInvoicesModule.test.js && node tests/verifyQuotationsModule.test.js

# Frontend Production Build
cd frontend && npm run build
```

---

## How to Add a New Tool (Zero-Boilerplate Extensibility)

SmartTools is designed to scale cleanly to dozens of tools without editing navigation bars, sidebars, or history controllers:

### 1. Frontend — Register in `toolsRegistry.js` & `Router.jsx`
1. Append a single tool object to `RAW_TOOLS` in `frontend/src/config/toolsRegistry.js`:
   ```js
   {
     id: 'receipt-generator',
     name: 'Receipt Generator',
     shortName: 'Receipts',
     tagline: 'Instant branded payment receipts',
     description: 'Issue branded receipts in A5 or 80mm thermal format.',
     route: '/tools/receipt-generator',
     iconName: 'Receipt',
     category: 'finance',
     tags: ['receipt', 'payment', 'pos'],
     supportsGuestMode: true,
     status: 'active',
     featured: false,
     defaultPinned: false,
     accentColor: 'amber',
     quickCreateLabel: 'New Receipt',
     highlights: ['Linked to invoices', 'Thermal & A5 formats'],
   }
   ```
2. Register its lazy page component in `TOOL_PAGE_COMPONENTS` inside `frontend/src/app/Router.jsx`:
   ```js
   'receipt-generator': lazy(() => import('../pages/ReceiptGenerator/ReceiptGeneratorPage.jsx')),
   ```
3. The new tool **automatically** appears across:
   - **Tools Hub (`/tools`)** & Category Tabs / Search Filters
   - **Top Navbar `Tools` Mega-Menu** & Quick-Create `+` menu
   - **`Ctrl+K` / `Cmd+K` Command Tool Switcher**
   - **User Sidebar Pinned Tools** (star-pin customizable up to 5 slots)
   - **Dynamic Breadcrumbs**

### 2. Backend — Plug into Unified History via `historyAdapters.js`
1. Create your independent Mongoose model(s) under `backend/src/modules/<your-tool>/` with an indexed `userId`.
2. Call `registerHistoryAdapter(...)` in `backend/src/modules/documents/historyAdapters.js` mapping your collection to the normalized History DTO (`{ id, toolType, documentNumber, customerName, currency, grandTotal, pageSize, status, createdAt, updatedAt, owner? }`).
3. Your new tool automatically appears in both **User Document History (`/api/v1/history`)** and **Admin Global History (`/api/v1/admin/history`)** with strict ownership isolation and audit logging already enforced.
