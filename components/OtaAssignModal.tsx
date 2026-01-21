
import React, { useState, useMemo } from 'react';
import { Modal } from './Modal';
import { OtaOrder, Room, Booking } from '../types';
import { useAppContext } from '../context/AppContext';
import { User, Calendar, Check, AlertTriangle, ArrowRight, DollarSign, BedDouble, Users, Coffee } from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  order: OtaOrder;
}

export const OtaAssignModal: React.FC<Props> = ({ isOpen, onClose, order }) => {
  const { facilities, rooms, checkAvailability, addBooking, updateOtaOrder, notify, webhooks } = useAppContext();
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedRoom = useMemo(() => {
      if (!selectedRoomId) return null;
      return rooms.find(r => r.id === selectedRoomId);
  }, [selectedRoomId, rooms]);

  const handleConfirm = async () => {
      if (!selectedRoom || !order) return;
      setIsSubmitting(true);

      try {
          const facility = facilities.find(f => f.id === selectedRoom.facility_id);
          
          // 1. Create Booking Object in Local DB
          const newBooking: Booking = {
              id: `BK-${Date.now()}`,
              createdDate: new Date().toISOString(),
              facilityName: facility?.facilityName || '',
              roomCode: selectedRoom.name,
              customerName: order.guestName,
              customerPhone: order.guestPhone || '',
              source: order.platform,
              collaborator: 'OTA System',
              paymentMethod: order.paymentStatus === 'Prepaid' ? 'OTA Prepaid' : 'Pay at hotel',
              checkinDate: order.checkIn,
              checkoutDate: order.checkOut,
              status: 'Confirmed',
              price: order.totalAmount, // Doanh thu ghi nhận
              extraFee: 0,
              totalRevenue: order.totalAmount,
              note: `${order.notes || ''}\nMã OTA: ${order.bookingCode}`,
              
              // Handle Payment Logic
              paymentsJson: order.paymentStatus === 'Prepaid' 
                  ? JSON.stringify([{
                      ngayThanhToan: new Date().toISOString(),
                      soTien: order.totalAmount,
                      method: 'Transfer',
                      ghiChu: 'Thanh toán qua OTA (Prepaid)'
                  }]) 
                  : '[]',
              remainingAmount: order.paymentStatus === 'Prepaid' ? 0 : order.totalAmount,
              
              cleaningJson: '{}',
              assignedCleaner: '',
              servicesJson: '[]',
              lendingJson: '[]',
              guestsJson: '[]',
              isDeclared: false
          };

          const updates: Promise<any>[] = [
              addBooking(newBooking),
              // Optimistic UI update: Set to Assigned locally
              updateOtaOrder(order.id, { status: 'Assigned', assignedRoom: selectedRoom.name })
          ];

          // 2. TRIGGER WEBHOOK (POST) TO UPDATE GOOGLE SHEET
          const hook = webhooks.find(w => w.event_type === 'ota_import' && w.is_active);
          if (hook) {
              // ENSURE DATA SANITIZATION FOR GOOGLE SCRIPT
              const payload = {
                  action: 'update_room',
                  bookingCode: String(order.bookingCode).trim(), // Critical Fix: Force String & Trim
                  room: selectedRoom.name
              };

              console.log("Sending Webhook Payload:", payload); // Debug log

              updates.push(
                  fetch(hook.url, {
                      method: 'POST',
                      mode: 'no-cors', 
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(payload)
                  }).catch(err => console.error("Webhook POST failed", err))
              );
          }

          // Execute Updates concurrently
          await Promise.all(updates);

          notify('success', `Đã xếp phòng ${selectedRoom.name} cho đơn ${order.bookingCode}. Đang đồng bộ Sheet...`);
          onClose();

      } catch (error) {
          console.error("Assign Error:", error);
          notify('error', 'Lỗi khi xếp phòng. Vui lòng thử lại.');
      } finally {
          setIsSubmitting(false);
      }
  };

  // Group rooms by facility
  const groupedRooms = useMemo(() => {
      return facilities.map(f => {
          const facilityRooms = rooms
              .filter(r => r.facility_id === f.id)
              .sort((a,b) => a.name.localeCompare(b.name, undefined, {numeric: true}));
          
          return {
              facility: f,
              rooms: facilityRooms
          };
      });
  }, [facilities, rooms]);

  const checkInDate = parseISO(order.checkIn);
  const checkOutDate = parseISO(order.checkOut);
  const validDates = isValid(checkInDate) && isValid(checkOutDate);

  const hasBreakfast = (order: OtaOrder) => {
      if (!order.breakfastStatus) return false;
      const s = order.breakfastStatus.toLowerCase();
      return s !== '' && s !== 'no' && s !== 'không' && s !== 'none';
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Xếp Phòng Cho Đơn OTA" size="lg">
        <div className="flex flex-col h-[70vh] md:h-auto">
            {/* Header: Order Summary */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-4 shrink-0">
                <div className="flex justify-between items-start">
                    <div>
                        <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                            {order.guestName}
                            <span className="text-xs font-normal text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-full">
                                {order.bookingCode}
                            </span>
                        </h3>
                        <div className="text-sm text-slate-600 mt-1 flex items-center gap-4">
                            <span className="flex items-center gap-1"><Calendar size={14}/> {validDates ? format(checkInDate, 'dd/MM') : '--/--'} <ArrowRight size={12}/> {validDates ? format(checkOutDate, 'dd/MM') : '--/--'}</span>
                            <span className="flex items-center gap-1"><BedDouble size={14}/> {order.roomType} (x{order.roomQuantity})</span>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-lg font-black text-brand-600">{order.totalAmount.toLocaleString()} ₫</div>
                        <div className={`text-xs font-bold uppercase ${order.paymentStatus === 'Prepaid' ? 'text-green-600' : 'text-orange-600'}`}>
                            {order.paymentStatus}
                        </div>
                    </div>
                </div>
            </div>

            {/* CRITICAL INFO ALERT BOX */}
            <div className="mb-4 bg-blue-50 border border-blue-200 rounded-xl p-3 flex flex-col md:flex-row gap-3 shadow-sm">
                <div className="flex-1">
                    <div className="flex items-center gap-2 text-blue-800 font-bold text-xs uppercase mb-1">
                        <Users size={14}/> Chi tiết khách
                    </div>
                    <div className="text-sm font-bold text-slate-700">
                        {order.guestDetails || `${order.guestCount} Khách`}
                    </div>
                </div>
                
                {hasBreakfast(order) ? (
                    <div className="flex-1 border-t md:border-t-0 md:border-l border-blue-200 pt-2 md:pt-0 md:pl-3">
                        <div className="flex items-center gap-2 text-amber-700 font-bold text-xs uppercase mb-1">
                            <Coffee size={14}/> Chế độ ăn uống
                        </div>
                        <div className="text-sm font-black text-amber-600 bg-amber-100 w-fit px-2 py-0.5 rounded border border-amber-200">
                            {order.breakfastStatus || 'Có ăn sáng'}
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 border-t md:border-t-0 md:border-l border-blue-200 pt-2 md:pt-0 md:pl-3 flex items-center text-slate-400 text-xs italic">
                        Không có chế độ ăn
                    </div>
                )}
            </div>

            {/* Body: Room Selection Grid */}
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                <div className="space-y-6">
                    {groupedRooms.map(group => (
                        <div key={group.facility.id}>
                            <h4 className="font-bold text-slate-700 mb-2 sticky top-0 bg-white py-1 z-10 flex items-center gap-2">
                                <div className="w-1 h-4 bg-slate-300 rounded-full"></div> 
                                {group.facility.facilityName}
                            </h4>
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2">
                                {group.rooms.map(room => {
                                    // Logic: Check Availability
                                    const isAvailable = checkAvailability(
                                        group.facility.facilityName, 
                                        room.name, 
                                        order.checkIn, 
                                        order.checkOut
                                    );
                                    
                                    // Logic: Check Room Type Match (Simple string check)
                                    const isTypeMatch = room.type && order.roomType.toLowerCase().includes(room.type.toLowerCase());
                                    
                                    // Logic: Check Status (Dirty/Repair)
                                    const isDirty = room.status === 'Bẩn' || room.status === 'Đang dọn';
                                    const isRepair = room.status === 'Sửa chữa';
                                    const isSelected = selectedRoomId === room.id;

                                    let cardClass = "border-slate-200 bg-white hover:border-brand-300 cursor-pointer";
                                    let statusIcon = null;

                                    if (!isAvailable) {
                                        cardClass = "bg-slate-100 border-slate-200 opacity-50 cursor-not-allowed";
                                    } else if (isSelected) {
                                        cardClass = "border-brand-500 ring-2 ring-brand-100 bg-brand-50";
                                    } else if (isRepair) {
                                        cardClass = "border-red-200 bg-red-50";
                                        statusIcon = <AlertTriangle size={12} className="text-red-500"/>;
                                    } else if (isDirty) {
                                        cardClass = "border-orange-200 bg-orange-50";
                                        statusIcon = <div className="w-2 h-2 bg-orange-500 rounded-full"></div>;
                                    } else if (isTypeMatch) {
                                        cardClass = "border-green-300 bg-green-50/50 hover:bg-green-50";
                                    }

                                    return (
                                        <button
                                            key={room.id}
                                            onClick={() => isAvailable && setSelectedRoomId(room.id)}
                                            disabled={!isAvailable}
                                            className={`
                                                relative p-3 rounded-xl border-2 text-left transition-all flex flex-col justify-between h-20 group
                                                ${cardClass}
                                            `}
                                        >
                                            <div className="flex justify-between items-start w-full">
                                                <span className={`font-black text-lg ${isSelected ? 'text-brand-700' : 'text-slate-700'}`}>{room.name}</span>
                                                {isSelected && <div className="bg-brand-600 text-white rounded-full p-0.5"><Check size={10}/></div>}
                                                {!isAvailable && <span className="text-[9px] font-bold text-slate-400">BẬN</span>}
                                                {statusIcon}
                                            </div>
                                            
                                            <div className="flex justify-between items-end w-full">
                                                <span className="text-[10px] font-medium text-slate-500 truncate max-w-[70%]">{room.type || 'Standard'}</span>
                                                {isTypeMatch && isAvailable && !isSelected && (
                                                    <span className="text-[8px] font-bold text-green-600 bg-green-100 px-1.5 py-0.5 rounded border border-green-200">GỢI Ý</span>
                                                )}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Footer */}
            <div className="pt-4 mt-2 border-t border-slate-100 flex justify-end gap-3 shrink-0 bg-white">
                <button 
                    onClick={onClose} 
                    className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-50 transition-colors"
                >
                    Hủy bỏ
                </button>
                <button 
                    onClick={handleConfirm}
                    disabled={!selectedRoomId || isSubmitting}
                    className="px-6 py-2.5 rounded-xl text-sm font-bold bg-brand-600 text-white shadow-lg shadow-brand-200 hover:bg-brand-700 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                >
                    {isSubmitting ? 'Đang gửi lệnh...' : 'Xác nhận xếp phòng'}
                </button>
            </div>
        </div>
    </Modal>
  );
};