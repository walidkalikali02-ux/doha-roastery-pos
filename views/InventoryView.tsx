
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Package, Search, Plus, X, Edit, Trash2, 
  Loader2, CheckCircle2, Save, Database, AlertCircle, CloudOff, Cloud,
  MapPin, Store, Building2, User as UserIcon, Phone, 
  ChevronRight, Box, Coffee, Check, AlertTriangle, Users, Power, PowerOff,
  Activity, ArrowRightLeft, LayoutGrid, List, RefreshCw, Filter, Calendar, Tag, Layers,
  RotateCcw, FileDown, FileSpreadsheet, Printer, DollarSign, Truck, Clock, 
  ChevronDown, ArrowRight, Clipboard, Send, ThumbsUp, PackageCheck, Ban, Scale,
  Minus, FileCheck, ClipboardCheck, Signature, History, ArrowDown, ArrowUp, FileText,
  Settings as SettingsIcon, XCircle
} from 'lucide-react';
import { useLanguage, useTheme } from '../App';
import { GreenBean, Location, InventoryItem, ContactPerson, ProductDefinition, UserRole } from '../types';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';

type TransferStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'IN_TRANSIT' | 'RECEIVED' | 'COMPLETED' | 'CANCELLED';
type AdjustmentReason = 'DAMAGE' | 'THEFT' | 'COUNTING_ERROR' | 'EXPIRY' | 'OTHER';
type AdjustmentStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

const TRANSFER_APPROVAL_THRESHOLD = 5000;
const ADJUSTMENT_APPROVAL_THRESHOLD = 1000;

interface TransferOrder {
  id: string;
  source_location_id: string;
  destination_location_id: string;
  status: TransferStatus;
  created_at: string;
  items_count: number;
  notes?: string;
  source_name?: string;
  destination_name?: string;
  manifest?: any[];
  received_manifest?: any[];
  total_value?: number;
  received_at?: string;
}

interface StockAdjustment {
  id: string;
  item_id: string;
  location_id: string;
  quantity: number;
  reason: AdjustmentReason;
  notes: string;
  status: AdjustmentStatus;
  created_at: string;
  user_name: string;
  item_name?: string;
  location_name?: string;
  value?: number;
}

