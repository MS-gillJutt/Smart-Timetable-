import { useState, useEffect } from 'react';
import { Calendar, Clock, MapPin, User, Search, Trash2, AlertTriangle, ChevronRight, LayoutGrid, List } from 'lucide-react';
import { db, auth } from '../lib/firebase';
import { collection, query, where, getDocs, onSnapshot, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { Timetable, Lecture, DAYS } from '../types';
import { cn, getCurrentDay } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

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

  const currentDay = getCurrentDay();

  useEffect(() => {
    const q = query(collection(db, 'timetables'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Timetable));
      setTimetables(data);
      if (data.length > 0 && !selectedTimetableId) {
        setSelectedTimetableId(data[0].id);
        if (data[0].classes.length > 0) {
          setSelectedClassName(data[0].classes[0]);
        }
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!selectedTimetableId) return;
    
    const q = query(
      collection(db, 'lectures'), 
      where('timetableId', '==', selectedTimetableId)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Lecture));
      setLectures(data);
    });
    
    return unsubscribe;
  }, [selectedTimetableId]);

  const handleDelete = async () => {
    if (!selectedTimetableId) return;
    
    if (!auth.currentUser) {
      alert("You must be signed in to delete timetables.");
      return;
    }

    if (!window.confirm("WARNING: Are you sure you want to delete this entire timetable? This action cannot be undone.")) return;
    
    setIsDeleting(true);
    try {
      // Delete all lectures for this timetable
      const lecturesQ = query(collection(db, 'lectures'), where('timetableId', '==', selectedTimetableId));
      const lecturesSnap = await getDocs(lecturesQ);
      for (const d of lecturesSnap.docs) {
        await deleteDoc(doc(db, 'lectures', d.id));
      }
      // Delete timetable metadata
      await deleteDoc(doc(db, 'timetables', selectedTimetableId));
      
      setSelectedTimetableId('');
      setSelectedClassName('');
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
    
    if (filterMode === 'mine') {
      return matchesSearch && auth.currentUser && t.userId === auth.currentUser.uid;
    }
    return matchesSearch;
  });

  const selectedTimetable = timetables.find(t => t.id === selectedTimetableId);
  const filteredLectures = lectures.filter(l => l.className === selectedClassName);
  const todayLectures = filteredLectures.filter(l => l.day === currentDay).sort((a,b) => (a.slotIndex || 0) - (b.slotIndex || 0));

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
              {auth.currentUser && (
                <div className="flex gap-2">
                  <button 
                    onClick={() => setFilterMode('all')}
                    className={cn("font-mono font-bold text-[9px] uppercase tracking-widest px-2 py-1 transition-colors rounded", filterMode === 'all' ? "bg-teal-600 text-white" : "text-slate-500 hover:text-teal-600 hover:bg-teal-50")}
                  >
                    All
                  </button>
                  <button 
                    onClick={() => setFilterMode('mine')}
                    className={cn("font-mono font-bold text-[9px] uppercase tracking-widest px-2 py-1 transition-colors rounded", filterMode === 'mine' ? "bg-teal-600 text-white" : "text-slate-500 hover:text-teal-600 hover:bg-teal-50")}
                  >
                    Mine
                  </button>
                </div>
              )}
            </div>
            <div className="relative">
              <select 
                value={selectedTimetableId}
                onChange={handleTimetableChange}
                className="w-full h-12 bg-white border border-slate-300 px-4 font-sans font-bold text-slate-900 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 appearance-none cursor-pointer rounded-lg shadow-sm transition-all"
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
              className="w-full h-12 bg-white border border-slate-300 px-4 font-sans font-bold text-slate-900 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 appearance-none cursor-pointer rounded-lg shadow-sm transition-all"
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
            className="h-12 px-6 bg-teal-600 text-white font-mono font-bold text-xs uppercase tracking-widest hover:bg-teal-700 transition-colors rounded-lg shadow-sm"
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
                {selectedTimetable?.createdAt?.toDate ? selectedTimetable.createdAt.toDate().toLocaleDateString() : 'Recently'}
              </p>
            </div>
            <div className="space-y-1">
              <span className="font-mono font-bold text-[9px] uppercase text-slate-400">Today</span>
              <p className="font-sans text-sm font-bold text-teal-600">{currentDay}</p>
            </div>
          </motion.div>

          {/* Toggle View */}
          <div className="flex justify-between items-center">
            <h2 className="text-3xl font-display font-bold text-slate-900">Your Schedule</h2>
            <div className="flex bg-slate-100 p-1 rounded-lg">
              <button 
                onClick={() => setViewMode('daily')}
                className={cn("px-3 py-2 transition-all font-bold rounded-md flex items-center gap-2", viewMode === 'daily' ? "bg-white text-teal-700 shadow-sm" : "text-slate-500 hover:text-slate-900")}
              >
                <List className="w-4 h-4" />
                <span className="text-xs hidden sm:block">Daily</span>
              </button>
              <button 
                onClick={() => setViewMode('grid')}
                className={cn("px-3 py-2 transition-all font-bold rounded-md flex items-center gap-2", viewMode === 'grid' ? "bg-white text-teal-700 shadow-sm" : "text-slate-500 hover:text-slate-900")}
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
                <h3 className="font-mono font-bold text-xs uppercase tracking-widest mb-6 text-slate-500">Today's Lectures ({currentDay})</h3>
                {todayLectures.length === 0 ? (
                  <p className="py-12 text-center text-slate-400 font-medium font-sans">No lectures scheduled for today. Enjoy your break!</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {todayLectures.map((lecture, i) => (
                      <motion.div 
                        variants={{
                          hidden: { opacity: 0, y: 20 },
                          show: { opacity: 1, y: 0 }
                        }}
                        key={lecture.id}
                        className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm hover:shadow-md hover:border-teal-200 group hover:-translate-y-1 transition-all"
                      >
                         <div className="flex justify-between items-start mb-6">
                            <div className="bg-teal-50 text-teal-700 px-3 py-1 font-mono font-bold rounded-md text-[10px] border border-teal-100">
                              SLOT {lecture.slotIndex}
                            </div>
                            <div className="flex items-center gap-2 text-slate-400 font-medium">
                              <Clock className="w-4 h-4" />
                              <span className="font-mono font-bold text-[10px]">{lecture.startTime} - {lecture.endTime}</span>
                            </div>
                         </div>
                         <h4 className="text-xl font-display font-bold leading-tight mb-4 text-slate-900 group-hover:text-teal-600 transition-colors">
                           {lecture.subject}
                         </h4>
                         <div className="space-y-3 pt-4 border-t border-slate-100">
                            <div className="flex items-center gap-3 text-sm text-slate-600 font-medium">
                              <div className="p-1.5 rounded-full bg-slate-50 text-slate-400">
                                <User className="w-3.5 h-3.5" />
                              </div>
                              <span>{lecture.teacher}</span>
                            </div>
                            <div className="flex items-center gap-3 text-sm text-slate-800 font-bold">
                              <div className="p-1.5 rounded-full bg-slate-50 text-slate-400">
                                <MapPin className="w-3.5 h-3.5" />
                              </div>
                              <span>{lecture.room}</span>
                            </div>
                         </div>
                      </motion.div>
                    ))}
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
                      <tr key={day} className={cn("transition-colors", day === currentDay ? "bg-teal-50/50" : "hover:bg-slate-50/50")}>
                        <td className="p-4 font-sans font-bold text-sm border-r border-b border-slate-200 bg-slate-50 text-slate-900">{day.slice(0,3)}</td>
                        {[...Array(12)].map((_, i) => {
                          const lect = filteredLectures.find(l => l.day === day && (l.slotIndex === i + 1));
                          return (
                            <td key={i} className="p-2 border-r border-b border-slate-100 min-w-[140px] align-top bg-white">
                              {lect ? (
                                <div className="text-[10px] leading-tight flex flex-col h-full justify-between p-1.5 rounded bg-white">
                                  <div className="font-bold mb-1 line-clamp-2 text-slate-900">{lect.subject}</div>
                                  <div className="text-slate-500 font-medium">{lect.teacher}</div>
                                  <div className="mt-2 font-mono font-bold text-[9px] text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded inline-block w-fit">{lect.room}</div>
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
