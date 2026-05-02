import { Loader2 } from 'lucide-react';
import { motion } from 'motion/react';

export function FullScreenLoader() {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#FAFAFA] z-[100]">
      <motion.div
        animate={{ scale: [0.9, 1, 0.9], opacity: [0.5, 1, 0.5] }}
        transition={{ repeat: Infinity, duration: 2 }}
        className="mb-8"
      >
        <div className="w-16 h-16 bg-bloom-primary/10 rounded-3xl flex items-center justify-center animate-pulse">
          <Loader2 className="w-8 h-8 text-bloom-primary animate-spin" />
        </div>
      </motion.div>
      <h2 className="text-xl font-bold text-gray-900 tracking-tight">Chargement en cours</h2>
      <p className="text-gray-500 text-sm mt-2">Un instant s'il te plaît...</p>
    </div>
  );
}
