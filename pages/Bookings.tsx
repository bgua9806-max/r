
import React from 'react';
import { BookingModal } from '../components/BookingModal';
import { SwapRoomModal } from '../components/SwapRoomModal';
import { useBookingLogic } from '../hooks/useBookingLogic';
import { BookingToolbar } from './bookings-parts/BookingToolbar';
import { BookingTimelineView } from './bookings-parts/BookingTimelineView';
import { BookingGridView } from './bookings-parts/BookingGridView';

export const Bookings: React.FC = () => {
  const {
    viewMode, setViewMode,
    calendarMode, setCalendarMode,
    currentDate, setCurrentDate,
    searchTerm, setSearchTerm,
    filterFacility, setFilterFacility,
    isModalOpen, setIsModalOpen,
    isSwapModalOpen, setIsSwapModalOpen,
    editingBooking, setEditingBooking,
    swappingBooking,
    modalInitialTab, 
    isCancellationMode, setIsCancellationMode,
    defaultBookingData, setDefaultBookingData,
    now,
    scrollContainerRef,
    
    dateRange,
    roomMapData,
    roomStats,
    timelineRows,
    viewConfig,
    facilities,
    
    navigateDate,
    handleQuickClean,
    handleRoomClick,
    openBookingAction,
    openBookingCancellation,
    handleSwapClick,
    getBookingsForRow,
    getCurrentTimePositionPercent,
    getBookingStyle,
    refreshData
  } = useBookingLogic();

  const handleAddBooking = () => {
      setEditingBooking(null);
      setDefaultBookingData({});
      setIsCancellationMode(false);
      setIsModalOpen(true);
  };

  const handleBookingClick = (booking: any) => {
      setEditingBooking(booking);
      setIsCancellationMode(false);
      setIsModalOpen(true);
  };

  return (
    <div className="flex flex-col h-full space-y-4 animate-enter">
      
      {/* 1. TOOLBAR & HEADER */}
      <BookingToolbar 
        viewMode={viewMode}
        setViewMode={setViewMode}
        calendarMode={calendarMode}
        setCalendarMode={setCalendarMode}
        currentDate={currentDate}
        setCurrentDate={setCurrentDate}
        navigateDate={navigateDate}
        dateRange={dateRange}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        filterFacility={filterFacility}
        setFilterFacility={setFilterFacility}
        facilities={facilities}
        roomStats={roomStats}
        refreshData={refreshData}
        onAddBooking={handleAddBooking}
      />

      {/* 2. MAIN VIEW AREA */}
      <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col relative z-0">
        
        {viewMode === 'timeline' ? (
          <BookingTimelineView 
            dateRange={dateRange}
            timelineRows={timelineRows}
            viewConfig={viewConfig}
            calendarMode={calendarMode}
            now={now}
            currentDate={currentDate}
            getBookingsForRow={getBookingsForRow}
            getCurrentTimePositionPercent={getCurrentTimePositionPercent}
            getBookingStyle={getBookingStyle}
            onBookingClick={handleBookingClick}
            scrollContainerRef={scrollContainerRef}
          />
        ) : (
          <BookingGridView 
            roomMapData={roomMapData}
            now={now}
            handleRoomClick={handleRoomClick}
            handleSwapClick={handleSwapClick}
            openBookingAction={openBookingAction}
            openBookingCancellation={openBookingCancellation}
            handleQuickClean={handleQuickClean}
          />
        )}
      </div>

      <BookingModal 
        isOpen={isModalOpen} 
        onClose={() => { setIsModalOpen(false); setIsCancellationMode(false); }} 
        booking={editingBooking}
        defaultData={defaultBookingData} 
        initialTab={modalInitialTab} 
        initialCancellation={isCancellationMode}
      />

      {swappingBooking && (
          <SwapRoomModal
            isOpen={isSwapModalOpen}
            onClose={() => setIsSwapModalOpen(false)}
            booking={swappingBooking}
          />
      )}
    </div>
  );
};
