
import React, { useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { Shirt, Truck, AlertTriangle, Package, CheckCircle2, TrendingDown, AlertOctagon } from 'lucide-react';

export const LinenDashboard: React.FC = () => {
  const { services, inventoryTransactions } = useAppContext();

  // 1. FILTER LINEN ITEMS
  const linenItems = useMemo(() => {
    return services.filter(s => s.category === 'Linen');
  }, [services]);

  // 2. CALCULATE KPIS
  const kpis = useMemo(() => {
    let totalAssetsValue = 0;
    let totalClean = 0;
    let totalInRoom = 0;
    let totalDirty = 0;
    let totalVendor = 0;
    
    linenItems.forEach(item => {
        const totalQty = item.totalassets || 0;
        totalAssetsValue += totalQty * (item.costPrice || 0);
        
        totalClean += item.stock || 0;
        totalInRoom += item.in_circulation || 0;
        totalDirty += item.laundryStock || 0;
        totalVendor += item.vendor_stock || 0;
    });

    const totalItems = totalClean + totalInRoom + totalDirty + totalVendor;
    const vendorDebtRatio = totalItems > 0 ? (totalVendor / totalItems) * 100 : 0;

    return {
        totalAssetsValue,
        totalClean,
        totalInRoom,
        totalDirty,
        totalVendor,
        vendorDebtRatio
    };
  }, [linenItems]);

  // 3. PIE CHART DATA
  const pieData = [
    { name: 'Trong phòng', value: kpis.totalInRoom, color: '#3b82f6' }, // blue-500
    { name: 'Kho sạch', value: kpis.totalClean, color: '#10b981' }, // emerald-500
    { name: 'Kho bẩn', value: kpis.totalDirty, color: '#f43f5e' }, // rose-500
    { name: 'Tại xưởng', value: kpis.totalVendor, color: '#9333ea' }, // purple-600
  ].filter(d => d.value > 0);

  // 4. BAR CHART DATA (Top Damage)
  const damageData = useMemo(() => {
      const damageCounts: Record<string, number> = {};
      
      inventoryTransactions.forEach(t => {
          const isLinen = linenItems.some(l => l.id === t.item_id);
          if (!isLinen) return;

          const note = (t.note || '').toLowerCase();
          if (note.includes('hỏng') || note.includes('rách') || note.includes('mất') || note.includes('damage')) {
              const match = note.match(/hỏng\/rách:\s*(\d+)/) || note.match(/hỏng:\s*(\d+)/);
              const qty = match ? parseInt(match[1]) : 0;
              
              if (qty > 0) {
                  damageCounts[t.item_name] = (damageCounts[t.item_name] || 0) + qty;
              }
          }
      });

      return Object.entries(damageCounts)
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 5);
  }, [inventoryTransactions, linenItems]);

  // 5. LOW STOCK ALERTS
  const lowStockItems = linenItems.filter(item => (item.stock || 0) < (item.minStock || 0));

  return (
    <div className="p-4 md:p-6 space-y-6 h-auto md:h-full md:overflow-y-auto custom-scrollbar bg-slate-50/50">
        
        {/* SECTION A: KPI CARDS */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="col-span-2 md:col-span-1 bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between h-28">
                <div className="flex justify-between items-start">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tổng Giá Trị</span>
                    <div className="p-2 bg-slate-100 rounded-lg text-slate-600"><Package size={16}/></div>
                </div>
                <div>
                    <div className="text-xl font-black text-slate-800">{kpis.totalAssetsValue.toLocaleString()} ₫</div>
                    <div className="text-[10px] text-slate-400 mt-1">Vốn đầu tư cố định</div>
                </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-emerald-100 shadow-sm flex flex-col justify-between h-28">
                <div className="flex justify-between items-start">
                    <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Sẵn Sàng</span>
                    <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600"><CheckCircle2 size={16}/></div>
                </div>
                <div>
                    <div className="text-2xl font-black text-emerald-700">{kpis.totalClean}</div>
                    <div className="text-[10px] text-emerald-500 mt-1">Trong kho sạch</div>
                </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-blue-100 shadow-sm flex flex-col justify-between h-28">
                <div className="flex justify-between items-start">
                    <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Đang Dùng</span>
                    <div className="p-2 bg-blue-50 rounded-lg text-blue-600"><Shirt size={16}/></div>
                </div>
                <div>
                    <div className="text-2xl font-black text-blue-700">{kpis.totalInRoom}</div>
                    <div className="text-[10px] text-blue-500 mt-1">Tại phòng khách</div>
                </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-purple-100 shadow-sm flex flex-col justify-between h-28 relative overflow-hidden">
                {kpis.vendorDebtRatio > 30 && <div className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-bl-lg animate-pulse"></div>}
                <div className="flex justify-between items-start">
                    <span className="text-xs font-bold text-purple-600 uppercase tracking-wider">Tại Xưởng</span>
                    <div className="p-2 bg-purple-50 rounded-lg text-purple-600"><Truck size={16}/></div>
                </div>
                <div>
                    <div className="text-2xl font-black text-purple-700">{kpis.totalVendor}</div>
                    <div className="text-[10px] text-purple-500 mt-1">Nợ giặt ({kpis.vendorDebtRatio.toFixed(1)}%)</div>
                </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-rose-100 shadow-sm flex flex-col justify-between h-28">
                <div className="flex justify-between items-start">
                    <span className="text-xs font-bold text-rose-600 uppercase tracking-wider">Hỏng / Mất</span>
                    <div className="p-2 bg-rose-50 rounded-lg text-rose-600"><TrendingDown size={16}/></div>
                </div>
                <div>
                    <div className="text-2xl font-black text-rose-700">{damageData.reduce((a,b) => a + b.value, 0)}</div>
                    <div className="text-[10px] text-rose-500 mt-1">Ghi nhận gần đây</div>
                </div>
            </div>
        </div>

        {/* SECTION B: CHARTS */}
        <div className="flex flex-col lg:grid lg:grid-cols-2 gap-6">
            {/* Chart 1: Distribution */}
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col h-[300px] md:h-[350px]">
                <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wide mb-4">Phân bổ Tài Sản Đồ Vải</h3>
                <div className="flex-1 min-h-0">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={pieData}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                            >
                                {pieData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                            </Pie>
                            <Tooltip formatter={(value) => [`${value} món`, 'Số lượng']} />
                            <Legend verticalAlign="bottom" height={36} iconType="circle" />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Chart 2: Top Damage */}
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col h-[300px] md:h-[350px]">
                <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wide mb-4 flex items-center gap-2">
                    <AlertTriangle size={16} className="text-rose-500"/> Top Hư Hỏng & Mất
                </h3>
                {damageData.length > 0 ? (
                    <div className="flex-1 min-h-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={damageData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 11, fill: '#64748b', fontWeight: 600}} />
                                <Tooltip cursor={{fill: 'transparent'}} />
                                <Bar dataKey="value" fill="#f43f5e" radius={[0, 4, 4, 0]} barSize={20} name="Số lượng hỏng" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                        <CheckCircle2 size={40} className="mb-2 opacity-30 text-emerald-500"/>
                        <p className="text-xs font-medium">Chưa có ghi nhận hư hỏng đáng kể.</p>
                    </div>
                )}
            </div>
        </div>

        {/* SECTION C: ALERTS */}
        <div className="flex flex-col md:grid md:grid-cols-2 gap-4 pb-10 md:pb-0">
            {kpis.vendorDebtRatio > 30 && (
                <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 flex items-start gap-3">
                    <div className="bg-white p-2 rounded-full text-purple-600 shadow-sm shrink-0"><AlertOctagon size={20}/></div>
                    <div>
                        <h4 className="text-sm font-bold text-purple-800">Cảnh báo tồn đọng nhà giặt</h4>
                        <p className="text-xs text-purple-600 mt-1 leading-relaxed">
                            Hiện có <b>{kpis.vendorDebtRatio.toFixed(1)}%</b> tổng đồ vải đang nằm tại xưởng giặt. 
                            Tỷ lệ này cao hơn mức khuyến nghị (30%). Vui lòng đôn đốc nhà giặt trả đồ.
                        </p>
                    </div>
                </div>
            )}

            {lowStockItems.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                    <div className="bg-white p-2 rounded-full text-amber-600 shadow-sm shrink-0"><AlertTriangle size={20}/></div>
                    <div className="flex-1">
                        <h4 className="text-sm font-bold text-amber-800">Cảnh báo sắp hết (Kho sạch)</h4>
                        <div className="mt-2 flex flex-wrap gap-2">
                            {lowStockItems.slice(0, 5).map(item => (
                                <span key={item.id} className="text-[10px] font-bold bg-white text-amber-700 px-2 py-1 rounded border border-amber-100">
                                    {item.name}: {item.stock}
                                </span>
                            ))}
                            {lowStockItems.length > 5 && <span className="text-[10px] text-amber-600 pt-1">+{lowStockItems.length - 5} món khác...</span>}
                        </div>
                    </div>
                </div>
            )}
        </div>
    </div>
  );
};
