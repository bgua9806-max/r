
import { Season, ShiftDefinition } from '../types';
import { parseISO, isValid } from 'date-fns';

const TIME_REGEX = /^(\d{1,2}):(\d{1,2})(:(\d{1,2}))?$/;

/**
 * Converts a time string (HH:mm:ss) or ISO string to minutes from midnight (0-1439).
 */
export const timeToMinutes = (timeStr: string): number => {
  if (!timeStr) return -1;

  // Check if ISO string
  if (timeStr.includes('T')) {
    const date = parseISO(timeStr);
    if (isValid(date)) {
      return date.getHours() * 60 + date.getMinutes();
    }
  }

  // Check if HH:mm:ss format
  const match = timeStr.match(TIME_REGEX);
  if (match) {
    const hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    return hours * 60 + minutes;
  }

  return -1;
};

/**
 * Calculates the shortest distance between two times on a 24h clock.
 * Result is in minutes (0 - 720).
 * Example: 23:00 (1380) vs 01:00 (60) -> Distance is 120 mins (2 hours), not 1320 mins.
 */
export const getCircularDistance = (min1: number, min2: number): number => {
  const diff = Math.abs(min1 - min2);
  return Math.min(diff, 1440 - diff);
};

/**
 * Determines the active season for a given date.
 * Handles both normal ranges (May-Sept) and cross-year ranges (Oct-Apr).
 */
export const getCurrentSeason = (date: Date, seasons: Season[]): Season | null => {
  if (!isValid(date) || !seasons || seasons.length === 0) return null;

  const currentMonth = date.getMonth() + 1; // 1-12
  const currentDay = date.getDate();

  // Find the season that matches
  const activeSeason = seasons.find(season => {
    if (!season.is_active) return false;

    // Normal case: Start month <= End month (e.g., May to Sept)
    if (season.start_month <= season.end_month) {
      const isAfterStart = currentMonth > season.start_month || (currentMonth === season.start_month && currentDay >= season.start_day);
      const isBeforeEnd = currentMonth < season.end_month || (currentMonth === season.end_month && currentDay <= season.end_day);
      return isAfterStart && isBeforeEnd;
    } 
    
    // Cross-year case: Start month > End month (e.g., Oct to Apr)
    else {
      // It is the season if we are AFTER the start OR BEFORE the end (wrapping around year end)
      const isAfterStart = currentMonth > season.start_month || (currentMonth === season.start_month && currentDay >= season.start_day);
      const isBeforeEnd = currentMonth < season.end_month || (currentMonth === season.end_month && currentDay <= season.end_day);
      return isAfterStart || isBeforeEnd;
    }
  });

  return activeSeason || null;
};

/**
 * Determines which shift corresponds to a specific check-in time and date.
 * 1. Finds the active season for the date.
 * 2. Filters shifts belonging to that season.
 * 3. Finds the shift with the closest start_time to the check-in time (circular logic).
 */
export const determineShift = (
  checkInTimeStr: string, 
  date: Date, 
  seasons: Season[], 
  shifts: ShiftDefinition[]
): ShiftDefinition | null => {
  // 1. Determine Season
  const currentSeason = getCurrentSeason(date, seasons);
  if (!currentSeason) return null; // No active season configuration found for this date

  // 2. Filter Shifts for this season
  const validShifts = shifts.filter(s => s.season_code === currentSeason.code && s.is_active);
  if (validShifts.length === 0) return null;

  // 3. Convert check-in time
  const checkInMinutes = timeToMinutes(checkInTimeStr);
  if (checkInMinutes === -1) return null;

  // 4. Find closest shift
  let closestShift: ShiftDefinition | null = null;
  let minDistance = Infinity;

  for (const shift of validShifts) {
    const startMinutes = timeToMinutes(shift.start_time);
    if (startMinutes === -1) continue;

    const distance = getCircularDistance(checkInMinutes, startMinutes);
    
    // Logic: Strictly closest start time.
    if (distance < minDistance) {
      minDistance = distance;
      closestShift = shift;
    }
  }

  return closestShift;
};