const InventoryView: React.FC = () => {
  const { lang, t } = useLanguage();
  const { user } = useAuth();
  const { theme } = useTheme();
  
  const [activeTab, setActiveTab] = useState<'locations' | 'packaged' | 'transfers' | 'adjustments'>('locations');
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  
  const [packagedItems, setPackagedItems] = useState<InventoryItem[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [adjustments, setAdjustments] = useState<StockAdjustment[]>([]);
  const [transferOrders, setTransferOrders] = useState<TransferOrder[]>([]);

  const [adjustmentForm, setAdjustmentForm] = useState({
    locationId: '',
    itemId: '',
    quantity: '',
    reason: 'COUNTING_ERROR' as AdjustmentReason,
    notes: ''
  });

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [invRes, locRes, adjRes, transRes] = await Promise.all([
        supabase.from('inventory_items').select('*'),
        supabase.from('locations').select('*').order('name', { ascending: true }),
        supabase.from('stock_adjustments').select('*').order('created_at', { ascending: false }),
        supabase.from('stock_transfers').select('*').order('created_at', { ascending: false })
      ]);

      if (invRes.data) setPackagedItems(invRes.data);
      if (locRes.data) setLocations(locRes.data);
      if (adjRes.data) setAdjustments(adjRes.data);
      if (transRes.data) setTransferOrders(transRes.data);

      setLastUpdated(new Date());
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSaveAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustmentForm.notes || adjustmentForm.notes.length < 10) {
      alert(lang === 'ar' ? 'يجب كتابة تبرير مفصل (10 أحرف على الأقل)' : 'Please provide a detailed justification (min 10 chars)');
      return;
    }

    setIsSaving(true);
    try {
      const item = packagedItems.find(i => i.id === adjustmentForm.itemId);
      const qty = parseInt(adjustmentForm.quantity);
      const adjValue = Math.abs(qty * (item?.price || 0));
      const needsApproval = adjValue > ADJUSTMENT_APPROVAL_THRESHOLD;

      const payload = {
        item_id: adjustmentForm.itemId,
        location_id: adjustmentForm.locationId,
        quantity: qty,
        reason: adjustmentForm.reason,
        notes: adjustmentForm.notes,
        status: needsApproval ? 'PENDING' : 'APPROVED',
        user_name: user?.name || 'System',
        item_name: item?.name,
        location_name: locations.find(l => l.id === adjustmentForm.locationId)?.name,
        value: adjValue
      };

      const { error: adjError } = await supabase.from('stock_adjustments').insert([payload]);
      if (adjError) throw adjError;

      // If it doesn't need approval, update stock immediately
      if (!needsApproval && item) {
        const { error: invError } = await supabase.from('inventory_items')
          .update({ stock: Math.max(0, item.stock + qty) })
          .eq('id', item.id);
        if (invError) throw invError;
      }

      setSuccessMsg(needsApproval 
        ? (lang === 'ar' ? 'التسوية بانتظار موافقة الإدارة' : 'Adjustment pending manager approval') 
        : (lang === 'ar' ? 'تمت التسوية بنجاح' : 'Adjustment saved successfully'));
      
      setShowSuccess(true);
      setShowAdjustmentModal(false);
      setAdjustmentForm({ locationId: '', itemId: '', quantity: '', reason: 'COUNTING_ERROR', notes: '' });
      fetchData();
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err) {
      console.error(err);
      alert("Error saving adjustment");
    } finally {
      setIsSaving(false);
    }
  };

  const handleApproveAdjustment = async (adj: StockAdjustment, newStatus: 'APPROVED' | 'REJECTED') => {
    if (!user || (user.role !== UserRole.ADMIN && user.role !== UserRole.MANAGER)) return;
    
    setIsSaving(true);
    try {
      // 1. Update Adjustment Status
      const { error: adjError } = await supabase.from('stock_adjustments').update({ status: newStatus }).eq('id', adj.id);
      if (adjError) throw adjError;

      // 2. If approved, update inventory
      if (newStatus === 'APPROVED') {
        const item = packagedItems.find(i => i.id === adj.item_id);
        if (item) {
          const { error: invError } = await supabase.from('inventory_items')
            .update({ stock: Math.max(0, item.stock + adj.quantity) })
            .eq('id', item.id);
          if (invError) throw invError;
        }
      }

      setSuccessMsg(lang === 'ar' ? 'تم تحديث حالة التسوية' : 'Adjustment status updated');
      setShowSuccess(true);
      fetchData();
      setTimeout(() => setShowSuccess(false), 2000);
    } catch (err) {
      console.error(err);
      alert("Approval action failed");
    } finally {
      setIsSaving(false);
    }
  };

  const reasonLabels: Record<AdjustmentReason, { ar: string, en: string }> = {
    DAMAGE: { ar: 'تلف', en: 'Damage' },
    THEFT: { ar: 'سرقة', en: 'Theft' },
    COUNTING_ERROR: { ar: 'خطأ جرد', en: 'Counting Error' },
    EXPIRY: { ar: 'انتهاء صلاحية', en: 'Expiry' },
    OTHER: { ar: 'أخرى', en: 'Other' }
  };

  const isAdmin = user?.role === UserRole.ADMIN || user?.role === UserRole.MANAGER;

  return (
    <div className="space-y-6 md:space-y-8 animate-in slide-in-from-right-4 duration-500 pb-20">
      {showSuccess && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-8 py-3 rounded-full font-bold flex items-center gap-3 shadow-xl z-[150] border border-green-200">
          <CheckCircle2 size={24} /> {successMsg}
        </div>
      )}

      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex gap-4 items-start">
           <div className="p-3 bg-amber-600 text-white rounded-[20px] shadow-lg shadow-amber-600/20"><Package size={28} /></div>
           <div>
             <h2 className="text-xl md:text-2xl font-bold text-stone-800 dark:text-stone-100">{t.stockAndDistribution}</h2>
             <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-stone-400">
               <Activity size={10} className="text-green-500" /> {lang === 'ar' ? 'نظام الرقابة المركزي' : 'Central Control System'}
             </div>
           </div>
        </div>
        <div className="flex bg-stone-100 dark:bg-stone-800 p-1 rounded-2xl w-full md:w-auto overflow-x-auto no-scrollbar shadow-sm">
           <button onClick={() => setActiveTab('locations')} className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${activeTab === 'locations' ? 'bg-white dark:bg-stone-900 text-amber-600 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}><MapPin size={16} /> {t.locations}</button>
           <button onClick={() => setActiveTab('packaged')} className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${activeTab === 'packaged' ? 'bg-white dark:bg-stone-900 text-amber-600 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}><Box size={16} /> {lang === 'ar' ? 'الجرد' : 'Inventory'}</button>
           <button onClick={() => setActiveTab('transfers')} className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${activeTab === 'transfers' ? 'bg-white dark:bg-stone-900 text-amber-600 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}><Truck size={16} /> {lang === 'ar' ? 'التحويلات' : 'Transfers'}</button>
           <button onClick={() => setActiveTab('adjustments')} className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${activeTab === 'adjustments' ? 'bg-white dark:bg-stone-900 text-amber-600 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}><History size={16} /> {lang === 'ar' ? 'سجل التسويات' : 'Adjustment Log'}</button>
        </div>
      </div>

      <div className="bg-white dark:bg-stone-900 rounded-[40px] shadow-sm border border-stone-200 dark:border-stone-800 overflow-hidden min-h-[500px]">
        <div className="p-6 border-b border-stone-50 dark:border-stone-800 flex flex-col md:flex-row items-center gap-4 bg-stone-50/50 dark:bg-stone-800/20">
          <div className="relative flex-1 w-full">
            <Search className={`absolute ${lang === 'ar' ? 'right-5' : 'left-5'} top-1/2 -translate-y-1/2 text-stone-400`} size={20} />
            <input 
              type="text" 
              placeholder={lang === 'ar' ? 'البحث...' : 'Search...'} 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full bg-white dark:bg-stone-800 border-none rounded-2xl ${lang === 'ar' ? 'pr-14 pl-6' : 'pl-14 pr-6'} py-4 text-sm outline-none focus:ring-2 focus:ring-amber-500 shadow-sm transition-all`}
            />
          </div>
          <button onClick={() => setShowAdjustmentModal(true)} className="bg-red-600 text-white px-6 py-4 rounded-2xl font-bold shadow-lg hover:bg-red-700 flex items-center gap-2 w-full md:w-auto justify-center transition-all active:scale-95">
             <History size={20} /> <span>{lang === 'ar' ? 'تسوية جديدة' : 'New Adjustment'}</span>
          </button>
        </div>

        {activeTab === 'adjustments' ? (
          <div className="overflow-x-auto">
             <table className={`w-full ${lang === 'ar' ? 'text-right' : 'text-left'} text-sm min-w-[1000px]`}>
              <thead className="bg-stone-50 dark:bg-stone-950 text-stone-500 uppercase text-[10px] font-black tracking-widest border-b border-stone-100 dark:border-stone-800">
                <tr>
                   <th className="px-8 py-5">التاريخ</th>
                   <th className="px-8 py-5">الصنف</th>
                   <th className="px-8 py-5">الكمية</th>
                   <th className="px-8 py-5">السبب والمبرر</th>
                   <th className="px-8 py-5">الحالة</th>
                   <th className="px-8 py-5">المستخدم</th>
                   {isAdmin && <th className="px-8 py-5">الإجراء</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                {adjustments.map(adj => (
                  <tr key={adj.id} className="hover:bg-stone-50/50 transition-colors">
                    <td className="px-8 py-5 text-stone-500 font-mono text-xs">{new Date(adj.created_at).toLocaleString()}</td>
                    <td className="px-8 py-5">
                       <div className="font-bold">{adj.item_name}</div>
                       <div className="text-[10px] text-stone-400">{adj.location_name}</div>
                    </td>
                    <td className="px-8 py-5">
                       <span className={`flex items-center gap-1 font-black ${adj.quantity > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {adj.quantity > 0 ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
                          {Math.abs(adj.quantity)}
                       </span>
                    </td>
                    <td className="px-8 py-5 max-w-[300px]">
                       <div className="flex flex-col gap-1">
                          <span className="px-2 py-0.5 bg-stone-100 dark:bg-stone-800 rounded text-[10px] font-bold uppercase w-fit">{reasonLabels[adj.reason][lang]}</span>
                          <span className="text-xs text-stone-500 italic truncate" title={adj.notes}>{adj.notes}</span>
                       </div>
                    </td>
                    <td className="px-8 py-5">
                       <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase ${
                         adj.status === 'APPROVED' ? 'bg-green-50 text-green-600' : 
                         adj.status === 'PENDING' ? 'bg-amber-50 text-amber-600 animate-pulse' : 
                         'bg-red-50 text-red-600'
                       }`}>
                          {adj.status}
                       </span>
                    </td>
                    <td className="px-8 py-5 font-medium">{adj.user_name}</td>
                    {isAdmin && (
                      <td className="px-8 py-5">
                         {adj.status === 'PENDING' && (
                           <div className="flex items-center gap-2">
                             <button onClick={() => handleApproveAdjustment(adj, 'APPROVED')} className="p-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-600 hover:text-white transition-all"><Check size={16}/></button>
                             <button onClick={() => handleApproveAdjustment(adj, 'REJECTED')} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-600 hover:text-white transition-all"><X size={16}/></button>
                           </div>
                         )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
             </table>
          </div>
        ) : activeTab === 'packaged' ? (
          <div className="overflow-x-auto">
            <table className={`w-full ${lang === 'ar' ? 'text-right' : 'text-left'} text-sm min-w-[1000px]`}>
              <thead className="bg-stone-50 dark:bg-stone-950 text-stone-500 uppercase text-[10px] font-black tracking-widest border-b border-stone-100 dark:border-stone-800">
                <tr>
                   <th className="px-8 py-5">المنتج</th>
                   <th className="px-8 py-5">الموقع</th>
                   <th className="px-8 py-5">المخزون الحالي</th>
                   <th className="px-8 py-5">الإجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                 {packagedItems.filter(i => i.name.toLowerCase().includes(searchTerm.toLowerCase())).map(item => (
                   <tr key={item.id} className="hover:bg-stone-50/50">
                     <td className="px-8 py-5 font-bold">{item.name}</td>
                     <td className="px-8 py-5 text-stone-500">{locations.find(l => l.id === item.location_id)?.name || 'Central'}</td>
                     <td className="px-8 py-5 font-mono font-black">{item.stock}</td>
                     <td className="px-8 py-5">
                        <button onClick={() => { setAdjustmentForm({...adjustmentForm, locationId: item.location_id || '', itemId: item.id}); setShowAdjustmentModal(true); }} className="p-2 text-stone-400 hover:text-red-600 transition-colors"><ArrowRightLeft size={18} /></button>
                     </td>
                   </tr>
                 ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {locations.map(loc => (
              <div key={loc.id} className="bg-white dark:bg-stone-900 border border-stone-100 dark:border-stone-800 p-8 rounded-[32px] shadow-sm hover:shadow-xl transition-all group">
                 <div className="flex justify-between items-start mb-6">
                    <div className="p-4 bg-stone-50 dark:bg-stone-800 text-stone-400 group-hover:bg-amber-600 group-hover:text-white rounded-2xl transition-colors">
                       {loc.is_roastery ? <Coffee size={24}/> : <Store size={24}/>}
                    </div>
                    <span className="text-[10px] font-black uppercase text-amber-600 bg-amber-50 px-3 py-1 rounded-full">{loc.is_roastery ? 'Roastery' : 'Branch'}</span>
                 </div>
                 <h4 className="text-xl font-bold mb-2">{loc.name}</h4>
                 <p className="text-xs text-stone-500 line-clamp-2">{loc.address}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Stock Adjustment Modal */}
      {showAdjustmentModal && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md overflow-y-auto">
          <div className="bg-white dark:bg-stone-900 rounded-[40px] max-w-2xl w-full p-8 md:p-10 shadow-2xl animate-in zoom-in-95 my-8" dir={t.dir}>
            <div className="flex justify-between items-center mb-8 border-b border-stone-100 dark:border-stone-800 pb-6">
              <div className="flex items-center gap-4">
                 <div className="p-3 bg-red-600 text-white rounded-2xl shadow-lg"><ArrowRightLeft size={28} /></div>
                 <div>
                    <h3 className="text-2xl font-bold">{lang === 'ar' ? 'تسوية المخزون' : 'Stock Adjustment'}</h3>
                    <p className="text-xs text-stone-500 font-medium">{lang === 'ar' ? 'تعديل الكميات يدوياً يتطلب تبريراً دقيقاً' : 'Manual stock updates require precise justification'}</p>
                 </div>
              </div>
              <button onClick={() => setShowAdjustmentModal(false)} className="p-2 hover:bg-stone-100 rounded-full transition-colors"><X size={32} className="text-stone-400" /></button>
            </div>

            <form onSubmit={handleSaveAdjustment} className="space-y-6">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                     <label className="text-[10px] font-black uppercase text-stone-400 flex items-center gap-1.5"><MapPin size={12} /> {lang === 'ar' ? 'الموقع' : 'Location'}</label>
                     <select 
                       required 
                       value={adjustmentForm.locationId} 
                       onChange={e => setAdjustmentForm({...adjustmentForm, locationId: e.target.value, itemId: ''})} 
                       className="w-full bg-stone-50 dark:bg-stone-800 border-none rounded-2xl px-5 py-4 font-bold outline-none focus:ring-2 focus:ring-red-500"
                     >
                        <option value="">-- {lang === 'ar' ? 'اختر الموقع' : 'Select Location'} --</option>
                        {locations.map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
                     </select>
                  </div>
                  <div className="space-y-1.5">
                     <label className="text-[10px] font-black uppercase text-stone-400 flex items-center gap-1.5"><Box size={12} /> {lang === 'ar' ? 'الصنف' : 'Item'}</label>
                     <select 
                       required 
                       disabled={!adjustmentForm.locationId}
                       value={adjustmentForm.itemId} 
                       onChange={e => setAdjustmentForm({...adjustmentForm, itemId: e.target.value})} 
                       className="w-full bg-stone-50 dark:bg-stone-800 border-none rounded-2xl px-5 py-4 font-bold outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50"
                     >
                        <option value="">-- {lang === 'ar' ? 'اختر الصنف' : 'Select Item'} --</option>
                        {packagedItems.filter(i => i.location_id === adjustmentForm.locationId).map(i => <option key={i.id} value={i.id}>{i.name} ({i.stock} {t.currentStock})</option>)}
                     </select>
                  </div>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                     <label className="text-[10px] font-black uppercase text-stone-400 flex items-center gap-1.5"><ArrowRightLeft size={12} /> {lang === 'ar' ? 'الكمية للتعديل (+ أو -)' : 'Adjustment Quantity (+ or -)'}</label>
                     <input 
                       type="number" 
                       required 
                       value={adjustmentForm.quantity} 
                       onChange={e => setAdjustmentForm({...adjustmentForm, quantity: e.target.value})} 
                       placeholder="-5"
                       className="w-full bg-stone-50 dark:bg-stone-800 border-none rounded-2xl px-5 py-4 font-mono font-bold outline-none focus:ring-2 focus:ring-red-500" 
                     />
                  </div>
                  <div className="space-y-1.5">
                     <label className="text-[10px] font-black uppercase text-stone-400 flex items-center gap-1.5"><AlertCircle size={12} /> {lang === 'ar' ? 'سبب التسوية' : 'Adjustment Reason'}</label>
                     <select 
                       required 
                       value={adjustmentForm.reason} 
                       onChange={e => setAdjustmentForm({...adjustmentForm, reason: e.target.value as AdjustmentReason})} 
                       className="w-full bg-stone-50 dark:bg-stone-800 border-none rounded-2xl px-5 py-4 font-bold outline-none focus:ring-2 focus:ring-red-500"
                     >
                        <option value="COUNTING_ERROR">{lang === 'ar' ? 'خطأ جرد' : 'Counting Error'}</option>
                        <option value="DAMAGE">{lang === 'ar' ? 'تلف' : 'Damage'}</option>
                        <option value="EXPIRY">{lang === 'ar' ? 'انتهاء صلاحية' : 'Expiry'}</option>
                        <option value="THEFT">{lang === 'ar' ? 'سرقة' : 'Theft'}</option>
                        <option value="OTHER">{lang === 'ar' ? 'أخرى' : 'Other'}</option>
                     </select>
                  </div>
               </div>

               <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-stone-400 flex items-center gap-1.5"><Clipboard size={12} /> {lang === 'ar' ? 'التبرير / الملاحظات (إلزامي)' : 'Notes / Justification (Required)'}</label>
                  <textarea 
                    rows={3} 
                    required
                    value={adjustmentForm.notes} 
                    onChange={e => setAdjustmentForm({...adjustmentForm, notes: e.target.value})} 
                    className="w-full bg-stone-50 dark:bg-stone-800 border-none rounded-2xl px-5 py-4 outline-none focus:ring-2 focus:ring-red-500 resize-none text-sm" 
                    placeholder={lang === 'ar' ? 'يرجى كتابة المبرر المالي للعملية لغايات التدقيق...' : 'Please state the financial justification for audit purposes...'}
                  />
               </div>

               <div className="pt-6 flex gap-4">
                  <button type="button" onClick={() => setShowAdjustmentModal(false)} className="flex-1 py-4 font-bold text-stone-400 uppercase tracking-widest">{t.cancel}</button>
                  <button type="submit" disabled={isSaving} className="flex-[2] bg-red-600 text-white py-4 rounded-2xl font-bold shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2">
                     {isSaving ? <Loader2 className="animate-spin" /> : <Save size={20} />} {lang === 'ar' ? 'حفظ العملية' : 'Record Transaction'}
                  </button>
               </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryView;
