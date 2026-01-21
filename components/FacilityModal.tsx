
import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { Facility } from '../types';
import { useAppContext } from '../context/AppContext';
import { MapPin, Crosshair, Loader2 } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  facility?: Facility | null;
}

export const FacilityModal: React.FC<Props> = ({ isOpen, onClose, facility }) => {
  const { addFacility, updateFacility, notify } = useAppContext();
  const [form, setForm] = useState<Partial<Facility>>({
     facilityName: '',
     facilityPrice: 0,
     facilityPriceSaturday: 0,
     note: '',
     staff: [],
     latitude: 0,
     longitude: 0,
     allowed_radius: 100
  });
  
  const [staffString, setStaffString] = useState('');
  const [isLocating, setIsLocating] = useState(false);

  useEffect(() => {
    if (facility) {
        setForm(facility);
        setStaffString((facility.staff || []).join(', '));
    } else {
        setForm({ 
            facilityName: '', 
            facilityPrice: 0, 
            facilityPriceSaturday: 0, 
            note: '', 
            staff: [],
            latitude: 0,
            longitude: 0,
            allowed_radius: 100
        });
        setStaffString('');
    }
  }, [facility, isOpen]);

  const handleGetLocation = () => {
      if (!navigator.geolocation) {
          notify('error', 'Trình duyệt không hỗ trợ GPS');
          return;
      }
      setIsLocating(true);
      navigator.geolocation.getCurrentPosition(
          (pos) => {
              setForm(prev => ({
                  ...prev,
                  latitude: pos.coords.latitude,
                  longitude: pos.coords.longitude
              }));
              notify('success', 'Đã lấy tọa độ hiện tại');
              setIsLocating(false);
          },
          (err) => {
              console.error(err);
              notify('error', 'Không thể lấy vị trí. Hãy cấp quyền GPS.');
              setIsLocating(false);
          },
          { enableHighAccuracy: true }
      );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.facilityName) {
        notify('error', 'Tên cơ sở không được để trống');
        return;
    }

    const staffArray = staffString.split(',').map(s => s.trim()).filter(s => s !== '');

    const data: Facility = {
       id: facility?.id || `F${Date.now()}`,
       ...(form as Facility),
       staff: staffArray,
       roomsJson: facility?.roomsJson || '[]',
       latitude: Number(form.latitude || 0),
       longitude: Number(form.longitude || 0),
       allowed_radius: Number(form.allowed_radius || 100)
    };

    if (facility) updateFacility(data);
    else addFacility(data);

    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={facility ? 'Sửa Thông Tin Cơ Sở' : 'Thêm Cơ Sở Mới'}>
      <form id="facilityForm" onSubmit={handleSubmit} className="space-y-4">
        <div>
           <label className="block text-sm font-medium mb-1">Tên cơ sở</label>
           <input required className="w-full border rounded p-2 bg-white text-slate-900" placeholder="VD: Chi nhánh 1 - Quận 1" value={form.facilityName} onChange={e => setForm({...form, facilityName: e.target.value})} />
        </div>
        
        {/* GPS CONFIG SECTION */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div className="flex justify-between items-center mb-3">
                <h4 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                    <MapPin size={14}/> Cấu hình Chấm công (GPS)
                </h4>
                <button
                    type="button"
                    onClick={handleGetLocation}
                    disabled={isLocating}
                    className="text-[10px] bg-white border border-slate-300 hover:border-brand-500 text-slate-600 hover:text-brand-600 px-2 py-1 rounded-lg flex items-center gap-1 transition-all font-bold"
                >
                    {isLocating ? <Loader2 size={10} className="animate-spin"/> : <Crosshair size={10}/>}
                    Lấy vị trí hiện tại
                </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                   <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase">Vĩ độ (Lat)</label>
                   <input type="number" step="any" className="w-full border rounded p-2 bg-white text-slate-900 text-sm font-mono" placeholder="0.000000" value={form.latitude || ''} onChange={e => setForm({...form, latitude: Number(e.target.value)})} />
                </div>
                <div>
                   <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase">Kinh độ (Long)</label>
                   <input type="number" step="any" className="w-full border rounded p-2 bg-white text-slate-900 text-sm font-mono" placeholder="0.000000" value={form.longitude || ''} onChange={e => setForm({...form, longitude: Number(e.target.value)})} />
                </div>
            </div>
            <div className="mt-3">
               <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase">Bán kính cho phép (Mét)</label>
               <div className="flex items-center gap-2">
                   <input type="number" className="w-24 border rounded p-2 bg-white text-slate-900 text-sm font-bold" value={form.allowed_radius || 100} onChange={e => setForm({...form, allowed_radius: Number(e.target.value)})} />
                   <span className="text-xs text-slate-400">mét (Khoảng cách tối đa để Check-in hợp lệ)</span>
               </div>
            </div>
        </div>

        <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
            <div>
               <label className="block text-sm font-medium mb-1">Giá chuẩn (Ngày thường)</label>
               <input type="number" className="w-full border rounded p-2 bg-white text-slate-900" placeholder="VD: 500000" value={form.facilityPrice} onChange={e => setForm({...form, facilityPrice: Number(e.target.value)})} />
            </div>
            <div>
               <label className="block text-sm font-medium mb-1 text-rose-600">Giá chuẩn (Thứ 7)</label>
               <input type="number" className="w-full border rounded p-2 bg-white text-slate-900" placeholder="VD: 700000" value={form.facilityPriceSaturday || ''} onChange={e => setForm({...form, facilityPriceSaturday: Number(e.target.value)})} />
            </div>
            <p className="col-span-2 text-xs text-gray-500 italic">Các giá này sẽ được dùng mặc định khi tạo phòng mới.</p>
        </div>
        <div>
           <label className="block text-sm font-medium mb-1">Nhân viên buồng phòng (Phân cách bằng dấu phẩy)</label>
           <input 
                className="w-full border rounded p-2 bg-white text-slate-900" 
                placeholder="VD: Cô Lan, Chị Mai, Anh Tuấn..." 
                value={staffString} 
                onChange={e => setStaffString(e.target.value)} 
           />
           <p className="text-xs text-gray-500 mt-1">Nhập tên các nhân viên dọn dẹp phụ trách riêng cơ sở này.</p>
        </div>
        <div>
           <label className="block text-sm font-medium mb-1">Mô tả / Địa chỉ</label>
           <textarea className="w-full border rounded p-2 h-24 bg-white text-slate-900" placeholder="Địa chỉ, ghi chú..." value={form.note} onChange={e => setForm({...form, note: e.target.value})}></textarea>
        </div>
      </form>
      <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
         <button type="button" onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Hủy</button>
         <button form="facilityForm" type="submit" className="px-4 py-2 bg-brand-600 text-white rounded hover:bg-brand-700 font-medium">Lưu Cơ Sở</button>
      </div>
    </Modal>
  );
};
