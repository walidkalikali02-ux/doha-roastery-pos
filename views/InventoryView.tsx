
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

  // Location Management State
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [locationForm, setLocationForm] = useState<Partial<Location>>({
    name: '', type: 'BRANCH', address: '', contact_person: { name: '', phone: '', email: '' }, is_active: true
  });

  // Transfer Management State
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferForm, setTransferForm] = useState({
    sourceId: '', destinationId: '', notes: '', items: [] as { itemId: string, quantity: number, name: string, currentStock: number }[]
  });
  const [selectedTransferItem, setSelectedTransferItem] = useState('');
  const [transferItemQty, setTransferItemQty] = useState('');

  const getStockStatus = (item: InventoryItem) => {
    if (item.stock <= (item.min_stock || 10)) return 'CRITICAL';
    const daysToExpiry = item.expiry_date ? Math.ceil((new Date(item.expiry_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : 365;
    if (daysToExpiry <= 30) return 'EXPIRING';
    return 'GOOD';
  };

  const inventorySummary = useMemo(() => {
    const totalItems = packagedItems.length;
    const totalValue = packagedItems.reduce((acc, item) => acc + (item.stock * (item.cost_per_unit || 0)), 0);
    const lowStock = packagedItems.filter(i => getStockStatus(i) === 'CRITICAL').length;
    return { totalItems, totalValue, lowStock };
  }, [packagedItems]);

  const handleExportInventory = () => {
    const headers = ['Name', 'SKU', 'Location', 'Stock', 'Unit', 'Cost', 'Value', 'Status'];
    const csvContent = [
        headers.join(','),
        ...packagedItems.map(item => {
            const status = getStockStatus(item);
            return [
                `"${item.name}"`,
                item.skuPrefix || '',
                locations.find(l => l.id === item.location_id)?.name || 'Central',
                item.stock,
                item.unit || 'PCS',
                item.cost_per_unit || 0,
                (item.stock * (item.cost_per_unit || 0)).toFixed(2),
                status
            ].join(',');
        })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `inventory_export_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const handleUpdateTransferStatus = async (order: TransferOrder, newStatus: TransferStatus) => {
    if (!confirm(lang === 'ar' ? 'هل أنت متأكد من تغيير حالة التحويل؟' : 'Are you sure you want to update this transfer?')) return;
    
    setIsSaving(true);
    try {
        // If completing, we need to move stock
        if (newStatus === 'COMPLETED') {
             const items = order.manifest || [];
             
             for (const item of items) {
                 // Decrement Source
                 const sourceItem = packagedItems.find(i => i.id === item.itemId);
                 if (sourceItem) {
                     await supabase.from('inventory_items')
                        .update({ stock: Math.max(0, sourceItem.stock - item.quantity) })
                        .eq('id', sourceItem.id);
                 }
                 
                 // Increment Destination (Find or Create)
                 const { data: destItems } = await supabase.from('inventory_items')
                    .select('*')
                    .eq('location_id', order.destination_location_id)
                    .eq('name', item.name); 
                 
                 if (destItems && destItems.length > 0) {
                     await supabase.from('inventory_items')
                        .update({ stock: destItems[0].stock + item.quantity })
                        .eq('id', destItems[0].id);
                 } else if (sourceItem) {
                     const newItem = {
                         ...sourceItem,
                         id: undefined,
                         location_id: order.destination_location_id,
                         stock: item.quantity
                     };
                     delete newItem.id;
                     await supabase.from('inventory_items').insert(newItem);
                 }
             }
        }

        const { error } = await supabase.from('stock_transfers')
            .update({ status: newStatus, received_at: newStatus === 'COMPLETED' ? new Date().toISOString() : null })
            .eq('id', order.id);
            
        if (error) throw error;
        
        setSuccessMsg(lang === 'ar' ? 'تم تحديث حالة التحويل' : 'Transfer updated');
        setShowSuccess(true);
        fetchData();
        setTimeout(() => setShowSuccess(false), 3000);
        
    } catch (err) {
        console.error(err);
        alert('Error updating transfer');
    } finally {
        setIsSaving(false);
    }
  };

  const handleSaveLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const { data, error } = await supabase.from('locations').upsert(locationForm).select();
      if (error) throw error;
      if (data) {
         setLocations(prev => {
           const exists = prev.find(l => l.id === data[0].id);
           return exists ? prev.map(l => l.id === data[0].id ? data[0] : l) : [...prev, data[0]];
         });
         setShowLocationModal(false);
         setSuccessMsg(lang === 'ar' ? 'تم حفظ الموقع بنجاح' : 'Location saved successfully');
         setShowSuccess(true);
         setTimeout(() => setShowSuccess(false), 3000);
      }
    } catch (error) {
      console.error('Error saving location:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (transferForm.items.length === 0) return;
    setIsSaving(true);
    try {
      const transferData = {
        source_location_id: transferForm.sourceId,
        destination_location_id: transferForm.destinationId,
        status: 'DRAFT', // Default to Draft as per requirements
        notes: transferForm.notes,
        created_by: user?.id,
        manifest: transferForm.items,
        items_count: transferForm.items.length
      };

      const { data, error } = await supabase.from('stock_transfers').insert(transferData).select();
      if (error) throw error;
      if (data) {
         setTransferOrders([data[0], ...transferOrders]);
         setShowTransferModal(false);
         setSuccessMsg(lang === 'ar' ? 'تم إنشاء أمر التحويل' : 'Transfer order created');
         setShowSuccess(true);
         setTimeout(() => setShowSuccess(false), 3000);
      }
    } catch (error) {
      console.error('Error creating transfer:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const addItemToTransfer = () => {
    if (!selectedTransferItem || !transferItemQty) return;
    const item = packagedItems.find(i => i.id === selectedTransferItem);
    if (!item) return;

    if (Number(transferItemQty) > item.stock) {
      alert(lang === 'ar' ? 'الكمية غير متوفرة في المخزون' : 'Insufficient stock available');
      return;
    }
    
    setTransferForm(prev => ({
      ...prev,
      items: [...prev.items, { 
        itemId: item.id, 
        quantity: Number(transferItemQty), 
        name: item.name,
        currentStock: item.stock
      }]
    }));
    setSelectedTransferItem('');
    setTransferItemQty('');
  };

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
        <div className="fixed top-24 left-1/2 -translate-x-1/2 bg-white dark:bg-stone-900 text-black dark:text-white px-8 py-3 rounded-full font-bold flex items-center gap-3 shadow-xl z-[150] border border-black dark:border-white">
          <CheckCircle2 size={24} /> {successMsg}
        </div>
      )}

      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex gap-4 items-start">
           <div className="p-3 bg-black dark:bg-white text-white dark:text-black rounded-[20px] shadow-lg shadow-stone-500/20"><Package size={28} /></div>
           <div>
             <h2 className="text-xl md:text-2xl font-bold text-stone-800 dark:text-stone-100">{t.stockAndDistribution}</h2>
             <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-stone-400">
               <Activity size={10} className="text-stone-500 dark:text-stone-400" /> {lang === 'ar' ? 'نظام الرقابة المركزي' : 'Central Control System'}
             </div>
           </div>
        </div>
        <div className="flex bg-stone-100 dark:bg-stone-800 p-1 rounded-2xl w-full md:w-auto overflow-x-auto no-scrollbar shadow-sm">
           <button onClick={() => setActiveTab('locations')} className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${activeTab === 'locations' ? 'bg-white dark:bg-stone-900 text-black dark:text-white shadow-sm' : 'text-stone-500 hover:text-black dark:hover:text-white'}`}><MapPin size={16} /> {t.locations}</button>
           <button onClick={() => setActiveTab('packaged')} className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${activeTab === 'packaged' ? 'bg-white dark:bg-stone-900 text-black dark:text-white shadow-sm' : 'text-stone-500 hover:text-black dark:hover:text-white'}`}><Box size={16} /> {lang === 'ar' ? 'الجرد' : 'Inventory'}</button>
           <button onClick={() => setActiveTab('transfers')} className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${activeTab === 'transfers' ? 'bg-white dark:bg-stone-900 text-black dark:text-white shadow-sm' : 'text-stone-500 hover:text-black dark:hover:text-white'}`}><Truck size={16} /> {lang === 'ar' ? 'التحويلات' : 'Transfers'}</button>
           <button onClick={() => setActiveTab('adjustments')} className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${activeTab === 'adjustments' ? 'bg-white dark:bg-stone-900 text-black dark:text-white shadow-sm' : 'text-stone-500 hover:text-black dark:hover:text-white'}`}><History size={16} /> {lang === 'ar' ? 'سجل التسويات' : 'Adjustment Log'}</button>
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
              className={`w-full bg-white dark:bg-stone-800 border-none rounded-2xl ${lang === 'ar' ? 'pr-14 pl-6' : 'pl-14 pr-6'} py-4 text-sm outline-none focus:ring-2 focus:ring-black dark:focus:ring-white shadow-sm transition-all`}
            />
          </div>
          {activeTab === 'locations' && (
            <button onClick={() => { setLocationForm({}); setShowLocationModal(true); }} className="bg-black dark:bg-white text-white dark:text-black px-6 py-4 rounded-2xl font-bold shadow-lg hover:bg-stone-800 dark:hover:bg-stone-200 flex items-center gap-2 w-full md:w-auto justify-center transition-all active:scale-95">
               <Plus size={20} /> <span>{lang === 'ar' ? 'موقع جديد' : 'New Location'}</span>
            </button>
          )}
          {activeTab === 'transfers' && (
            <button onClick={() => setShowTransferModal(true)} className="bg-black dark:bg-white text-white dark:text-black px-6 py-4 rounded-2xl font-bold shadow-lg hover:bg-stone-800 dark:hover:bg-stone-200 flex items-center gap-2 w-full md:w-auto justify-center transition-all active:scale-95">
               <ArrowRightLeft size={20} /> <span>{lang === 'ar' ? 'تحويل جديد' : 'New Transfer'}</span>
            </button>
          )}
          {activeTab === 'adjustments' && (
            <button onClick={() => setShowAdjustmentModal(true)} className="bg-black dark:bg-white text-white dark:text-black px-6 py-4 rounded-2xl font-bold shadow-lg hover:bg-stone-800 dark:hover:bg-stone-200 flex items-center gap-2 w-full md:w-auto justify-center transition-all active:scale-95">
               <History size={20} /> <span>{lang === 'ar' ? 'تسوية جديدة' : 'New Adjustment'}</span>
            </button>
          )}
          {activeTab === 'packaged' && (
             <button onClick={handleExportInventory} className="bg-stone-100 dark:bg-stone-800 text-black dark:text-white px-6 py-4 rounded-2xl font-bold shadow-sm hover:bg-stone-200 dark:hover:bg-stone-700 flex items-center gap-2 w-full md:w-auto justify-center transition-all active:scale-95">
               <FileDown size={20} /> <span>{lang === 'ar' ? 'تصدير' : 'Export'}</span>
             </button>
          )}
        </div>

        {activeTab === 'locations' ? (
          <div className="p-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {locations.map(loc => (
              <div key={loc.id} className="bg-white dark:bg-stone-900 border border-stone-100 dark:border-stone-800 p-8 rounded-[32px] shadow-sm hover:shadow-xl transition-all group relative">
                 <div className="flex justify-between items-start mb-6">
                    <div className="p-4 bg-stone-50 dark:bg-stone-800 text-stone-400 group-hover:bg-black dark:group-hover:bg-white group-hover:text-white dark:group-hover:text-black rounded-2xl transition-colors">
                       {loc.is_roastery ? <Coffee size={24}/> : <Store size={24}/>}
                    </div>
                    <div className="flex gap-2">
                       <button onClick={() => { setLocationForm(loc); setShowLocationModal(true); }} className="p-2 hover:bg-stone-100 rounded-full text-stone-400 hover:text-black transition-colors"><Edit size={16}/></button>
                       <span className="text-[10px] font-black uppercase text-black dark:text-white bg-stone-100 dark:bg-stone-800 border border-black dark:border-white px-3 py-1 rounded-full">{loc.is_roastery ? 'Roastery' : 'Branch'}</span>
                    </div>
                 </div>
                 <h4 className="text-xl font-bold mb-2">{loc.name}</h4>
                 <p className="text-xs text-stone-500 line-clamp-2">{loc.address}</p>
                 <div className="mt-4 pt-4 border-t border-stone-100 dark:border-stone-800 flex justify-between items-center">
                    <span className={`text-[10px] font-bold uppercase ${loc.is_active ? 'text-green-500' : 'text-red-500'}`}>{loc.is_active ? 'Active' : 'Inactive'}</span>
                    <span className="text-[10px] text-stone-400">{packagedItems.filter(i => i.location_id === loc.id).length} Items</span>
                 </div>
              </div>
            ))}
          </div>
        ) : activeTab === 'transfers' ? (
          <div className="overflow-x-auto">
             <table className={`w-full ${lang === 'ar' ? 'text-right' : 'text-left'} text-sm min-w-[1000px]`}>
               <thead className="bg-stone-50 dark:bg-stone-950 text-stone-500 uppercase text-[10px] font-black tracking-widest border-b border-stone-100 dark:border-stone-800">
                 <tr>
                    <th className="px-8 py-5">Date</th>
                    <th className="px-8 py-5">Source</th>
                    <th className="px-8 py-5">Destination</th>
                    <th className="px-8 py-5">Items</th>
                    <th className="px-8 py-5">Status</th>
                    <th className="px-8 py-5">Actions</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                 {transferOrders.map(order => (
                   <tr key={order.id} className="hover:bg-stone-50/50">
                     <td className="px-8 py-5 font-mono text-xs text-stone-500">{new Date(order.created_at).toLocaleDateString()}</td>
                     <td className="px-8 py-5 font-bold">{locations.find(l => l.id === order.source_location_id)?.name}</td>
                     <td className="px-8 py-5 font-bold">{locations.find(l => l.id === order.destination_location_id)?.name}</td>
                     <td className="px-8 py-5">{order.items_count} items</td>
                     <td className="px-8 py-5">
                        <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase border ${
                          order.status === 'COMPLETED' ? 'bg-green-100 text-green-700 border-green-200' : 
                          order.status === 'DRAFT' ? 'bg-stone-100 text-stone-600 border-stone-200' : 
                          'bg-blue-100 text-blue-700 border-blue-200'
                        }`}>{order.status}</span>
                     </td>
                     <td className="px-8 py-5">
                        <div className="flex gap-2">
                          {order.status === 'DRAFT' && (
                             <button onClick={() => handleUpdateTransferStatus(order, 'APPROVED')} className="text-[10px] font-bold uppercase bg-black dark:bg-white text-white dark:text-black px-3 py-1 rounded-full hover:bg-stone-800 transition-all">
                                {lang === 'ar' ? 'اعتماد' : 'Approve'}
                             </button>
                          )}
                          {order.status === 'APPROVED' && (
                             <button onClick={() => handleUpdateTransferStatus(order, 'COMPLETED')} className="text-[10px] font-bold uppercase bg-green-500 text-white px-3 py-1 rounded-full hover:bg-green-600 transition-all">
                                {lang === 'ar' ? 'استلام' : 'Receive'}
                             </button>
                          )}
                          {(order.status === 'COMPLETED' || order.status === 'CANCELLED') && (
                             <button className="text-stone-400 hover:text-black"><ChevronRight size={18}/></button>
                          )}
                        </div>
                     </td>
                   </tr>
                 ))}
               </tbody>
             </table>
          </div>
        ) : activeTab === 'packaged' ? (
          <div className="flex flex-col gap-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 px-10 pt-6">
               <div className="bg-stone-50 dark:bg-stone-800 p-6 rounded-3xl border border-stone-100 dark:border-stone-700">
                  <div className="text-stone-400 text-xs font-black uppercase tracking-widest mb-2">{lang === 'ar' ? 'إجمالي الأصناف' : 'Total Items'}</div>
                  <div className="text-3xl font-black text-stone-800 dark:text-white">{inventorySummary.totalItems}</div>
               </div>
               <div className="bg-stone-50 dark:bg-stone-800 p-6 rounded-3xl border border-stone-100 dark:border-stone-700">
                  <div className="text-stone-400 text-xs font-black uppercase tracking-widest mb-2">{lang === 'ar' ? 'القيمة الإجمالية' : 'Total Value'}</div>
                  <div className="text-3xl font-black text-stone-800 dark:text-white flex items-baseline gap-1">
                    <span className="text-sm text-stone-400">QAR</span>
                    {inventorySummary.totalValue.toLocaleString()}
                  </div>
               </div>
               <div className="bg-red-50 dark:bg-red-900/20 p-6 rounded-3xl border border-red-100 dark:border-red-900/50">
                  <div className="text-red-400 text-xs font-black uppercase tracking-widest mb-2">{lang === 'ar' ? 'نقص المخزون' : 'Low Stock Alert'}</div>
                  <div className="text-3xl font-black text-red-600 dark:text-red-400">{inventorySummary.lowStock} <span className="text-sm font-bold">{lang === 'ar' ? 'أصناف' : 'Items'}</span></div>
               </div>
            </div>

            <div className="overflow-x-auto">
            <table className={`w-full ${lang === 'ar' ? 'text-right' : 'text-left'} text-sm min-w-[1000px]`}>
              <thead className="bg-stone-50 dark:bg-stone-950 text-stone-500 uppercase text-[10px] font-black tracking-widest border-b border-stone-100 dark:border-stone-800">
                <tr>
                   <th className="px-8 py-5">Product</th>
                   <th className="px-8 py-5">Location</th>
                   <th className="px-8 py-5">Stock</th>
                   <th className="px-8 py-5">Status</th>
                   <th className="px-8 py-5">Expiry</th>
                   <th className="px-8 py-5">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                 {packagedItems.filter(i => i.name.toLowerCase().includes(searchTerm.toLowerCase())).map(item => {
                   const status = getStockStatus(item);
                   return (
                   <tr key={item.id} className={`hover:bg-stone-50/50 ${status === 'CRITICAL' ? 'bg-red-50/50 dark:bg-red-900/10' : status === 'EXPIRING' ? 'bg-orange-50/50 dark:bg-orange-900/10' : ''}`}>
                     <td className="px-8 py-5 font-bold">
                        {item.name}
                        <div className="text-[10px] text-stone-400 font-mono">{item.skuPrefix || 'N/A'}</div>
                     </td>
                     <td className="px-8 py-5 text-stone-500">{locations.find(l => l.id === item.location_id)?.name || 'Central'}</td>
                     <td className={`px-8 py-5 font-mono font-black ${status === 'CRITICAL' ? 'text-red-600' : ''}`}>{item.stock} {item.unit}</td>
                     <td className="px-8 py-5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                           status === 'CRITICAL' ? 'bg-red-100 text-red-600' : 
                           status === 'EXPIRING' ? 'bg-orange-100 text-orange-600' : 
                           'bg-green-100 text-green-600'
                        }`}>{status}</span>
                     </td>
                     <td className="px-8 py-5 font-mono text-xs">{item.expiry_date ? new Date(item.expiry_date).toLocaleDateString() : '-'}</td>
                     <td className="px-8 py-5">
                        <button onClick={() => { setAdjustmentForm({...adjustmentForm, locationId: item.location_id || '', itemId: item.id}); setShowAdjustmentModal(true); }} className="p-2 text-stone-400 hover:text-black dark:hover:text-white transition-colors"><ArrowRightLeft size={18} /></button>
                     </td>
                   </tr>
                 )})}
              </tbody>
            </table>
          </div>
        </div>
        ) : (
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
                       <span className={`flex items-center gap-1 font-black ${adj.quantity > 0 ? 'text-black dark:text-white' : 'text-black dark:text-white'}`}>
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
                       <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase border ${
                         adj.status === 'APPROVED' ? 'bg-white dark:bg-stone-900 text-black dark:text-white border-black dark:border-white' : 
                         adj.status === 'PENDING' ? 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 border-stone-300 dark:border-stone-600 animate-pulse' : 
                         'bg-stone-200 dark:bg-stone-700 text-stone-500 dark:text-stone-400 border-stone-400 dark:border-stone-500'
                       }`}>
                          {adj.status}
                       </span>
                    </td>
                    <td className="px-8 py-5 font-medium">{adj.user_name}</td>
                    {isAdmin && (
                      <td className="px-8 py-5">
                         {adj.status === 'PENDING' && (
                           <div className="flex items-center gap-2">
                             <button onClick={() => handleApproveAdjustment(adj, 'APPROVED')} className="p-2 bg-white dark:bg-stone-800 text-black dark:text-white border border-black dark:border-white rounded-lg hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all"><Check size={16}/></button>
                             <button onClick={() => handleApproveAdjustment(adj, 'REJECTED')} className="p-2 bg-white dark:bg-stone-800 text-stone-500 dark:text-stone-400 border border-stone-300 dark:border-stone-600 rounded-lg hover:bg-stone-200 hover:text-black dark:hover:bg-stone-600 transition-all"><X size={16}/></button>
                           </div>
                         )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
             </table>
          </div>
        )}
      </div>

      {/* Location Modal */}
      {showLocationModal && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md overflow-y-auto">
          <div className="bg-white dark:bg-stone-900 rounded-[40px] max-w-2xl w-full p-8 md:p-10 shadow-2xl animate-in zoom-in-95 my-8" dir={t.dir}>
             <div className="flex justify-between items-center mb-8 border-b border-stone-100 dark:border-stone-800 pb-6">
               <h3 className="text-2xl font-bold">{locationForm.id ? (lang === 'ar' ? 'تعديل موقع' : 'Edit Location') : (lang === 'ar' ? 'إضافة موقع جديد' : 'Add New Location')}</h3>
               <button onClick={() => setShowLocationModal(false)}><X size={32} className="text-stone-400" /></button>
             </div>
             <form onSubmit={handleSaveLocation} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="space-y-2">
                      <label className="text-xs font-bold uppercase text-stone-500">{lang === 'ar' ? 'اسم الموقع' : 'Location Name'}</label>
                      <input required type="text" value={locationForm.name} onChange={e => setLocationForm({...locationForm, name: e.target.value})} className="w-full bg-stone-50 dark:bg-stone-800 p-4 rounded-xl font-bold outline-none focus:ring-2 focus:ring-black dark:focus:ring-white" />
                   </div>
                   <div className="space-y-2">
                      <label className="text-xs font-bold uppercase text-stone-500">{lang === 'ar' ? 'النوع' : 'Type'}</label>
                      <select value={locationForm.type} onChange={e => setLocationForm({...locationForm, type: e.target.value as any})} className="w-full bg-stone-50 dark:bg-stone-800 p-4 rounded-xl font-bold outline-none focus:ring-2 focus:ring-black dark:focus:ring-white">
                        <option value="WAREHOUSE">Warehouse</option>
                        <option value="BRANCH">Branch</option>
                        <option value="ROASTERY">Roastery</option>
                      </select>
                   </div>
                </div>
                <div className="space-y-2">
                   <label className="text-xs font-bold uppercase text-stone-500">{lang === 'ar' ? 'العنوان' : 'Address'}</label>
                   <input type="text" value={locationForm.address} onChange={e => setLocationForm({...locationForm, address: e.target.value})} className="w-full bg-stone-50 dark:bg-stone-800 p-4 rounded-xl font-bold outline-none focus:ring-2 focus:ring-black dark:focus:ring-white" />
                </div>
                <div className="pt-6 flex gap-4">
                  <button type="button" onClick={() => setShowLocationModal(false)} className="flex-1 py-4 font-bold text-stone-400 uppercase tracking-widest">{t.cancel}</button>
                  <button type="submit" disabled={isSaving} className="flex-[2] bg-black dark:bg-white text-white dark:text-black py-4 rounded-2xl font-bold shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2 hover:bg-stone-800 dark:hover:bg-stone-200">{isSaving ? <Loader2 className="animate-spin" /> : (lang === 'ar' ? 'حفظ' : 'Save')}</button>
                </div>
             </form>
          </div>
        </div>
      )}

      {/* Transfer Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md overflow-y-auto">
          <div className="bg-white dark:bg-stone-900 rounded-[40px] max-w-4xl w-full p-8 md:p-10 shadow-2xl animate-in zoom-in-95 my-8" dir={t.dir}>
             <div className="flex justify-between items-center mb-8 border-b border-stone-100 dark:border-stone-800 pb-6">
               <h3 className="text-2xl font-bold">{lang === 'ar' ? 'أمر تحويل مخزون' : 'New Stock Transfer Order'}</h3>
               <button onClick={() => setShowTransferModal(false)}><X size={32} className="text-stone-400" /></button>
             </div>
             <form onSubmit={handleSaveTransfer} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="space-y-2">
                      <label className="text-xs font-bold uppercase text-stone-500">{lang === 'ar' ? 'من (المصدر)' : 'From (Source)'}</label>
                      <select required value={transferForm.sourceId} onChange={e => setTransferForm({...transferForm, sourceId: e.target.value})} className="w-full bg-stone-50 dark:bg-stone-800 p-4 rounded-xl font-bold outline-none focus:ring-2 focus:ring-black dark:focus:ring-white">
                        <option value="">-- Select Source --</option>
                        {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                      </select>
                   </div>
                   <div className="space-y-2">
                      <label className="text-xs font-bold uppercase text-stone-500">{lang === 'ar' ? 'إلى (الوجهة)' : 'To (Destination)'}</label>
                      <select required value={transferForm.destinationId} onChange={e => setTransferForm({...transferForm, destinationId: e.target.value})} className="w-full bg-stone-50 dark:bg-stone-800 p-4 rounded-xl font-bold outline-none focus:ring-2 focus:ring-black dark:focus:ring-white">
                        <option value="">-- Select Destination --</option>
                        {locations.filter(l => l.id !== transferForm.sourceId).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                      </select>
                   </div>
                </div>
                
                {/* Items Section */}
                <div className="bg-stone-50 dark:bg-stone-800 p-6 rounded-2xl space-y-4">
                   <h4 className="font-bold border-b border-stone-200 dark:border-stone-700 pb-2">{lang === 'ar' ? 'الأصناف' : 'Items to Transfer'}</h4>
                   <div className="flex gap-4">
                      <select disabled={!transferForm.sourceId} value={selectedTransferItem} onChange={e => setSelectedTransferItem(e.target.value)} className="flex-[3] p-3 rounded-xl border-none outline-none bg-white dark:bg-stone-900">
                         <option value="">Select Item</option>
                         {packagedItems.filter(i => i.location_id === transferForm.sourceId).map(i => <option key={i.id} value={i.id}>{i.name} (Stock: {i.stock})</option>)}
                      </select>
                      <input type="number" placeholder="Qty" value={transferItemQty} onChange={e => setTransferItemQty(e.target.value)} className="flex-1 p-3 rounded-xl border-none outline-none bg-white dark:bg-stone-900" />
                      <button type="button" onClick={addItemToTransfer} className="p-3 bg-black text-white rounded-xl hover:bg-stone-800"><Plus size={20}/></button>
                   </div>
                   {/* List of added items */}
                   <div className="space-y-2">
                      {transferForm.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center bg-white dark:bg-stone-900 p-3 rounded-xl shadow-sm">
                           <span>{item.name}</span>
                           <div className="flex items-center gap-4">
                             <span className="font-mono font-bold">{item.quantity}</span>
                             <button type="button" onClick={() => setTransferForm(prev => ({...prev, items: prev.items.filter((_, i) => i !== idx)}))} className="text-red-500 hover:text-red-700"><Trash2 size={16}/></button>
                           </div>
                        </div>
                      ))}
                      {transferForm.items.length === 0 && <p className="text-stone-400 text-sm text-center italic py-4">No items added yet</p>}
                   </div>
                </div>

                <div className="space-y-2">
                   <label className="text-xs font-bold uppercase text-stone-500">{lang === 'ar' ? 'ملاحظات' : 'Notes'}</label>
                   <textarea value={transferForm.notes} onChange={e => setTransferForm({...transferForm, notes: e.target.value})} className="w-full bg-stone-50 dark:bg-stone-800 p-4 rounded-xl font-bold h-24 outline-none focus:ring-2 focus:ring-black dark:focus:ring-white resize-none" />
                </div>
                
                <div className="pt-6 flex gap-4">
                  <button type="button" onClick={() => setShowTransferModal(false)} className="flex-1 py-4 font-bold text-stone-400 uppercase tracking-widest">{t.cancel}</button>
                  <button type="submit" disabled={isSaving || transferForm.items.length === 0} className="flex-[2] bg-black dark:bg-white text-white dark:text-black py-4 rounded-2xl font-bold shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2 hover:bg-stone-800 dark:hover:bg-stone-200 disabled:opacity-50 disabled:pointer-events-none">{isSaving ? <Loader2 className="animate-spin" /> : (lang === 'ar' ? 'إنشاء أمر التحويل' : 'Create Transfer Order')}</button>
                </div>
             </form>
          </div>
        </div>
      )}

      {/* Stock Adjustment Modal */}
      {showAdjustmentModal && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md overflow-y-auto">
          <div className="bg-white dark:bg-stone-900 rounded-[40px] max-w-2xl w-full p-8 md:p-10 shadow-2xl animate-in zoom-in-95 my-8" dir={t.dir}>
            <div className="flex justify-between items-center mb-8 border-b border-stone-100 dark:border-stone-800 pb-6">
              <div className="flex items-center gap-4">
                 <div className="p-3 bg-black dark:bg-white text-white dark:text-black rounded-2xl shadow-lg"><ArrowRightLeft size={28} /></div>
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
                       className="w-full bg-stone-50 dark:bg-stone-800 border-none rounded-2xl px-5 py-4 font-bold outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
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
                       className="w-full bg-stone-50 dark:bg-stone-800 border-none rounded-2xl px-5 py-4 font-bold outline-none focus:ring-2 focus:ring-black dark:focus:ring-white disabled:opacity-50"
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
                       className="w-full bg-stone-50 dark:bg-stone-800 border-none rounded-2xl px-5 py-4 font-mono font-bold outline-none focus:ring-2 focus:ring-black dark:focus:ring-white" 
                     />
                  </div>
                  <div className="space-y-1.5">
                     <label className="text-[10px] font-black uppercase text-stone-400 flex items-center gap-1.5"><AlertCircle size={12} /> {lang === 'ar' ? 'سبب التسوية' : 'Adjustment Reason'}</label>
                     <select 
                       required 
                       value={adjustmentForm.reason} 
                       onChange={e => setAdjustmentForm({...adjustmentForm, reason: e.target.value as AdjustmentReason})} 
                       className="w-full bg-stone-50 dark:bg-stone-800 border-none rounded-2xl px-5 py-4 font-bold outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
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
                    className="w-full bg-stone-50 dark:bg-stone-800 border-none rounded-2xl px-5 py-4 outline-none focus:ring-2 focus:ring-black dark:focus:ring-white resize-none text-sm" 
                    placeholder={lang === 'ar' ? 'يرجى كتابة المبرر المالي للعملية لغايات التدقيق...' : 'Please state the financial justification for audit purposes...'}
                  />
               </div>

               <div className="pt-6 flex gap-4">
                  <button type="button" onClick={() => setShowAdjustmentModal(false)} className="flex-1 py-4 font-bold text-stone-400 uppercase tracking-widest">{t.cancel}</button>
                  <button type="submit" disabled={isSaving} className="flex-[2] bg-black dark:bg-white text-white dark:text-black py-4 rounded-2xl font-bold shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2 hover:bg-stone-800 dark:hover:bg-stone-200">
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
