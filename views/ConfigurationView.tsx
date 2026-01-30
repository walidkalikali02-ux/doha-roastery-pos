
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Settings, Plus, Trash2, Save, Scale, 
  Coffee, Loader2, Shield, X, Database, Copy, CheckCircle2,
  Tag, Power, PowerOff, AlertCircle, AlertTriangle, ArrowRight,
  RefreshCw, ImageIcon, DollarSign, PieChart, Info, TrendingUp,
  ExternalLink, Layers, Search, FlaskConical, Milk, Droplets, Utensils,
  Edit3, Beaker, Archive, HardDrive, Trash, Code2, ClipboardCheck,
  CheckCircle, DatabaseZap, Activity, Terminal, XCircle, FileText, ToggleLeft, ToggleRight,
  PlusCircle, MinusCircle, Calculator
} from 'lucide-react';
import { useLanguage, useTheme } from '../App';
import { PackageTemplate, ProductDefinition, RoastingLevel, UserRole, Recipe, RecipeIngredient, AddOn, InventoryItem, SystemSettings } from '../types';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';

const FULL_SCHEMA_COLUMNS = [
  'id', 'name', 'description', 'category', 'roast_level', 'template_id', 
  'base_price', 'is_active', 'type', 'recipe', 'image', 
  'labor_cost', 'roasting_overhead', 'estimated_green_bean_cost', 'add_ons'
];

