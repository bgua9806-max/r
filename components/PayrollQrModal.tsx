
import React from 'react';
import { Modal } from './Modal';
import { Collaborator } from '../types';
import { AlertCircle, Copy, Printer, CheckCircle } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  staff: Collaborator;
  amount: number;
  month: string;
}

export const PayrollQrModal: React.FC<Props> = ({ isOpen, onClose, staff, amount, month }) => {
  const roundedAmount = Math.round(amount);
  const content = `LUONG T${month.replace('-', '/')} ${staff.collaboratorName}`;
  const bankInfoValid = staff.bankId && staff.accountNo && staff.accountName;
  
  // VietQR QuickLink
  const qrUrl = bankInfoValid 
    ? `https://img.vietqr.io/image/${staff.bankId}-${staff.accountNo}-compact.png?amount=${roundedAmount}&addInfo=${encodeURIComponent(content)}&accountName=${encodeURIComponent(staff.accountName!)}`
    : '';

  const handleCopy = () => {
      navigator.clipboard.writeText(`${staff.bankId} - ${staff.accountNo} - ${staff.accountName}\nSố tiền: ${roundedAmount}\nND: ${content}`);
      alert('Đã sao chép nội dung chuyển khoản!');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Thanh toán lương: ${staff.collaboratorName}`} size="sm">
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
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-center w-full max-w-[280px]">
                      <img src={qrUrl} alt="VietQR" className="w-full h-auto rounded-lg mix-blend-multiply" />
                      <div className="mt-3 pt-3 border-t border-slate-100">
                          <div className="font-bold text-slate-800 uppercase">{staff.accountName}</div>
                          <div className="text-xs text-slate-500 font-mono">{staff.bankId} - {staff.accountNo}</div>
                      </div>
                  </div>

                  <div className="w-full space-y-3">
                      <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-100">
                          <span className="text-xs font-bold text-slate-500 uppercase">Thực lãnh</span>
                          <span className="text-lg font-black text-emerald-600">{roundedAmount.toLocaleString()} ₫</span>
                      </div>
                      <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-100">
                          <span className="text-xs font-bold text-slate-500 uppercase">Nội dung</span>
                          <span className="text-xs font-bold text-slate-700 text-right max-w-[150px] truncate">{content}</span>
                      </div>
                  </div>

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
