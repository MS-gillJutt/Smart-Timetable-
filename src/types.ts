/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Timetable {
  id: string;
  name: string;
  department: string;
  createdBy: string;
  userId?: string;
  createdAt: any; // Firestore Timestamp
  classes: string[];
}

export interface Lecture {
  id: string;
  timetableId: string;
  day: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
  startTime: string;
  endTime: string;
  subject: string;
  teacher: string;
  room: string;
  className: string;
  slotIndex: number;
}

export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;
export const DAY_MAP: Record<string, string> = {
  'Mo': 'Monday',
  'Tu': 'Tuesday',
  'We': 'Wednesday',
  'Th': 'Thursday',
  'Fr': 'Friday',
  'Sa': 'Saturday',
  'Su': 'Sunday'
};