const ConfigurationView: React.FC = () => {
  const { lang, t } = useLanguage();
  const { user } = useAuth();
  const { theme } = useTheme();
  
  const [activeSubTab, setActiveSubTab] = useState<'catalog' | 'templates' | 'database' | 'profile' | 'settings'>('catalog');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [templates, setTemplates] = useState<PackageTemplate[]>([]);
  const [products, setProducts] = useState<ProductDefinition[]>([]);
  const [allIngredients, setAllIngredients] = useState<InventoryItem[]>([]);
  const [settings, setSettings] = useState<SystemSettings>({
    id: '',
    printer_width: '80mm',
    store_name: 'Doha Roastery',
    store_address: '',
    store_phone: '',
    vat_rate: 0,
    currency: 'QAR'
  });
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [copyingSql, setCopyingSql] = useState(false);
  
  const [missingCols, setMissingCols] = useState<Set<string>>(new Set());
  const [dbStatus, setDbStatus] = useState<'checking' | 'ready' | 'needs_update'>('checking');

  const [showProductModal, setShowProductModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [productForm, setProductForm] = useState({
    name: '', 
    description: '',
    category: 'Coffee', 
    roastLevel: RoastingLevel.MEDIUM, 
    templateId: '', 
    basePrice: '', 
    image: '', 
    isActive: true,
    type: 'PACKAGED_COFFEE' as 'BEVERAGE' | 'PACKAGED_COFFEE',
    laborCost: '0', 
    roastingOverhead: '0', 
    estimatedGreenBeanCost: '0'
  });
  const [recipeIngredients, setRecipeIngredients] = useState<RecipeIngredient[]>([]);
  const [productAddOns, setProductAddOns] = useState<AddOn[]>([]);

  const checkSchemaIntegrity = useCallback(async () => {
    const missing = new Set<string>();
    for (const col of FULL_SCHEMA_COLUMNS) {
      if (['id', 'name', 'category', 'base_price'].includes(col)) continue;
      const { error } = await supabase.from('product_definitions').select(col).limit(1);
      if (error && (error.code === 'PGRST204' || error.message.includes('column'))) {
        missing.add(col);
      }
    }
    setMissingCols(missing);
    setDbStatus(missing.size === 0 ? 'ready' : 'needs_update');
    return missing;
  }, []);

  const fetchInitialData = useCallback(async () => {
    setIsLoadingData(true);
    const missing = await checkSchemaIntegrity();
    
    try {
      const [tplRes, prodRes, ingRes, settingsRes] = await Promise.all([
        supabase.from('package_templates').select('*').order('created_at', { ascending: false }),
        supabase.from('product_definitions').select(FULL_SCHEMA_COLUMNS.filter(c => !missing.has(c)).join(',')).order('created_at', { ascending: false }),
        supabase.from('inventory_items').select('*').eq('type', 'INGREDIENT'),
        supabase.from('system_settings').select('*').single()
      ]);

      if (tplRes.data) setTemplates(tplRes.data.map(mapTemplateFromDB));
      if (prodRes.data) setProducts(prodRes.data.map(mapProductFromDB));
      if (ingRes.data) setAllIngredients(ingRes.data);
      if (settingsRes.data) setSettings(settingsRes.data);
      
    } catch (err) {
      console.error("Data Load Error:", err);
    } finally {
      setIsLoadingData(false);
    }
  }, [checkSchemaIntegrity]);

  useEffect(() => { fetchInitialData(); }, [fetchInitialData]);

  const mapTemplateFromDB = (item: any): PackageTemplate => ({
    id: item.id, sizeLabel: item.size_label, weightInKg: item.weight_in_kg, unitCost: item.unit_cost || 0,
    isActive: item.is_active, shelf_life_days: item.shelf_life_days || 180, skuPrefix: item.sku_prefix
  });

  const mapProductFromDB = (item: any): ProductDefinition => ({
    id: item.id, 
    name: item.name, 
    description: item.description,
    category: item.category,
    roastLevel: item.roast_level, 
    templateId: item.template_id, 
    basePrice: item.base_price,
    isActive: item.is_active, 
    image: item.image, 
    type: item.type || 'PACKAGED_COFFEE',
    recipe: item.recipe, 
    laborCost: item.labor_cost, 
    roastingOverhead: item.roasting_overhead,
    estimatedGreenBeanCost: item.estimated_green_bean_cost,
    add_ons: item.add_ons || []
  });

  const sqlFixScript = `
-- سكريبت تحديث قاعدة بيانات محمصة الدوحة

-- Create system_settings table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.system_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    printer_width TEXT DEFAULT '80mm',
    store_name TEXT DEFAULT 'Doha Roastery',
    store_address TEXT,
    store_phone TEXT,
    vat_rate DECIMAL DEFAULT 0,
    currency TEXT DEFAULT 'QAR',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Insert default settings if not exists
 INSERT INTO public.system_settings (printer_width, store_name, currency)
 SELECT '80mm', 'Doha Roastery', 'QAR'
 WHERE NOT EXISTS (SELECT 1 FROM public.system_settings);
 
 -- Create reprint_logs table
 CREATE TABLE IF NOT EXISTS public.reprint_logs (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     transaction_id TEXT NOT NULL REFERENCES public.transactions(id),
     user_id UUID REFERENCES auth.users(id),
     cashier_name TEXT,
     reprinted_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
     reason TEXT
 );
 
 -- Update existing product_definitions table
ALTER TABLE IF EXISTS public.product_definitions 
ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'PACKAGED_COFFEE',
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS recipe JSONB DEFAULT '{"ingredients": []}',
ADD COLUMN IF NOT EXISTS add_ons JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS image TEXT,
ADD COLUMN IF NOT EXISTS labor_cost NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS roasting_overhead NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS estimated_green_bean_cost NUMERIC DEFAULT 0;

ALTER TABLE IF EXISTS public.inventory_items 
ADD COLUMN IF NOT EXISTS cost_per_unit NUMERIC DEFAULT 0;

NOTIFY pgrst, 'reload schema';
  `.trim();

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    
    const payload: any = {
      name: productForm.name,
      category: productForm.category,
      base_price: parseFloat(productForm.basePrice),
      is_active: productForm.isActive
    };

    if (editingId) payload.id = editingId;
    if (!missingCols.has('description')) payload.description = productForm.description;
    if (!missingCols.has('type')) payload.type = productForm.type;
    if (!missingCols.has('image')) payload.image = productForm.image;
    if (!missingCols.has('add_ons')) payload.add_ons = productAddOns;
    if (!missingCols.has('labor_cost')) payload.labor_cost = parseFloat(productForm.laborCost || '0');
    if (!missingCols.has('roasting_overhead')) payload.roasting_overhead = parseFloat(productForm.roastingOverhead || '0');
    if (!missingCols.has('estimated_green_bean_cost')) payload.estimated_green_bean_cost = parseFloat(productForm.estimatedGreenBeanCost || '0');

    if (productForm.type === 'PACKAGED_COFFEE') {
      payload.roast_level = productForm.roastLevel;
      payload.template_id = productForm.templateId || null;
      payload.recipe = null;
    } else {
      if (!missingCols.has('recipe')) {
        payload.recipe = { ingredients: recipeIngredients };
      }
      payload.roast_level = null;
      payload.template_id = null;
    }

    try {
      const { error } = await supabase.from('product_definitions').upsert([payload]);
      if (error) throw error;
      await fetchInitialData();
      setShowProductModal(false);
      resetProductForm();
      setSuccessMsg(t.saveSuccess);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err: any) {
      alert(err.message);
    } finally { setIsSaving(false); }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .upsert({
          ...settings,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      if (data) setSettings(data);
      
      setSuccessMsg(lang === 'ar' ? 'تم حفظ الإعدادات' : 'Settings saved');
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err) {
      console.error("Settings Save Error:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const resetProductForm = () => {
    setEditingId(null);
    setProductForm({ 
      name: '', description: '', category: 'Coffee', roastLevel: RoastingLevel.MEDIUM, 
      templateId: '', basePrice: '', image: '', isActive: true, type: 'PACKAGED_COFFEE',
      laborCost: '0', roastingOverhead: '0', estimatedGreenBeanCost: '0'
    });
    setRecipeIngredients([]);
    setProductAddOns([]);
  };

  const addIngredient = () => setRecipeIngredients([...recipeIngredients, { ingredient_id: '', name: '', amount: 0, unit: 'g' }]);
  const updateIngredient = (idx: number, field: string, value: any) => {
    const newIng = [...recipeIngredients];
    if (field === 'ingredient_id') {
      const selected = allIngredients.find(i => i.id === value);
      newIng[idx] = { ...newIng[idx], ingredient_id: value, name: selected?.name || '', unit: selected?.unit || 'g' };
    } else {
      newIng[idx] = { ...newIng[idx], [field]: value } as any;
    }
    setRecipeIngredients(newIng);
  };

  const addAddOn = () => setProductAddOns([...productAddOns, { id: crypto.randomUUID(), name: '', price: 0 }]);
  const updateAddOn = (idx: number, field: string, value: any) => {
    const newAddOns = [...productAddOns];
    newAddOns[idx] = { ...newAddOns[idx], [field]: value } as any;
    setProductAddOns(newAddOns);
  };

  const calculatedBeverageCost = useMemo(() => {
    if (productForm.type !== 'BEVERAGE') return 0;
    // REQ-002: Calculate beverage cost based on recipe ingredients
    return recipeIngredients.reduce((sum, ing) => {
      const dbIng = allIngredients.find(i => i.id === ing.ingredient_id);
      return sum + (ing.amount * (dbIng?.cost_per_unit || 0));
    }, 0);
  }, [productForm.type, recipeIngredients, allIngredients]);

  const calculatedAddOnsPrice = useMemo(() => {
    // REQ-001: Support beverage add-ons with additional pricing
    return productAddOns.reduce((sum, ao) => sum + ao.price, 0);
  }, [productAddOns]);

  const filteredProducts = useMemo(() => products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())), [products, searchTerm]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      {showSuccess && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-8 py-3 rounded-full font-bold flex items-center gap-3 shadow-xl z-[150] border border-green-200">
          <CheckCircle2 size={24} /> {successMsg}
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-amber-600 text-white rounded-[20px] shadow-lg shadow-amber-600/20"><Settings size={28} /></div>
          <div>
            <h2 className="text-2xl font-bold text-stone-800 dark:text-stone-100">{t.systemSetup}</h2>
            <p className="text-xs text-stone-500 font-bold uppercase">{lang === 'ar' ? 'إدارة المكونات والإضافات والتسعير' : 'Ingredient, Add-on & Price Management'}</p>
          </div>
        </div>
        <button onClick={() => { resetProductForm(); setShowProductModal(true); }} className="w-full md:w-auto bg-amber-600 text-white px-8 py-3.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all">
          <Plus size={18} /> {t.addProduct}
        </button>
      </div>

      <div className="flex flex-wrap gap-4 bg-stone-100 dark:bg-stone-800/50 p-2 rounded-2xl w-fit mb-10">
        {['catalog', 'templates', 'settings', 'database', 'profile'].map(tab => (
          <button 
            key={tab} onClick={() => setActiveSubTab(tab as any)}
            className={`px-6 py-2.5 rounded-xl text-xs font-bold transition-all ${activeSubTab === tab ? 'bg-white dark:bg-stone-900 text-amber-600 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
          >
            {tab === 'catalog' ? t.productCatalog : tab === 'templates' ? t.packageTemplates : tab === 'database' ? 'SQL' : tab === 'settings' ? t.printerSettings : t.profile}
          </button>
        ))}
      </div>

      {activeSubTab === 'catalog' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 animate-in slide-in-from-bottom-4">
          {filteredProducts.map(product => (
            <div key={product.id} className="bg-white dark:bg-stone-900 rounded-[32px] overflow-hidden border border-stone-200 dark:border-stone-800 shadow-sm group flex h-full">
              <div className="w-48 bg-stone-100 dark:bg-stone-800 relative shrink-0">
                <img src={product.image || 'https://picsum.photos/seed/coffee/200/200'} className="w-full h-full object-cover" />
                <div className="absolute top-4 left-4"><span className="bg-black/80 text-white text-[8px] font-black uppercase px-2 py-1 rounded-lg">{product.type}</span></div>
              </div>
              <div className="flex-1 p-6 flex flex-col">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h4 className="text-lg font-bold">{product.name}</h4>
                    <span className="text-[10px] text-amber-600 font-black uppercase">{product.category}</span>
                  </div>
                  <span className="text-xl font-black">{product.basePrice}<span className="text-[10px] ml-1 opacity-50">{t.currency}</span></span>
                </div>
                {product.type === 'BEVERAGE' && product.add_ons && product.add_ons.length > 0 && (
                  <div className="mb-4">
                    <span className="text-[8px] font-black text-stone-400 uppercase block mb-1">{lang === 'ar' ? 'الإضافات المتاحة' : 'Available Add-ons'}</span>
                    <div className="flex flex-wrap gap-1">
                      {product.add_ons.map(ao => <span key={ao.id} className="text-[9px] bg-stone-50 dark:bg-stone-800 px-2 py-0.5 rounded-md border border-stone-100 dark:border-stone-700">{ao.name} (+{ao.price})</span>)}
                    </div>
                  </div>
                )}
                <div className="mt-auto flex justify-end">
                  <button onClick={() => {
                    setEditingId(product.id);
                    setProductForm({ 
                      name: product.name, description: product.description || '', category: product.category, roastLevel: product.roastLevel || RoastingLevel.MEDIUM, 
                      templateId: product.templateId || '', basePrice: product.basePrice.toString(), image: product.image || '', isActive: product.isActive, type: product.type || 'PACKAGED_COFFEE',
                      laborCost: (product.laborCost || 0).toString(), roastingOverhead: (product.roastingOverhead || 0).toString(), estimatedGreenBeanCost: (product.estimatedGreenBeanCost || 0).toString()
                    });
                    setRecipeIngredients(product.recipe?.ingredients || []);
                    setProductAddOns(product.add_ons || []);
                    setShowProductModal(true);
                  }} className="p-2.5 text-amber-600 hover:bg-amber-50 rounded-xl transition-all"><Edit3 size={18} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeSubTab === 'database' && (
        <div className="bg-stone-900 rounded-[40px] p-10 text-white">
          <h3 className="text-2xl font-black mb-4 flex items-center gap-3 text-amber-500"><Terminal size={24}/> SQL Schema Upgrade</h3>
          <pre className="bg-black/50 p-6 rounded-2xl font-mono text-xs text-stone-400 whitespace-pre-wrap mb-6 border border-white/5">{sqlFixScript}</pre>
          <button onClick={() => { navigator.clipboard.writeText(sqlFixScript); setCopyingSql(true); setTimeout(()=>setCopyingSql(false), 2000); }} className="bg-white/10 hover:bg-white/20 px-6 py-3 rounded-xl text-sm font-bold flex items-center gap-2">{copyingSql ? <CheckCircle size={18} className="text-green-500"/> : <Copy size={18}/>} Copy SQL Script</button>
        </div>
      )}

      {activeSubTab === 'settings' && (
        <div className="max-w-4xl animate-in slide-in-from-bottom-4">
          <form onSubmit={handleSaveSettings} className="bg-white dark:bg-stone-900 rounded-[40px] p-10 border border-stone-200 dark:border-stone-800 shadow-sm space-y-10">
            <div className="flex items-center gap-4 border-b border-stone-100 dark:border-stone-800 pb-8">
              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 text-amber-600 rounded-2xl"><Settings size={32} /></div>
              <div>
                <h3 className="text-2xl font-bold">{t.printerSettings}</h3>
                <p className="text-stone-400 text-sm">{lang === 'ar' ? 'تكوين طابعة الإيصالات الحرارية' : 'Configure thermal receipt printer'}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest">{t.printerWidth}</label>
                  <div className="flex bg-stone-100 dark:bg-stone-800 p-1 rounded-2xl w-fit">
                    <button type="button" onClick={() => setSettings({...settings, printer_width: '58mm'})} className={`px-8 py-3 rounded-xl font-bold text-sm transition-all ${settings.printer_width === '58mm' ? 'bg-white dark:bg-stone-900 text-amber-600 shadow-sm' : 'text-stone-500'}`}>{t.width58mm}</button>
                    <button type="button" onClick={() => setSettings({...settings, printer_width: '80mm'})} className={`px-8 py-3 rounded-xl font-bold text-sm transition-all ${settings.printer_width === '80mm' ? 'bg-white dark:bg-stone-900 text-amber-600 shadow-sm' : 'text-stone-500'}`}>{t.width80mm}</button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest">{t.tax} (%)</label>
                  <input type="number" step="0.01" value={settings.vat_rate * 100} onChange={e => setSettings({...settings, vat_rate: parseFloat(e.target.value) / 100})} className="w-full bg-stone-50 dark:bg-stone-800 border-none rounded-2xl px-6 py-4 font-bold outline-none focus:ring-2 focus:ring-amber-500" />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest">{t.vatNumber}</label>
                  <input 
                    type="text" 
                    value={settings.vat_number || ''} 
                    onChange={e => setSettings({...settings, vat_number: e.target.value})} 
                    className="w-full bg-stone-50 dark:bg-stone-800 border-none rounded-2xl px-6 py-4 font-bold outline-none focus:ring-2 focus:ring-amber-500" 
                    placeholder="e.g. 123456789"
                  />
                </div>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest">{lang === 'ar' ? 'اسم المتجر' : 'Store Name'}</label>
                  <input type="text" value={settings.store_name} onChange={e => setSettings({...settings, store_name: e.target.value})} className="w-full bg-stone-50 dark:bg-stone-800 border-none rounded-2xl px-6 py-4 font-bold outline-none focus:ring-2 focus:ring-amber-500" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest">{lang === 'ar' ? 'عنوان المتجر' : 'Store Address'}</label>
                  <input type="text" value={settings.store_address} onChange={e => setSettings({...settings, store_address: e.target.value})} className="w-full bg-stone-50 dark:bg-stone-800 border-none rounded-2xl px-6 py-4 font-bold outline-none focus:ring-2 focus:ring-amber-500" />
                </div>
              </div>
            </div>

            <div className="pt-6 flex justify-end">
              <button type="submit" disabled={isSaving} className="bg-amber-600 text-white px-10 py-4 rounded-2xl font-black shadow-xl active:scale-95 transition-all flex items-center gap-3">
                {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />} {t.saveChanges}
              </button>
            </div>
          </form>
        </div>
      )}

      {showProductModal && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md overflow-y-auto">
          <div className="bg-white dark:bg-stone-900 rounded-[40px] max-w-5xl w-full p-8 md:p-12 shadow-2xl animate-in zoom-in-95 my-8" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
            <div className="flex justify-between items-center mb-10 border-b border-stone-100 pb-8">
              <div className="flex items-center gap-4">
                <div className="p-4 bg-amber-50 dark:bg-amber-900/20 text-amber-600 rounded-2xl"><Tag size={32} /></div>
                <h3 className="text-2xl font-bold">{editingId ? (lang === 'ar' ? 'تعديل المنتج' : 'Edit Product') : (lang === 'ar' ? 'منتج جديد' : 'New Product')}</h3>
              </div>
              <button onClick={() => setShowProductModal(false)} className="p-2 hover:bg-stone-100 rounded-full transition-colors text-stone-400"><X size={36} /></button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-10">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                <div className="space-y-8">
                  <div className="flex bg-stone-100 dark:bg-stone-800 p-1 rounded-2xl w-fit">
                    <button type="button" onClick={() => setProductForm({...productForm, type: 'PACKAGED_COFFEE'})} className={`px-6 py-3 rounded-xl font-bold text-xs transition-all ${productForm.type === 'PACKAGED_COFFEE' ? 'bg-white dark:bg-stone-900 text-amber-600 shadow-sm' : 'text-stone-500'}`}>{lang === 'ar' ? 'بن معبأ' : 'Packaged'}</button>
                    <button type="button" onClick={() => setProductForm({...productForm, type: 'BEVERAGE'})} className={`px-6 py-3 rounded-xl font-bold text-xs transition-all ${productForm.type === 'BEVERAGE' ? 'bg-white dark:bg-stone-900 text-amber-600 shadow-sm' : 'text-stone-500'}`}>{lang === 'ar' ? 'مشروب' : 'Beverage'}</button>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest">{t.productName}</label>
                    <input type="text" required value={productForm.name} onChange={e => setProductForm({...productForm, name: e.target.value})} className="w-full bg-stone-50 dark:bg-stone-800 border-none rounded-2xl px-6 py-4 font-bold outline-none focus:ring-2 focus:ring-amber-500" />
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest">{t.sellingPrice}</label>
                      <input type="number" step="0.01" required value={productForm.basePrice} onChange={e => setProductForm({...productForm, basePrice: e.target.value})} className="w-full bg-stone-50 dark:bg-stone-800 border-none rounded-2xl px-6 py-4 font-mono font-bold text-amber-600" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest">{lang === 'ar' ? 'رابط الصورة' : 'Image URL'}</label>
                      <input type="text" value={productForm.image} onChange={e => setProductForm({...productForm, image: e.target.value})} className="w-full bg-stone-50 dark:bg-stone-800 border-none rounded-2xl px-6 py-4 text-xs font-mono" placeholder="https://..." />
                    </div>
                  </div>

                  {productForm.type === 'BEVERAGE' ? (
                    <div className="space-y-6">
                      <div className="space-y-4">
                        <div className="flex justify-between items-center border-b border-stone-100 pb-2">
                          <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest flex items-center gap-2"><FlaskConical size={12}/> {lang === 'ar' ? 'مكونات المشروب' : 'Beverage Recipe'}</label>
                          <button type="button" onClick={addIngredient} className="text-amber-600 font-bold text-xs flex items-center gap-1"><PlusCircle size={14}/> {lang === 'ar' ? 'إضافة مكون' : 'Add Item'}</button>
                        </div>
                        <div className="space-y-3 max-h-48 overflow-y-auto custom-scrollbar">
                          {recipeIngredients.map((ing, idx) => (
                            <div key={idx} className="flex gap-2 items-center">
                              <select required value={ing.ingredient_id} onChange={e => updateIngredient(idx, 'ingredient_id', e.target.value)} className="flex-1 bg-stone-50 dark:bg-stone-800 border-none rounded-xl px-3 py-2 text-xs font-bold">
                                <option value="">-- {lang === 'ar' ? 'اختر المكون' : 'Select'} --</option>
                                {allIngredients.map(i => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
                              </select>
                              <input type="number" required value={ing.amount} onChange={e => updateIngredient(idx, 'amount', parseFloat(e.target.value))} className="w-20 bg-stone-50 dark:bg-stone-800 border-none rounded-xl px-3 py-2 text-xs font-mono font-bold" placeholder="Qty" />
                              <button type="button" onClick={() => setRecipeIngredients(recipeIngredients.filter((_, i) => i !== idx))} className="text-stone-300 hover:text-red-500"><MinusCircle size={18}/></button>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="flex justify-between items-center border-b border-stone-100 pb-2">
                          <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest flex items-center gap-2"><PlusCircle size={12}/> {lang === 'ar' ? 'إضافات مدفوعة (Add-ons)' : 'Paid Add-ons'}</label>
                          <button type="button" onClick={addAddOn} className="text-amber-600 font-bold text-xs flex items-center gap-1"><Plus size={14}/> {lang === 'ar' ? 'إضافة خيار' : 'Add Option'}</button>
                        </div>
                        <div className="space-y-3">
                          {productAddOns.map((ao, idx) => (
                            <div key={ao.id} className="flex gap-2 items-center animate-in slide-in-from-top-1">
                              <input type="text" placeholder={lang === 'ar' ? 'اسم الإضافة' : 'Extra Name'} value={ao.name} onChange={e => updateAddOn(idx, 'name', e.target.value)} className="flex-1 bg-stone-50 dark:bg-stone-800 border-none rounded-xl px-3 py-2 text-xs font-bold" />
                              <input type="number" placeholder="Price" value={ao.price} onChange={e => updateAddOn(idx, 'price', parseFloat(e.target.value))} className="w-24 bg-stone-50 dark:bg-stone-800 border-none rounded-xl px-3 py-2 text-xs font-mono font-bold text-amber-600" />
                              <button type="button" onClick={() => setProductAddOns(productAddOns.filter((_, i) => i !== idx))} className="text-stone-300 hover:text-red-500"><Trash2 size={16}/></button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest">{t.chooseTemplate}</label>
                        <select required value={productForm.templateId} onChange={e => setProductForm({...productForm, templateId: e.target.value})} className="w-full bg-stone-50 dark:bg-stone-800 border-none rounded-2xl px-6 py-4 font-bold">
                          <option value="">-- {t.chooseTemplate} --</option>
                          {templates.map(tpl => <option key={tpl.id} value={tpl.id}>{tpl.sizeLabel}</option>)}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest">{t.roastLevel}</label>
                        <select value={productForm.roastLevel} onChange={e => setProductForm({...productForm, roastLevel: e.target.value as RoastingLevel})} className="w-full bg-stone-50 dark:bg-stone-800 border-none rounded-2xl px-6 py-4 font-bold">
                          <option value={RoastingLevel.LIGHT}>{t.light}</option>
                          <option value={RoastingLevel.MEDIUM}>{t.medium}</option>
                          <option value={RoastingLevel.DARK}>{t.dark}</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-stone-900 rounded-[40px] p-10 text-white space-y-8 shadow-inner border border-white/5 relative overflow-hidden">
                   <h4 className="text-xl font-black flex items-center gap-3 border-b border-white/10 pb-6"><Calculator size={24} className="text-amber-500" /> {lang === 'ar' ? 'تحليل التكلفة الذكي' : 'Smart Cost Analysis'}</h4>
                   
                   {productForm.type === 'BEVERAGE' ? (
                     <div className="space-y-6">
                        <div className="bg-white/5 p-6 rounded-3xl border border-white/10">
                           <span className="text-[10px] font-black text-stone-400 uppercase block mb-3">{lang === 'ar' ? 'تكلفة المكونات (حسب الوصفة)' : 'Ingredient Cost (Calculated)'}</span>
                           <div className="flex justify-between items-end">
                              <span className="text-4xl font-black font-mono text-amber-500">{calculatedBeverageCost.toFixed(2)}</span>
                              <span className="text-xs font-bold text-stone-500 mb-1">{t.currency} / {lang === 'ar' ? 'كوب' : 'Cup'}</span>
                           </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                           <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                              <span className="text-[8px] font-black text-stone-500 uppercase block mb-1">{lang === 'ar' ? 'تكلفة التشغيل' : 'Ops Cost'}</span>
                              <input type="number" step="0.01" value={productForm.roastingOverhead} onChange={e => setProductForm({...productForm, roastingOverhead: e.target.value})} className="w-full bg-transparent border-none p-0 font-bold text-stone-100 outline-none" />
                           </div>
                           <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                              <span className="text-[8px] font-black text-stone-500 uppercase block mb-1">{lang === 'ar' ? 'تكلفة العمالة' : 'Labor Cost'}</span>
                              <input type="number" step="0.01" value={productForm.laborCost} onChange={e => setProductForm({...productForm, laborCost: e.target.value})} className="w-full bg-transparent border-none p-0 font-bold text-stone-100 outline-none" />
                           </div>
                        </div>
                        <div className="pt-6 border-t border-white/10">
                           <div className="flex justify-between items-center">
                              <span className="text-sm font-bold text-stone-400 uppercase tracking-widest">{lang === 'ar' ? 'هامش الربح المتوقع' : 'Expected Margin'}</span>
                              <span className="text-4xl font-black text-green-400">
                                {parseFloat(productForm.basePrice) > 0 
                                  ? (((parseFloat(productForm.basePrice) - (calculatedBeverageCost + parseFloat(productForm.laborCost) + parseFloat(productForm.roastingOverhead))) / parseFloat(productForm.basePrice)) * 100).toFixed(0)
                                  : '0'}%
                              </span>
                           </div>
                        </div>
                     </div>
                   ) : (
                     <div className="space-y-6">
                        <div className="space-y-2">
                           <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest">{lang === 'ar' ? 'تكلفة البن الأخضر (للكجم)' : 'Green Bean Cost'}</label>
                           <input type="number" step="0.01" value={productForm.estimatedGreenBeanCost} onChange={e => setProductForm({...productForm, estimatedGreenBeanCost: e.target.value})} className="w-full bg-white/5 border-none rounded-2xl px-6 py-4 font-mono font-bold text-amber-500 outline-none" />
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                           <div className="space-y-2">
                              <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest">{lang === 'ar' ? 'تكلفة العمالة' : 'Labor'}</label>
                              <input type="number" step="0.01" value={productForm.laborCost} onChange={e => setProductForm({...productForm, laborCost: e.target.value})} className="w-full bg-white/5 border-none rounded-2xl px-6 py-4 font-mono font-bold" />
                           </div>
                           <div className="space-y-2">
                              <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest">{lang === 'ar' ? 'مصاريف التشغيل' : 'Ops'}</label>
                              <input type="number" step="0.01" value={productForm.roastingOverhead} onChange={e => setProductForm({...productForm, roastingOverhead: e.target.value})} className="w-full bg-white/5 border-none rounded-2xl px-6 py-4 font-mono font-bold" />
                           </div>
                        </div>
                     </div>
                   )}
                </div>
              </div>

              <div className="pt-10 flex gap-6 border-t border-stone-100 dark:border-stone-800">
                <button type="button" onClick={() => setShowProductModal(false)} className="flex-1 py-5 font-black text-stone-400 uppercase tracking-widest hover:text-stone-600">{t.cancel}</button>
                <button type="submit" disabled={isSaving} className="flex-[3] bg-amber-600 text-white py-5 rounded-[24px] font-black shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-4 text-xl">
                  {isSaving ? <Loader2 className="animate-spin" size={28} /> : <Save size={28} />} {editingId ? t.saveChanges : t.addProduct}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConfigurationView;
