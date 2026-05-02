import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { motion } from 'motion/react';
import { Flame, LogIn, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

export function Home() {
  const { user, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSigningIn, setIsSigningIn] = useState(false);

  const from = location.state?.from?.pathname || '/dashboard';

  useEffect(() => {
    if (user) {
      navigate(from, { replace: true });
    }
  }, [user, navigate, from]);

  const handleLogin = async () => {
    try {
      setIsSigningIn(true);
      await signIn();
    } catch(err) {
      setIsSigningIn(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center overflow-hidden bg-[#FAFAFA]">
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-bloom-primary/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-bloom-secondary/10 blur-[120px] pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-panel rounded-3xl p-8 md:p-12 max-w-md w-full mx-4 text-center z-10"
      >
        <div className="inline-flex items-center justify-center p-4 bg-bloom-primary/10 text-bloom-primary rounded-2xl mb-6">
          <Flame className="w-10 h-10" />
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 mb-2">
          Bloom <span className="text-transparent bg-clip-text bg-gradient-to-r from-bloom-primary to-bloom-secondary">FAMI</span>
        </h1>
        <p className="text-gray-500 mb-8">
          L'outil pour veiller les uns sur les autres, grandir ensemble et s'épanouir. 🤩
        </p>

        <button 
          onClick={handleLogin}
          disabled={isSigningIn}
          className="w-full py-4 px-6 rounded-2xl bg-gray-900 text-white font-semibold flex items-center justify-center gap-3 hover:bg-gray-800 transition-all hover:shadow-lg active:scale-95 disabled:opacity-75 disabled:pointer-events-none"
        >
          {isSigningIn ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogIn className="w-5 h-5" />}
          {isSigningIn ? 'Connexion...' : 'Se connecter avec Google'}
        </button>
      </motion.div>
    </div>
  );
}
