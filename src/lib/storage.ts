import { Timetable, Lecture } from '../types';

const TIMETABLES_KEY = 'stt_timetables';
const LECTURES_KEY = 'stt_lectures';

export const localDb = {
  getTimetables: (): Timetable[] => {
    try {
      const data = localStorage.getItem(TIMETABLES_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },
  
  saveTimetable: (timetable: Timetable) => {
    const list = localDb.getTimetables();
    list.push(timetable);
    localStorage.setItem(TIMETABLES_KEY, JSON.stringify(list));
  },
  
  deleteTimetable: (id: string) => {
    const list = localDb.getTimetables().filter(t => t.id !== id);
    localStorage.setItem(TIMETABLES_KEY, JSON.stringify(list));
    
    // Also delete associated lectures
    const lectures = localDb.getLectures().filter(l => l.timetableId !== id);
    localStorage.setItem(LECTURES_KEY, JSON.stringify(lectures));
  },

  getLectures: (): Lecture[] => {
    try {
      const data = localStorage.getItem(LECTURES_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },
  
  saveLectures: (lectures: Lecture[]) => {
    const list = localDb.getLectures();
    list.push(...lectures);
    localStorage.setItem(LECTURES_KEY, JSON.stringify(list));
  }
};
