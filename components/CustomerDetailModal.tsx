import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useAppContext } from '../context/AppContext';
import { GuestProfile } from '../types';
import { 
    X, User, Phone, MapPin, CreditCard, Star, 
    MessageSquare, Heart, Tag, Save, History,
    Globe, Loader2
} from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';

// Preset tags for selection
const PRESET_TAGS = [
    { label: 'VIP', color: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
    { label: 'Loyal', color: 'bg-green-100 text-green-700 border-green-300' },
    { label: 'New', color: 'bg-blue-100 text-blue-700 border-blue-300' },
    { label: 'Direct', color: 'bg-indigo-100 text-indigo-700 border-indigo-300' },
    { label: 'OTA-Agoda', color: 'bg-sky-100 text-sky-700 border-sky-300' },
    { label: 'OTA-Booking', color: 'bg-violet-100 text-violet-700 border-violet-300' },
    { label: 'Referral', color: 'bg-pink-100 text-pink-700 border-pink-300' },
    { label: 'Blacklist', color: 'bg-red-100 text-red-700 border-red-300' },
];

interface CustomerDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    customerPhone: string;
    customerName: string;
}

export const CustomerDetailModal: React.FC<CustomerDetailModalProps> = ({ isOpen, onClose, customerPhone, customerName }) => {
    const { bookings, guestProfiles, updateGuestProfile, addGuestProfile, notify } = useAppContext();
    const [activeTab, setActiveTab] = useState<'profile' | 'history'>('profile');
    const [isSaving, setIsSaving] = useState(false);

    // Find guest profile by phone (match from guest_profiles table)
    const matchedProfile = useMemo(() => {
        return guestProfiles.find(p => p.phone === customerPhone) || null;
    }, [guestProfiles, customerPhone]);

    // Local editable state for CRM fields
    const [notes, setNotes] = useState(matchedProfile?.notes || '');
    const [preferences, setPreferences] = useState(matchedProfile?.preferences || '');
    const [selectedTags, setSelectedTags] = useState<string[]>(
        matchedProfile?.tags ? matchedProfile.tags.split(',').filter(t => t) : []
    );

    // Reset local state when profile changes
    React.useEffect(() => {
        setNotes(matchedProfile?.notes || '');
        setPreferences(matchedProfile?.preferences || '');
        setSelectedTags(matchedProfile?.tags ? matchedProfile.tags.split(',').filter(t => t) : []);
    }, [matchedProfile]);

    // Booking history for this customer
    const customerBookings = useMemo(() => {
        return bookings
            .filter(b => b.customerPhone === customerPhone)
            .sort((a, b) => new Date(b.checkinDate).getTime() - new Date(a.checkinDate).getTime());
    }, [bookings, customerPhone]);

    const totalSpent = customerBookings.reduce((sum, b) => sum + b.totalRevenue, 0);
    const totalVisits = customerBookings.length;

    const toggleTag = (tag: string) => {
        setSelectedTags(prev =>
            prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
        );
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            if (matchedProfile?.id) {
                await updateGuestProfile({
                    ...matchedProfile,
                    tags: selectedTags.join(','),
                    notes: notes,
                    preferences: preferences
                });
            } else {
                await addGuestProfile({
                    full_name: customerName || 'Khách vãng lai',
                    phone: customerPhone,
                    dob: '',
                    gender: 'Chưa rõ',
                    nationality: 'Việt Nam',
                    id_card_number: `CRM-${customerPhone}`,
                    card_type: 'Khác',
                    address: '',
                    tags: selectedTags.join(','),
                    notes: notes,
                    preferences: preferences
                });
            }
            notify('success', 'Đã lưu thông tin khách hàng.');
            onClose();
        } catch (e) {
            notify('error', 'Lỗi khi lưu thông tin.');
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    const target = document.getElementById('main-layout-container') || document.body;

    const modalContent = (
        <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center md:p-4">
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
            <div
                className="relative bg-white rounded-t-3xl md:rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] md:max-h-[85vh] flex flex-col animate-in fade-in slide-in-from-bottom-8 md:zoom-in-95 border border-slate-200 z-[110]"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-4 md:p-6 border-b border-slate-100 flex items-start justify-between shrink-0 relative">
                    <div className="flex items-start md:items-center gap-3 md:gap-4 pr-8 md:pr-0">
                        <div className="w-12 h-12 md:w-14 md:h-14 bg-gradient-to-br from-brand-500 to-brand-700 rounded-full flex items-center justify-center text-white font-black text-lg md:text-xl shadow-lg ring-2 md:ring-4 ring-brand-100 shrink-0">
                            {(customerName || '?').charAt(0)}
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-lg md:text-xl font-black text-slate-800 flex flex-wrap items-center gap-1.5 md:gap-2 leading-tight">
                                <span className="truncate max-w-[200px] md:max-w-none">{customerName}</span>
                                {selectedTags.includes('VIP') && (
                                    <span className="bg-gradient-to-r from-yellow-200 to-amber-200 text-amber-800 px-1.5 md:px-2 py-0.5 rounded text-[9px] md:text-[10px] font-black tracking-widest uppercase flex items-center gap-0.5 shadow-sm border border-amber-300 shrink-0">
                                        <Star size={9} fill="currentColor" /> VIP
                                    </span>
                                )}
                            </h2>
                            <div className="flex flex-wrap items-center gap-1.5 md:gap-3 text-xs md:text-sm text-slate-500 font-medium mt-1">
                                <span className="flex items-center gap-1 shrink-0"><Phone size={10} className="md:w-3 md:h-3" /> {customerPhone}</span>
                                <span className="text-slate-300 hidden md:inline">|</span>
                                <span className="shrink-0">{totalVisits} lượt</span>
                                <span className="text-slate-300 hidden md:inline">|</span>
                                <span className="text-brand-600 font-bold shrink-0">{totalSpent.toLocaleString()} ₫</span>
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="absolute right-2 top-2 md:relative md:right-0 md:top-0 text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-100 rounded-xl transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-100 px-2 md:px-6 shrink-0 overflow-x-auto no-scrollbar">
                    <button
                        onClick={() => setActiveTab('profile')}
                        className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors flex items-center justify-center flex-1 md:flex-none gap-2 ${activeTab === 'profile' ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                    >
                        <User size={16} /> Hồ Sơ
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors flex items-center justify-center flex-1 md:flex-none gap-2 whitespace-nowrap ${activeTab === 'history' ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                    >
                        <History size={16} /> Lịch Sử ({totalVisits})
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar">
                    {activeTab === 'profile' && (
                        <div className="space-y-6 animate-in fade-in">
                            {/* Personal Info from guest_profiles */}
                            {matchedProfile ? (
                                <div className="bg-slate-50 rounded-xl border border-slate-100 p-4">
                                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                        <CreditCard size={12} /> Thông tin giấy tờ
                                    </h3>
                                    <div className="grid grid-cols-2 gap-3 text-sm">
                                        <div>
                                            <span className="text-slate-400 text-xs font-medium">Họ tên (CCCD)</span>
                                            <p className="font-bold text-slate-700">{matchedProfile.full_name}</p>
                                        </div>
                                        <div>
                                            <span className="text-slate-400 text-xs font-medium">Ngày sinh</span>
                                            <p className="font-bold text-slate-700">{matchedProfile.dob || '—'}</p>
                                        </div>
                                        <div>
                                            <span className="text-slate-400 text-xs font-medium">Loại giấy tờ</span>
                                            <p className="font-bold text-slate-700">{matchedProfile.card_type} — {matchedProfile.id_card_number}</p>
                                        </div>
                                        <div>
                                            <span className="text-slate-400 text-xs font-medium">Quốc tịch</span>
                                            <p className="font-bold text-slate-700 flex items-center gap-1"><Globe size={12} /> {matchedProfile.nationality || '—'}</p>
                                        </div>
                                        {matchedProfile.address && (
                                            <div className="col-span-2">
                                                <span className="text-slate-400 text-xs font-medium">Địa chỉ</span>
                                                <p className="font-medium text-slate-600 text-xs flex items-start gap-1"><MapPin size={12} className="shrink-0 mt-0.5" /> {matchedProfile.address}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-slate-50 rounded-xl border border-slate-100 p-6 text-center">
                                    <CreditCard size={32} className="mx-auto mb-2 text-slate-300" />
                                    <p className="text-sm text-slate-500 font-medium">Chưa có hồ sơ giấy tờ (CCCD/Passport).</p>
                                    <p className="text-xs text-slate-400 mt-1">Hồ sơ sẽ được tạo khi quét giấy tờ qua Booking.</p>
                                </div>
                            )}

                            {/* Tags */}
                            <div>
                                <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                    <Tag size={12} /> Phân loại khách hàng
                                </h3>
                                <div className="flex flex-wrap gap-2">
                                    {PRESET_TAGS.map(tag => (
                                        <button
                                            key={tag.label}
                                            onClick={() => toggleTag(tag.label)}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                                                selectedTags.includes(tag.label)
                                                    ? `${tag.color} ring-2 ring-offset-1 ring-current shadow-sm scale-105`
                                                    : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'
                                            }`}
                                        >
                                            {tag.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Notes */}
                            <div>
                                <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                    <MessageSquare size={12} /> Ghi chú nội bộ
                                </h3>
                                <textarea
                                    value={notes}
                                    onChange={e => setNotes(e.target.value)}
                                    placeholder="VD: Khách hay đến cuối tuần, thường đi 2 người, yêu cầu phòng yên tĩnh..."
                                    className="w-full border border-slate-200 rounded-xl p-3 text-sm resize-none h-24 outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all bg-white"
                                />
                            </div>

                            {/* Preferences */}
                            <div>
                                <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                    <Heart size={12} /> Sở thích & Yêu cầu đặc biệt
                                </h3>
                                <textarea
                                    value={preferences}
                                    onChange={e => setPreferences(e.target.value)}
                                    placeholder="VD: Thích tầng cao, dị ứng hải sản, cần giường phụ cho trẻ em..."
                                    className="w-full border border-slate-200 rounded-xl p-3 text-sm resize-none h-24 outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all bg-white"
                                />
                            </div>
                        </div>
                    )}

                    {activeTab === 'history' && (
                        <div className="animate-in fade-in">
                            {customerBookings.length === 0 ? (
                                <div className="text-center py-10 text-slate-400">
                                    <History size={40} className="mx-auto mb-2 opacity-40" />
                                    <p className="text-sm font-medium">Chưa có lịch sử booking nào.</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {customerBookings.map(b => {
                                        const checkin = parseISO(b.checkinDate);
                                        const checkout = parseISO(b.checkoutDate);
                                        const statusColors: Record<string, string> = {
                                            'Confirmed': 'bg-blue-50 text-blue-700 border-blue-200',
                                            'CheckedIn': 'bg-green-50 text-green-700 border-green-200',
                                            'CheckedOut': 'bg-slate-100 text-slate-500 border-slate-200',
                                            'Cancelled': 'bg-red-50 text-red-600 border-red-200'
                                        };

                                        return (
                                            <div key={b.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-white hover:bg-slate-50 transition-colors group">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className="text-center shrink-0 w-12">
                                                        <div className="text-lg font-black text-slate-700 leading-none">{isValid(checkin) ? format(checkin, 'dd') : '--'}</div>
                                                        <div className="text-[10px] text-slate-400 font-bold uppercase">{isValid(checkin) ? format(checkin, 'MM/yy') : ''}</div>
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="text-sm font-bold text-slate-700 truncate">
                                                            {b.facilityName} — <span className="text-brand-600">{b.roomCode}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2 text-[11px] text-slate-400 font-medium mt-0.5">
                                                            <span>{isValid(checkin) ? format(checkin, 'dd/MM') : '--'} → {isValid(checkout) ? format(checkout, 'dd/MM') : '--'}</span>
                                                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase border ${statusColors[b.status] || ''}`}>
                                                                {b.status}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="text-right shrink-0 pl-2">
                                                    <div className={`font-black text-sm ${b.status === 'Cancelled' ? 'text-slate-400 line-through' : 'text-brand-600'}`}>
                                                        {b.totalRevenue.toLocaleString()} ₫
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {/* Summary Footer */}
                                    <div className="mt-4 pt-4 border-t-2 border-slate-100 flex justify-between items-center">
                                        <span className="text-sm font-bold text-slate-500">{totalVisits} giao dịch</span>
                                        <span className="text-lg font-black text-brand-700">{totalSpent.toLocaleString()} ₫</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer - Save Button (only on profile tab) */}
                {activeTab === 'profile' && (
                    <div className="p-4 border-t border-slate-100 shrink-0 flex flex-col-reverse md:flex-row justify-end gap-2 md:gap-3 bg-white pb-safe">
                        <button
                            onClick={onClose}
                            className="w-full md:w-auto px-5 py-3 md:py-2.5 text-sm font-bold text-slate-500 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
                        >
                            Đóng
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="w-full md:w-auto justify-center px-6 py-3 md:py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-bold rounded-xl shadow-md shadow-brand-200 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
                        >
                            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                            Lưu Hồ Sơ
                        </button>
                    </div>
                )}
            </div>
        </div>
    );

    return createPortal(modalContent, target);
};
