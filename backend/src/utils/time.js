import { config } from '../config/env.js';

export function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60_000);
}

// Calendar date (YYYY-MM-DD) of an instant in the app's time zone.
export function dateInAppTimezone(date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: config.timezone }).format(date);
}
