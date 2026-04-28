import { useState, useCallback } from 'react';
import { useDropzone, FileRejection, DropEvent } from 'react-dropzone';
import { Upload, Loader2, X, AlertCircle, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { parseTimetable } from '../lib/gemini';
import { localDb } from '../lib/storage';
import { cn } from '../lib/utils';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function UploadModal({ isOpen, onClose, onSuccess }: UploadModalProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const onDrop = useCallback(async (acceptedFiles: File[], fileRejections: FileRejection[], event: DropEvent) => {
    if (isProcessing) return;
    const file = acceptedFiles[0];
    if (!file) {
      if (fileRejections.length > 0) {
         setError(fileRejections[0].errors[0].message);
      }
      return;
    }

    setIsProcessing(true);
    setError(null);
    setSuccess(false);

    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]);
        };
      });
      reader.readAsDataURL(file);
      const base64 = await base64Promise;

      const data = await parseTimetable(base64, file.type);
      
      const timetableId = 'local_' + Date.now() + Math.random().toString(36).substring(2, 9);
      
      // Save directly to localStorage
      localDb.saveTimetable({
        id: timetableId,
        name: data.name,
        department: data.department,
        createdBy: data.createdBy,
        classes: data.classes,
        createdAt: Date.now()
      });

      const processedLectures = data.lectures.map(lecture => ({
        ...lecture,
        id: 'lec_' + Date.now() + Math.random().toString(36).substring(2, 9),
        timetableId: timetableId,
      }));

      localDb.saveLectures(processedLectures);

      setSuccess(true);
      setTimeout(() => {
        onSuccess();
        onClose();
        setSuccess(false);
      }, 1500);
    } catch (err: any) {
      console.error(err);
      if (err.message === "NOT_TIMETABLE") {
        setError("The uploaded file does not appear to be a timetable. Please upload a valid timetable image or document.");
      } else {
        setError(err.message || 'Failed to process timetable. Please try again.');
      }
    } finally {
      setIsProcessing(false);
    }
  }, [onClose, onSuccess]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png'],
      'application/pdf': ['.pdf'],
      'application/vnd.ms-powerpoint': ['.ppt'],
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx']
    },
    maxSize: 10 * 1024 * 1024, // 10MB limit
    multiple: false
  } as any);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-lg overflow-hidden bg-white border border-slate-200 shadow-xl p-8 rounded-2xl"
      >
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-1 transition-colors text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
        >
          <X className="w-6 h-6" />
        </button>

        <h2 className="text-3xl font-display mb-2 font-bold text-slate-900">New Timetable</h2>
        <p className="text-sm font-medium text-slate-500 mb-8">
          Upload an image or PDF. Our AI will automatically extract classes, subjects, and rooms.
        </p>

          <div 
            {...getRootProps()} 
            className={cn(
              "relative group cursor-pointer border-2 border-dashed aspect-video flex flex-col items-center justify-center transition-all rounded-xl",
              isDragActive ? "border-blue-500 bg-amber-50" : "border-slate-300 hover:border-blue-400",
              isProcessing && "pointer-events-none opacity-50"
            )}
          >
          <input {...getInputProps()} />
          
          
          <AnimatePresence mode="wait">
            {isProcessing ? (
              <motion.div 
                key="processing"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex flex-col items-center text-slate-900"
              >
                <Loader2 className="w-12 h-12 animate-spin mb-4" />
                <p className="font-mono font-bold text-xs uppercase tracking-widest text-slate-500">AI is reading file...</p>
              </motion.div>
            ) : success ? (
              <motion.div 
                key="success"
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="flex flex-col items-center text-blue-600"
              >
                <CheckCircle2 className="w-12 h-12 mb-4" />
                <p className="font-mono font-bold text-xs uppercase tracking-widest text-blue-700">Successfully Stored!</p>
              </motion.div>
            ) : (
              <motion.div 
                key="idle"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex flex-col items-center text-center px-4"
              >
                <Upload className="w-12 h-12 mb-4 opacity-50 text-slate-400 group-hover:text-blue-600 group-hover:opacity-100 transition-colors" />
                <p className="font-sans font-bold text-slate-900 mb-1">Click or drop file</p>
                <p className="text-xs font-medium text-slate-500">PNG, JPG, PDF or PPT up to 10MB</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {error && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="mt-6 p-4 bg-red-50 border border-red-200 flex items-start gap-3"
          >
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <p className="text-sm text-red-800">{error}</p>
          </motion.div>
        )}

        <div className="mt-8 flex justify-end gap-4">
          <button 
            disabled={isProcessing}
            onClick={onClose}
            className="px-6 py-2 font-mono font-bold text-xs uppercase text-slate-500 tracking-widest hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      </motion.div>
    </div>
  );
}
