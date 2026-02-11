
import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from './Modal';
import { ShiftSchedule, Collaborator } from '../types';
import { useAppContext } from '../context/AppContext';
import { format } from 'date-fns';
import { Trash2, Save, Sun, Moon, Coffee, Sunset, Cloud } from 'lucide-react';
import { getCurrentSeason } from '../utils/shiftLogic';

interface ShiftScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  staff: Collaborator;
  date: Date;
  existingSchedule?: ShiftSchedule | null;
}

export const ShiftScheduleModal: React.FC<ShiftScheduleModalProps> = ({ 
  isOpen, onClose, staff, date, existingSchedule 
}) => {
  const { upsertSchedule, deleteSchedule, notify, seasons, shiftDefinitions } = useAppContext();
  const [shiftType, setShiftType] = useState<string>('Sáng');
  const [note, setNote] = useState('');

  // Determine active season for the selected date
  const activeSeason = useMemo(() => getCurrentSeason(date, seasons), [date, seasons]);

  // Filter available shifts for this season
  const availableShifts = useMemo(() => {
      if (!activeSeason) return [];
      return shiftDefinitions.filter(s => s.season_code === activeSeason.code && s.is_active);
  }, [activeSeason, shiftDefinitions]);

  useEffect(() => {
    if (existingSchedule) {
      setShiftType(existingSchedule.shift_type);
      setNote(existingSchedule.note || '');
    } else {
      // Default to first available shift or 'Sáng'
      setShiftType(availableShifts.length > 0 ? availableShifts[0].name : 'Sáng');
      setNote('');
    }
  }, [existingSchedule, isOpen, availableShifts]);

  const handleSave = () => {
    const s: ShiftSchedule = {
      id: existingSchedule?.id || `SCH-${Date.now()}`,
      staff_id: staff.id,
      date: format(date, 'yyyy-MM-dd'),
      shift_type: shiftType, // Now saves the full name e.g. "Ca Sáng (Hè)"
      note
    };
    upsertSchedule(s);
    onClose();
  };

  const handleDelete = () => {
    if (existingSchedule && confirm('Xóa phân ca này?')) {
      deleteSchedule(existingSchedule.id);
      notify('info', 'Đã xóa phân ca');
      onClose();
    }
  };

  const getShiftIcon = (code: string) => {
      if (code === 'SANG') return <Sun size={20} className="text-amber-500"/>;
      if (code === 'TOI') return <Moon size={20} className="text-indigo-500"/>;
      if (code === 'CHIEU') return <Sunset size={20} className="text-orange-500"/>;
      return <Cloud size={20} className="text-slate-400"/>;
  };

  const getShiftColor = (code: string, isSelected: boolean) => {
      if (!isSelected) return 'bg-white border-slate-100 text-slate-500 hover:bg-slate-50';
      if (code === 'SANG') return 'bg-amber-50 border-amber-500 text-amber-700';
      if (code === 'TOI') return 'bg-indigo-50 border-indigo-500 text-indigo-700';
      if (code === 'CHIEU') return 'bg-orange-50 border-orange-500 text-orange-700';
      return 'bg-brand-50 border-brand-500 text-brand-700';
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Phân ca: ${staff.collaboratorName}`} size="sm">
      <div className="space-y-5">
        <div className="p-4 bg-slate-50 rounded-2xl text-slate-600 text-sm font-black border border-slate-100 flex justify-between items-center">
          <span>Ngày trực:</span>
          <div className="text-right">
              <span className="text-brand-600 block">{format(date, 'dd/MM/yyyy')}</span>
              {activeSeason && <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block">{activeSeason.name}</span>}
          </div>
        </div>

        <div className="space-y-3">
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">CHỌN CA TRỰC</label>
          <div className="flex flex-col gap-2 max-h-60 overflow-y-auto custom-scrollbar pr-1">
            {availableShifts.length > 0 ? availableShifts.map(shift => (
                <button
                    key={shift.id}
                    onClick={() => setShiftType(shift.name)}
                    className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all font-bold ${getShiftColor(shift.code, shiftType === shift.name)}`}
                >
                    <div className="flex items-center gap-3">
                        {getShiftIcon(shift.code)}
                        <div className="text-left">
                            <div className="text-sm uppercase">{shift.name}</div>
                            <div className="text-[10px] opacity-70 flex gap-2">
                                <span>{shift.start_time.slice(0,5)} - {shift.end_time.slice(0,5)}</span>
                                <span>• Hệ số {shift.coefficient}</span>
                            </div>
                        </div>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${shiftType === shift.name ? 'border-current' : 'border-slate-200'}`}>
                        {shiftType === shift.name && <div className="w-2.5 h-2.5 bg-current rounded-full"></div>}
                    </div>
                </button>
            )) : (
                <div className="text-center text-xs text-slate-400 italic py-4 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    Chưa có cấu hình ca cho mùa này.
                </div>
            )}

            <button
                onClick={() => setShiftType('OFF')}
                className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all font-bold ${shiftType === 'OFF' ? 'bg-slate-100 border-slate-400 text-slate-700' : 'bg-white border-slate-100 text-slate-500'}`}
            >
                <div className="flex items-center gap-3">
                    <Coffee size={20} className="text-slate-400"/>
                    <div className="text-left">
                        <div className="text-sm uppercase">Nghỉ (OFF)</div>
                        <div className="text-[10px] opacity-70">Không tính công</div>
                    </div>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${shiftType === 'OFF' ? 'border-slate-500' : 'border-slate-200'}`}>
                    {shiftType === 'OFF' && <div className="w-2.5 h-2.5 bg-slate-500 rounded-full"></div>}
                </div>
            </button>
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">GHI CHÚ</label>
          <textarea
            className="w-full border-2 border-slate-100 rounded-xl p-3 outline-none focus:border-brand-500 transition-all text-sm h-20 bg-slate-50/50"
            placeholder="Ghi chú nếu cần..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        <div className="flex gap-3 pt-4 border-t border-slate-100">
          {existingSchedule && (
            <button
              onClick={handleDelete}
              className="px-5 py-3 text-rose-500 hover:bg-rose-50 rounded-xl font-bold flex items-center justify-center transition-all"
            >
              <Trash2 size={20} />
            </button>
          )}
          <button
            onClick={handleSave}
            className="flex-1 py-4 bg-brand-600 text-white rounded-2xl font-black shadow-lg shadow-brand-100 hover:bg-brand-700 active:scale-95 transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-xs"
          >
            <Save size={18} /> Lưu Phân Ca
          </button>
        </div>
      </div>
    </Modal>
  );
};
