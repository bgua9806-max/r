
import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, CloudLightning, CalendarCheck, DoorOpen, Brush, 
  Smartphone, Package, Contact, Users, Wallet, Settings, 
  X, Fingerprint, Clock, ChevronRight, LogOut, FileUp 
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { storageService } from '../services/storage';
import { ShiftModal } from './ShiftModal';
import { TimekeepingModal } from './TimekeepingModal';

export const Sidebar: React.FC<{ isOpen: boolean; toggle: () => void }> = ({ isOpen, toggle }) => {
  const { currentUser, setCurrentUser, canAccess, currentShift, otaOrders, timeLogs } = useAppContext();
  const navigate = useNavigate();
  const location = useLocation();
  const [isShiftModalOpen, setShiftModalOpen] = useState(false);
  const [isTimekeepingOpen, setTimekeepingOpen] = useState(false);

  // FIX: Calculate pending count to include both 'Pending' and 'Cancelled' (but not confirmed)
  // This matches the "Cần xử lý" tab logic in OtaOrders page
  const pendingOtaCount = otaOrders.filter(o => 
      o.status === 'Pending' || 
      o.status === 'Cancelled'
  ).length;

  // Check if currently clocked in
  const activeLog = currentUser ? timeLogs.find(l => l.staff_id === currentUser.id && !l.check_out_time) : null;

  const handleLogout = () => {
    // Thực hiện đăng xuất ngay lập tức
    setCurrentUser(null);
    storageService.saveUser(null); // Clear storage
    navigate('/login');
  };

  const menuItems = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Tổng quan' },
    { to: '/ota-orders', icon: CloudLightning, label: 'Đơn hàng', badge: pendingOtaCount },
    { to: '/bookings', icon: CalendarCheck, label: 'Lịch đặt phòng' },
    { to: '/rooms', icon: DoorOpen, label: 'Phòng & Cơ sở' },
    { to: '/housekeeping', icon: Brush, label: 'Buồng phòng' },
    { to: '/staff-portal', icon: Smartphone, label: 'App Nhân Viên' },
    { to: '/inventory', icon: Package, label: 'Kho & Vật tư' },
    { to: '/customers', icon: Contact, label: 'Khách hàng (CRM)' }, 
    { to: '/collaborators', icon: Users, label: 'Nhân sự' },
    { to: '/expenses', icon: Wallet, label: 'Tài chính' },
    { to: '/settings', icon: Settings, label: 'Cấu hình' },
  ];
  
  return (
    <>
    <aside 
      className={`h-full bg-[#0f172a] text-slate-300 flex flex-col border-r border-slate-800 shadow-xl overflow-hidden transition-all duration-300 w-full`}
    >
      {/* Header Sidebar */}
      <div className="h-16 flex items-center px-4 border-b border-slate-800/80 bg-[#020617] justify-between">
        <div className="flex items-center gap-3 overflow-hidden whitespace-nowrap">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-brand-500 to-brand-400 flex items-center justify-center text-white shadow-[0_0_15px_rgba(20,184,166,0.4)] shrink-0">
             <span className="font-bold font-sans">H</span>
          </div>
          <div className={`transition-all duration-300 ${(isOpen || window.innerWidth < 768) ? 'opacity-100 w-auto' : 'opacity-0 w-0'}`}>
             <h1 className="font-bold text-white text-base tracking-tight">HotelPro</h1>
          </div>
        </div>
        
        {/* Close button for mobile */}
        <button onClick={toggle} className="md:hidden p-2 text-slate-400 hover:text-white transition-colors">
          <X size={20} />
        </button>
      </div>

      <div className="p-3 space-y-2">
          {/* TIMEKEEPING BUTTON */}
          <button 
             onClick={() => setTimekeepingOpen(true)}
             className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-bold text-sm transition-all shadow-lg group relative overflow-hidden
                ${activeLog 
                    ? 'bg-emerald-600/10 text-emerald-400 border border-emerald-600/30 hover:bg-emerald-600/20' 
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'}
             `}
          >
              <div className={`shrink-0 ${activeLog ? 'animate-pulse' : ''}`}>
                  <Fingerprint size={18} />
              </div>
              <span className={`whitespace-nowrap overflow-hidden transition-all duration-200 flex-1 text-left ${(isOpen || window.innerWidth < 768) ? 'w-auto opacity-100' : 'w-0 opacity-0 hidden'}`}>
                  {activeLog ? 'Đang làm việc' : 'Chấm công GPS'}
              </span>
              {activeLog && (isOpen || window.innerWidth < 768) && (
                  <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_#10b981]"></div>
              )}
          </button>

          {/* SHIFT BUTTON - HIDDEN FOR 'Buồng phòng' */}
          {currentUser?.role !== 'Buồng phòng' && (
            <button 
               onClick={() => setShiftModalOpen(true)}
               className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-bold text-sm transition-all shadow-lg
                  ${currentShift ? 'bg-blue-600/10 text-blue-400 border border-blue-600/20 hover:bg-blue-600/20' : 'bg-brand-600 text-white hover:bg-brand-500'}
               `}
            >
                <Clock size={18} className="shrink-0"/>
                <span className={`whitespace-nowrap overflow-hidden transition-all duration-200 ${(isOpen || window.innerWidth < 768) ? 'w-auto opacity-100' : 'w-0 opacity-0 hidden'}`}>
                    {currentShift ? 'Giao Ca / Quỹ' : 'Mở Ca Mới'}
                </span>
            </button>
          )}
      </div>

      <nav className="flex-1 px-2 space-y-1 overflow-y-auto custom-scrollbar">
        {menuItems.filter(i => canAccess(i.to)).map((item) => {
          const isActive = location.pathname === item.to || location.pathname.startsWith(item.to + '/');
          
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => window.innerWidth < 768 && toggle()} // Auto close on mobile click
              title={!isOpen ? item.label : ''}
              className={`
                relative flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200 group mb-1
                ${isActive 
                  ? 'bg-brand-600 text-white shadow-lg shadow-brand-900/20 font-medium' 
                  : 'hover:bg-slate-800/80 hover:text-white text-slate-400'}
              `}
            >
              <div className="relative shrink-0">
                  <item.icon size={20} className={`transition-colors ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'}`} />
                  {/* Fix: Check for > 0 explicitly to avoid rendering '0' text */}
                  {(item.badge || 0) > 0 && !isOpen && window.innerWidth >= 768 && (
                      <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-[#0f172a]"></div>
                  )}
              </div>
              
              <span className={`whitespace-nowrap overflow-hidden transition-all duration-200 text-sm flex-1 flex items-center justify-between ${(isOpen || window.innerWidth < 768) ? 'w-auto opacity-100' : 'w-0 opacity-0 hidden'}`}>
                {item.label}
                {/* Fix: Check for > 0 explicitly to avoid rendering '0' text */}
                {(item.badge || 0) > 0 && (
                    <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{item.badge}</span>
                )}
              </span>

              {(!isOpen && window.innerWidth >= 768) && (
                <div className="absolute left-full ml-4 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 whitespace-nowrap shadow-xl">
                  {item.label}
                </div>
              )}
              
              {isActive && (isOpen || window.innerWidth < 768) && (
                  <ChevronRight size={14} className="opacity-50" />
              )}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-slate-800/80 bg-[#020617]">
        <button 
           onClick={handleLogout}
           className={`flex items-center gap-3 w-full p-2 rounded-lg hover:bg-red-500/10 hover:text-red-400 transition-all group ${(!isOpen && window.innerWidth >= 768) ? 'justify-center' : ''}`}
        >
          <LogOut size={20} className="shrink-0" />
          <span className={`text-sm font-medium whitespace-nowrap overflow-hidden transition-all duration-200 ${(isOpen || window.innerWidth < 768) ? 'w-auto opacity-100' : 'w-0 opacity-0 hidden'}`}>
             Đăng xuất
          </span>
        </button>
      </div>
    </aside>

    <ShiftModal isOpen={isShiftModalOpen} onClose={() => setShiftModalOpen(false)} />
    <TimekeepingModal isOpen={isTimekeepingOpen} onClose={() => setTimekeepingOpen(false)} />
    </>
  );
};
