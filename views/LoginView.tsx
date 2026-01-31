
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { 
  Coffee, User, Lock, ArrowRight, ArrowLeft, Loader2, 
  AlertCircle, Languages, Moon, Sun, Mail, CheckCircle2, 
  ShieldCheck, Eye, EyeOff, Sparkles, Shield, Flame, ShoppingCart, 
  ChevronRight, X
} from 'lucide-react';
import { useLanguage, useTheme } from '../App';
import { useAuth } from '../contexts/AuthContext';
import { UserRole } from '../types';

interface LoginViewProps {
  onLogin: (role: string) => void;
}

const loginSchema = z.object({
  identifier: z.string().min(3, { message: 'اسم المستخدم مطلوب' }),
  password: z.string().min(8, { message: 'كلمة المرور يجب أن تكون 8 أحرف' }),
  rememberMe: z.boolean().default(false),
});

const forgotPasswordSchema = z.object({
  email: z.string().email({ message: 'بريد إلكتروني غير صحيح' }),
});

type LoginFormValues = z.infer<typeof loginSchema>;
type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

const LoginView: React.FC<LoginViewProps> = ({ onLogin }) => {
  const { lang, setLang, t } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const { login, loginAsGuest, forgotPassword } = useAuth();
  
  const [viewMode, setViewMode] = useState<'login' | 'forgotPassword' | 'chooseRole'>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [apiError, setApiError] = useState('');
  const [isResetSent, setIsResetSent] = useState(false);
  const [lastResetEmail, setLastResetEmail] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: '', password: '', rememberMe: false }
  });

  const {
    register: registerForgot,
    handleSubmit: handleSubmitForgot,
    formState: { errors: forgotErrors, isSubmitting: isSubmittingForgot },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onLoginSubmit = async (values: LoginFormValues) => {
    setApiError('');
    try {
      await login(values);
      onLogin('redirecting'); 
    } catch (err: any) {
      setApiError(err.message === "Invalid login credentials" ? t.invalidLogin : err.message);
    }
  };

  const handleRoleSelection = (role: UserRole) => {
    setApiError('');
    loginAsGuest(role);
    onLogin(role);
  };

  const toggleLang = () => setLang(lang === 'ar' ? 'en' : 'ar');

  const renderResetSent = () => (
    <div className="space-y-6 text-center animate-in fade-in zoom-in-95 duration-300">
      <div className="flex justify-center">
        <div className="bg-black text-white p-4 rounded-full border-2 border-black">
          <CheckCircle2 size={48} />
        </div>
      </div>
      <div className="space-y-2">
        <h3 className="text-xl font-bold text-stone-800 dark:text-stone-100">{t.resetLinkSent}</h3>
        <p className="text-stone-500 dark:text-stone-400 text-sm">
          {lang === 'ar' ? `تم إرسال الرابط إلى ${lastResetEmail}` : `Link sent to ${lastResetEmail}`}
        </p>
      </div>
      <button 
        onClick={() => { setViewMode('login'); setIsResetSent(false); }}
        className="text-black dark:text-white font-bold hover:underline flex items-center gap-2 justify-center w-full"
      >
        {t.backToLogin}
      </button>
    </div>
  );

  const renderChooseRole = () => (
    <div className="animate-in fade-in zoom-in-95 duration-300 space-y-6">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-xl font-bold text-stone-800 dark:text-stone-100">
          {lang === 'ar' ? 'اختر صلاحية الدخول' : 'Choose Your Role'}
        </h3>
        <button onClick={() => setViewMode('login')} className="p-2 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-full transition-colors">
          <X size={20} className="text-stone-400" />
        </button>
      </div>
      
      <div className="grid grid-cols-1 gap-4">
        <button 
          onClick={() => handleRoleSelection(UserRole.ADMIN)}
          className="group flex items-center justify-between p-5 bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700 rounded-2xl hover:border-black dark:hover:border-white hover:bg-white dark:hover:bg-stone-800 transition-all text-right"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-black text-white rounded-xl group-hover:scale-110 transition-transform">
              <Shield size={24} />
            </div>
            <div className="text-right">
              <h4 className="font-bold text-stone-800 dark:text-stone-100">{t.admin}</h4>
              <p className="text-xs text-stone-500">{lang === 'ar' ? 'صلاحية كاملة لإدارة النظام' : 'Full system management'}</p>
            </div>
          </div>
          <ChevronRight size={20} className={`text-stone-300 group-hover:text-black dark:group-hover:text-white group-hover:translate-x-1 transition-all ${t.dir === 'rtl' ? 'rotate-180' : ''}`} />
        </button>

        <button 
          onClick={() => handleRoleSelection(UserRole.ROASTER)}
          className="group flex items-center justify-between p-5 bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700 rounded-2xl hover:border-black dark:hover:border-white hover:bg-white dark:hover:bg-stone-800 transition-all text-right"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white border-2 border-black text-black rounded-xl group-hover:scale-110 transition-transform">
              <Flame size={24} />
            </div>
            <div className="text-right">
              <h4 className="font-bold text-stone-800 dark:text-stone-100">{t.roaster}</h4>
              <p className="text-xs text-stone-500">{lang === 'ar' ? 'إدارة دفعات التحميص والمخزون' : 'Manage roasting and stock'}</p>
            </div>
          </div>
          <ChevronRight size={20} className={`text-stone-300 group-hover:text-black dark:group-hover:text-white group-hover:translate-x-1 transition-all ${t.dir === 'rtl' ? 'rotate-180' : ''}`} />
        </button>

        <button 
          onClick={() => handleRoleSelection(UserRole.CASHIER)}
          className="group flex items-center justify-between p-5 bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700 rounded-2xl hover:border-black dark:hover:border-white hover:bg-white dark:hover:bg-stone-800 transition-all text-right"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-black text-white rounded-xl group-hover:scale-110 transition-transform">
              <ShoppingCart size={24} />
            </div>
            <div className="text-right">
              <h4 className="font-bold text-stone-800 dark:text-stone-100">{t.cashier}</h4>
              <p className="text-xs text-stone-500">{lang === 'ar' ? 'نظام المبيعات وخدمة العملاء' : 'POS and customer service'}</p>
            </div>
          </div>
          <ChevronRight size={20} className={`text-stone-300 group-hover:text-black dark:group-hover:text-white group-hover:translate-x-1 transition-all ${t.dir === 'rtl' ? 'rotate-180' : ''}`} />
        </button>
      </div>
    </div>
  );

  const renderForgotPassword = () => (
    <div className="animate-in slide-in-from-bottom-4 duration-300">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-stone-800 dark:text-stone-100 mb-2">{t.resetPasswordTitle}</h2>
        <p className="text-stone-500 dark:text-stone-400 text-sm">{t.resetPasswordDesc}</p>
      </div>
      <form onSubmit={handleSubmitForgot(async (v) => {
        try {
          await forgotPassword(v.email);
          setLastResetEmail(v.email);
          setIsResetSent(true);
        } catch (e: any) { setApiError(e.message); }
      })} className="space-y-6">
        <div className="space-y-1">
          <label className="text-sm font-semibold text-stone-700 dark:text-stone-300 block">{t.emailAddress}</label>
          <div className="relative">
            <Mail className={`absolute ${t.dir === 'rtl' ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 text-stone-400`} size={20} />
            <input {...registerForgot('email')} type="email" className={`w-full bg-stone-50 dark:bg-stone-800 border ${forgotErrors.email ? 'border-black' : 'border-stone-200 dark:border-stone-700'} rounded-2xl ${t.dir === 'rtl' ? 'pr-12 pl-4' : 'pl-12 pr-4'} py-3.5 outline-none focus:ring-2 focus:ring-black transition-all`} />
          </div>
        </div>
        <button type="submit" disabled={isSubmittingForgot} className="w-full bg-black dark:bg-white text-white dark:text-black py-4 rounded-2xl font-bold shadow-xl flex items-center justify-center gap-3 border-2 border-black">
          {isSubmittingForgot ? <Loader2 className="animate-spin" size={24} /> : t.sendResetLink}
        </button>
        <button type="button" onClick={() => { setViewMode('login'); setApiError(''); }} className="w-full text-stone-500 text-sm font-bold hover:text-black transition-colors">{t.backToLogin}</button>
      </form>
    </div>
  );

  return (
    <div className={`min-h-screen flex items-center justify-center bg-stone-100 dark:bg-stone-950 p-4 transition-colors duration-300 ${lang === 'ar' ? 'font-arabic' : 'font-sans'}`} dir={t.dir}>
      <div className="fixed top-6 left-6 right-6 flex justify-between items-center z-10">
        <div className="flex items-center gap-2">
          <div className="bg-black p-2 rounded-xl text-white shadow-lg border-2 border-black"><Coffee size={24} /></div>
          <span className="font-bold text-xl text-stone-800 dark:text-stone-100">{t.appName}</span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={toggleTheme} className="p-2.5 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-full shadow-sm hover:border-black transition-colors">{theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}</button>
          <button onClick={toggleLang} className="flex items-center gap-2 text-xs font-bold px-4 py-2 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-full shadow-sm hover:border-black transition-colors"><Languages size={16} />{lang === 'ar' ? 'English' : 'عربي'}</button>
        </div>
      </div>

      <div className="w-full max-w-md animate-in fade-in zoom-in-95 duration-500">
        <div className="bg-white dark:bg-stone-900 rounded-[32px] shadow-2xl border border-stone-200 dark:border-stone-800 p-8 md:p-10 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-black" />
          
          {isResetSent ? renderResetSent() : (
            viewMode === 'forgotPassword' ? renderForgotPassword() : (
              viewMode === 'chooseRole' ? renderChooseRole() : (
                <>
                  <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-white dark:bg-stone-800 rounded-2xl flex items-center justify-center text-black dark:text-white mx-auto mb-4 border-2 border-black dark:border-stone-700"><Coffee size={40} /></div>
                    <h2 className="text-3xl font-bold text-stone-800 dark:text-stone-100 mb-2">{t.welcomeBack}</h2>
                    <p className="text-stone-500 dark:text-stone-400 text-sm">{t.loginToManage}</p>
                  </div>

                  <form onSubmit={handleSubmit(onLoginSubmit)} className="space-y-5">
                    <div className="space-y-1">
                      <label className="text-sm font-semibold text-stone-700 dark:text-stone-300 block">{t.usernameOrEmail}</label>
                      <div className="relative">
                        <User className={`absolute ${t.dir === 'rtl' ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 text-stone-400`} size={20} />
                        <input {...register('identifier')} type="text" className={`w-full bg-stone-50 dark:bg-stone-800 border ${errors.identifier ? 'border-black' : 'border-stone-200 dark:border-stone-700'} rounded-2xl ${t.dir === 'rtl' ? 'pr-12 pl-4' : 'pl-12 pr-4'} py-3.5 outline-none focus:ring-2 focus:ring-black transition-all`} placeholder="admin" />
                      </div>
                      {errors.identifier && <p className="text-xs text-black font-bold mt-1">{errors.identifier.message}</p>}
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <label className="text-sm font-semibold text-stone-700 dark:text-stone-300 block">{t.password}</label>
                        <button type="button" onClick={() => setViewMode('forgotPassword')} className="text-xs font-bold text-black dark:text-white hover:underline">{t.forgotPassword}</button>
                      </div>
                      <div className="relative">
                        <Lock className={`absolute ${t.dir === 'rtl' ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 text-stone-400`} size={20} />
                        <input {...register('password')} type={showPassword ? 'text' : 'password'} className={`w-full bg-stone-50 dark:bg-stone-800 border ${errors.password ? 'border-black' : 'border-stone-200 dark:border-stone-700'} rounded-2xl ${t.dir === 'rtl' ? 'pr-12 pl-12' : 'pl-12 pr-12'} py-3.5 outline-none focus:ring-2 focus:ring-black transition-all`} placeholder="••••••••" />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className={`absolute ${t.dir === 'rtl' ? 'left-4' : 'right-4'} top-1/2 -translate-y-1/2 text-stone-400`}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
                      </div>
                      {errors.password && <p className="text-xs text-black font-bold mt-1">{errors.password.message}</p>}
                    </div>

                    {apiError && (
                      <div className="bg-stone-100 dark:bg-stone-800 border-2 border-black dark:border-white p-4 rounded-xl flex items-center gap-3 animate-in shake duration-500">
                        <AlertCircle className="text-black dark:text-white shrink-0" size={18} />
                        <span className="text-xs font-bold text-black dark:text-white">{apiError}</span>
                      </div>
                    )}

                    <button type="submit" disabled={isSubmitting} className="w-full bg-black dark:bg-white text-white dark:text-black py-4 rounded-2xl font-bold text-lg shadow-xl hover:bg-stone-900 dark:hover:bg-stone-200 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3 border-2 border-black">
                      {isSubmitting ? <Loader2 className="animate-spin" size={24} /> : <>{t.login} {t.dir === 'rtl' ? <ArrowLeft size={20} /> : <ArrowRight size={20} />}</>}
                    </button>

                    <div className="relative py-4 flex items-center">
                      <div className="flex-grow border-t border-stone-100 dark:border-stone-800"></div>
                      <span className="flex-shrink mx-4 text-stone-400 text-xs font-bold uppercase">{lang === 'ar' ? 'أو' : 'OR'}</span>
                      <div className="flex-grow border-t border-stone-100 dark:border-stone-800"></div>
                    </div>

                    <button 
                      type="button" 
                      onClick={() => setViewMode('chooseRole')}
                      className="w-full bg-white dark:bg-stone-800 border-2 border-black dark:border-stone-700 text-black dark:text-white py-3.5 rounded-2xl font-bold text-sm hover:bg-stone-50 dark:hover:bg-stone-700 transition-all flex items-center justify-center gap-2"
                    >
                      <Sparkles size={18} />
                      {lang === 'ar' ? 'الدخول كزائر (اختيار الصلاحية)' : 'Try Demo (Select Role)'}
                    </button>
                  </form>

                  <div className="mt-8 pt-6 border-t border-stone-100 dark:border-stone-800 text-center">
                    <div className="flex justify-center items-center gap-2 text-stone-400 text-xs italic">
                      <ShieldCheck size={14} /> {lang === 'ar' ? 'نظام محمي وآمن' : 'Secure Enterprise System'}
                    </div>
                  </div>
                </>
              )
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default LoginView;
