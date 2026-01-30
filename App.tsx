
import React, { useState, useEffect, createContext, useContext, useCallback, useRef } from 'react';
import { LayoutDashboard, Flame, Package, ClipboardList, ShoppingCart, BarChart3, Menu, X, Coffee, BrainCircuit, Languages, Sun, Moon, Keyboard, ChevronRight, ChevronLeft, Zap, UserCircle, LogOut, Clock, AlertTriangle, Settings, Loader2 } from 'lucide-react';
import DashboardView from './views/DashboardView';
import RoastingView from './views/RoastingView';
import InventoryView from './views/InventoryView';
import POSView from './views/POSView';
import ReportsView from './views/ReportsView';
import AIInsights from './views/AIInsights';
import LoginView from './views/LoginView';
import ConfigurationView from './views/ConfigurationView';
import { translations, Language } from './translations';
import { UserRole } from './types';
import { AuthProvider, useAuth } from './contexts/AuthContext';

interface LanguageContextType {
  lang: Language;
  setLang: (l: Language) => void;
  t: typeof translations.ar;
}

interface ThemeContextType {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

export const LanguageContext = createContext<LanguageContextType | undefined>(undefined);
export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within LanguageProvider');
  return context;
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
};

const WARNING_THRESHOLD = 5 * 60 * 1000; // 5 minutes before expiration

