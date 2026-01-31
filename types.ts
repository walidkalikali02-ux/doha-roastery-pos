
export enum RoastingLevel {
  LIGHT = 'Light',
  MEDIUM = 'Medium',
  DARK = 'Dark'
}

export enum BatchStatus {
  IN_PROGRESS = 'In Progress',
  COMPLETED = 'Completed',
  READY_FOR_PACKAGING = 'Ready for Packaging',
  DELETED = 'DELETED'
}

export enum UserRole {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  ROASTER = 'ROASTER',
  CASHIER = 'CASHIER',
  WAREHOUSE_STAFF = 'WAREHOUSE_STAFF'
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  permissions: string[];
  avatar?: string;
}

export interface Ingredient {
  id: string;
  name: string;
  unit: 'g' | 'ml' | 'unit' | 'tsp';
  quantity: number;
  cost_per_unit: number;
}

export interface RecipeIngredient {
  ingredient_id: string; 
  name: string;
  amount: number;
  unit: string;
  cost_per_unit?: number; // Added for REQ-002
}

export interface Recipe {
  id: string;
  product_id: string;
  ingredients: RecipeIngredient[];
}

export interface AddOn {
  id: string;
  name: string;
  price: number;
  ingredient_id?: string;
}

export interface BeverageCustomization {
  size: 'S' | 'M' | 'L';
  milkType: 'Full Fat' | 'Low Fat' | 'Oat' | 'Almond';
  sugarLevel: 'None' | 'Half' | 'Normal' | 'Extra';
  extraPrice: number;
  selectedAddOns?: AddOn[];
}

export interface ProductDefinition {
  id: string;
  name: string;
  description?: string; 
  category: string;
  roastLevel?: RoastingLevel;
  templateId?: string;
  basePrice: number;
  isActive: boolean;
  image?: string;
  laborCost?: number; 
  roastingOverhead?: number; 
  estimatedGreenBeanCost?: number; 
  type: 'PACKAGED_COFFEE' | 'BEVERAGE';
  recipe?: Recipe;
  add_ons?: AddOn[];
}

export interface InventoryItem {
  id: string;
  name: string;
  description?: string;
  category?: string;
  type: 'PACKAGED_COFFEE' | 'BEVERAGE' | 'INGREDIENT';
  size?: string;
  price: number;
  stock: number;
  min_stock?: number;
  unit?: string;
  batchId?: string;
  image: string;
  skuPrefix?: string;
  productId?: string;
  location_id?: string;
  expiry_date?: string;
  cost_per_unit?: number;
}

export interface CartItem extends InventoryItem {
  quantity: number;
  recipe?: Recipe;
  selectedCustomizations?: BeverageCustomization;
}

export type PaymentMethod = 'CASH' | 'CARD' | 'MOBILE' | 'SPLIT';

export interface PaymentBreakdown {
  cash: number;
  card: number;
  mobile: number;
  card_reference?: string; // REQ-003: Payment reference for card transactions
}

export interface Transaction {
  id: string;
  items: CartItem[];
  total: number;
  subtotal?: number;
  vat_amount?: number;
  discount_amount?: number;
  timestamp: string;
  paymentMethod: PaymentMethod;
  paymentBreakdown?: PaymentBreakdown;
  card_reference?: string; // REQ-003: Added for single card payments
  user_id?: string;
  cashier_name?: string;
  received_amount?: number;
  change_amount?: number;
  created_at?: string;
  is_returned?: boolean;
  return_id?: string;
}

export type RefundStatus = 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
export type RefundType = 'FULL' | 'PARTIAL';

export interface ReturnItem {
  id: string; // Product/Inventory ID
  cartId: string; // cartId from the original transaction items
  name: string;
  quantity: number;
  price: number;
  type: 'PACKAGED_COFFEE' | 'BEVERAGE' | 'INGREDIENT';
  return_reason: string;
  is_inventory_updated: boolean;
}

export interface ReturnRequest {
  id: string;
  invoice_number: string;
  items: ReturnItem[];
  total_refund_amount: number;
  refund_type: RefundType;
  status: RefundStatus;
  manager_id?: string;
  manager_name?: string;
  requested_by_id: string;
  requested_by_name: string;
  created_at: string;
  updated_at?: string;
}

export interface PackagingUnit {
  id: string;
  timestamp: string;
  templateId: string;
  productId: string;
  size: string;
  quantity: number;
  operator: string;
  packagingCostTotal: number;
  productionDate: string;
  expiryDate: string;
  packagingDate: string;
  sku: string;
}

export interface RoastingBatch {
  id: string;
  beanId: string;
  roastDate: string;
  roastTime: string;
  level: RoastingLevel;
  preWeight: number;
  postWeight: number;
  wastePercentage: number;
  status: BatchStatus;
  operator: string;
  notes: string;
  history: any[];
  costPerKg: number;
  packagingUnits: PackagingUnit[];
}

export interface PackageTemplate {
  id: string;
  sizeLabel: string;
  weightInKg: number;
  unitCost: number;
  shelf_life_days: number;
  skuPrefix: string;
  isActive: boolean;
}

export interface GreenBean {
  id: string;
  origin: string;
  variety: string;
  quantity: number;
  cost_per_kg: number;
  supplier: string;
  purchase_date: string;
  harvest_date?: string;
  quality_grade?: string;
  batch_number?: string;
  is_organic?: boolean;
}

export interface ContactPerson {
  name: string;
  phone: string;
  email: string;
}

export interface Location {
  id: string;
  name: string;
  address: string;
  is_active: boolean;
  is_roastery: boolean;
  type?: 'WAREHOUSE' | 'BRANCH' | 'ROASTERY';
  contact_person?: ContactPerson;
}

export interface ReprintLog {
  id: string;
  transaction_id: string;
  user_id?: string;
  cashier_name: string;
  reprinted_at: string;
  reason?: string;
}

export interface SystemSettings {
  id: string;
  printer_width: '58mm' | '80mm';
  store_name: string;
  store_address: string;
  store_phone: string;
  store_logo_url?: string;
  vat_rate: number;
  vat_number?: string;
  currency: string;
}

export interface LoginCredentials {
  identifier: string;
  password: string;
  rememberMe?: boolean;
}

export interface Shift {
  id: string;
  cashier_id: string;
  cashier_name: string;
  start_time: string;
  end_time?: string;
  initial_cash: number;
  total_cash_sales: number;
  total_cash_returns: number;
  expected_cash?: number;
  actual_cash?: number;
  status: 'OPEN' | 'CLOSED';
  notes?: string;
}

export interface CashMovement {
  id: string;
  shift_id: string;
  type: 'IN' | 'OUT';
  amount: number;
  reason: string;
  created_at: string;
  created_by_id: string;
  created_by_name: string;
}
