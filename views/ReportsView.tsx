
import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { FileDown, Calendar } from 'lucide-react';
import { useLanguage, useTheme } from '../App';

const COLORS = ['#d97706', '#ea580c', '#78350f', '#f59e0b'];

const ReportsView: React.FC = () => {
  const { lang, t } = useLanguage();
  const { theme } = useTheme();
  
  const pieData = [
    { name: lang === 'ar' ? 'بن إثيوبي' : 'Ethiopian', value: 400 },
    { name: lang === 'ar' ? 'بن كولومبي' : 'Colombian', value: 300 },
    { name: lang === 'ar' ? 'بن برازيلي' : 'Brazilian', value: 300 },
    { name: lang === 'ar' ? 'بن غواتيمالي' : 'Guatemalan', value: 200 },
  ];

  return (
    <div className="space-y-6 md:space-y-8 animate-in zoom-in-95 duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-stone-800 dark:text-stone-100 transition-colors">{t.reports}</h2>
          <p className="text-sm md:text-base text-stone-500 dark:text-stone-400">{lang === 'ar' ? 'تحليل الأداء المالي والتشغيلي' : 'Financial and operational performance analysis'}</p>
        </div>
        <div className="flex flex-wrap gap-2 md:gap-3 w-full md:w-auto">
          <div className="flex-1 md:flex-none flex bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl px-4 py-2 md:py-3 items-center gap-3 shadow-sm transition-colors">
            <Calendar size={18} className="text-stone-400 dark:text-stone-500" />
            <span className="text-xs md:text-sm font-bold whitespace-nowrap text-stone-700 dark:text-stone-300">{t.last30Days}</span>
          </div>
          <button className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 px-4 md:px-6 py-2 md:py-3 rounded-xl font-bold shadow-lg hover:bg-black dark:hover:bg-white text-xs md:text-sm whitespace-nowrap active:scale-95 transition-all">
            <FileDown size={18} />
            {t.exportPdf}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
        <div className="bg-white dark:bg-stone-900 p-5 md:p-8 rounded-2xl shadow-sm border border-stone-200 dark:border-stone-800 transition-colors">
          <h3 className="text-base md:text-lg font-bold mb-6 text-stone-800 dark:text-stone-100">{lang === 'ar' ? 'توزيع المبيعات' : 'Sales Distribution'}</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={70}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                   contentStyle={{ backgroundColor: theme === 'dark' ? '#1c1917' : '#fff', borderColor: theme === 'dark' ? '#292524' : '#e7e5e4', borderRadius: '12px' }}
                   itemStyle={{ color: theme === 'dark' ? '#f5f5f4' : '#1c1917' }}
                />
                <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px', color: theme === 'dark' ? '#a8a29e' : '#78716c' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-2 bg-white dark:bg-stone-900 p-5 md:p-8 rounded-2xl shadow-sm border border-stone-200 dark:border-stone-800 transition-colors">
          <h3 className="text-base md:text-lg font-bold mb-6 text-stone-800 dark:text-stone-100">{t.profitability}</h3>
          <div className="space-y-5">
            {[
              { name: lang === 'ar' ? 'إثيوبيا ييرغاتشيف (٢٥٠جم)' : 'Ethiopia Yirgacheffe (250g)', margin: '٤٢٪', trend: 'up' },
              { name: lang === 'ar' ? 'فلات وايت' : 'Flat White', margin: '٧٨٪', trend: 'up' },
              { name: lang === 'ar' ? 'كولومبيا سبريمو (٥٠٠جم)' : 'Colombia Supremo (500g)', margin: '٣٥٪', trend: 'down' },
              { name: lang === 'ar' ? 'أيسد لاتيه' : 'Iced Latte', margin: '٨٢٪', trend: 'up' },
            ].map((product, idx) => (
              <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 group">
                <div className="flex items-center gap-3 md:gap-4">
                  <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-stone-100 dark:bg-stone-800 flex items-center justify-center font-bold text-stone-500 dark:text-stone-400 text-xs md:text-sm shrink-0 transition-colors">
                    {idx + 1}
                  </div>
                  <span className="font-bold text-stone-700 dark:text-stone-200 text-xs md:text-sm line-clamp-1">{product.name}</span>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-4 md:gap-8 grow">
                  <div className={`text-${t.dir === 'rtl' ? 'right' : 'left'} shrink-0`}>
                    <span className="block text-[10px] text-stone-400 dark:text-stone-500 font-bold uppercase">{lang === 'ar' ? 'هامش الربح' : 'Margin'}</span>
                    <span className={`text-xs md:text-sm font-bold ${product.trend === 'up' ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-500'}`}>
                      {product.margin}
                    </span>
                  </div>
                  <div className="w-24 md:w-32 bg-stone-100 dark:bg-stone-800 h-1.5 md:h-2 rounded-full overflow-hidden shrink-0 transition-colors">
                    <div 
                      className="bg-amber-600 dark:bg-amber-500 h-full rounded-full transition-all duration-1000" 
                      style={{ width: product.margin }} 
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportsView;
