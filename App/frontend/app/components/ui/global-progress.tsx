import { useNavigation } from '@remix-run/react';
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';

export function GlobalProgress() {
  const navigation = useNavigation();
  const [progress, setProgress] = useState(0);
  
  const isNavigating = navigation.state !== 'idle';

  useEffect(() => {
    if (!isNavigating) {
      setProgress(100);
      return;
    }

    // Start with a small progress
    setProgress(15);

    // Simulate progress increasing while waiting
    const interval = setInterval(() => {
      setProgress((prev) => {
        // Slow down progress as it gets closer to 90%
        if (prev >= 90) return prev;
        const jump = Math.random() * 10;
        return Math.min(prev + jump, 90);
      });
    }, 300);

    return () => clearInterval(interval);
  }, [isNavigating]);

  return (
    <AnimatePresence>
      {(isNavigating || progress < 100) && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { delay: 0.3 } }}
          className="fixed top-0 left-0 right-0 z-[100] h-[3px] bg-accent/20"
        >
          <motion.div
            className="h-full bg-accent shadow-[0_0_10px_theme('colors.accent.DEFAULT')]"
            initial={{ width: '0%' }}
            animate={{ width: `${progress}%` }}
            transition={{ ease: 'easeOut', duration: 0.2 }}
            onAnimationComplete={() => {
              if (progress === 100) {
                setTimeout(() => setProgress(0), 400); // Reset after exit
              }
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
