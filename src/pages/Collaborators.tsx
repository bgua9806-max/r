              <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase">Từ ngày</label>
                      <input 
                        type="date" 
                        className="w-full border rounded-lg p-2.5 text-sm" 
                        value={leaveForm.start_date} 
                        min={leaveForm.leave_type === 'Nghỉ ốm' ? undefined : format(new Date(), 'yyyy-MM-dd')}
                        onChange={e => {
                            const newStart = e.target.value;
                            setLeaveForm(prev => ({
                                ...prev, 
                                start_date: newStart,
                                // Nếu ngày kết thúc nhỏ hơn ngày bắt đầu mới -> Cập nhật ngày kết thúc bằng ngày bắt đầu
                                end_date: (prev.end_date && prev.end_date < newStart) ? newStart : prev.end_date
                            }));
                        }} 
                      />
                  </div>
                  <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase">Đến ngày</label>
                      <input 
                        type="date" 
                        className="w-full border rounded-lg p-2.5 text-sm" 
                        value={leaveForm.end_date} 
                        min={leaveForm.start_date}
                        onChange={e => setLeaveForm({...leaveForm, end_date: e.target.value})} 
                      />
                  </div>
              </div>
              <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Loại nghỉ</label>
                  <select 
                    className="w-full border rounded-lg p-2.5 text-sm" 
                    value={leaveForm.leave_type} 
                    onChange={e => {
                        const newType = e.target.value as any;
                        const today = format(new Date(), 'yyyy-MM-dd');
                        let newStart = leaveForm.start_date || today;
                        let newEnd = leaveForm.end_date || today;

                        // Nếu chuyển từ 'Nghỉ ốm' sang loại khác mà ngày đang chọn là quá khứ -> Reset về hôm nay
                        if (newType !== 'Nghỉ ốm' && newStart < today) {
                            newStart = today;
                            if (newEnd < newStart) newEnd = newStart;
                        }

                        setLeaveForm({
                            ...leaveForm, 
                            leave_type: newType,
                            start_date: newStart,
                            end_date: newEnd
                        });
                    }}
                  >
                      <option value="Nghỉ phép năm">Nghỉ phép năm</option>
                      <option value="Nghỉ ốm">Nghỉ ốm</option>
                      <option value="Việc riêng">Việc riêng (Có lương/Trừ phép)</option>
                      <option value="Không lương">Không lương</option>
                      <option value="Chế độ">Chế độ (Hiếu/Hỉ/Thai sản)</option>
                  </select>
              </div>