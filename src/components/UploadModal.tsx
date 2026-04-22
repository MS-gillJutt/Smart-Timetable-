import { useState, useCallback } from 'react';
import { useDropzone, FileRejection, DropEvent } from 'react-dropzone';
import { Upload, Loader2, X, AlertCircle, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { parseTimetable } from '../lib/gemini';
import { db, auth } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, writeBatch, doc } from 'firebase/firestore';
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

    if (!auth.currentUser) {
      setError('You must be signed in to upload a timetable.');
      setIsProcessing(false);
      return;
    }

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
      
      // Save to Firebase
      const timetableRef = await addDoc(collection(db, 'timetables'), {
        name: data.name,
        department: data.department,
        createdBy: data.createdBy,
        userId: auth.currentUser.uid,
        classes: data.classes,
        createdAt: serverTimestamp(),
      });

      const batch = writeBatch(db);
      data.lectures.forEach((lecture) => {
        const lectureRef = doc(collection(db, 'lectures'));
        batch.set(lectureRef, {
          ...lecture,
          timetableId: timetableRef.id,
        });
      });

      await batch.commit();
      setSuccess(true);
      setTimeout(() => {
        onSuccess();
        onClose();
        setSuccess(false);
      }, 1500);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to process timetable. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  }, [onClose, onSuccess]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png'],
      'application/pdf': ['.pdf']
    },
    multiple: false
  } as any);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-lg overflow-hidden bg-[#FAF9F6] border border-[#141414] shadow-[8px_8px_0px_0px_rgba(20,20,20,1)] p-8"
      >
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-1 transition-colors hover:bg-black/5"
        >
          <X className="w-6 h-6" />
        </button>

        <h2 className="text-3xl font-serif italic mb-2">New Timetable</h2>
        <p className="text-sm text-black/60 mb-8">
          Upload an image or PDF. Our AI will automatically extract classes, subjects, and rooms.
        </p>

        <div 
          {...getRootProps()} 
          className={cn(
            "relative group cursor-pointer border-2 border-dashed aspect-video flex flex-col items-center justify-center transition-all",
            isDragActive ? "border-black bg-black/5" : "border-black/20 hover:border-black/40",
            isProcessing && "pointer-events-none opacity-50"
          )}
        >
          <input {...getInputProps()} />
          
          <AnimatePresence mode="wait">
            {isProcessing ? (
              <motion.div 
                key="processing"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex flex-col items-center"
              >
                <Loader2 className="w-12 h-12 animate-spin mb-4" />
                <p className="font-mono text-xs uppercase tracking-widest">AI is reading file...</p>
              </motion.div>
            ) : success ? (
              <motion.div 
                key="success"
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="flex flex-col items-center text-green-600"
              >
                <CheckCircle2 className="w-12 h-12 mb-4" />
                <p className="font-mono text-xs uppercase tracking-widest font-bold">Successfully Stored!</p>
              </motion.div>
            ) : (
              <motion.div 
                key="idle"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex flex-col items-center text-center px-4"
              >
                <Upload className="w-12 h-12 mb-4 opacity-20 group-hover:opacity-100 transition-opacity" />
                <p className="font-sans font-medium mb-1">Click or drag & drop</p>
                <p className="text-xs text-black/40">PNG, JPG or PDF up to 10MB</p>
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
            className="px-6 py-2 font-mono text-xs uppercase tracking-widest hover:underline"
          >
            Cancel
          </button>
        </div>
      </motion.div>
    </div>
  );
}
