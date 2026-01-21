
import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from './Modal';
import { useAppContext } from '../context/AppContext';
import { 
  MapPin, Navigation, Loader2, Fingerprint, CheckCircle, 
  XCircle, RotateCcw, Building, LogOut, Clock, AlertTriangle 
} from 'lucide-react';
import { format } from 'date-fns';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

// Haversine formula to calculate distance on UI side for immediate feedback
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; // Earth radius in metres
  const φ1 = lat1 * Math.PI/180; 
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return Math.round(R * c);
}

export const TimekeepingModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { facilities, clockIn, clockOut, timeLogs, currentUser, notify, isLoading } = useAppContext();
  
  const [coords, setCoords] = useState<{lat: number, lng: number} | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>('');

  // Determine current active session
  const activeLog = useMemo(() => {
      if (!currentUser) return null;
      // Sort by check_in desc, find first one without check_out
      return timeLogs.find(l => l.staff_id === currentUser.id && !l.check_out_time);
  }, [timeLogs, currentUser]);

  // Set default facility based on active log OR user assignment
  useEffect(() => {
      if (isOpen) {
          getLocation();
          if (activeLog) {
              setSelectedFacilityId(activeLog.facility_id);
          } else if (facilities.length > 0) {
              // Try to find facility where user is assigned
              const userFacility = facilities.find(f => f.staff?.includes(currentUser?.collaboratorName || ''));
              setSelectedFacilityId(userFacility ? userFacility.id : facilities[0].id);
          }
      }
  }, [isOpen, activeLog, facilities, currentUser]);

  const getLocation = () => {
      if (!navigator.geolocation) {
          setGeoError('Trình duyệt không hỗ trợ GPS.');
          return;
      }
      
      setIsLocating(true);
      setGeoError(null);
      
      navigator.geolocation.getCurrentPosition(
          (position) => {
              setCoords({
                  lat: position.coords.latitude,
                  lng: position.coords.longitude
              });
              setIsLocating(false);
          },
          (error) => {
              console.error(error);
              setGeoError('Không thể lấy vị trí. Vui lòng bật GPS và cấp quyền.');
              setIsLocating(false);
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
  };

  const selectedFacility = facilities.find(f => f.id === selectedFacilityId);
  
  const distanceInfo = useMemo(() => {
      if (!coords || !selectedFacility) return { distance: 0, isValid: false };
      
      const dist = calculateDistance(
          coords.lat, 
          coords.lng, 
          selectedFacility.latitude || 0, 
          selectedFacility.longitude || 0
      );
      
      const allowed = selectedFacility.allowed_radius || 100;
      return {
          distance: dist,
          isValid: dist <= allowed,
          allowed: allowed
      };
  }, [coords, selectedFacility]);

  const handleAction = async () => {
      if (!currentUser) return;
      if (!coords) {
          notify('error', 'Cần có dữ liệu vị trí GPS.');
          return;
      }

      setIsSubmitting(true);
      try {
          if (activeLog) {
              // Checkout Logic
              const res = await clockOut();
              if (res.success) onClose();
          } else {
              // Checkin Logic
              if (!distanceInfo.isValid) {
                  const confirm = window.confirm(`Bạn đang ở xa ${distanceInfo.distance}m. Vẫn muốn Check-in? (Sẽ bị đánh dấu Invalid)`);
                  if (!confirm) {
                      setIsSubmitting(false);
                      return;
                  }
              }
              const res = await clockIn(selectedFacilityId, coords.lat, coords.lng);
              if (res.success) onClose();
          }
      } catch (e) {
          notify('error', 'Lỗi xử lý chấm công.');
      } finally {
          setIsSubmitting(false);
      }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Chấm Công GPS" size="sm">
        <div className="flex flex-col items-center space-y-6 py-2">
            
            {/* 1. STATUS CARD */}
            <div className="w-full bg-slate-50 rounded-2xl p-1 border border-slate-100 flex flex-col items-center relative overflow-hidden">
                {/* Radar Animation */}
                <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">
                    <div className="w-32 h-32 border-4 border-brand-500 rounded-full animate-ping"></div>
                </div>
                
                <div className="w-full bg-white rounded-xl p-4 shadow-sm z-10 text-center">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Vị trí hiện tại</div>
                    
                    {isLocating ? (
                        <div className="flex items-center justify-center gap-2 text-brand-600 font-bold py-4">
                            <Loader2 className="animate-spin" size={20}/> Đang dò tìm GPS...
                        </div>
                    ) : geoError ? (
                        <div className="flex flex-col items-center gap-1 text-red-500 font-bold py-2">
                            <XCircle size={24}/>
                            <span className="text-sm">{geoError}</span>
                            <button onClick={getLocation} className="text-xs underline mt-1">Thử lại</button>
                        </div>
                    ) : coords ? (
                        <div className="flex flex-col items-center gap-2">
                            <div className="flex items-center gap-1.5 text-slate-700 bg-slate-100 px-3 py-1.5 rounded-lg font-mono text-xs font-bold">
                                <MapPin size={12}/> {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
                            </div>
                            
                            {selectedFacility && (selectedFacility.latitude ? (
                                <div className={`flex items-center gap-2 text-sm font-bold mt-2 ${distanceInfo.isValid ? 'text-emerald-600' : 'text-rose-600'}`}>
                                    {distanceInfo.isValid ? <CheckCircle size={16}/> : <AlertTriangle size={16}/>}
                                    Cách cơ sở {distanceInfo.distance}m
                                    <span className="text-xs font-normal text-slate-400">(Cho phép {distanceInfo.allowed}m)</span>
                                </div>
                            ) : (
                                <div className="text-amber-500 text-xs font-bold mt-2 flex items-center gap-1">
                                    <Building size={12}/> Cơ sở chưa có tọa độ gốc
                                </div>
                            ))}
                        </div>
                    ) : null}
                </div>
            </div>

            {/* 2. FACILITY SELECTOR (Only if not checked in) */}
            {!activeLog && (
                <div className="w-full">
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5">Chọn cơ sở làm việc</label>
                    <select 
                        className="w-full border-2 border-slate-100 rounded-xl p-3 bg-white font-bold text-slate-700 outline-none focus:border-brand-500"
                        value={selectedFacilityId}
                        onChange={e => setSelectedFacilityId(e.target.value)}
                    >
                        {facilities.map(f => (
                            <option key={f.id} value={f.id}>{f.facilityName}</option>
                        ))}
                    </select>
                </div>
            )}

            {/* 3. BIG ACTION BUTTON */}
            <button 
                onClick={handleAction}
                disabled={isLocating || !!geoError || isSubmitting || (!activeLog && !selectedFacility)}
                className={`
                    w-full py-5 rounded-2xl font-black text-white shadow-xl flex items-center justify-center gap-3 text-lg uppercase tracking-wider transition-all active:scale-95 relative overflow-hidden group
                    ${activeLog 
                        ? 'bg-gradient-to-r from-rose-500 to-red-600 shadow-rose-200 hover:shadow-rose-300' 
                        : 'bg-gradient-to-r from-brand-500 to-emerald-500 shadow-brand-200 hover:shadow-brand-300'}
                    ${(isLocating || !!geoError) ? 'opacity-50 cursor-not-allowed' : ''}
                `}
            >
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                
                {isSubmitting ? (
                    <Loader2 size={24} className="animate-spin"/>
                ) : activeLog ? (
                    <><LogOut size={24}/> Check Out</>
                ) : (
                    <><Fingerprint size={24}/> Check In</>
                )}
            </button>

            {/* 4. CURRENT SESSION INFO */}
            {activeLog && (
                <div className="w-full bg-blue-50 border border-blue-100 p-4 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-blue-600 shadow-sm">
                            <Clock size={20}/>
                        </div>
                        <div>
                            <div className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">Bắt đầu lúc</div>
                            <div className="text-sm font-black text-blue-800">{format(new Date(activeLog.check_in_time), 'HH:mm dd/MM')}</div>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">Cơ sở</div>
                        <div className="text-xs font-bold text-blue-800 truncate max-w-[100px]">
                            {facilities.find(f => f.id === activeLog.facility_id)?.facilityName}
                        </div>
                    </div>
                </div>
            )}
        </div>
    </Modal>
  );
};
