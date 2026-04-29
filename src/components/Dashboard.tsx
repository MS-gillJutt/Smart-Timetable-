import { useState, useEffect, ChangeEvent } from 'react';
import { Calendar, Clock, MapPin, User, Search, Trash2, AlertTriangle, ChevronRight, LayoutGrid, List, X } from 'lucide-react';
import { db, auth } from '../lib/firebase';
import { collection, query, where, getDocs, onSnapshot, orderBy, deleteDoc, doc, writeBatch } from 'firebase/firestore';
import { Timetable, Lecture, DAYS } from '../types';
import { cn, getCurrentDay, getFormattedDateForDay } from '../lib/utils';
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
  const [selectedDay, setSelectedDay] = useState<string>(getCurrentDay());
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const currentDay = getCurrentDay();

  // Time tracking for highlighting
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

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

  const initiateDelete = () => {
    console.log("Delete button clicked. Selected ID:", selectedTimetableId);
    
    if (!selectedTimetableId) {
      alert("Please select a timetable first.");
      return;
    }

    if (!auth.currentUser) {
      alert("You must be signed in to delete.");
      return;
    }

    const currentEmail = auth.currentUser.email;
    const currentUid = auth.currentUser.uid;
    const isAdmin = currentEmail === 'aligilljutt150@gmail.com';
    
    const targetTimetable = timetables.find(t => t.id === selectedTimetableId);
    
    if (!targetTimetable) {
      if (!isAdmin) {
        alert("Timetable metadata not found. Please refresh.");
        return;
      }
    }

    const isOwner = targetTimetable?.userId === currentUid;
    const wasCreatedByAdmin = targetTimetable?.creatorEmail === 'aligilljutt150@gmail.com';

    // Permission logic: Admin deletes all. Users delete their own non-admin-created ones.
    if (!isAdmin && (!isOwner || wasCreatedByAdmin)) {
      alert("Permission Denied: You cannot delete this timetable.");
      return;
    }

    setShowDeleteConfirm(true);
  };

  const executeDelete = async () => {
    console.log("executeDelete initiated for ID:", selectedTimetableId);
    setShowDeleteConfirm(false);
    setIsDeleting(true);
    
    try {
      const batch = writeBatch(db);
      
      console.log("Querying lectures for deletion...");
      const lecturesQ = query(collection(db, 'lectures'), where('timetableId', '==', selectedTimetableId));
      const lecturesSnap = await getDocs(lecturesQ);
      
      console.log(`Found ${lecturesSnap.size} lectures to delete.`);
      
      lecturesSnap.forEach(d => {
        batch.delete(doc(db, 'lectures', d.id));
      });
      
      batch.delete(doc(db, 'timetables', selectedTimetableId));
      
      console.log("Committing batch delete...");
      await batch.commit();
      
      setSelectedTimetableId('');
      setSelectedClassName('');
      setLectures([]);
      alert("Timetable deleted successfully.");
    } catch (err: any) {
      console.error("Critical delete error:", err);
      alert(`Delete operation failed: ${err.message || "Please check your connection and try again."}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleTimetableChange = (e: ChangeEvent<HTMLSelectElement>) => {
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
    const query = searchQuery.toLowerCase();
    const dept = t.department.toLowerCase();
    const name = t.name.toLowerCase();
    
    // Better matching: prioritizes startsWith
    const matchesSearch = dept.includes(query) || name.includes(query) || 
                          dept.startsWith(query) || name.startsWith(query);
                          
    if (filterMode === 'mine') {
      return matchesSearch && auth.currentUser && t.userId === auth.currentUser.uid;
    }
    return matchesSearch;
  }).sort((a,b) => {
    // Sort logic: exact matches first, then startsWith, then includes
    const aDept = a.department.toLowerCase();
    const bDept = b.department.toLowerCase();
    const aName = a.name.toLowerCase();
    const bName = b.name.toLowerCase();
    const query = searchQuery.toLowerCase();

    if (query === '') return 0;

    const aExact = aDept === query || aName === query;
    const bExact = bDept === query || bName === query;
    if (aExact && !bExact) return -1;
    if (!aExact && bExact) return 1;

    const aStarts = aDept.startsWith(query) || aName.startsWith(query);
    const bStarts = bDept.startsWith(query) || bName.startsWith(query);
    if (aStarts && !bStarts) return -1;
    if (!aStarts && bStarts) return 1;

    return 0;
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
    if (status === 'CURRENT') return 'bg-emerald-50 border-2 border-emerald-500 ring-4 ring-emerald-100 shadow-lg scale-[1.02] z-10';
    if (status === 'UPCOMING') return 'bg-amber-50/50 border-2 border-amber-400 shadow-sm';
    if (status === 'PAST') return 'bg-slate-50 border-2 border-red-300 opacity-70 grayscale-[0.2]';
    return 'bg-white border-2 border-slate-100 hover:shadow-md hover:border-teal-200';
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
      {/* Real-time Digital Clock Section */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 p-6 bg-slate-900 text-white rounded-[2rem] shadow-xl overflow-hidden relative group border border-slate-800 max-w-2xl mx-auto"
      >
        <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
          <Clock className="w-32 h-32 rotate-12" />
        </div>
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-center gap-6">
          <div className="flex flex-col items-center md:items-start">
            <span className="text-[10px] font-mono font-black uppercase tracking-[0.3em] text-teal-400 mb-1">Live System Time</span>
            <div className="text-4xl md:text-6xl font-mono font-black tracking-tighter tabular-nums flex items-baseline">
              {currentTime.toLocaleTimeString([], { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' }).split(' ')[0]}
              <span className="text-lg md:text-2xl ml-2 text-teal-500">
                {currentTime.toLocaleTimeString([], { hour12: true }).split(' ')[1]}
              </span>
            </div>
          </div>
          
          <div className="flex flex-col items-center md:items-start pt-4 md:pt-0 border-t md:border-t-0 md:border-l border-white/10 md:pl-8">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-mono font-bold uppercase tracking-widest text-white/50">{currentDay}</span>
            </div>
            <span className="text-xl md:text-2xl font-display font-black text-white leading-none">
              {currentTime.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
        </div>
      </motion.div>

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
                    className={cn("font-mono font-bold text-[9px] uppercase tracking-widest px-2 py-1 transition-colors rounded", filterMode === 'all' ? "bg-teal-700 text-white" : "text-slate-500 hover:text-teal-700 hover:bg-teal-50")}
                  >
                    All
                  </button>
                  <button 
                    onClick={() => setFilterMode('mine')}
                    className={cn("font-mono font-bold text-[9px] uppercase tracking-widest px-2 py-1 transition-colors rounded", filterMode === 'mine' ? "bg-teal-700 text-white" : "text-slate-500 hover:text-teal-700 hover:bg-teal-50")}
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
              {selectedTimetable?.classes?.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 rotate-90 w-4 h-4 pointer-events-none" />
          </div>
        </div>

        <div className="flex gap-2">
          <button 
            onClick={onAddClick}
            className="h-12 px-6 bg-teal-700 text-white font-mono font-bold text-xs uppercase tracking-widest hover:bg-teal-600 transition-colors rounded-lg shadow-sm whitespace-nowrap"
          >
            Upload
          </button>
          {selectedTimetableId && auth.currentUser && (auth.currentUser.email === 'aligilljutt150@gmail.com' || (selectedTimetable?.userId === auth.currentUser.uid && selectedTimetable?.creatorEmail !== 'aligilljutt150@gmail.com')) && (
            <button 
              disabled={isDeleting}
              onClick={initiateDelete}
              className="h-12 w-12 flex items-center justify-center border border-red-200 text-red-500 hover:bg-red-50 transition-colors rounded-lg"
              title="Delete Timetable"
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

            <div className="flex justify-between items-center">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <h2 className="text-3xl font-display font-bold text-slate-900">Your Schedule</h2>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono font-bold uppercase text-slate-400">View Day:</span>
                  <select 
                    value={selectedDay}
                    onChange={(e) => setSelectedDay(e.target.value)}
                    className="bg-white border border-slate-200 text-sm font-bold text-teal-700 px-3 py-1 rounded-md shadow-sm outline-none focus:ring-1 focus:ring-teal-500"
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
                              <div>
                                <div className={cn(
                                  "text-lg sm:text-2xl font-mono font-black tracking-tight leading-none",
                                  status === 'CURRENT' ? "text-emerald-700" :
                                  status === 'UPCOMING' ? "text-amber-800" :
                                  status === 'PAST' ? "text-red-700" : "text-slate-800"
                                )}>
                                  {lecture.startTime} <span className={cn("text-sm font-semibold mx-1", status === 'CURRENT' ? "text-emerald-600" : "text-slate-400")}>to</span> {lecture.endTime}
                                </div>
                                <div className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 mt-2">
                                  <Calendar className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
                                  {lecture.day} • {getFormattedDateForDay(lecture.day)}
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-2">
                                <div className={cn(
                                  "px-3 py-1 font-mono font-bold rounded-md text-[10px] border whitespace-nowrap",
                                  status === 'CURRENT' ? "bg-emerald-100 text-emerald-800 border-emerald-200" :
                                  status === 'UPCOMING' ? "bg-amber-100 text-amber-900 border-amber-200" :
                                  status === 'PAST' ? "bg-red-100 text-red-900 border-red-200" :
                                  "bg-slate-100 text-slate-600 border-slate-200"
                                )}>
                                  SLOT {lecture.slotIndex}
                                </div>
                              </div>
                           </div>
                           <h4 className={cn(
                             "text-xl font-display font-bold leading-tight mb-4 transition-colors",
                             status === 'CURRENT' ? "text-emerald-900" :
                             status === 'PAST' ? "text-red-900" : "text-slate-900 group-hover:text-teal-700"
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
                      <tr key={day} className={cn("transition-colors", day === selectedDay ? "bg-teal-50/50" : (day === currentDay ? "bg-slate-50/80" : "hover:bg-slate-50/50"))}>
                        <td className={cn("p-4 font-sans font-bold text-sm border-r border-b border-slate-200 text-slate-900", day === selectedDay ? "bg-teal-600 text-white" : "bg-slate-50")}>{day.slice(0,3)}</td>
                        {[...Array(12)].map((_, i) => {
                          const lect = filteredLectures.find(l => l.day === day && (l.slotIndex === i + 1));
                          return (
                            <td key={i} className="p-2 border-r border-b border-slate-100 min-w-[140px] align-top bg-white group/cell">
                              {lect ? (
                                <div className="text-[10px] leading-tight flex flex-col h-full justify-between p-1.5 rounded bg-white relative">
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
      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-white p-8 rounded-2xl shadow-2xl border border-slate-200"
            >
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-6 mx-auto">
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-2xl font-display font-bold text-slate-900 text-center mb-2">Delete Timetable?</h3>
              <p className="text-slate-500 text-center mb-8">This will permanently remove "{selectedTimetable?.name}" and all its lecture slots. This action cannot be undone.</p>
              
              <div className="flex flex-col sm:flex-row gap-3">
                <button 
                  onClick={executeDelete}
                  disabled={isDeleting}
                  className="flex-1 h-12 bg-red-600 text-white font-mono font-bold text-[10px] uppercase tracking-widest rounded-xl hover:bg-red-700 transition-colors shadow-lg shadow-red-200 flex items-center justify-center gap-2 px-4"
                >
                  {isDeleting ? (
                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : <Trash2 className="w-4 h-4" />}
                  Confirm Delete
                </button>
                <button 
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                  className="flex-1 h-12 bg-slate-100 text-slate-600 font-mono font-bold text-[10px] uppercase tracking-widest rounded-xl hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
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
