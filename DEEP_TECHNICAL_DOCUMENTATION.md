# Doha Roastery Management System - Deep Feature Documentation

## **1. Authentication & Security Framework**
**File Reference**: [AuthContext.tsx](file:///Users/macbookair/Downloads/doha-roastery-management-system%20%281%29/contexts/AuthContext.tsx), [LoginView.tsx](file:///Users/macbookair/Downloads/doha-roastery-management-system%20%281%29/views/LoginView.tsx)

### **1.1 Role-Based Access Control (RBAC)**
The system implements a rigid RBAC model using the `UserRole` enum. Each role is mapped to a specific set of functional permissions:
- **`ADMIN`**: Full system access, user management, and configuration.
- **`MANAGER`**: Inventory management, roasting oversight, and high-value approval rights.
- **`ROASTER`**: Access to roasting operations and raw material inventory.
- **`CASHIER`**: POS operations and personal sales history.
- **`WAREHOUSE_STAFF`**: Stock intake, transfers, and inventory audits.

### **1.2 Session Management**
- **Persistence**: Supports "Remember Me" functionality via local storage.
- **Security**: Automatic session timeout warnings and proactive logout for inactive sessions.
- **Supabase Integration**: Leverages Supabase Auth for secure password hashing and JWT-based session tokens.

---

## **2. Roasting & Production Lifecycle**
**File Reference**: [RoastingView.tsx](file:///Users/macbookair/Downloads/doha-roastery-management-system%20%281%29/views/RoastingView.tsx), [types.ts](file:///Users/macbookair/Downloads/doha-roastery-management-system%20%281%29/types.ts)

### **2.1 Batch Creation**
1. **Selection**: Roasters select a `GreenBean` source from available inventory.
2. **Pre-Weight**: Input weight is recorded (kg). The system validates that sufficient stock exists.
3. **Roast Profile**: Level selection (`LIGHT`, `MEDIUM`, `DARK`) and operator assignment.

### **2.2 Real-time Monitoring & Waste**
- **In-Progress State**: Tracks active batches with a "Cooling" transition phase.
- **Post-Weight**: Output weight is recorded upon completion.
- **Waste Algorithm**: `((PreWeight - PostWeight) / PreWeight) * 100`. High waste triggers visual alerts.

### **2.3 Packaging Integration**
- **Unit Conversion**: Roasted beans are converted into retail units based on `PackageTemplate` (e.g., 250g, 500g).
- **SKU Generation**: Unique barcodes and SKUs are generated based on center prefixes and batch numbers.
- **Shelf Life**: Expiry dates are auto-calculated from production date + template shelf life.

---

## **3. Inventory & Distribution Ecosystem**
**File Reference**: [InventoryView.tsx](file:///Users/macbookair/Downloads/doha-roastery-management-system%20%281%29/views/InventoryView.tsx), [inventoryService.ts](file:///Users/macbookair/Downloads/doha-roastery-management-system%20%281%29/services/inventoryService.ts)

### **3.1 Multi-Location Stock Tracking**
- **Locations**: Managed via `WAREHOUSE`, `BRANCH`, and `ROASTERY` types.
- **Real-time Balance**: Stock levels are updated atomically across locations during transfers.

### **3.2 Stock Transfers**
- **Workflow**: `DRAFT` → `PENDING_APPROVAL` → `IN_TRANSIT` → `RECEIVED`.
- **Value Thresholds**: Transfers exceeding 5,000 QAR require administrative approval.

### **3.3 Adjustments & Audits**
- **Reasons**: `DAMAGE`, `THEFT`, `EXPIRY`, or `COUNTING_ERROR`.
- **Audit Log**: Every adjustment records the user, reason, and financial impact.

---

## **4. Advanced POS Operations**
**File Reference**: [POSView.tsx](file:///Users/macbookair/Downloads/doha-roastery-management-system%20%281%29/views/POSView.tsx)

### **4.1 Cart & Checkout**
- **Bilingual Interface**: Seamless RTL/LTR switching for cashiers.
- **Payment Processing**: Supports `CASH`, `CARD`, and `MOBILE` payments with split-payment capabilities.
- **Taxation**: Automated VAT calculation based on system settings.

### **4.2 Receipt Engineering**
- **Thermal Optimization**: CSS-driven receipt layout with `Courier New` monospaced font for pixel-perfect thermal alignment.
- **Automatic Printing**: JavaScript `window.print()` is triggered post-checkout with a 300ms buffer to ensure UI stability.

---

## **5. AI-Driven Intelligence**
**File Reference**: [AIInsights.tsx](file:///Users/macbookair/Downloads/doha-roastery-management-system%20%281%29/views/AIInsights.tsx), [geminiService.ts](file:///Users/macbookair/Downloads/doha-roastery-management-system%20%281%29/services/geminiService.ts)

### **5.1 Business Consulting**
- **Contextual Analysis**: Sends recent sales, waste ratios, and stock levels to Gemini AI.
- **Operational Advice**: Generates professional advice in Arabic/English on improving roasting efficiency and sales.

### **5.2 Predictive Stocking**
- **Historical Analysis**: Analyzes sales trends to predict inventory needs for the upcoming week.
- **JSON Schema Output**: Ensures AI responses are structured and ready for UI rendering.

---

## **6. System Configuration & Database**
**File Reference**: [ConfigurationView.tsx](file:///Users/macbookair/Downloads/doha-roastery-management-system%20%281%29/views/ConfigurationView.tsx), [supabaseClient.ts](file:///Users/macbookair/Downloads/doha-roastery-management-system%20%281%29/supabaseClient.ts)

### **6.1 Product Definition**
- **Templates**: Centralized management of packaging sizes and material costs.
- **COGS Calculation**: Real-time calculation of Green Bean Cost + Labor + Overhead to determine profit margins.

### **6.2 Database Integrity**
- **Schema Validation**: Built-in tools to check for missing columns or tables in Supabase.
- **Migrations**: Automated SQL script generation for system updates.

---

## **7. System Architecture (C4 Model)**

### **7.1 Context Diagram (Level 1)**
The Doha Roastery Management System acts as a central hub connecting staff, customers (indirectly through POS), and external services.

- **Users**: Admin, Manager, Roaster, Cashier, Warehouse Staff.
- **System**: Doha Roastery ERP (React + Vite).
- **External Systems**: 
    - **Supabase**: Backend-as-a-Service (Auth, DB, Storage).
    - **Google Gemini API**: AI Insights and Forecasting.
    - **Thermal Printers**: ESC/POS hardware for receipts/labels.

### **7.2 Container Diagram (Level 2)**
- **Web Application**: React (TypeScript) + Tailwind CSS.
- **State Management**: React Hooks (useContext, useState, useMemo).
- **Data Access**: Supabase Client (PostgREST).
- **Services**: 
    - `AuthContext`: RBAC & Session logic.
    - `GeminiService`: AI integration logic.
    - `InventoryService`: Server-side filtered data fetching.
    - `ThermalReceiptModule` (Python): Specialized module for hardware-level receipt generation.

### **7.3 Component Diagram (Level 3)**
- **Views**: Modular React components for each business domain (POS, Roasting, etc.).
- **Common Components**: Shared UI elements (Modals, Tables, Forms).
- **Hooks**: Custom logic for data fetching and business rules.

---

## **8. Database Schema & Data Flow**

### **8.1 Core Tables & Relationships**
- **`green_beans`**: Source materials.
- **`roasting_batches`**: Processed coffee (FK to `green_beans`).
- **`inventory_items`**: Packaged products (FK to `roasting_batches` and `product_definitions`).
- **`product_definitions`**: Catalog items (Linked to `package_templates`).
- **`transactions`**: Sales records (Linked to `inventory_items`).
- **`locations`**: Multi-site management (Warehouse vs. Branch).

### **8.2 API & Data Flow**
- **Read Flow**: UI → `inventoryService` → Supabase (PostgREST) → JSON.
- **Write Flow**: UI → Supabase Client → Real-time Broadcast → Other Clients.
- **AI Flow**: Database Snapshot → Gemini API → Structured JSON Advice → UI.

### **8.3 Row-Level Security (RLS)**
- **Policy**: `auth.uid()` based checks ensure users only access data permitted by their `UserRole`.
- **Public Access**: Denied by default; only authenticated sessions with valid JWTs can query data.

---

## **9. React Design Patterns & Hooks**

### **9.1 Component Organization**
The system follows a "View-Service-Type" architectural pattern:
- **Views**: High-level containers (`RoastingView`, `POSView`) that manage local UI state.
- **Services**: Pure logic files (`inventoryService`, `geminiService`) for API interactions.
- **Contexts**: Global state providers (`AuthContext`, `LanguageContext`).

### **9.2 Core Design Patterns**
- **Controlled Components**: All forms (e.g., in `RoastingView`'s production modal) use controlled inputs for predictable state.
- **Memoization**: Heavy use of `useMemo` for filtering and calculation (e.g., `totalBatchPackagingWeightNeeded`) to optimize performance.
- **Custom Hooks**: 
    - `useAuth`: Abstracts role and permission checks.
    - `useLanguage`: Handles dynamic i18n switching and RTL directionality.
- **Higher-Order Components (Conceptual)**: Role-based conditional rendering (e.g., `{user?.role === UserRole.ADMIN && ...}`) acts as a security wrapper.

### **9.3 Global State & Side Effects**
- **`useEffect` + `useCallback`**: Standard pattern for data fetching, ensuring fetchers are memoized and only re-run when dependencies change.
- **Supabase Real-time**: Integration of `onAuthStateChange` for seamless session management across tabs.
