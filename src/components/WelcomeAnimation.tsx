import { motion } from 'motion/react';
import { useEffect, useState, useMemo } from 'react';

interface WelcomeAnimationProps {
  onComplete: () => void;
  famiName: string;
  userName: string;
}

export function WelcomeAnimation({ onComplete, famiName, userName }: WelcomeAnimationProps) {
  const [phase, setPhase] = useState<'falling' | 'ordering' | 'exit'>('falling');

  const words = useMemo(() => {
    return [
      { text: "Joie", color: "text-yellow-500", isBig: false, type: 'fruit' },
      { text: "Paix", color: "text-blue-400", isBig: false, type: 'fruit' },
      { text: "Amour", color: "text-rose-400", isBig: false, type: 'fruit' },
      { text: "Bienvenue", color: "text-gray-900", isBig: true, type: 'sentence' },
      { text: userName ? `${userName},` : '', color: "text-bloom-primary", isBig: true, type: 'sentence' },
      { text: "dans", color: "text-gray-600", isBig: false, type: 'sentence' },
      { text: famiName || "la FAMI", color: "text-bloom-secondary", isBig: true, type: 'sentence' },
      { text: "!", color: "text-bloom-primary", isBig: true, type: 'sentence' }
    ].filter(w => w.text !== ''); // filter out empty names if any
  }, [famiName, userName]);

  useEffect(() => {
    // Transition from falling randomly to ordering nicely
    const timer1 = setTimeout(() => {
      setPhase('ordering');
    }, 2500);

    // Zoom out / exit
    const timer2 = setTimeout(() => {
      setPhase('exit');
    }, 4500);

    // End animation
    const timer3 = setTimeout(() => {
      onComplete();
    }, 5000);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [onComplete]);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: phase === 'exit' ? 0 : 1 }}
      transition={{ duration: 0.5 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#FAFAFA]/95 backdrop-blur-md overflow-hidden"
    >
      <div className="relative w-full max-w-4xl h-[400px] flex flex-wrap items-center justify-center gap-x-4 gap-y-2 p-8">
        {words.map((word, i) => {
          // Random start positions far outside
          const randomX = (Math.random() - 0.5) * 1500;
          const randomY = (Math.random() - 0.5) * 1500;
          const randomRot = (Math.random() - 0.5) * 360;
          
          return (
            <motion.div
              key={i}
              initial={{ 
                x: randomX, 
                y: randomY, 
                rotate: randomRot,
                scale: 0,
                opacity: 0
              }}
              animate={
                phase === 'falling' 
                  ? {
                      x: (Math.random() - 0.5) * 300, // random bouncy clutter
                      y: (Math.random() - 0.5) * 300,
                      rotate: (Math.random() - 0.5) * 60,
                      scale: word.isBig ? 1.5 : 1.2,
                      opacity: 1
                    }
                  : phase === 'ordering' || phase === 'exit'
                  ? {
                      x: 0, // assemble together inline
                      y: word.type === 'fruit' ? -150 : 0, // push fruits out of the way or above
                      rotate: 0,
                      scale: word.type === 'fruit' ? 0 : (word.isBig ? 1.2 : 1), // hide fruits during sentence forming
                      opacity: word.type === 'fruit' ? 0 : 1
                    }
                  : {}
              }
              transition={
                phase === 'falling'
                  ? {
                      type: "spring",
                      stiffness: 80,
                      damping: 10,
                      delay: i * 0.15,
                      bounce: 0.6
                    }
                  : {
                      type: "spring",
                      stiffness: 150,
                      damping: 15,
                      delay: word.type === 'sentence' ? i * 0.1 : 0
                    }
              }
              className={`font-black ${word.color} ${word.isBig ? 'text-4xl md:text-6xl' : 'text-2xl md:text-4xl'} font-sans tracking-widest`}
              style={{
                textShadow: '0 4px 12px rgba(0,0,0,0.1)'
              }}
            >
              {word.text}
            </motion.div>
          );
        })}
      </div>
      
      {/* Decorative Blobs */}
      <motion.div 
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: [0, 1.2, 1], opacity: phase === 'exit' ? 0 : 0.15 }}
        transition={{ duration: 1, delay: 0.5 }}
        className="absolute top-10 left-10 w-64 h-64 bg-bloom-primary rounded-full mix-blend-multiply filter blur-3xl"
      />
      <motion.div 
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: [0, 1.2, 1], opacity: phase === 'exit' ? 0 : 0.15 }}
        transition={{ duration: 1, delay: 0.8 }}
        className="absolute bottom-10 right-10 w-64 h-64 bg-bloom-secondary rounded-full mix-blend-multiply filter blur-3xl"
      />
    </motion.div>
  );
}
