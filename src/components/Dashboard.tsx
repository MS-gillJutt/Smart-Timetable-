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
              <label className="font-mono text-[10px] uppercase tracking-widest text-black/40">Select Timetable Source</label>
              {auth.currentUser && (
                <div className="flex gap-2">
                  <button 
                    onClick={() => setFilterMode('all')}
                    className={cn("font-mono text-[9px] uppercase tracking-widest px-2 py-1 transition-colors", filterMode === 'all' ? "bg-black text-white" : "text-black/40 hover:text-black")}
                  >
                    All
                  </button>
                  <button 
                    onClick={() => setFilterMode('mine')}
                    className={cn("font-mono text-[9px] uppercase tracking-widest px-2 py-1 transition-colors", filterMode === 'mine' ? "bg-black text-white" : "text-black/40 hover:text-black")}
                  >
                    Mine
                  </button>
                </div>
              )}
            </div>
            <div className="relative">
              <select 
                value={selectedTimetableId}
                onChange={(e) => setSelectedTimetableId(e.target.value)}
                className="w-full h-12 bg-white border border-[#141414] px-4 font-sans focus:outline-none appearance-none cursor-pointer"
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
          <label className="font-mono text-[10px] uppercase tracking-widest text-black/40">Class / Section</label>
          <div className="relative">
            <select 
              value={selectedClassName}
              onChange={(e) => setSelectedClassName(e.target.value)}
              className="w-full h-12 bg-white border border-[#141414] px-4 font-sans focus:outline-none appearance-none cursor-pointer"
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
            className="h-12 px-6 bg-[#141414] text-[#FAF9F6] font-mono text-xs uppercase tracking-widest hover:bg-black/90 transition-colors"
          >
            Update / Add
          </button>
          {selectedTimetableId && (
            <button 
              disabled={isDeleting}
              onClick={handleDelete}
              className="h-12 w-12 flex items-center justify-center border border-red-200 text-red-500 hover:bg-red-50 transition-colors"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </div>

    {!selectedTimetableId ? (
        <div className="text-center py-24 border-2 border-dashed border-black/10 rounded-3xl">
          <LayoutGrid className="w-12 h-12 mx-auto mb-4 opacity-10" />
          <h3 className="text-xl font-serif">No Timetable Selected</h3>
          <p className="text-sm text-black/40">Upload a schedule to get started</p>
        </div>
      ) : (
        <div className="space-y-12">
          {/* Metadata Bar */}
          <div className="flex flex-wrap gap-x-8 gap-y-4 p-6 bg-white border border-[#141414] shadow-[4px_4px_0px_0px_rgba(20,20,20,1)]">
            <div className="space-y-1">
              <span className="font-mono text-[9px] uppercase text-black/40">Uploaded By</span>
              <p className="font-sans text-sm font-medium">{selectedTimetable?.createdBy || 'Official'}</p>
            </div>
            <div className="space-y-1">
              <span className="font-mono text-[9px] uppercase text-black/40">Generated On</span>
              <p className="font-sans text-sm font-medium">
                {selectedTimetable?.createdAt?.toDate ? selectedTimetable.createdAt.toDate().toLocaleDateString() : 'Recently'}
              </p>
            </div>
            <div className="space-y-1">
              <span className="font-mono text-[9px] uppercase text-black/40">Today</span>
              <p className="font-sans text-sm font-bold text-blue-600">{currentDay}</p>
            </div>
          </div>

          {/* Toggle View */}
          <div className="flex justify-between items-center">
            <h2 className="text-3xl font-serif italic">Your Schedule</h2>
            <div className="flex border border-black bg-white">
              <button 
                onClick={() => setViewMode('daily')}
                className={cn("p-2 transition-colors", viewMode === 'daily' ? "bg-black text-white" : "hover:bg-black/5")}
              >
                <List className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setViewMode('grid')}
                className={cn("p-2 transition-colors", viewMode === 'grid' ? "bg-black text-white" : "hover:bg-black/5")}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {viewMode === 'daily' ? (
              <motion.div 
                key="daily"
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}
                className="space-y-4"
              >
                <h3 className="font-mono text-xs uppercase tracking-widest mb-6">Today's Lectures ({currentDay})</h3>
                {todayLectures.length === 0 ? (
                  <p className="py-12 text-center text-black/40 italic font-serif">No lectures scheduled for today. Enjoy your break!</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {todayLectures.map((lecture, i) => (
                      <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        key={lecture.id}
                        className="bg-white border border-[#141414] p-6 group hover:translate-x-1 hover:-translate-y-1 transition-transform"
                      >
                         <div className="flex justify-between items-start mb-6">
                            <div className="bg-[#141414] text-[#FAF9F6] px-3 py-1 font-mono text-[10px]">
                              SLOT {lecture.slotIndex}
                            </div>
                            <div className="flex items-center gap-2 text-black/40">
                              <Clock className="w-4 h-4" />
                              <span className="font-mono text-[10px]">{lecture.startTime} - {lecture.endTime}</span>
                            </div>
                         </div>
                         <h4 className="text-xl font-sans font-bold leading-tight mb-4 group-hover:text-blue-600 transition-colors">
                           {lecture.subject}
                         </h4>
                         <div className="space-y-2 pt-4 border-t border-black/5">
                            <div className="flex items-center gap-3 text-sm">
                              <User className="w-4 h-4 text-black/40" />
                              <span>{lecture.teacher}</span>
                            </div>
                            <div className="flex items-center gap-3 text-sm">
                              <MapPin className="w-4 h-4 text-black/40" />
                              <span className="font-medium">{lecture.room}</span>
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
                initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
                className="overflow-x-auto border border-[#141414]"
              >
                <table className="w-full text-left border-collapse bg-white">
                  <thead>
                    <tr className="bg-[#141414] text-[#FAF9F6]">
                      <th className="p-4 font-mono text-[10px] uppercase border border-[#141414]">Day / Slot</th>
                      {[...Array(12)].map((_, i) => (
                        <th key={i} className="p-4 font-mono text-[10px] uppercase border border-[#141414] text-center">{i + 1}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {DAYS.map(day => (
                      <tr key={day} className={cn(day === currentDay && "bg-blue-50/50")}>
                        <td className="p-4 font-sans font-bold text-sm border border-[#141414] bg-[#F5F5F5]">{day.slice(0,3)}</td>
                        {[...Array(12)].map((_, i) => {
                          const lect = filteredLectures.find(l => l.day === day && (l.slotIndex === i + 1));
                          return (
                            <td key={i} className="p-2 border border-black/10 min-w-[140px] align-top">
                              {lect ? (
                                <div className="text-[10px] leading-tight flex flex-col h-full justify-between">
                                  <div className="font-bold mb-1 line-clamp-2">{lect.subject}</div>
                                  <div className="text-black/60 italic">{lect.teacher}</div>
                                  <div className="mt-2 font-mono text-[9px] bg-black/5 p-1 rounded inline-block w-fit">{lect.room}</div>
                                </div>
                              ) : (
                                <div className="h-full min-h-[60px] opacity-10 flex items-center justify-center">
                                  <div className="w-2 h-2 rounded-full bg-black" />
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
