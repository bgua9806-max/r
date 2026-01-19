
import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { Booking, Settings, BankAccount } from '../types';
import { Printer, Check, CreditCard, AlertTriangle, ChevronDown } from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
import { useAppContext } from '../context/AppContext';

interface BillPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: Booking;
  settings: Settings;
  onConfirmPayment: (amount: number, method: 'Transfer' | 'Cash') => void;
}

export const BillPreviewModal: React.FC<BillPreviewModalProps> = ({ 
  isOpen, onClose, booking, settings, onConfirmPayment 
}) => {
  const { bankAccounts } = useAppContext();
  const [selectedBank, setSelectedBank] = useState<BankAccount | null>(null);

  useEffect(() => {
      if (isOpen) {
          // Priority 1: Default from new table
          const defaultBank = bankAccounts.find(b => b.is_default);
          if (defaultBank) {
              setSelectedBank(defaultBank);
          } else if (bankAccounts.length > 0) {
              // Priority 2: First available in new table
              setSelectedBank(bankAccounts[0]);
          } else if (settings.bankAccount && settings.bankAccount.bankId) {
              // Priority 3: Fallback to old settings object (Legacy Support)
              setSelectedBank({
                  id: 'legacy',
                  bankId: settings.bankAccount.bankId,
                  accountNo: settings.bankAccount.accountNo,
                  accountName: settings.bankAccount.accountName,
                  template: settings.bankAccount.template || 'print',
                  is_default: true
              });
          } else {
              setSelectedBank(null);
          }
      }
  }, [isOpen, bankAccounts, settings]);

  if (!isOpen) return null;

  const usedServices = booking.servicesJson ? JSON.parse(booking.servicesJson) : [];
  const payments = booking.paymentsJson ? JSON.parse(booking.paymentsJson) : [];
  const totalPaid = payments.reduce((sum: number, p: any) => sum + Number(p.soTien), 0);
  const remaining = booking.remainingAmount;

  // Generate QR
  let qrUrl = '';
  if (selectedBank && remaining > 0) {
      const description = `TT PHONG ${booking.roomCode.replace(/\s+/g, '')}`;
      const template = selectedBank.template || 'print';
      // Use standard VietQR API
      qrUrl = `https://img.vietqr.io/image/${selectedBank.bankId}-${selectedBank.accountNo}-${template}.png?amount=${remaining}&addInfo=${description}&accountName=${selectedBank.accountName}`;
  }

  const handlePrint = () => {
      // Simple window print - style controlled via @media print in main css or inline styles
      window.print();
  };

  const checkin = parseISO(booking.checkinDate);
  const checkout = parseISO(booking.checkoutDate);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Xem Hóa Đơn & Thanh Toán QR" size="lg">
        {/* 
            MOBILE OPTIMIZATION: 
            - Removed `h-full` on mobile wrapper to allow natural scrolling.
            - Reduced gap on mobile.
            - Adjusted padding on Bill Detail card.
            - Removed `overflow-y-auto` from Bill Detail on mobile (let parent scroll).
        */}
        <div className="flex flex-col md:flex-row gap-4 md:gap-6 md:h-[600px]">
            {/* LEFT: Bill Detail */}
            <div className="w-full md:flex-1 bg-white p-4 md:p-6 border border-slate-200 rounded-xl shadow-sm md:overflow-y-auto custom-scrollbar print-section order-1" id="printable-bill">
                <div className="text-center mb-6 border-b border-slate-100 pb-4">
                    <h2 className="text-xl font-black text-slate-800 uppercase tracking-widest">{booking.facilityName}</h2>
                    <p className="text-xs text-slate-500 mt-1">HÓA ĐƠN THANH TOÁN</p>
                    <p className="text-[10px] text-slate-400 mt-1">Mã Booking: {booking.id}</p>
                </div>

                <div className="space-y-4 text-sm">
                    <div className="grid grid-cols-2 gap-4 text-slate-600">
                        <div>
                            <span className="block text-[10px] uppercase font-bold text-slate-400">Khách hàng</span>
                            <span className="font-bold text-slate-800">{booking.customerName}</span>
                        </div>
                        <div>
                            <span className="block text-[10px] uppercase font-bold text-slate-400">Phòng</span>
                            <span className="font-bold text-slate-800 text-lg">{booking.roomCode}</span>
                        </div>
                        <div>
                            <span className="block text-[10px] uppercase font-bold text-slate-400">Check-in</span>
                            <span>{isValid(checkin) ? format(checkin, 'dd/MM/yyyy HH:mm') : 'N/A'}</span>
                        </div>
                        <div>
                            <span className="block text-[10px] uppercase font-bold text-slate-400">Check-out</span>
                            <span>{isValid(checkout) ? format(checkout, 'dd/MM/yyyy HH:mm') : 'N/A'}</span>
                        </div>
                    </div>

                    <table className="w-full text-left mt-4 border-collapse">
                        <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase font-bold">
                            <tr>
                                <th className="p-2 border-b">Khoản mục</th>
                                <th className="p-2 border-b text-center">SL</th>
                                <th className="p-2 border-b text-right">Thành tiền</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 text-xs">
                            <tr>
                                <td className="p-2 font-medium">Tiền phòng</td>
                                <td className="p-2 text-center">1</td>
                                <td className="p-2 text-right font-bold">{(booking.price + booking.extraFee).toLocaleString()}</td>
                            </tr>
                            {usedServices.map((s: any, idx: number) => (
                                <tr key={idx}>
                                    <td className="p-2 text-slate-600">{s.name}</td>
                                    <td className="p-2 text-center text-slate-500">{s.quantity}</td>
                                    <td className="p-2 text-right">{s.total.toLocaleString()}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="border-t-2 border-slate-100">
                            <tr>
                                <td colSpan={2} className="p-2 font-bold text-right text-slate-600">Tổng cộng:</td>
                                <td className="p-2 text-right font-bold text-slate-800">{booking.totalRevenue.toLocaleString()}</td>
                            </tr>
                            <tr>
                                <td colSpan={2} className="p-2 font-bold text-right text-emerald-600">Đã thanh toán:</td>
                                <td className="p-2 text-right font-bold text-emerald-600">-{totalPaid.toLocaleString()}</td>
                            </tr>
                            <tr className="text-lg bg-slate-50">
                                <td colSpan={2} className="p-3 font-black text-right text-slate-800 uppercase">CÒN LẠI:</td>
                                <td className="p-3 text-right font-black text-brand-600">{remaining.toLocaleString()} ₫</td>
                            </tr>
                        </tfoot>
                    </table>
                    
                    <div className="mt-8 text-center text-[10px] text-slate-400 italic">
                        Cảm ơn quý khách và hẹn gặp lại!
                    </div>
                </div>
            </div>

            {/* RIGHT: QR Code Area */}
            <div className="w-full md:w-80 flex flex-col gap-3 md:gap-4 no-print shrink-0 order-2">
                <div className="bg-white p-4 md:p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center text-center flex-1">
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <CreditCard size={16}/> Quét mã thanh toán
                    </h3>
                    
                    {bankAccounts.length > 1 && (
                        <div className="w-full mb-4">
                            <label className="block text-[10px] font-bold text-slate-400 text-left mb-1 uppercase">Chọn ngân hàng</label>
                            <div className="relative">
                                <select 
                                    className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-xs font-bold text-slate-700 outline-none cursor-pointer"
                                    value={selectedBank?.id || ''}
                                    onChange={(e) => {
                                        const b = bankAccounts.find(bk => bk.id === e.target.value);
                                        if (b) setSelectedBank(b);
                                    }}
                                >
                                    {bankAccounts.map(b => (
                                        <option key={b.id} value={b.id}>{b.bankId} - {b.accountName}</option>
                                    ))}
                                </select>
                                <ChevronDown size={14} className="absolute right-3 top-2.5 text-slate-400 pointer-events-none"/>
                            </div>
                        </div>
                    )}
                    
                    {selectedBank ? (
                        remaining > 0 ? (
                            <div className="w-full bg-slate-50 p-2 rounded-xl border border-slate-100">
                                <img src={qrUrl} alt="VietQR" className="w-full h-auto object-contain rounded-lg mix-blend-multiply" />
                                <div className="mt-2 text-xs font-bold text-slate-600">{selectedBank.accountName}</div>
                                <div className="text-[10px] text-slate-400">{selectedBank.bankId} - {selectedBank.accountNo}</div>
                            </div>
                        ) : (
                            <div className="py-10 text-emerald-600 flex flex-col items-center">
                                <Check size={48} className="mb-2"/>
                                <span className="font-bold">Đã thanh toán đủ</span>
                            </div>
                        )
                    ) : (
                        <div className="py-10 text-slate-400 flex flex-col items-center bg-slate-50 rounded-xl w-full">
                            <AlertTriangle size={32} className="mb-2 opacity-50"/>
                            <span className="text-xs font-medium text-center px-4">Chưa cấu hình ngân hàng trong Cài Đặt.</span>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 gap-3">
                    {remaining > 0 && selectedBank && (
                        <button 
                            onClick={() => onConfirmPayment(remaining, 'Transfer')}
                            className="w-full py-3 bg-brand-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-brand-200 hover:bg-brand-700 active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                            <Check size={18}/> Xác nhận đã thu (CK)
                        </button>
                    )}
                    <button 
                        onClick={handlePrint}
                        className="w-full py-3 bg-white text-slate-700 border-2 border-slate-200 rounded-xl font-bold text-sm hover:bg-slate-50 active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                        <Printer size={18}/> In Hóa Đơn
                    </button>
                </div>
            </div>
        </div>
    </Modal>
  );
};
