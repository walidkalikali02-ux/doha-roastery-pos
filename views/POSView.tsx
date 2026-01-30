
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Search, Plus, Minus, Trash2, CreditCard, Banknote, 
  Coffee, X, Box, Loader2, CheckCircle2, 
  LayoutGrid, ShoppingCart, Check, Smartphone, 
  Receipt, Printer, Scissors, PlusCircle,
  Clock, User as UserIcon, History, ChevronDown, ChevronUp,
  SearchX, Calendar, RefreshCw
} from 'lucide-react';
import { InventoryItem, CartItem, AddOn, PaymentMethod, PaymentBreakdown, SystemSettings } from '../types';
import { useLanguage } from '../App';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';

const SIZE_MULTIPLIERS = { S: 0.75, M: 1.0, L: 1.5 };
const MILK_PRICES = { 'Full Fat': 0, 'Low Fat': 0, 'Oat': 5, 'Almond': 5 };

const POSView: React.FC = () => {
  const { lang, t } = useLanguage();
  const { user } = useAuth();
  
  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeTab, setActiveTab] = useState<'ALL' | 'PACKAGED' | 'DRINKS' | 'HISTORY'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [historySearch, setHistorySearch] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [showMobileCart, setShowMobileCart] = useState(false);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [pastTransactions, setPastTransactions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [settings, setSettings] = useState<SystemSettings>({
    id: '',
    printer_width: '80mm',
    store_name: 'Doha Roastery',
    store_address: '',
    store_phone: '',
    vat_rate: 0,
    currency: 'QAR'
  });
  
  // Checkout & Results State
  const [showSuccess, setShowSuccess] = useState(false);
  const [lastTransaction, setLastTransaction] = useState<any>(null);
  const [isReprint, setIsReprint] = useState(false);
  const [reprintTime, setReprintTime] = useState<string | null>(null);

  // Customization State
  const [customizingItem, setCustomizingItem] = useState<InventoryItem | null>(null);
  const [tempCustoms, setTempCustoms] = useState({
    size: 'M' as 'S' | 'M' | 'L',
    milkType: 'Full Fat',
    sugarLevel: 'Normal',
    selectedAddOns: [] as AddOn[]
  });

  // Payment Modals State
  const [showCashModal, setShowCashModal] = useState(false);
  const [cashReceived, setCashReceived] = useState<string>('');
  const [showSplitModal, setShowSplitModal] = useState(false);
  const [splitBreakdown, setSplitBreakdown] = useState<PaymentBreakdown>({ cash: 0, card: 0, mobile: 0, card_reference: '' });
  const [cardReference, setCardReference] = useState(''); // REQ-003: State for card reference
  const [showCardInput, setShowCardInput] = useState(false); // UI state for single card payment reference input

  const fetchInventory = useCallback(async () => {
    setIsLoading(true);
    try {
      const [prodRes, invRes, settingsRes] = await Promise.all([
        supabase.from('product_definitions').select('*'),
        supabase.from('inventory_items').select('*'),
        supabase.from('system_settings').select('*').single()
      ]);

      if (settingsRes.data) setSettings(settingsRes.data);

      const allItems: InventoryItem[] = [];
      if (invRes.data) {
        invRes.data.filter(i => i.type !== 'INGREDIENT').forEach(item => {
           allItems.push({ ...item, category: item.type === 'PACKAGED_COFFEE' ? 'PACKAGED' : 'OTHER' });
        });
      }

      if (prodRes.data) {
        prodRes.data.filter(p => p.type === 'BEVERAGE').forEach(p => {
          allItems.push({
            id: p.id, name: p.name, description: p.description, category: 'DRINKS', type: 'BEVERAGE',
            price: p.base_price, stock: 999, image: p.image || 'https://images.unsplash.com/photo-1541167760496-162955ed8a9f?q=80&w=300&h=300&auto=format&fit=crop',
            recipe: p.recipe, add_ons: p.add_ons || []
          } as any);
        });
      }
      setInventoryItems(allItems);
    } catch (error) { console.error(error); } finally { setIsLoading(false); }
  }, []);

  const fetchHistory = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      setPastTransactions(data || []);
    } catch (error) { console.error(error); } finally { setIsLoading(false); }
  }, []);

  useEffect(() => { 
    if (activeTab === 'HISTORY') {
      fetchHistory();
    } else {
      fetchInventory(); 
    }
  }, [lang, activeTab, fetchInventory, fetchHistory]);

  const generateInvoiceNumber = (sequence: number = 1) => {
    // REQ-005: Generate sequential invoice numbers
    const date = new Date();
    const prefix = "INV"; 
    const dateStr = `${date.getFullYear()}${(date.getMonth()+1).toString().padStart(2,'0')}${date.getDate().toString().padStart(2,'0')}`;
    return `${prefix}-${dateStr}-${sequence.toString().padStart(4, '0')}`;
  };

  const openCustomization = (item: InventoryItem) => {
    if (item.type === 'BEVERAGE') {
      setCustomizingItem(item);
      setTempCustoms({ size: 'M', milkType: 'Full Fat', sugarLevel: 'Normal', selectedAddOns: [] });
    } else { addToCart(item); }
  };

  const toggleAddOn = (addOn: AddOn) => {
    const isSelected = tempCustoms.selectedAddOns?.some(ao => ao.id === addOn.id);
    if (isSelected) {
      setTempCustoms({ ...tempCustoms, selectedAddOns: tempCustoms.selectedAddOns?.filter(ao => ao.id !== addOn.id) });
    } else {
      setTempCustoms({ ...tempCustoms, selectedAddOns: [...(tempCustoms.selectedAddOns || []), addOn] });
    }
  };

  const addToCart = (item: InventoryItem, customs?: any) => {
    const milkExtra = MILK_PRICES[customs?.milkType as keyof typeof MILK_PRICES] || 0;
    
    // REQ-001: The system shall support beverage add-ons with additional pricing
    const addOnsExtra = customs?.selectedAddOns?.reduce((sum: number, ao: AddOn) => sum + ao.price, 0) || 0;
    
    const sizeMultiplier = customs ? SIZE_MULTIPLIERS[customs.size as keyof typeof SIZE_MULTIPLIERS] : 1.0;
    
    const finalPrice = (item.price * sizeMultiplier) + milkExtra + addOnsExtra;

    setCart(prev => {
      const addOnsIds = customs?.selectedAddOns?.map((ao: AddOn) => ao.id).sort().join(',') || '';
      const cartItemId = customs ? `${item.id}-${customs.size}-${customs.milkType}-${customs.sugarLevel}-${addOnsIds}` : item.id;
      const existing = prev.find(i => (i as any).cartId === cartItemId);
      
      if (existing) {
        return prev.map(i => (i as any).cartId === cartItemId ? { ...i, quantity: i.quantity + 1 } : i);
      }
      
      return [...prev, { 
        ...item, price: finalPrice, quantity: 1, cartId: cartItemId, selectedCustomizations: customs, recipe: (item as any).recipe 
      } as any];
    });
    setCustomizingItem(null);
  };

  const updateQuantity = (cartId: string, delta: number) => {
    setCart(prev => prev.map(item => 
      (item as any).cartId === cartId ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item
    ));
  };

  const removeFromCart = (cartId: string) => {
    setCart(prev => prev.filter(item => (item as any).cartId !== cartId));
  };

  const totals = useMemo(() => {
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const vat = subtotal * settings.vat_rate;
    const total = subtotal + vat;
    return { subtotal, vat, total };
  }, [cart, settings.vat_rate]);

  const handleCheckout = async (paymentMethod: PaymentMethod, breakdown?: PaymentBreakdown, receivedAmount?: number) => {
    if (cart.length === 0 || isProcessing) return;
    setIsProcessing(true);
    
    try {
      // REQ-005: Generate sequential invoice numbers by counting today's transactions
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { count } = await supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', today.toISOString());
      
      const sequence = (count || 0) + 1;
      const invoiceNo = generateInvoiceNumber(sequence);

      // REQ-001: Calculate and display change for cash payments
      const change = receivedAmount ? Math.max(0, receivedAmount - totals.total) : 0;
      const validUserId = user?.id === 'demo-user' ? null : user?.id;
      const now = new Date();

      const transactionData = {
        id: invoiceNo,
        items: cart, 
        subtotal: totals.subtotal,
        vat_amount: totals.vat,
        total: totals.total, 
        payment_method: paymentMethod, 
        payment_breakdown: breakdown || null,
        // REQ-003: Record payment reference for card transactions
        card_reference: paymentMethod === 'CARD' ? cardReference : (breakdown?.card_reference || null),
        user_id: validUserId, 
        cashier_name: user?.name || 'Cashier',
        received_amount: receivedAmount || totals.total,
        change_amount: change,
        created_at: now.toISOString(),
        timestamp: now.toISOString()
      };

      await supabase.from('transactions').insert([transactionData]);
      
      // REQ-006: Automatically deduct sold items from branch inventory
      const { data: allInv } = await supabase.from('inventory_items').select('*');
      for (const item of cart) {
        if (item.type === 'BEVERAGE') {
          // 1. Deduction for beverages based on recipe
          if (item.recipe) {
            const multiplier = SIZE_MULTIPLIERS[item.selectedCustomizations?.size || 'M'];
            for (const ing of item.recipe.ingredients) {
              const dbIng = allInv?.find(i => i.id === ing.ingredient_id || i.name === ing.name);
              if (dbIng) {
                await supabase.from('inventory_items').update({ stock: Math.max(0, dbIng.stock - (ing.amount * multiplier * item.quantity)) }).eq('id', dbIng.id);
              }
            }
          }
          // 2. Deduction for add-ons if they have associated ingredients
          if (item.selectedCustomizations?.selectedAddOns) {
            for (const addOn of item.selectedCustomizations.selectedAddOns) {
              if (addOn.ingredient_id) {
                const dbIng = allInv?.find(i => i.id === addOn.ingredient_id);
                if (dbIng) {
                  await supabase.from('inventory_items').update({ stock: Math.max(0, dbIng.stock - item.quantity) }).eq('id', dbIng.id);
                }
              }
            }
          }
        } else {
          // Direct deduction for packaged items
          const dbItem = allInv?.find(inv => inv.id === item.id);
          if (dbItem) await supabase.from('inventory_items').update({ stock: Math.max(0, dbItem.stock - item.quantity) }).eq('id', dbItem.id);
        }
      }

      setLastTransaction(transactionData);
      setIsReprint(false);
      setShowSuccess(true);
      
      // Automatically trigger print
      setTimeout(() => {
        window.print();
      }, 300);

      setCart([]);
      setShowSplitModal(false);
      setShowCashModal(false);
      setShowCardInput(false);
      setCashReceived('');
      setCardReference('');
      fetchInventory(); 
    } catch (error) { 
      console.error(error);
      alert("Checkout failed"); 
    } finally { setIsProcessing(false); }
  };

  const handlePrint = async (transaction?: any) => {
    if (transaction) {
      // Authorization Check: Only ADMIN or MANAGER can reprint
      if (user?.role !== 'ADMIN' && user?.role !== 'MANAGER') {
        alert(lang === 'ar' ? 'غير مصرح لك بإعادة طباعة الإيصالات' : 'Not authorized to reprint receipts');
        return;
      }

      setLastTransaction(transaction);
      setIsReprint(true);
      const now = new Date().toISOString();
      setReprintTime(now);

      // Log the reprint action
      try {
        await supabase.from('reprint_logs').insert([{
          transaction_id: transaction.id,
          user_id: user?.id === 'demo-user' ? null : user?.id,
          cashier_name: user?.name || 'Unknown',
          reprinted_at: now,
          reason: 'Customer Request'
        }]);
      } catch (err) {
        console.error("Failed to log reprint:", err);
      }

      setTimeout(() => window.print(), 200);
    } else if (lastTransaction) {
      setIsReprint(false);
      setReprintTime(null);
      window.print();
    }
  };

  const filteredItems = useMemo(() => {
    return inventoryItems.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesTab = activeTab === 'ALL' || (activeTab === 'PACKAGED' && item.category === 'PACKAGED') || (activeTab === 'DRINKS' && item.type === 'BEVERAGE');
      return matchesSearch && matchesTab;
    });
  }, [inventoryItems, searchTerm, activeTab]);

  const filteredHistory = useMemo(() => {
    return pastTransactions.filter(tx => {
      const matchesSearch = tx.id.toLowerCase().includes(historySearch.toLowerCase()) ||
                          tx.cashier_name?.toLowerCase().includes(historySearch.toLowerCase());
      
      const txDate = new Date(tx.created_at);
      const matchesStart = !dateRange.start || txDate >= new Date(dateRange.start);
      const matchesEnd = !dateRange.end || txDate <= new Date(dateRange.end + 'T23:59:59');
      
      return matchesSearch && matchesStart && matchesEnd;
    });
  }, [pastTransactions, historySearch, dateRange]);

  const splitRemaining = totals.total - (splitBreakdown.cash + splitBreakdown.card + splitBreakdown.mobile);

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-140px)] gap-6 animate-in fade-in duration-500 relative" dir={t.dir}>
      
      {/* Thermal Receipt Styling */}
      <style>
        {`
          @media print {
            @page {
              margin: 0;
              size: ${settings.printer_width} auto;
            }
            html, body {
              margin: 0 !important;
              padding: 0 !important;
              height: auto !important;
              overflow: visible !important;
            }
            body * { visibility: hidden; }
            #thermal-receipt, #thermal-receipt * { 
              visibility: visible;
              font-family: 'Courier New', Courier, monospace !important;
            }
            #thermal-receipt {
              display: block !important;
              position: absolute;
              left: 0;
              top: 0;
              width: ${settings.printer_width};
              margin: 0;
              padding: ${settings.printer_width === '58mm' ? '8px' : '12px'};
              background: white;
              color: black;
            }
            /* Hide UI elements during print */
            .no-print { display: none !important; }
          }
        `}
      </style>

      {/* Hidden Thermal Receipt Div */}
      <div id="thermal-receipt" className="hidden bg-white text-black p-4 font-mono leading-normal" style={{ width: settings.printer_width, fontSize: settings.printer_width === '58mm' ? '11px' : '13px' }}>
        <div className="text-center mb-6">
          <div className="flex justify-center mb-3">
            <div className={`${settings.printer_width === '58mm' ? 'w-12 h-12' : 'w-16 h-16'} bg-black rounded-full flex items-center justify-center text-white`}>
              <Coffee size={settings.printer_width === '58mm' ? 24 : 32} />
            </div>
          </div>
          <div className={`${settings.printer_width === '58mm' ? 'text-lg' : 'text-xl'} font-black uppercase mb-1`}>{settings.store_name || t.appName}</div>
          <div className="text-[10px] opacity-80">{settings.store_address || t.storeAddress}</div>
          <div className="text-[10px] opacity-80">{t.storeCity} | {settings.store_phone || t.storePhone}</div>
          {isReprint && (
             <div className="mt-2 py-1 bg-black text-white text-[10px] font-black uppercase tracking-widest">
               {t.reprintedReceipt}
               {reprintTime && (
                 <div className="text-[7px] opacity-70 mt-0.5">
                   {new Date(reprintTime).toLocaleString(lang === 'ar' ? 'ar-QA' : 'en-US')}
                 </div>
               )}
             </div>
          )}
          <div className="mt-2 border-b border-dashed border-black"></div>
        </div>

        <div className="space-y-2 mb-4">
          <div className="flex justify-between">
            <span className="opacity-70">{t.invoiceNo}:</span>
            <span className="font-bold">{lastTransaction?.id}</span>
          </div>
          <div className="flex justify-between">
            <span className="opacity-70">{lang === 'ar' ? 'التاريخ:' : 'Date:'}</span>
            <span>{lastTransaction ? new Date(lastTransaction.created_at).toLocaleString(lang === 'ar' ? 'ar-QA' : 'en-US') : ''}</span>
          </div>
          <div className="flex justify-between">
            <span className="opacity-70">{t.cashierLabel}:</span>
            <span>{lastTransaction?.cashier_name}</span>
          </div>
        </div>

        <div className="border-b-2 border-dashed border-black mb-3"></div>
        
        <table className="w-full mb-4 border-collapse">
          <thead>
            <tr className="border-b border-black">
              <th className="text-left py-2 font-black uppercase text-[10px]">{lang === 'ar' ? 'الصنف' : 'Item'}</th>
              <th className="text-right py-2 font-black uppercase text-[10px]">{lang === 'ar' ? 'الإجمالي' : 'Total'}</th>
            </tr>
          </thead>
          <tbody>
            {lastTransaction?.items.map((item: any, i: number) => (
              <tr key={i} className="align-top border-b border-dotted border-stone-200">
                <td className="py-3 pr-2">
                  <div className="font-black text-[12px]">{item.name}</div>
                  <div className="text-[10px] opacity-80 mt-0.5">
                    {item.quantity} x {item.price.toFixed(2)} {t.currency}
                  </div>
                  {item.selectedCustomizations && (
                    <div className="text-[9px] italic opacity-70 mt-0.5">
                      {item.selectedCustomizations.size}
                      {item.selectedCustomizations.milkType !== 'Full Fat' ? `, ${item.selectedCustomizations.milkType}` : ''}
                      {item.selectedCustomizations.selectedAddOns?.length > 0 ? `, +${item.selectedCustomizations.selectedAddOns.length} extras` : ''}
                    </div>
                  )}
                </td>
                <td className="text-right py-3 font-black text-[12px]">
                  {(item.price * item.quantity).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="border-b border-dashed border-black my-2"></div>

        <div className="space-y-2 text-[11px] mb-4">
          <div className="flex justify-between">
            <span className="opacity-70">{t.subtotal}</span>
            <span className="font-bold">{lastTransaction?.subtotal?.toFixed(2) || lastTransaction?.total.toFixed(2)} {t.currency}</span>
          </div>
          {(lastTransaction?.vat_amount > 0 || settings.vat_rate > 0) && (
            <div className="flex justify-between">
              <span className="opacity-70">{t.tax} ({(settings.vat_rate * 100).toFixed(0)}%)</span>
              <span className="font-bold">{lastTransaction?.vat_amount?.toFixed(2) || (lastTransaction?.total * settings.vat_rate).toFixed(2)} {t.currency}</span>
            </div>
          )}
          {lastTransaction?.discount_amount > 0 && (
            <div className="flex justify-between text-red-600">
              <span className="opacity-70">{t.discount}</span>
              <span className="font-bold">-{lastTransaction.discount_amount.toFixed(2)} {t.currency}</span>
            </div>
          )}
          <div className="flex justify-between text-lg font-black pt-2 border-t-2 border-black mt-2">
            <span>{t.total}</span>
            <span>{lastTransaction?.total.toFixed(2)} {t.currency}</span>
          </div>
        </div>

        <div className="border-b-2 border-dashed border-black mb-4"></div>

        <div className="space-y-2 text-[10px] mb-6">
          <div className="flex justify-between">
            <span className="opacity-70">{t.payment}:</span>
            <span className="font-black uppercase">{lastTransaction?.payment_method}</span>
          </div>
          {lastTransaction?.payment_breakdown && (
            <div className="pl-4 space-y-1 border-l-2 border-stone-100 ml-1">
              {lastTransaction.payment_breakdown.cash > 0 && (
                <div className="flex justify-between">
                  <span className="opacity-60">{t.cash}</span>
                  <span>{lastTransaction.payment_breakdown.cash.toFixed(2)}</span>
                </div>
              )}
              {lastTransaction.payment_breakdown.card > 0 && (
                <div className="flex justify-between">
                  <span className="opacity-60">{t.card}</span>
                  <span>{lastTransaction.payment_breakdown.card.toFixed(2)}</span>
                </div>
              )}
              {lastTransaction.payment_breakdown.mobile > 0 && (
                <div className="flex justify-between">
                  <span className="opacity-60">{lang === 'ar' ? 'جوال' : 'Mobile'}</span>
                  <span>{lastTransaction.payment_breakdown.mobile.toFixed(2)}</span>
                </div>
              )}
            </div>
          )}
          <div className="flex justify-between pt-2 border-t border-dotted border-stone-200">
            <span className="opacity-70">{t.amountReceived}:</span>
            <span className="font-bold">{lastTransaction?.received_amount?.toFixed(2) || lastTransaction?.total.toFixed(2)}</span>
          </div>
          {lastTransaction?.change_amount > 0 && (
            <div className="flex justify-between">
              <span className="opacity-70 font-bold">{t.change}:</span>
              <span className="font-black text-amber-600">{lastTransaction.change_amount.toFixed(2)}</span>
            </div>
          )}
        </div>

        <div className="text-center mt-10">
          <div className="text-[12px] font-black uppercase mb-2 tracking-widest">{t.thankYou}</div>
          {settings.vat_number && (
            <div className="text-[10px] font-bold opacity-80 mb-4">
              {t.vatNumber}: {settings.vat_number}
            </div>
          )}
          
          <div className="flex justify-center mb-6">
            <div className="p-2 bg-white border-2 border-black rounded-xl">
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${lastTransaction?.id}`} 
                className="w-24 h-24 grayscale" 
                alt="QR" 
              />
            </div>
          </div>
          
          <div className="text-[9px] font-black opacity-40 uppercase tracking-[0.2em] mb-2">www.doharoastery.com</div>
          <div className="text-[8px] opacity-30 mb-4 font-mono">ID: {lastTransaction?.id}</div>
          
          <div className="border-t border-stone-200 pt-4 text-[8px] opacity-40 uppercase italic font-bold">
            {t.poweredBy}
          </div>
        </div>
      </div>

      {/* Payment Modals (Cash/Split) */}
      {showCardInput && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xl z-[250] flex items-center justify-center p-4">
           <div className="bg-white dark:bg-stone-900 rounded-[48px] max-w-md w-full p-10 shadow-2xl animate-in zoom-in-95">
              <div className="flex justify-between items-center mb-8">
                 <div className="flex items-center gap-4">
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-3xl"><CreditCard size={28}/></div>
                    <h3 className="text-2xl font-black">{t.card}</h3>
                 </div>
                 <button onClick={() => setShowCardInput(false)} className="p-2 hover:bg-stone-100 rounded-full transition-colors"><X size={32}/></button>
              </div>
              <div className="bg-stone-50 dark:bg-stone-950 p-6 rounded-[32px] mb-8 border border-stone-100 dark:border-stone-800">
                 <div className="text-[10px] font-black uppercase text-stone-400 mb-2">{t.total}</div>
                 <div className="text-4xl font-black text-stone-800 dark:text-stone-100">
                    {totals.total.toFixed(2)} <span className="text-sm opacity-50 uppercase">{t.currency}</span>
                 </div>
              </div>
              <div className="space-y-4">
                 <label className="text-[10px] font-black uppercase text-stone-400 block">{lang === 'ar' ? 'رقم مرجع العملية (اختياري)' : 'Transaction Reference (Optional)'}</label>
                 <input 
                    type="text" 
                    autoFocus 
                    value={cardReference} 
                    onChange={e => setCardReference(e.target.value)} 
                    className="w-full bg-stone-50 dark:bg-stone-800 border-none rounded-2xl px-6 py-5 font-mono font-black text-2xl text-blue-600 outline-none focus:ring-2 focus:ring-blue-500 text-center" 
                    placeholder="REF-0000" 
                 />
              </div>
              <button 
                onClick={() => handleCheckout('CARD')}
                disabled={isProcessing}
                className="w-full mt-10 py-5 bg-stone-900 text-white rounded-[24px] font-black text-xl shadow-xl active:scale-95 transition-all disabled:opacity-30 flex items-center justify-center gap-3"
              >
                {isProcessing ? <Loader2 className="animate-spin" /> : <CheckCircle2 />} {t.completePayment}
              </button>
           </div>
        </div>
      )}

      {showCashModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xl z-[250] flex items-center justify-center p-4">
           <div className="bg-white dark:bg-stone-900 rounded-[48px] max-w-md w-full p-10 shadow-2xl animate-in zoom-in-95">
              <div className="flex justify-between items-center mb-8">
                 <div className="flex items-center gap-4">
                    <div className="p-4 bg-green-50 dark:bg-green-900/20 text-green-600 rounded-3xl"><Banknote size={28}/></div>
                    <h3 className="text-2xl font-black">{t.cash}</h3>
                 </div>
                 <button onClick={() => setShowCashModal(false)} className="p-2 hover:bg-stone-100 rounded-full transition-colors"><X size={32}/></button>
              </div>
              <div className="bg-stone-50 dark:bg-stone-950 p-6 rounded-[32px] mb-8 border border-stone-100 dark:border-stone-800">
                 <div className="text-[10px] font-black uppercase text-stone-400 mb-2">{t.total}</div>
                 <div className="text-4xl font-black text-stone-800 dark:text-stone-100">
                    {totals.total.toFixed(2)} <span className="text-sm opacity-50 uppercase">{t.currency}</span>
                 </div>
              </div>
              <div className="space-y-4">
                 <label className="text-[10px] font-black uppercase text-stone-400 block">{t.amountReceived}</label>
                 <input type="number" autoFocus value={cashReceived} onChange={e => setCashReceived(e.target.value)} className="w-full bg-stone-50 dark:bg-stone-800 border-none rounded-2xl px-6 py-5 font-mono font-black text-4xl text-amber-600 outline-none focus:ring-2 focus:ring-amber-500 text-center" placeholder="0.00" />
                 
                 {parseFloat(cashReceived) >= totals.total && (
                   <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-2xl flex justify-between items-center border border-amber-100 dark:border-amber-800 animate-in fade-in slide-in-from-top-2">
                      <span className="text-[10px] font-black uppercase text-amber-600">{lang === 'ar' ? 'الباقي' : 'Change'}</span>
                      <span className="text-2xl font-black text-amber-700 dark:text-amber-400 font-mono">{(parseFloat(cashReceived) - totals.total).toFixed(2)} {t.currency}</span>
                   </div>
                 )}

                 <div className="grid grid-cols-3 gap-2">
                    {[10, 20, 50, 100, 200, 500].map(val => (
                       <button key={val} onClick={() => setCashReceived(val.toString())} className="py-4 bg-stone-100 dark:bg-stone-800 rounded-2xl font-black text-sm hover:bg-stone-200 transition-colors">{val}</button>
                    ))}
                 </div>
              </div>
              <button 
                onClick={() => handleCheckout('CASH', undefined, parseFloat(cashReceived))}
                disabled={parseFloat(cashReceived) < totals.total || isProcessing}
                className="w-full mt-10 py-5 bg-stone-900 text-white rounded-[24px] font-black text-xl shadow-xl active:scale-95 transition-all disabled:opacity-30 flex items-center justify-center gap-3"
              >
                {isProcessing ? <Loader2 className="animate-spin" /> : <CheckCircle2 />} {t.completePayment}
              </button>
           </div>
        </div>
      )}

      {showSplitModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xl z-[250] flex items-center justify-center p-4">
           <div className="bg-white dark:bg-stone-900 rounded-[48px] max-w-lg w-full p-10 shadow-2xl animate-in zoom-in-95">
              <div className="flex justify-between items-center mb-8">
                 <div className="flex items-center gap-4">
                    <div className="p-4 bg-stone-100 dark:bg-stone-800 text-stone-900 dark:text-stone-100 rounded-3xl"><Scissors size={28}/></div>
                    <h3 className="text-2xl font-black">{lang === 'ar' ? 'دفع مجزأ' : 'Split Payment'}</h3>
                 </div>
                 <button onClick={() => setShowSplitModal(false)} className="p-2 hover:bg-stone-100 rounded-full transition-colors"><X size={32}/></button>
              </div>
              <div className="bg-stone-50 dark:bg-stone-950 p-6 rounded-[32px] mb-8 border border-stone-100 dark:border-stone-800">
                 <div className="flex justify-between text-[10px] font-black uppercase text-stone-400 mb-2">
                    <span>{t.total}</span>
                    <span>{lang === 'ar' ? 'المتبقي' : 'Remaining'}</span>
                 </div>
                 <div className="flex justify-between items-end">
                    <span className="text-xl font-bold">{totals.total.toFixed(2)} {t.currency}</span>
                    <span className={`text-3xl font-black font-mono ${splitRemaining > 0 ? 'text-red-500' : 'text-green-500'}`}>{splitRemaining.toFixed(2)}</span>
                 </div>
              </div>
              <div className="space-y-6">
                 {([ {id: 'cash', icon: Banknote, color: 'green'}, {id: 'card', icon: CreditCard, color: 'blue'}, {id: 'mobile', icon: Smartphone, color: 'amber'} ] as any).map((method: any) => (
                    <div key={method.id} className="space-y-1">
                       <label className="text-[10px] font-black uppercase text-stone-400 flex items-center gap-2">
                          <method.icon size={14} className={`text-${method.color}-500`} /> {t[method.id as keyof typeof t] || method.id}
                       </label>
                       <input type="number" value={(splitBreakdown as any)[method.id] || ''} onChange={e => setSplitBreakdown({...splitBreakdown, [method.id]: parseFloat(e.target.value) || 0})} className="w-full bg-stone-50 dark:bg-stone-800 border-none rounded-2xl px-6 py-4 font-mono font-bold text-lg outline-none focus:ring-2 focus:ring-stone-500" placeholder="0.00" />
                       
                       {method.id === 'card' && splitBreakdown.card > 0 && (
                         <div className="mt-2 animate-in fade-in slide-in-from-top-2">
                            <input 
                               type="text" 
                               placeholder={lang === 'ar' ? 'مرجع بطاقة الصراف' : 'Card Reference'} 
                               value={splitBreakdown.card_reference || ''} 
                               onChange={e => setSplitBreakdown({...splitBreakdown, card_reference: e.target.value})}
                               className="w-full bg-stone-100 dark:bg-stone-800/50 border-none rounded-xl px-4 py-2 text-xs font-bold outline-none focus:ring-1 focus:ring-blue-500"
                            />
                         </div>
                       )}
                    </div>
                 ))}
              </div>
              <button 
                onClick={() => handleCheckout('SPLIT', splitBreakdown)}
                disabled={Math.abs(splitRemaining) > 0.01 || isProcessing}
                className="w-full mt-8 py-5 bg-stone-900 text-white rounded-[24px] font-black text-xl shadow-xl active:scale-95 transition-all disabled:opacity-30 flex items-center justify-center gap-3"
              >
                {lang === 'ar' ? 'تأكيد الدفع المجزأ' : 'Complete Split'}
              </button>
           </div>
        </div>
      )}

      {/* Item Customization Modal */}
      {customizingItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[200] flex items-center justify-center p-4">
           <div className="bg-white dark:bg-stone-900 rounded-[40px] max-w-2xl w-full p-8 shadow-2xl animate-in zoom-in-95 overflow-y-auto max-h-[90vh] custom-scrollbar">
              <div className="flex justify-between items-center mb-6">
                 <div className="flex items-center gap-4">
                    <div className="p-4 bg-amber-50 dark:bg-amber-900/20 text-amber-600 rounded-2xl"><Coffee size={32}/></div>
                    <h3 className="text-2xl font-black">{customizingItem.name}</h3>
                 </div>
                 <button onClick={() => setCustomizingItem(null)} className="p-2 hover:bg-stone-100 rounded-full transition-colors text-stone-400"><X size={32}/></button>
              </div>
              <div className="space-y-8 pb-4">
                 <div className="space-y-3">
                    <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest">{lang === 'ar' ? 'الحجم' : 'Size'}</label>
                    <div className="grid grid-cols-3 gap-3">
                       {(['S', 'M', 'L'] as const).map(s => (
                          <button key={s} onClick={() => setTempCustoms({...tempCustoms, size: s})} className={`py-5 rounded-3xl font-black transition-all border-2 ${tempCustoms.size === s ? 'bg-amber-600 text-white border-amber-600 shadow-lg' : 'bg-stone-50 dark:bg-stone-800 border-transparent text-stone-500'}`}>{s}</button>
                       ))}
                    </div>
                 </div>
                 <div className="space-y-3">
                    <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest">{lang === 'ar' ? 'نوع الحليب' : 'Milk'}</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                       {Object.keys(MILK_PRICES).map(m => (
                          <button key={m} onClick={() => setTempCustoms({...tempCustoms, milkType: m})} className={`px-2 py-4 rounded-2xl font-bold text-[10px] transition-all border-2 ${tempCustoms.milkType === m ? 'bg-stone-900 dark:bg-stone-700 text-white border-stone-900' : 'bg-stone-50 dark:bg-stone-800 border-transparent text-stone-500'}`}>
                             {m}
                             {MILK_PRICES[m as keyof typeof MILK_PRICES] > 0 && <span className="block mt-1 opacity-60">+{MILK_PRICES[m as keyof typeof MILK_PRICES]} {t.currency}</span>}
                          </button>
                       ))}
                    </div>
                 </div>
                 {(customizingItem as any).add_ons?.length > 0 && (
                   <div className="space-y-3">
                      <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest flex items-center gap-2"><PlusCircle size={14}/> {lang === 'ar' ? 'إضافات' : 'Extras'}</label>
                      <div className="grid grid-cols-2 gap-3">
                        {(customizingItem as any).add_ons.map((ao: AddOn) => {
                          const isSelected = tempCustoms.selectedAddOns?.some(s => s.id === ao.id);
                          return (
                            <button key={ao.id} onClick={() => toggleAddOn(ao)} className={`flex justify-between items-center px-4 py-4 rounded-3xl border-2 transition-all ${isSelected ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-500 text-amber-700 dark:text-amber-400 shadow-sm' : 'bg-stone-50 dark:bg-stone-800 border-transparent text-stone-500'}`}>
                               <span className="text-xs font-bold">{ao.name}</span>
                               <span className="font-mono font-black text-[10px]">+{ao.price} {isSelected && <Check size={12} className="inline ml-1" />}</span>
                            </button>
                          );
                        })}
                      </div>
                   </div>
                 )}
                 <button onClick={() => addToCart(customizingItem, tempCustoms)} className="w-full py-5 bg-amber-600 text-white rounded-[32px] font-black text-xl shadow-xl active:scale-95 transition-all mt-4">
                    {lang === 'ar' ? 'إضافة للطلب' : 'Add to Order'}
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* Main Catalog or History View */}
      <div className="flex-1 flex flex-col gap-6 overflow-hidden">
        <div className="bg-white dark:bg-stone-900 p-5 rounded-[40px] border border-stone-200 dark:border-stone-800 shadow-sm flex flex-col gap-5">
           <div className="flex flex-wrap items-center gap-4 bg-white/50 dark:bg-stone-900/50 p-4 rounded-3xl border border-stone-200 dark:border-stone-800">
             <div className="relative flex-1 min-w-[200px]">
               <Search className={`absolute ${t.dir === 'rtl' ? 'right-6' : 'left-6'} top-1/2 -translate-y-1/2 text-stone-400`} size={24}/>
               <input 
                type="text" 
                placeholder={activeTab === 'HISTORY' ? t.history : t.searchProduct} 
                value={activeTab === 'HISTORY' ? historySearch : searchTerm} 
                onChange={e => activeTab === 'HISTORY' ? setHistorySearch(e.target.value) : setSearchTerm(e.target.value)} 
                className="w-full bg-stone-50 dark:bg-stone-950 border-none rounded-[28px] px-16 py-5 font-bold outline-none focus:ring-2 focus:ring-amber-500 text-lg shadow-inner transition-all" 
               />
             </div>
             
             {activeTab === 'HISTORY' && (
               <div className="flex items-center gap-2">
                 <div className="flex items-center gap-2 bg-white dark:bg-stone-900 px-4 py-2 rounded-2xl shadow-sm border border-stone-100 dark:border-stone-800">
                   <Calendar size={16} className="text-stone-400" />
                   <input 
                     type="date" 
                     className="bg-transparent border-none outline-none text-xs font-bold"
                     value={dateRange.start}
                     onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
                   />
                   <span className="text-stone-300">→</span>
                   <input 
                     type="date" 
                     className="bg-transparent border-none outline-none text-xs font-bold"
                     value={dateRange.end}
                     onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
                   />
                   {(dateRange.start || dateRange.end) && (
                     <button onClick={() => setDateRange({start: '', end: ''})} className="text-stone-400 hover:text-red-500"><X size={14}/></button>
                   )}
                 </div>
                 <button onClick={fetchHistory} className="p-4 bg-stone-900 text-white rounded-2xl hover:bg-amber-600 transition-all"><RefreshCw size={20}/></button>
               </div>
             )}
           </div>
           <div className="flex items-center gap-3 overflow-x-auto no-scrollbar pb-1">
              {[ 
                { id: 'ALL', label: t.all, icon: LayoutGrid }, 
                { id: 'DRINKS', label: t.drinks, icon: Coffee }, 
                { id: 'PACKAGED', label: t.packaged, icon: Box },
                { id: 'HISTORY', label: t.history, icon: History }
              ].map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex items-center gap-3 px-8 py-4 rounded-[24px] text-sm font-black transition-all ${activeTab === tab.id ? 'bg-amber-600 text-white shadow-xl scale-105' : 'bg-stone-50 dark:bg-stone-950 text-stone-500 hover:bg-stone-100'}`}>
                  <tab.icon size={18}/> {tab.label}
                </button>
              ))}
           </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar px-1 pb-10">
          {activeTab === 'HISTORY' ? (
            <div className="space-y-4 animate-in slide-in-from-bottom-4">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 opacity-30">
                  <Loader2 size={48} className="animate-spin mb-4" />
                  <span className="font-bold">{t.loading}</span>
                </div>
              ) : filteredHistory.length > 0 ? filteredHistory.map(tx => (
                <div key={tx.id} className="bg-white dark:bg-stone-900 p-6 rounded-[32px] border border-stone-200 dark:border-stone-800 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row justify-between items-center gap-4">
                   <div className="flex items-center gap-5 w-full md:w-auto">
                      <div className="p-4 bg-stone-50 dark:bg-stone-800 text-stone-400 rounded-2xl"><Receipt size={24}/></div>
                      <div>
                         <div className="flex items-center gap-2">
                            <h4 className="font-black text-lg">{tx.id}</h4>
                            <span className="px-2 py-0.5 bg-stone-100 dark:bg-stone-800 rounded text-[10px] font-black uppercase">{tx.payment_method}</span>
                         </div>
                         <div className="flex items-center gap-3 text-stone-400 text-xs mt-1">
                            <span className="flex items-center gap-1"><Clock size={12}/> {new Date(tx.created_at).toLocaleString()}</span>
                            <span className="flex items-center gap-1"><UserIcon size={12}/> {tx.cashier_name}</span>
                         </div>
                      </div>
                   </div>
                   <div className="flex items-center gap-8 w-full md:w-auto justify-between md:justify-end">
                      <div className="text-right">
                         <span className="block text-[10px] font-black text-stone-400 uppercase">{t.total}</span>
                         <span className="text-2xl font-black text-amber-600 font-mono">{tx.total.toFixed(2)} <span className="text-xs opacity-50">{t.currency}</span></span>
                      </div>
                      <button 
                        onClick={() => handlePrint(tx)}
                        className="p-4 bg-stone-900 text-white rounded-2xl hover:bg-amber-600 transition-all active:scale-95 shadow-lg flex items-center gap-2"
                      >
                        <Printer size={20}/>
                        <span className="text-sm font-bold hidden sm:inline">{t.reprint}</span>
                      </button>
                   </div>
                </div>
              )) : (
                <div className="flex flex-col items-center justify-center py-20 opacity-30">
                  <SearchX size={64} className="mb-4" />
                  <p className="font-bold">{t.emptyCart}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-6 animate-in fade-in duration-500">
               {isLoading ? (
                  Array.from({length: 8}).map((_, i) => (
                    <div key={i} className="bg-stone-200 dark:bg-stone-800 rounded-[48px] aspect-[4/5] animate-pulse"></div>
                  ))
               ) : filteredItems.map(item => (
                 <button key={item.id} onClick={() => openCustomization(item)} className="group bg-white dark:bg-stone-900 p-5 rounded-[48px] border border-stone-200 dark:border-stone-800 shadow-sm hover:shadow-2xl transition-all flex flex-col h-full active:scale-95">
                   <div className="aspect-square rounded-[40px] overflow-hidden mb-5 bg-stone-100 relative shadow-inner">
                      <img src={item.image} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt={item.name} />
                   </div>
                   <div className="flex-1 flex flex-col px-2">
                      <h4 className="font-black text-stone-800 dark:text-stone-100 text-base line-clamp-2 mb-4 leading-tight text-center">{item.name}</h4>
                      <div className="mt-auto flex justify-between items-center pt-4 border-t border-stone-50 dark:border-stone-800">
                         <span className="text-amber-600 font-black text-2xl font-mono">{item.price}<span className="text-xs font-bold ml-1 opacity-50 uppercase">{t.currency}</span></span>
                         <div className="w-12 h-12 bg-stone-50 dark:bg-stone-950 rounded-[20px] flex items-center justify-center group-hover:bg-amber-600 group-hover:text-white transition-colors"><Plus size={22} strokeWidth={3}/></div>
                      </div>
                   </div>
                 </button>
               ))}
            </div>
          )}
        </div>
      </div>

      {/* Cart Sidebar */}
      <aside className={`fixed inset-y-0 ${t.dir === 'rtl' ? 'left-0' : 'right-0'} z-[100] w-full sm:w-[450px] lg:w-[420px] transform transition-all duration-500 ease-in-out lg:static lg:translate-x-0 ${showMobileCart ? 'translate-x-0' : (t.dir === 'rtl' ? '-translate-x-full' : 'translate-x-full')} flex flex-col bg-white dark:bg-stone-900 lg:rounded-[60px] shadow-2xl border border-stone-200 dark:border-stone-800 overflow-hidden`}>
         <div className="p-8 border-b flex justify-between items-center bg-white/50 dark:bg-stone-900/50 backdrop-blur-md">
            <div className="flex items-center gap-4">
               <div className="p-4 bg-amber-50 dark:bg-amber-900/20 text-amber-600 rounded-[24px]"><ShoppingCart size={28}/></div>
               <div><h3 className="text-xl font-black">{t.bill}</h3><span className="text-[11px] font-black text-stone-400 uppercase">{cart.length} {t.items}</span></div>
            </div>
            <button onClick={() => setShowMobileCart(false)} className="lg:hidden p-3 hover:bg-stone-100 rounded-full"><X size={32}/></button>
         </div>

         <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar bg-stone-50/20 dark:bg-stone-950/20">
            {cart.length > 0 ? cart.map(item => (
              <div key={(item as any).cartId} className="bg-white dark:bg-stone-900 p-5 rounded-[36px] border border-stone-100 dark:border-stone-800 shadow-sm flex items-center gap-4 animate-in slide-in-from-bottom-2">
                 <div className="w-16 h-16 rounded-2xl overflow-hidden shrink-0 bg-stone-100"><img src={item.image} className="w-full h-full object-cover" /></div>
                 <div className="flex-1 min-w-0">
                    <h5 className="font-bold text-sm truncate">{item.name}</h5>
                    {item.selectedCustomizations && (
                      <div className="flex flex-wrap gap-1 mt-1">
                         <span className="px-1.5 py-0.5 bg-amber-50 text-amber-600 rounded text-[8px] font-black uppercase">{item.selectedCustomizations.size}</span>
                         {item.selectedCustomizations.selectedAddOns?.map((ao: AddOn) => <span key={ao.id} className="px-1.5 py-0.5 bg-green-50 text-green-600 rounded text-[8px] font-black uppercase">+{ao.name}</span>)}
                      </div>
                    )}
                 </div>
                 <div className="flex items-center gap-1 bg-stone-50 dark:bg-stone-950 p-1 rounded-2xl">
                    <button onClick={() => updateQuantity((item as any).cartId, -1)} className="w-8 h-8 flex items-center justify-center hover:bg-white rounded-lg"><Minus size={14} strokeWidth={3}/></button>
                    <span className="w-4 text-center font-black font-mono text-xs">{item.quantity}</span>
                    <button onClick={() => updateQuantity((item as any).cartId, 1)} className="w-8 h-8 flex items-center justify-center hover:bg-white rounded-lg"><Plus size={14} strokeWidth={3}/></button>
                 </div>
                 <button onClick={() => removeFromCart((item as any).cartId)} className="text-stone-300 hover:text-red-500 p-2"><Trash2 size={20}/></button>
              </div>
            )) : (
              <div className="h-full flex flex-col items-center justify-center opacity-30">
                <ShoppingCart size={64} className="mb-4" />
                <p className="font-bold">{t.emptyCart}</p>
              </div>
            )}
         </div>

         <div className="p-8 bg-stone-900 text-white shrink-0">
            <div className="space-y-1 mb-4 opacity-70 text-[10px] uppercase font-black tracking-widest border-b border-white/5 pb-4">
              <div className="flex justify-between"><span>{t.subtotal}</span><span>{totals.subtotal.toFixed(2)} {t.currency}</span></div>
            </div>
            <div className="flex justify-between items-center mb-8">
               <span className="text-2xl font-black uppercase tracking-tight">{t.total}</span>
               <div className="text-right">
                 <span className="text-4xl font-black text-amber-500 font-mono">{totals.total.toFixed(2)}</span>
                 <span className="text-xs font-bold ml-2 opacity-50 uppercase">{t.currency}</span>
               </div>
            </div>
            
            <div className="grid grid-cols-4 gap-3">
               <button onClick={() => setShowCashModal(true)} disabled={cart.length === 0 || isProcessing} className="flex flex-col items-center justify-center gap-2 h-20 rounded-3xl bg-stone-800 hover:bg-stone-700 active:scale-95 transition-all disabled:opacity-30">
                  <Banknote size={20} className="text-green-500"/>
                  <span className="text-[8px] font-black uppercase">{t.cash}</span>
               </button>
               <button onClick={() => setShowCardInput(true)} disabled={cart.length === 0 || isProcessing} className="flex flex-col items-center justify-center gap-2 h-20 rounded-3xl bg-stone-800 hover:bg-stone-700 active:scale-95 transition-all disabled:opacity-30">
                  <CreditCard size={20} className="text-blue-500"/>
                  <span className="text-[8px] font-black uppercase">{t.card}</span>
               </button>
               <button onClick={() => handleCheckout('MOBILE')} disabled={cart.length === 0 || isProcessing} className="flex flex-col items-center justify-center gap-2 h-20 rounded-3xl bg-stone-800 hover:bg-stone-700 active:scale-95 transition-all disabled:opacity-30">
                  <Smartphone size={20} className="text-amber-500"/>
                  <span className="text-[8px] font-black uppercase">{lang === 'ar' ? 'هاتف' : 'Mobile'}</span>
               </button>
               <button onClick={() => setShowSplitModal(true)} disabled={cart.length === 0 || isProcessing} className="flex flex-col items-center justify-center gap-2 h-20 rounded-3xl bg-amber-600 hover:bg-amber-500 active:scale-95 transition-all disabled:opacity-30">
                  <Scissors size={20}/>
                  <span className="text-[8px] font-black uppercase">{lang === 'ar' ? 'مجزأ' : 'Split'}</span>
               </button>
            </div>
         </div>
      </aside>
      
      {/* Success Modal with Print Button */}
      {showSuccess && lastTransaction && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-2xl z-[300] flex flex-col items-center justify-center animate-in zoom-in-95">
          <div className="bg-white dark:bg-stone-900 p-8 md:p-12 rounded-[64px] text-center shadow-2xl border border-white/20 relative overflow-hidden max-w-lg w-full mx-4">
            <div className="absolute top-0 left-0 w-full h-3 bg-green-500"></div>
            <div className="bg-green-100 dark:bg-green-900/30 p-6 rounded-full inline-block mb-6 animate-bounce-slow">
              <CheckCircle2 size={64} className="text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-3xl font-black mb-2 text-stone-800 dark:text-white">{lang === 'ar' ? 'تم تأكيد الطلب!' : 'Order Confirmed!'}</h2>
            <div className="bg-stone-50 dark:bg-stone-800/50 p-5 rounded-[28px] mb-6 space-y-3 text-xs font-bold text-stone-600 dark:text-stone-300">
               <div className="flex justify-between items-center">
                  <span className="flex items-center gap-2 opacity-60"><Receipt size={14}/> {t.invoiceNo}</span>
                  <span className="font-mono">{lastTransaction.id}</span>
               </div>
               <div className="flex justify-between items-center border-t border-stone-200 dark:border-stone-700 pt-3">
                  <span className="opacity-60">{t.total}</span>
                  <span className="text-lg font-black text-stone-800 dark:text-white">{lastTransaction.total.toFixed(2)} {t.currency}</span>
               </div>
               
               {lastTransaction.change_amount > 0 && (
                 <div className="flex justify-between items-center border-t border-dashed border-stone-200 dark:border-stone-700 pt-3 text-amber-600">
                    <span className="opacity-60">{lang === 'ar' ? 'الباقي' : 'Change'}</span>
                    <span className="text-lg font-black">{lastTransaction.change_amount.toFixed(2)} {t.currency}</span>
                 </div>
               )}

               <div className="flex justify-between items-center border-t border-stone-200 dark:border-stone-700 pt-3">
                  <span className="opacity-60">{t.payment}</span>
                  <span className="font-black uppercase">{lastTransaction.payment_method}</span>
               </div>

               {lastTransaction.card_reference && (
                 <div className="flex justify-between items-center border-t border-dashed border-stone-200 dark:border-stone-700 pt-3 text-blue-600">
                    <span className="opacity-60">{lang === 'ar' ? 'المرجع' : 'Reference'}</span>
                    <span className="font-mono">{lastTransaction.card_reference}</span>
                 </div>
               )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={() => handlePrint()}
                className="py-4 bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-stone-200 transition-all active:scale-95"
              >
                <Printer size={20} /> {t.printLabel}
              </button>
              <button 
                onClick={() => { setShowSuccess(false); setLastTransaction(null); }}
                className="py-4 bg-amber-600 text-white rounded-2xl font-bold shadow-lg hover:bg-amber-700 transition-all active:scale-95"
              >
                {lang === 'ar' ? 'طلب جديد' : 'New Order'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default POSView;