const AppContent: React.FC = () => {
  const { lang, setLang, t } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const { user, isAuthenticated, isLoading, logout, sessionExpiresAt, refreshSession, error } = useAuth();

  const [activeTab, setActiveTab] = useState<'dashboard' | 'roasting' | 'inventory' | 'pos' | 'reports' | 'ai' | 'configuration'>(() => (localStorage.getItem('activeTab') as any) || 'dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => localStorage.getItem('sidebarOpen') !== 'false');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [showSessionWarning, setShowSessionWarning] = useState(false);
  const [activeDetailId, setActiveDetailId] = useState<string | null>(null);

  const allMenuItems = [
    { id: 'dashboard', label: t.dashboard, icon: LayoutDashboard, roles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.ROASTER, UserRole.CASHIER, UserRole.WAREHOUSE_STAFF] },
    { id: 'roasting', label: t.roasting, icon: Flame, roles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.ROASTER] },
    { id: 'inventory', label: t.inventory, icon: ClipboardList, roles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.ROASTER, UserRole.CASHIER, UserRole.WAREHOUSE_STAFF] },
    { id: 'pos', label: t.pos, icon: ShoppingCart, roles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER] },
    { id: 'reports', label: t.reports, icon: BarChart3, roles: [UserRole.ADMIN, UserRole.MANAGER] },
    { id: 'ai', label: t.ai, icon: BrainCircuit, roles: [UserRole.ADMIN, UserRole.MANAGER] },
    { id: 'configuration', label: t.configuration, icon: Settings, roles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.ROASTER, UserRole.CASHIER, UserRole.WAREHOUSE_STAFF] },
  ];

  const userRole = user?.role || UserRole.CASHIER;
  const menuItems = allMenuItems.filter(item => item.roles.includes(userRole));

  // Guard against unauthorized tab access (e.g. from localStorage or manually switching state)
  useEffect(() => {
    if (isAuthenticated && user) {
      const isAllowed = allMenuItems.find(i => i.id === activeTab)?.roles.includes(user.role);
      if (!isAllowed) {
        setActiveTab('dashboard');
      }
    }
  }, [activeTab, isAuthenticated, user]);

  useEffect(() => {
    if (sessionExpiresAt) {
      const timeUntilExpiry = sessionExpiresAt.getTime() - Date.now();
      const warningTime = timeUntilExpiry - WARNING_THRESHOLD;

      if (warningTime > 0) {
        const timer = setTimeout(() => setShowSessionWarning(true), warningTime);
        return () => clearTimeout(timer);
      } else if (timeUntilExpiry > 0) {
        setShowSessionWarning(true);
      }
    }
  }, [sessionExpiresAt]);

  useEffect(() => {
    document.documentElement.dir = t.dir;
    document.documentElement.lang = lang;
    localStorage.setItem('lang', lang);
  }, [lang, t.dir]);

  useEffect(() => {
    if (theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => { 
    if (isAuthenticated) localStorage.setItem('activeTab', activeTab); 
  }, [activeTab, isAuthenticated]);

  useEffect(() => { localStorage.setItem('sidebarOpen', isSidebarOpen.toString()); }, [isSidebarOpen]);

  const handleTabChange = useCallback((id: any) => {
    const isAllowed = allMenuItems.find(item => item.id === id)?.roles.includes(userRole);
    if (!isAllowed) return;
    
    setActiveTab(id);
    setActiveDetailId(null);
    setIsMobileMenuOpen(false);
  }, [userRole, allMenuItems]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isAuthenticated) return;
      if (e.altKey) {
        switch (e.key.toLowerCase()) {
          case '1': case 'd': handleTabChange('dashboard'); break;
          case '2': case 'r': handleTabChange('roasting'); break;
          case '3': case 'i': handleTabChange('inventory'); break;
          case '4': case 'p': handleTabChange('pos'); break;
          case '5': case 'm': handleTabChange('reports'); break;
          case '6': case 'a': handleTabChange('ai'); break;
          case '7': case 's': handleTabChange('configuration'); break;
          case 'l': setLang(lang === 'ar' ? 'en' : 'ar'); break;
          case 't': toggleTheme(); break;
          case 'q': setShowQuickActions(prev => !prev); break;
        }
      }
      if (e.key === '?') setShowShortcuts(prev => !prev);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lang, theme, isAuthenticated, setLang, toggleTheme, handleTabChange]);

  const handleLoginSuccess = (role: string) => {
    switch (role) {
      case UserRole.ADMIN: case UserRole.MANAGER: setActiveTab('dashboard'); break;
      case UserRole.ROASTER: setActiveTab('roasting'); break;
      case UserRole.WAREHOUSE_STAFF: setActiveTab('inventory'); break;
      default: setActiveTab('pos'); break;
    }
  };

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-stone-50 dark:bg-stone-950">
        <Loader2 className="w-12 h-12 text-amber-600 animate-spin" />
      </div>
    );
  }

  if (error === "Account disabled") {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-stone-50 dark:bg-stone-950 p-8 text-center" dir={t.dir}>
        <div className="bg-red-100 dark:bg-red-900/30 p-6 rounded-full text-red-600 dark:text-red-400 mb-6">
          <AlertTriangle size={64} />
        </div>
        <h1 className="text-3xl font-bold mb-4">{t.accountDisabled}</h1>
        <button onClick={() => window.location.reload()} className="bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 px-8 py-3 rounded-2xl font-bold">
          {t.backToLogin}
        </button>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginView onLogin={handleLoginSuccess} />;
  }

  const Breadcrumbs = () => {
    const activeItem = allMenuItems.find(i => i.id === activeTab);
    return (
      <nav className="flex items-center gap-2 text-xs md:text-sm text-stone-500 dark:text-stone-400 mb-4 transition-all overflow-x-auto no-scrollbar whitespace-nowrap">
        <button onClick={() => handleTabChange('dashboard')} className="hover:text-amber-600 dark:hover:text-amber-500 transition-colors">
          {t.home}
        </button>
        {activeTab !== 'dashboard' && (
          <>
            {t.dir === 'rtl' ? <ChevronLeft size={14} className="shrink-0" /> : <ChevronRight size={14} className="shrink-0" />}
            <button 
              onClick={() => setActiveDetailId(null)}
              className={`hover:text-amber-600 dark:hover:text-amber-500 transition-colors ${!activeDetailId ? 'font-bold text-stone-800 dark:text-stone-200' : ''}`}
            >
              {activeItem?.label}
            </button>
          </>
        )}
        {activeDetailId && (
          <>
            {t.dir === 'rtl' ? <ChevronLeft size={14} className="shrink-0" /> : <ChevronRight size={14} className="shrink-0" />}
            <span className="font-bold text-stone-800 dark:text-stone-200">
              {activeDetailId}
            </span>
          </>
        )}
      </nav>
    );
  };

  const QuickActions = () => (
    <div className="relative">
      <button 
        onClick={() => setShowQuickActions(!showQuickActions)}
        className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 md:px-4 md:py-2 rounded-xl text-xs md:text-sm font-bold shadow-lg transition-all active:scale-95"
      >
        <Zap size={16} fill="currentColor" />
        <span className="hidden sm:inline">{t.quickActions}</span>
      </button>
      {showQuickActions && (
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setShowQuickActions(false)} />
          <div className={`absolute top-full mt-2 ${t.dir === 'rtl' ? 'left-0' : 'right-0'} w-48 bg-white dark:bg-stone-900 rounded-2xl shadow-2xl border border-stone-100 dark:border-stone-800 p-2 z-[70] animate-in fade-in zoom-in-95 duration-200`}>
            {userRole !== UserRole.CASHIER && userRole !== UserRole.WAREHOUSE_STAFF && (
              <button onClick={() => { handleTabChange('roasting'); setShowQuickActions(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors text-right">
                <Flame size={16} className="text-orange-500" />
                <span className="text-sm font-medium dark:text-stone-200">{t.newBatch}</span>
              </button>
            )}
            {userRole !== UserRole.ROASTER && userRole !== UserRole.WAREHOUSE_STAFF && (
              <button onClick={() => { handleTabChange('pos'); setShowQuickActions(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors text-right">
                <ShoppingCart size={16} className="text-blue-500" />
                <span className="text-sm font-medium dark:text-stone-200">{t.newSale}</span>
              </button>
            )}
            <button onClick={() => { handleTabChange('inventory'); setShowQuickActions(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors text-right">
              <ClipboardList size={16} className="text-green-500" />
              <span className="text-sm font-medium dark:text-stone-200">{t.inventoryReport}</span>
            </button>
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className={`flex h-screen bg-stone-100 dark:bg-stone-950 overflow-hidden transition-colors duration-300 ${lang === 'ar' ? 'font-arabic' : 'font-sans'}`} dir={t.dir}>
      {showSessionWarning && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white dark:bg-stone-900 rounded-[32px] p-8 max-md w-full shadow-2xl border border-stone-200 dark:border-stone-800 text-center">
            <div className="flex justify-center mb-6">
              <div className="bg-amber-100 dark:bg-amber-900/30 p-4 rounded-full text-amber-600 dark:text-amber-400">
                <Clock size={48} className="animate-pulse" />
              </div>
            </div>
            <h3 className="text-2xl font-bold text-stone-900 dark:text-stone-100 mb-4">{t.sessionTimeout}</h3>
            <p className="text-stone-600 dark:text-stone-400 mb-8 leading-relaxed">{t.sessionWarning}</p>
            <div className="flex flex-col gap-3">
              <button onClick={() => { setShowSessionWarning(false); refreshSession(); }} className="w-full py-4 bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 rounded-2xl font-bold shadow-xl hover:bg-black dark:hover:bg-white transition-all active:scale-95">{t.stayLoggedIn}</button>
              <button onClick={() => { logout(); setShowSessionWarning(false); }} className="w-full py-4 text-stone-500 hover:text-red-500 font-bold transition-colors">{t.logout}</button>
            </div>
          </div>
        </div>
      )}
      {isMobileMenuOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setIsMobileMenuOpen(false)} />}
      {showShortcuts && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white dark:bg-stone-900 rounded-[32px] p-8 max-w-md w-full shadow-2xl border border-stone-200 dark:border-stone-800">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold flex items-center gap-2 text-stone-900 dark:text-stone-100"><Keyboard className="text-amber-600" />{t.shortcuts}</h3>
              <button onClick={() => setShowShortcuts(false)} className="p-2 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-full transition-colors"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              {menuItems.map((item, i) => (
                <div key={item.id} className="flex justify-between items-center py-2 border-b border-stone-100 dark:border-stone-800 last:border-0">
                  <span className="text-stone-600 dark:text-stone-400 text-sm">{item.label}</span>
                  <kbd className="bg-stone-100 dark:bg-stone-800 px-2 py-1 rounded text-xs font-mono font-bold text-stone-900 dark:text-stone-100 border border-stone-200 dark:border-stone-700">Alt + {item.id.charAt(0).toUpperCase()}</kbd>
                </div>
              ))}
              <div className="flex justify-between items-center py-2 border-b border-stone-100 dark:border-stone-800 last:border-0">
                <span className="text-stone-600 dark:text-stone-400 text-sm">{lang === 'ar' ? 'تغيير اللغة' : 'Change Language'}</span>
                <kbd className="bg-stone-100 dark:bg-stone-800 px-2 py-1 rounded text-xs font-mono font-bold text-stone-900 dark:text-stone-100 border border-stone-200 dark:border-stone-700">Alt + L</kbd>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-stone-100 dark:border-stone-800 last:border-0">
                <span className="text-stone-600 dark:text-stone-400 text-sm">{lang === 'ar' ? 'تغيير المظهر' : 'Change Theme'}</span>
                <kbd className="bg-stone-100 dark:bg-stone-800 px-2 py-1 rounded text-xs font-mono font-bold text-stone-900 dark:text-stone-100 border border-stone-200 dark:border-stone-700">Alt + T</kbd>
              </div>
            </div>
          </div>
        </div>
      )}
      <aside className={`fixed inset-y-0 ${t.dir === 'rtl' ? 'right-0' : 'left-0'} z-50 transform transition-all duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-auto ${isMobileMenuOpen ? 'translate-x-0' : (t.dir === 'rtl' ? 'translate-x-full' : '-translate-x-full')} bg-stone-900 text-stone-200 flex-shrink-0 flex flex-col shadow-xl ${isSidebarOpen ? 'w-64' : 'w-20'}`}>
        <div className="p-4 flex items-center justify-between border-b border-stone-800">
          <div className={`flex items-center gap-3 overflow-hidden transition-all ${!isSidebarOpen && 'opacity-0 w-0 lg:hidden'}`}>
            <div className="bg-amber-600 p-2 rounded-lg"><Coffee className="w-6 h-6 text-white" /></div>
            <span className="font-bold text-xl whitespace-nowrap">{t.appName}</span>
          </div>
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-1 hover:bg-stone-800 rounded hidden lg:block transition-colors">{isSidebarOpen ? (t.dir === 'rtl' ? <ChevronRight size={20} /> : <ChevronLeft size={20} />) : <Menu size={20} />}</button>
          <button onClick={() => setIsMobileMenuOpen(false)} className="p-1 hover:bg-stone-800 rounded lg:hidden transition-colors"><X size={24} /></button>
        </div>
        <nav className="flex-1 mt-6 px-3 space-y-2 overflow-y-auto no-scrollbar">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button key={item.id} onClick={() => handleTabChange(item.id)} className={`w-full flex items-center gap-4 px-3 py-3 rounded-xl transition-all duration-200 group relative ${isActive ? 'bg-amber-600 text-white shadow-lg shadow-amber-900/20' : 'hover:bg-stone-800 text-stone-400 hover:text-stone-100'}`}>
                <Icon size={22} className={`shrink-0 transition-transform ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} />
                <span className={`font-medium whitespace-nowrap overflow-hidden transition-all ${!isSidebarOpen ? 'opacity-0 w-0' : 'opacity-100 w-auto'}`}>{item.label}</span>
                {!isSidebarOpen && <div className={`absolute ${t.dir === 'rtl' ? 'right-full mr-4' : 'left-full ml-4'} px-2 py-1 bg-stone-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50`}>{item.label}</div>}
              </button>
            );
          })}
        </nav>
        <div className="p-4 border-t border-stone-800">
          <div className="flex flex-col gap-4">
            <button onClick={() => setShowShortcuts(true)} className="flex items-center gap-3 px-3 py-2 text-stone-500 hover:text-stone-300 transition-colors"><Keyboard size={18} />{isSidebarOpen && <span className="text-xs">{t.shortcuts}</span>}</button>
            <div className="flex items-center gap-3 px-3 py-2 text-stone-500 group relative">
              <UserCircle size={18} />
              {isSidebarOpen && <div className="flex flex-col flex-1"><span className="text-[10px] uppercase font-bold tracking-widest">{t.role}</span><span className="text-xs font-bold text-stone-300 truncate">{t[user?.role?.toLowerCase() as keyof typeof t] || user?.role}</span></div>}
              <button onClick={logout} className="text-stone-500 hover:text-red-400 transition-colors"><LogOut size={18} /></button>
            </div>
          </div>
        </div>
      </aside>
      <main className="flex-1 flex flex-col overflow-hidden relative w-full">
        <header className="h-16 bg-white dark:bg-stone-900 shadow-sm flex items-center justify-between px-4 md:px-8 shrink-0 transition-colors duration-300 z-50">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsMobileMenuOpen(true)} className={`p-2 ${t.dir === 'rtl' ? '-mr-2' : '-ml-2'} text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg lg:hidden transition-colors`}><Menu size={24} /></button>
            <div className="hidden sm:block">
              <h1 className="text-lg md:text-xl font-bold text-stone-800 dark:text-stone-100 truncate">{allMenuItems.find(i => i.id === activeTab)?.label}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            <QuickActions />
            <div className="h-6 w-[1px] bg-stone-200 dark:border-stone-800 mx-1 hidden md:block" />
            <button onClick={toggleTheme} className="p-2 text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-full transition-colors">{theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}</button>
            <button onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')} className="flex items-center gap-1 text-[10px] md:text-xs font-bold px-2 md:px-3 py-1 border border-stone-200 dark:border-stone-700 rounded-full text-stone-500 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"><Languages size={14} />{lang === 'ar' ? 'EN' : 'AR'}</button>
            <div className="hidden lg:flex flex-col text-right">
              <span className="text-sm font-bold text-stone-800 dark:text-stone-100">{t.welcome.replace('{name}', user?.name || '')}</span>
              <span className="text-[10px] text-stone-500 dark:text-stone-400 uppercase tracking-tighter">
                {t[user?.role?.toLowerCase() as keyof typeof t] || user?.role}
              </span>
            </div>
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-700 dark:text-amber-400 font-bold border-2 border-amber-500 text-sm md:text-base transition-colors shrink-0">
              {user?.name?.charAt(0) || (lang === 'ar' ? 'ع' : 'U')}
            </div>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-7xl mx-auto">
            <Breadcrumbs />
            {activeTab === 'dashboard' && <DashboardView />}
            {activeTab === 'roasting' && <RoastingView onDetailOpen={setActiveDetailId} />}
            {activeTab === 'inventory' && <InventoryView />}
            {activeTab === 'pos' && <POSView />}
            {activeTab === 'reports' && <ReportsView />}
            {activeTab === 'ai' && <AIInsights />}
            {activeTab === 'configuration' && <ConfigurationView />}
          </div>
        </div>
      </main>
    </div>
  );
};

const App: React.FC = () => {
  const [lang, setLang] = useState<Language>(() => (localStorage.getItem('lang') as Language) || 'ar');
  const [theme, setTheme] = useState<'light' | 'dark'>(() => (localStorage.getItem('theme') as 'light' | 'dark') || 'light');
  
  const t = translations[lang];

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

  return (
    <AuthProvider>
      <ThemeContext.Provider value={{ theme, toggleTheme }}>
        <LanguageContext.Provider value={{ lang, setLang, t }}>
          <AppContent />
        </LanguageContext.Provider>
      </ThemeContext.Provider>
    </AuthProvider>
  );
};

export default App;
