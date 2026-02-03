
import React, { useMemo } from 'react';
import { Modal } from './Modal';
import { Collaborator } from '../types';
import { AlertCircle, Copy, Printer, CheckCircle, MinusCircle, PlusCircle, Wallet, AlertTriangle } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { format, parseISO, isSameMonth } from 'date-fns';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  staff: Collaborator;
  amount: number; // Gross Salary calculated from Timesheet
  month: string; // MM/yyyy
}

export const PayrollQrModal: React.FC<Props> = ({ isOpen, onClose, staff, amount, month }) => {
  const { salaryAdvances, violations } = useAppContext();

  // Parse selected month
  const targetDate = useMemo(() => {
      const [m, y] = month.split('/');
      return new Date(Number(y), Number(m) - 1, 1);
  }, [month]);

  // 1. Calculate Approved Advances for this month
  const totalAdvances = useMemo(() => {
      return salaryAdvances
          .filter(a => 
              a.staff_id === staff.id && 
              a.status === 'Approved' && 
              isSameMonth(parseISO(a.request_date), targetDate)
          )
          .reduce((sum, a) => sum + Number(a.amount), 0);
  }, [salaryAdvances, staff.id, targetDate]);

  // 2. Calculate Fines (Violations) for this month
  const totalFines = useMemo(() => {
      return violations
          .filter(v => 
              v.staff_id === staff.id && 
              (v.status === 'Pending_Deduction' || v.status === 'Deducted') &&
              isSameMonth(parseISO(v.date), targetDate)
          )
          .reduce((sum, v) => sum + Number(v.fine_amount), 0);
  }, [violations, staff.id, targetDate]);

  // 3. Final Net Salary
  const netSalary = Math.max(0, amount - totalAdvances - totalFines);
  const roundedAmount = Math.round(netSalary);
  
  const content = `LUONG T${month.replace('-', '/')} ${staff.collaboratorName}`;
  const bankInfoValid = staff.bankId && staff.accountNo && staff.accountName;
  
  // VietQR QuickLink (Using Net Salary)
  const qrUrl = bankInfoValid 
    ? `https://img.vietqr.io/image/${staff.bankId}-${staff.accountNo}-compact.png?amount=${roundedAmount}&addInfo=${encodeURIComponent(content)}&accountName=${encodeURIComponent(staff.accountName!)}`
    : '';

  const handleCopy = () => {
      const breakdown = `
Lương cơ bản & Công: ${amount.toLocaleString()}
Đã ứng: -${totalAdvances.toLocaleString()}
Phạt vi phạm: -${totalFines.toLocaleString()}
THỰC LĨNH: ${roundedAmount.toLocaleString()}
      `.trim();
      navigator.clipboard.writeText(`${staff.bankId} - ${staff.accountNo} - ${staff.accountName}\nSố tiền: ${roundedAmount}\nND: ${content}\n\n${breakdown}`);
      alert('Đã sao chép nội dung và bảng kê lương!');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Phiếu Lương: ${staff.collaboratorName}`} size="sm">
      <div className="flex flex-col items-center space-y-6 py-2">
          
          {!bankInfoValid ? (
              <div className="w-full bg-red-50 border border-red-100 p-6 rounded-xl text-center">
                  <div className="bg-white p-3 rounded-full text-red-500 w-fit mx-auto shadow-sm mb-3">
                      <AlertCircle size={32}/>
                  </div>
                  <h3 className="text-red-700 font-bold mb-1">Thiếu thông tin ngân hàng</h3>
                  <p className="text-xs text-red-500">Vui lòng cập nhật Bank ID, Số TK, Tên TK cho nhân viên này trong phần "Chỉnh sửa".</p>
              </div>
          ) : (
              <>
                  {/* SALARY BREAKDOWN TABLE */}
                  <div className="w-full bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
                      <div className="p-3 border-b border-slate-200 bg-slate-100/50 flex justify-between items-center">
                          <span className="text-xs font-bold text-slate-500 uppercase">Kỳ lương</span>
                          <span className="text-sm font-black text-slate-800">{month}</span>
                      </div>
                      
                      <div className="p-3 space-y-2">
                          <div className="flex justify-between items-center text-sm">
                              <span className="flex items-center gap-2 text-slate-600 font-medium">
                                  <PlusCircle size={14} className="text-emerald-500"/> Lương theo công
                              </span>
                              <span className="font-bold text-slate-800">{Math.round(amount).toLocaleString()} ₫</span>
                          </div>

                          {totalAdvances > 0 && (
                              <div className="flex justify-between items-center text-sm">
                                  <span className="flex items-center gap-2 text-slate-600 font-medium">
                                      <MinusCircle size={14} className="text-orange-500"/> Đã ứng trước
                                  </span>
                                  <span className="font-bold text-orange-600">-{totalAdvances.toLocaleString()} ₫</span>
                              </div>
                          )}

                          {totalFines > 0 && (
                              <div className="flex justify-between items-center text-sm">
                                  <span className="flex items-center gap-2 text-slate-600 font-medium">
                                      <AlertTriangle size={14} className="text-red-500"/> Phạt vi phạm
                                  </span>
                                  <span className="font-bold text-red-600">-{totalFines.toLocaleString()} ₫</span>
                              </div>
                          )}
                      </div>

                      <div className="p-4 bg-emerald-50 border-t border-emerald-100 flex justify-between items-center">
                          <span className="text-xs font-black text-emerald-700 uppercase tracking-widest flex items-center gap-2">
                              <Wallet size={16}/> Thực lĩnh
                          </span>
                          <span className="text-xl font-black text-emerald-700">{roundedAmount.toLocaleString()} ₫</span>
                      </div>
                  </div>

                  {/* QR CODE */}
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-center w-full max-w-[280px]">
                      <img src={qrUrl} alt="VietQR" className="w-full h-auto rounded-lg mix-blend-multiply" />
                      <div className="mt-3 pt-3 border-t border-slate-100">
                          <div className="font-bold text-slate-800 uppercase">{staff.accountName}</div>
                          <div className="text-xs text-slate-500 font-mono">{staff.bankId} - {staff.accountNo}</div>
                      </div>
                  </div>

                  {/* ACTIONS */}
                  <div className="grid grid-cols-2 gap-3 w-full">
                      <button onClick={handleCopy} className="py-3 bg-white border-2 border-slate-100 text-slate-600 rounded-xl font-bold text-xs uppercase hover:bg-slate-50 flex items-center justify-center gap-2">
                          <Copy size={16}/> Sao chép
                      </button>
                      <button onClick={() => window.print()} className="py-3 bg-brand-600 text-white rounded-xl font-bold text-xs uppercase shadow-lg hover:bg-brand-700 flex items-center justify-center gap-2">
                          <Printer size={16}/> In phiếu
                      </button>
                  </div>
              </>
          )}
      </div>
    </Modal>
  );
};
