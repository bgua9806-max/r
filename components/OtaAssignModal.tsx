
import React, { useState, useMemo, useEffect } from 'react';
import { Modal } from './Modal';
import { OtaOrder, Room, Booking } from '../types';
import { useAppContext } from '../context/AppContext';
import { User, Calendar, Check, AlertTriangle, ArrowRight, DollarSign, BedDouble, Users, Coffee, Layers, Split } from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
import { supabase } from '../services/supabaseClient';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  order: OtaOrder;
  onSuccess?: () => void; // New prop for callback
}

export const OtaAssignModal: React.FC<Props> = ({ isOpen, onClose, order, onSuccess }) => {
  const { facilities, rooms, checkAvailability, addBooking, updateOtaOrder, notify, webhooks } = useAppContext();
  
  // Changed from single string to array for multi-room support
  const [selectedRoomIds, setSelectedRoomIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // New state for payment strategy
  const [paymentStrategy, setPaymentStrategy] = useState<'GROUP' | 'SPLIT'>('GROUP');

  // --- FIX: RESET STATE ON OPEN ---
  useEffect(() => {
      if (isOpen) {
          setSelectedRoomIds([]);
          setPaymentStrategy('GROUP');
          setIsSubmitting(false);
      }
  }, [isOpen, order.id]);

  const handleRoomClick = (roomId: string, isAvailable: boolean) => {
      if (!isAvailable) return;

      if (order.roomQuantity === 1) {
          // Single room mode: behave like radio button
          setSelectedRoomIds([roomId]);
      } else {
          // Multi room mode: behave like checkbox with limit
          if (selectedRoomIds.includes(roomId)) {
              setSelectedRoomIds(prev => prev.filter(id => id !== roomId));
          } else {
              if (selectedRoomIds.length < order.roomQuantity) {
                  setSelectedRoomIds(prev => [...prev, roomId]);
              } else {
                  notify('info', `Chỉ được chọn tối đa ${order.roomQuantity} phòng.`);
              }
          }
      }
  };

  const handleConfirm = async () => {
      if (selectedRoomIds.length !== order.roomQuantity || !order) return;
      setIsSubmitting(true);

      try {
          const selectedRoomsData = rooms.filter(r => selectedRoomIds.includes(r.id));
          const groupId = `GRP-${Date.now()}`;
          const facility = facilities.find(f => f.id === selectedRoomsData[0]?.facility_id);
          const roomNames = selectedRoomsData.map(r => r.name).join(', ');

          // Create Booking Promises
          const bookingPromises = selectedRoomsData.map((room, index) => {
              let price = 0;
              let isLeader = false;

              // Financial Logic
              if (order.roomQuantity === 1) {
                  price = order.totalAmount;
              } else {
                  if (paymentStrategy === 'GROUP') {
                      // Room 0 takes all cost
                      if (index === 0) {
                          price = order.totalAmount;
                          isLeader = true;
                      } else {
                          price = 0;
                      }
                  } else {
                      // Split cost
                      const basePrice = Math.floor(order.totalAmount / order.roomQuantity);
                      const remainder = order.totalAmount % order.roomQuantity;
                      // Add remainder to first room to match total exactly
                      price = basePrice + (index === 0 ? remainder : 0);
                  }
              }

              // Create Booking Object
              const newBooking: Booking = {
                  id: `BK-${Date.now()}-${index}`,
                  createdDate: new Date().toISOString(),
                  facilityName: facility?.facilityName || '',
                  roomCode: room.name,
                  customerName: (order.roomQuantity > 1 && !isLeader && paymentStrategy === 'GROUP') 
                      ? `${order.guestName} (Thành viên)` 
                      : order.guestName,
                  customerPhone: order.guestPhone || '',
                  source: order.platform,
                  collaborator: 'OTA System',
                  paymentMethod: order.paymentStatus === 'Prepaid' ? 'OTA Prepaid' : 'Pay at hotel',
                  checkinDate: order.checkIn,
                  checkoutDate: order.checkOut,
                  status: 'Confirmed',
                  price: price, 
                  extraFee: 0,
                  totalRevenue: price,
                  note: `${order.notes || ''}\nMã OTA: ${order.bookingCode}`,
                  
                  // Payment Logic: If Prepaid, mark as paid immediately
                  paymentsJson: order.paymentStatus === 'Prepaid' 
                      ? JSON.stringify([{
                          ngayThanhToan: new Date().toISOString(),
                          soTien: price,
                          method: 'Transfer',
                          ghiChu: 'Thanh toán qua OTA (Prepaid)'
                      }]) 
                      : '[]',
                  remainingAmount: order.paymentStatus === 'Prepaid' ? 0 : price,
                  
                  cleaningJson: '{}',
                  assignedCleaner: '',
                  servicesJson: '[]',
                  lendingJson: '[]',
                  guestsJson: '[]',
                  isDeclared: false,
                  
                  // Group Fields
                  groupId: order.roomQuantity > 1 ? groupId : undefined,
                  groupName: order.roomQuantity > 1 ? `${order.guestName} (OTA)` : undefined,
                  isGroupLeader: isLeader
              };

              return addBooking(newBooking);
          });

          // 1. Execute DB Inserts and Updates
          const updates: Promise<any>[] = [
              ...bookingPromises,
              // Optimistic UI update
              updateOtaOrder(order.id, { status: 'Assigned', assignedRoom: roomNames }),
              // Update Supabase DB Directly
              supabase.from('ota_orders').update({
                  status: 'Assigned',
                  assigned_room: roomNames,
                  updated_at: new Date().toISOString()
              }).eq('id', order.id)
          ];

          // Execute Updates concurrently
          await Promise.all(updates);

          notify('success', `Đã xếp phòng ${roomNames} cho đơn ${order.bookingCode}.`);
          
          if (onSuccess) onSuccess(); // Trigger UI update in parent
          
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
    <Modal isOpen={isOpen} onClose={onClose} title={`Xếp Phòng (${selectedRoomIds.length}/${order.roomQuantity})`} size="lg">
        <div className="flex flex-col h-[80vh] md:h-auto">
            {/* 
               UNIFIED SCROLL CONTAINER 
               Wraps Header, Strategy, Alert, and Grid together.
               This allows the header to scroll away on mobile, giving full space to the room grid.
            */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-1">
                
                {/* Header: Order Summary */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-4">
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

                {/* Strategy Selection (Only if > 1 room) */}
                {order.roomQuantity > 1 && (
                    <div className="mb-4 bg-white border-2 border-slate-100 rounded-xl p-3">
                        <div className="text-xs font-bold text-slate-400 uppercase mb-2 tracking-wider">Chiến lược thanh toán</div>
                        <div className="flex gap-4">
                            <label className={`flex-1 flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${paymentStrategy === 'GROUP' ? 'border-brand-500 bg-brand-50' : 'border-slate-100 hover:bg-slate-50'}`}>
                                <input 
                                    type="radio" 
                                    name="strategy" 
                                    className="hidden" 
                                    checked={paymentStrategy === 'GROUP'} 
                                    onChange={() => setPaymentStrategy('GROUP')}
                                />
                                <div className={`p-2 rounded-full ${paymentStrategy === 'GROUP' ? 'bg-brand-200 text-brand-700' : 'bg-slate-100 text-slate-400'}`}>
                                    <Layers size={18}/>
                                </div>
                                <div>
                                    <div className="text-sm font-bold text-slate-800">Gộp bill (Trưởng đoàn)</div>
                                    <div className="text-[10px] text-slate-500">Trưởng đoàn trả hết, các phòng khác 0đ.</div>
                                </div>
                            </label>

                            <label className={`flex-1 flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${paymentStrategy === 'SPLIT' ? 'border-brand-500 bg-brand-50' : 'border-slate-100 hover:bg-slate-50'}`}>
                                <input 
                                    type="radio" 
                                    name="strategy" 
                                    className="hidden" 
                                    checked={paymentStrategy === 'SPLIT'} 
                                    onChange={() => setPaymentStrategy('SPLIT')}
                                />
                                <div className={`p-2 rounded-full ${paymentStrategy === 'SPLIT' ? 'bg-brand-200 text-brand-700' : 'bg-slate-100 text-slate-400'}`}>
                                    <Split size={18}/>
                                </div>
                                <div>
                                    <div className="text-sm font-bold text-slate-800">Chia đều (Tự trả)</div>
                                    <div className="text-[10px] text-slate-500">Chia đều tiền cho từng phòng.</div>
                                </div>
                            </label>
                        </div>
                    </div>
                )}

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

                {/* Room Selection Grid (Flows naturally within the scroll container) */}
                <div className="space-y-6 pb-4">
                    {groupedRooms.map(group => (
                        <div key={group.facility.id}>
                            <h4 className="font-bold text-slate-700 mb-2 sticky top-0 bg-white py-2 z-10 flex items-center gap-2 border-b border-slate-100">
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
                                    const isSelected = selectedRoomIds.includes(room.id);

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
                                            onClick={() => handleRoomClick(room.id, isAvailable)}
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

            {/* Footer: Fixed at Bottom */}
            <div className="pt-4 mt-2 border-t border-slate-100 flex justify-end gap-3 shrink-0 bg-white items-center">
                <div className="mr-auto text-xs text-slate-500">
                    Đã chọn: <b className={selectedRoomIds.length === order.roomQuantity ? 'text-green-600' : 'text-red-600'}>{selectedRoomIds.length}</b>/{order.roomQuantity} phòng
                </div>
                <button 
                    onClick={onClose} 
                    className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-50 transition-colors"
                >
                    Hủy bỏ
                </button>
                <button 
                    onClick={handleConfirm}
                    disabled={selectedRoomIds.length !== order.roomQuantity || isSubmitting}
                    className="px-6 py-2.5 rounded-xl text-sm font-bold bg-brand-600 text-white shadow-lg shadow-brand-200 hover:bg-brand-700 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                >
                    {isSubmitting ? 'Đang xử lý...' : 'Xác nhận xếp phòng'}
                </button>
            </div>
        </div>
    </Modal>
  );
};
