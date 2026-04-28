import { useState, useEffect } from 'react';
import { Calendar, Clock, MapPin, User, Search, Trash2, AlertTriangle, ChevronRight, LayoutGrid, List } from 'lucide-react';
import { db, auth } from '../lib/firebase';
import { Timetable, Lecture, DAYS } from '../types';
import { cn, getCurrentDay } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { localDb } from '../lib/storage';

interface DashboardProps {
  onAddClick: () => void;
}

export default function Dashboard({ onAddClick }: DashboardProps) {
  const [timetables, setTimetables] = useState<Timetable[]>([]);
  const [selectedTimetableId, setSelectedTimetableId] = useState<string>('');
  const [selectedClassName, setSelectedClassName] = useState<string>('');
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [viewMode, setViewMode] = useState<'daily' | 'grid'>('daily');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'mine'>('all');
  const [selectedDay, setSelectedDay] = useState<string>(getCurrentDay());
  const [currentTime, setCurrentTime] = useState(new Date());

  const currentDay = getCurrentDay();

  // Time tracking for highlighting
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const loadLocalData = () => {
    const localTimetables = localDb.getTimetables();
    setTimetables(localTimetables);
    if (localTimetables.length > 0 && !selectedTimetableId) {
      setSelectedTimetableId(localTimetables[0].id);
      if (localTimetables[0].classes.length > 0) {
        setSelectedClassName(localTimetables[0].classes[0]);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    loadLocalData();
    
    // Optional: listen to storage events if multiple tabs are open
    const handleStorage = () => loadLocalData();
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  useEffect(() => {
    if (!selectedTimetableId) return;
    const allLectures = localDb.getLectures();
    setLectures(allLectures.filter(l => l.timetableId === selectedTimetableId));
  }, [selectedTimetableId]);

  const handleDelete = async () => {
    if (!selectedTimetableId) return;
    if (!window.confirm("WARNING: Are you sure you want to delete this entire timetable? This action cannot be undone.")) return;
    
    setIsDeleting(true);
    try {
      localDb.deleteTimetable(selectedTimetableId);
      setSelectedTimetableId('');
      setSelectedClassName('');
      loadLocalData();
    } catch (err) {
      console.error(err);
      alert("Failed to delete timetable.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleTimetableChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newId = e.target.value;
    setSelectedTimetableId(newId);
    const tbl = timetables.find(t => t.id === newId);
    if (tbl && tbl.classes.length > 0) {
      setSelectedClassName(tbl.classes[0]);
    } else {
      setSelectedClassName('');
    }
  };

  const filteredTimetables = timetables.filter(t => {
    const matchesSearch = t.department.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          t.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const selectedTimetable = timetables.find(t => t.id === selectedTimetableId);
  const filteredLectures = lectures.filter(l => l.className === selectedClassName);
  const todayLectures = filteredLectures.filter(l => l.day === selectedDay).sort((a,b) => (a.slotIndex || 0) - (b.slotIndex || 0));

  const getLectureStatus = (lecture: Lecture) => {
    if (selectedDay !== currentDay) return 'NONE'; // Only highlight times on the actual current day

    const parseTime = (timeStr: string) => {
      const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)?/i);
      if (!match) return -1;
      let [_, h, m, period] = match;
      let hours = parseInt(h);
      let minutes = parseInt(m);
      if (period?.toUpperCase() === 'PM' && hours < 12) hours += 12;
      if (period?.toUpperCase() === 'AM' && hours === 12) hours = 0;
      return hours * 60 + minutes;
    };

    const startMins = parseTime(lecture.startTime);
    // Approximate end time to 1 hour after start if missing, or parse it
    const endMins = parseTime(lecture.endTime) !== -1 ? parseTime(lecture.endTime) : startMins + 60;
    const currentMins = currentTime.getHours() * 60 + currentTime.getMinutes();

    if (startMins === -1) return 'NONE';

    if (currentMins >= startMins && currentMins < endMins) return 'CURRENT';
    if (currentMins < startMins) return 'UPCOMING';
    return 'PAST';
  };

  const getLectureColors = (status: string) => {
    if (status === 'CURRENT') return 'bg-emerald-50 border-emerald-400 ring-2 ring-emerald-400 shadow-md';
    if (status === 'UPCOMING') return 'bg-yellow-50 border-yellow-300';
    if (status === 'PAST') return 'bg-red-50 border-red-200 opacity-80';
    return 'bg-white border-slate-200 hover:shadow-md hover:border-amber-200';
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-black/20" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Search & Selection Header */}
      <div className="space-y-6 mb-12">
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-black/20 group-focus-within:text-black transition-colors" />
          <input 
            type="text"
            placeholder="Search by Department or Timetable Name (e.g. CS, IT, Software Engineering...)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-14 bg-white border border-[#141414] pl-12 pr-4 font-sans focus:outline-none focus:ring-1 focus:ring-black placeholder:text-black/20"
          />
        </div>

        <div className="flex flex-col lg:flex-row gap-6 items-start lg:items-end">
          <div className="flex-1 w-full space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-mono font-bold text-[10px] uppercase tracking-widest text-slate-500">Select Timetable Source</label>
            </div>
            <div className="relative">
              <select 
                value={selectedTimetableId}
                onChange={handleTimetableChange}
                className="w-full h-12 bg-white border border-slate-300 px-4 font-sans font-bold text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 appearance-none cursor-pointer rounded-lg shadow-sm transition-all"
              >
                <option value="">Select a timetable...</option>
                {filteredTimetables.map(t => (
                  <option key={t.id} value={t.id}>{t.name} ({t.department})</option>
                ))}
              </select>
              <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 rotate-90 w-4 h-4 pointer-events-none" />
            </div>
          </div>

        <div className="flex-1 w-full space-y-2">
          <label className="font-mono font-bold text-[10px] uppercase tracking-widest text-slate-500">Class / Section</label>
          <div className="relative">
            <select 
              value={selectedClassName}
              onChange={(e) => setSelectedClassName(e.target.value)}
              className="w-full h-12 bg-white border border-slate-300 px-4 font-sans font-bold text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 appearance-none cursor-pointer rounded-lg shadow-sm transition-all"
            >
              <option value="">Select a class...</option>
              {selectedTimetable?.classes.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 rotate-90 w-4 h-4 pointer-events-none" />
          </div>
        </div>

        <div className="flex gap-2">
          <button 
            onClick={onAddClick}
            className="h-12 px-6 bg-blue-900 text-white font-mono font-bold text-xs uppercase tracking-widest hover:bg-blue-800 transition-colors rounded-lg shadow-sm"
          >
            Update / Add
          </button>
          {selectedTimetableId && (
            <button 
              disabled={isDeleting}
              onClick={handleDelete}
              className="h-12 w-12 flex items-center justify-center border border-red-200 text-red-500 hover:bg-red-50 transition-colors rounded-lg"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </div>

    {!selectedTimetableId ? (
        <motion.div 
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="text-center py-24 border-2 border-dashed border-slate-200 rounded-3xl bg-white/50"
        >
          <LayoutGrid className="w-12 h-12 mx-auto mb-4 opacity-20 text-slate-900" />
          <h3 className="text-xl font-display font-bold text-slate-800">No Timetable Selected</h3>
          <p className="text-sm font-medium text-slate-500">Upload a schedule to get started</p>
        </motion.div>
      ) : (
        <div className="space-y-12">
          {/* Metadata Bar */}
          <motion.div 
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            className="flex flex-wrap gap-x-8 gap-y-4 p-6 bg-white border border-slate-200 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] rounded-2xl"
          >
            <div className="space-y-1">
              <span className="font-mono font-bold text-[9px] uppercase text-slate-400">Uploaded By</span>
              <p className="font-sans text-sm font-bold text-slate-900">{selectedTimetable?.createdBy || 'Official'}</p>
            </div>
            <div className="space-y-1">
              <span className="font-mono font-bold text-[9px] uppercase text-slate-400">Generated On</span>
              <p className="font-sans text-sm font-bold text-slate-900">
                {selectedTimetable?.createdAt ? new Date(selectedTimetable.createdAt).toLocaleDateString() : 'Recently'}
              </p>
            </div>
            <div className="space-y-1">
              <span className="font-mono font-bold text-[9px] uppercase text-slate-400">Today</span>
              <p className="font-sans text-sm font-bold text-blue-600">{currentDay}</p>
            </div>
          </motion.div>

            <div className="flex justify-between items-center">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <h2 className="text-3xl font-display font-bold text-slate-900">Your Schedule</h2>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono font-bold uppercase text-slate-400">View Day:</span>
                  <select 
                    value={selectedDay}
                    onChange={(e) => setSelectedDay(e.target.value)}
                    className="bg-white border border-slate-200 text-sm font-bold text-blue-700 px-3 py-1 rounded-md shadow-sm outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {DAYS.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex bg-slate-100 p-1 rounded-lg">
              <button 
                onClick={() => setViewMode('daily')}
                className={cn("px-3 py-2 transition-all font-bold rounded-md flex items-center gap-2", viewMode === 'daily' ? "bg-white text-blue-900 shadow-sm" : "text-slate-500 hover:text-slate-900")}
              >
                <List className="w-4 h-4" />
                <span className="text-xs hidden sm:block">Daily</span>
              </button>
              <button 
                onClick={() => setViewMode('grid')}
                className={cn("px-3 py-2 transition-all font-bold rounded-md flex items-center gap-2", viewMode === 'grid' ? "bg-white text-blue-900 shadow-sm" : "text-slate-500 hover:text-slate-900")}
              >
                <LayoutGrid className="w-4 h-4" />
                <span className="text-xs hidden sm:block">Grid</span>
              </button>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {viewMode === 'daily' ? (
              <motion.div 
                key="daily"
                initial="hidden" animate="show" exit={{ opacity: 0, x: -20 }}
                variants={{
                  hidden: { opacity: 0 },
                  show: {
                    opacity: 1,
                    transition: { staggerChildren: 0.1 }
                  }
                }}
                className="space-y-4"
              >
                <h3 className="font-mono font-bold text-xs uppercase tracking-widest mb-6 text-slate-500">Lectures for {selectedDay} {selectedDay === currentDay && "(Today)"}</h3>
                {todayLectures.length === 0 ? (
                  <p className="py-12 text-center text-slate-400 font-medium font-sans">No lectures scheduled for {selectedDay}. Enjoy your break!</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {todayLectures.map((lecture, i) => {
                      const status = getLectureStatus(lecture);
                      return (
                        <motion.div 
                          variants={{
                            hidden: { opacity: 0, y: 20 },
                            show: { opacity: 1, y: 0 }
                          }}
                          key={lecture.id}
                          className={cn(
                            "p-6 rounded-2xl group transition-all relative overflow-hidden",
                            getLectureColors(status)
                          )}
                        >
                           {status === 'CURRENT' && (
                             <div className="absolute top-0 right-0 left-0 h-1 bg-emerald-500 animate-pulse" />
                           )}
                           <div className="flex justify-between items-start mb-6">
                              <div className={cn(
                                "px-3 py-1 font-mono font-bold rounded-md text-[10px] border",
                                status === 'CURRENT' ? "bg-emerald-100 text-emerald-800 border-emerald-200" :
                                status === 'UPCOMING' ? "bg-amber-100 text-amber-900 border-amber-200" :
                                status === 'PAST' ? "bg-red-100 text-red-900 border-red-200" :
                                "bg-slate-100 text-slate-600 border-slate-200"
                              )}>
                                SLOT {lecture.slotIndex}
                              </div>
                              <div className={cn(
                                "flex items-center gap-2 font-medium",
                                status === 'CURRENT' ? "text-emerald-700" :
                                status === 'UPCOMING' ? "text-amber-800" :
                                status === 'PAST' ? "text-red-700" : "text-slate-400"
                              )}>
                                <Clock className="w-4 h-4" />
                                <span className="font-mono font-bold text-[10px]">{lecture.startTime} - {lecture.endTime}</span>
                              </div>
                           </div>
                           <h4 className={cn(
                             "text-xl font-display font-bold leading-tight mb-4 transition-colors",
                             status === 'CURRENT' ? "text-emerald-900" :
                             status === 'PAST' ? "text-red-900" : "text-slate-900 group-hover:text-amber-700"
                           )}>
                             {lecture.subject}
                           </h4>
                           <div className={cn(
                             "space-y-3 pt-4 border-t",
                             status === 'CURRENT' ? "border-emerald-200" :
                             status === 'UPCOMING' ? "border-amber-200" :
                             status === 'PAST' ? "border-red-200" : "border-slate-100"
                           )}>
                              <div className={cn(
                                "flex items-center gap-3 text-sm font-medium",
                                status === 'PAST' ? "text-red-800" : "text-slate-600"
                              )}>
                                <div className={cn(
                                  "p-1.5 rounded-full",
                                  status === 'CURRENT' ? "bg-emerald-100 text-emerald-600" :
                                  status === 'UPCOMING' ? "bg-amber-100 text-amber-600" :
                                  status === 'PAST' ? "bg-red-100 text-red-500" : "bg-slate-50 text-slate-400"
                                )}>
                                  <User className="w-3.5 h-3.5" />
                                </div>
                                <span>{lecture.teacher}</span>
                              </div>
                              <div className={cn(
                                "flex items-center gap-3 text-sm font-bold",
                                status === 'PAST' ? "text-red-900" : "text-slate-800"
                              )}>
                                <div className={cn(
                                  "p-1.5 rounded-full",
                                  status === 'CURRENT' ? "bg-emerald-100 text-emerald-600" :
                                  status === 'UPCOMING' ? "bg-amber-100 text-amber-600" :
                                  status === 'PAST' ? "bg-red-100 text-red-500" : "bg-slate-50 text-slate-400"
                                )}>
                                  <MapPin className="w-3.5 h-3.5" />
                                </div>
                                <span>{lecture.room}</span>
                              </div>
                           </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div 
                key="grid"
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
                className="overflow-x-auto border border-slate-200 rounded-2xl shadow-sm"
              >
                <table className="w-full text-left border-collapse bg-white">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600">
                      <th className="p-4 font-mono font-bold text-[10px] uppercase border-b border-r border-slate-200">Day / Slot</th>
                      {[...Array(12)].map((_, i) => (
                        <th key={i} className="p-4 font-mono font-bold text-[10px] uppercase border-b border-r border-slate-200 text-center">{i + 1}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {DAYS.map(day => (
                      <tr key={day} className={cn("transition-colors", day === selectedDay ? "bg-amber-50/50" : (day === currentDay ? "bg-slate-50/80" : "hover:bg-slate-50/50"))}>
                        <td className={cn("p-4 font-sans font-bold text-sm border-r border-b border-slate-200 text-slate-900", day === selectedDay ? "bg-blue-900 text-white" : "bg-slate-50")}>{day.slice(0,3)}</td>
                        {[...Array(12)].map((_, i) => {
                          const lect = filteredLectures.find(l => l.day === day && (l.slotIndex === i + 1));
                          return (
                            <td key={i} className="p-2 border-r border-b border-slate-100 min-w-[140px] align-top bg-white">
                              {lect ? (
                                <div className="text-[10px] leading-tight flex flex-col h-full justify-between p-1.5 rounded bg-white">
                                  <div className="font-bold mb-1 line-clamp-2 text-slate-900">{lect.subject}</div>
                                  <div className="text-slate-500 font-medium">{lect.teacher}</div>
                                  <div className="mt-2 font-mono font-bold text-[9px] text-amber-900 bg-amber-50 px-1.5 py-0.5 rounded inline-block w-fit">{lect.room}</div>
                                </div>
                              ) : (
                                <div className="h-full min-h-[60px] opacity-10 flex items-center justify-center">
                                  <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

const Loader2 = ({ className }: { className?: string }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width="24" 
    height="24" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={cn("animate-spin", className)}
  >
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);
