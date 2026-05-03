import { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { useNavigate } from 'react-router-dom';
import { db, handleFirestoreError, OperationType, auth } from '../lib/firebase';
import { collection, addDoc, getDocs, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { User, Users, ArrowRight, ArrowLeft } from 'lucide-react';
import { WelcomeAnimation } from '../components/WelcomeAnimation';

interface Fami {
  id: string;
  name: string;
  leaderId: string;
  createdAt: string;
}

export function Onboarding() {
  const { user, profile, updateProfile } = useAuth();
  const navigate = useNavigate();
  
  const [role, setRole] = useState<'leader' | 'member' | 'admin' | null>(null);
  const [birthDate, setBirthDate] = useState('');
  const [famiName, setFamiName] = useState('');
  const [adminCode, setAdminCode] = useState('');
  const [famiList, setFamiList] = useState<Fami[]>([]);
  const [selectedFamiId, setSelectedFamiId] = useState<string>('');
  const [loadingStep, setLoadingStep] = useState(false);
  const [showAnimation, setShowAnimation] = useState(false);

  useEffect(() => {
    // If they already have a role and we are NOT in the middle of completing setup, push them to dashboard
    if (profile?.role && !loadingStep && !showAnimation) {
      navigate('/dashboard');
      return;
    }
    // Fetch famis for member selection
    async function fetchFamis() {
      try {
        const querySnapshot = await getDocs(collection(db, 'famis'));
        const famisData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Fami[];
        setFamiList(famisData);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'famis');
      }
    }
    
    fetchFamis();
  }, [profile, navigate]);

  const handleComplete = async () => {
    if (!role || !birthDate) return;
    setLoadingStep(true);

    try {
      if (role === 'admin') {
        if (adminCode !== 'FAMI 2026') {
          alert('Code incorrect');
          setLoadingStep(false);
          return;
        }
        await updateProfile({ role: 'admin', birthDate });
      } else if (role === 'leader') {
        if (!famiName.trim() || !user) {
          setLoadingStep(false);
          return;
        }
        
        // 1. Create the user profile first as a leader
        await updateProfile({ role: 'leader', birthDate });

        // 2. Save the Fami collection document
        const newFamiRef = await addDoc(collection(db, 'famis'), {
          name: famiName,
          leaderId: user.uid,
          createdAt: serverTimestamp()
        });
        
        // 3. Update the user with the Fami ID
        await updateProfile({ famiId: newFamiRef.id });
      } else {
        if (!selectedFamiId) {
          setLoadingStep(false);
          return;
        }
        await updateProfile({ role: 'member', famiId: selectedFamiId, birthDate });
      }
      
      // Trigger welcome animation
      setShowAnimation(true);
    } catch (error: any) {
      console.error(error);
      setLoadingStep(false);
      // Let handleFirestoreError bubble up or handle gracefully if desired
    }
  };

  const handleAnimationComplete = () => {
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 bg-[#FAFAFA]">
      <AnimatePresence>
        {showAnimation && (
          <WelcomeAnimation 
            key="welcome-anim" 
            onComplete={handleAnimationComplete} 
            famiName={role === 'leader' ? famiName : role === 'admin' ? 'Bloom Admin' : (famiList.find(f => f.id === selectedFamiId)?.name || 'ta FAMI')}
            userName={profile?.name || user?.displayName || ''}
          />
        )}
      </AnimatePresence>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-panel rounded-3xl p-8 max-w-md w-full relative z-10"
      >
        {!role ? (
          <>
            <div className="flex items-center mb-6">
               <button 
                 onClick={() => auth.signOut()}
                 className="mr-3 w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors shrink-0"
                 title="Se déconnecter"
               >
                 <ArrowLeft className="w-5 h-5 text-gray-500" />
               </button>
               <h2 className="text-2xl font-bold text-center flex-1 pr-13">Bienvenue ! 👋</h2>
            </div>
            <div className="space-y-4">
              <p className="text-gray-500 mb-6 text-center">Dis-nous qui tu es pour commencer :</p>
            <button 
              onClick={() => setRole('leader')}
              className="w-full flex items-center p-4 rounded-xl border border-gray-200 hover:border-bloom-primary hover:bg-bloom-primary/5 transition-all text-left group"
            >
              <div className="w-12 h-12 rounded-full bg-bloom-primary/10 flex items-center justify-center mr-4 group-hover:bg-bloom-primary/20">
                <User className="w-6 h-6 text-bloom-primary" />
              </div>
              <div>
                <div className="font-semibold text-gray-900">Je suis Leader</div>
                <div className="text-sm text-gray-500">Je gère mon groupe FAMI</div>
              </div>
            </button>
            <button 
              onClick={() => setRole('member')}
              className="w-full flex items-center p-4 rounded-xl border border-gray-200 hover:border-bloom-secondary hover:bg-bloom-secondary/5 transition-all text-left group"
            >
              <div className="w-12 h-12 rounded-full bg-bloom-secondary/10 flex items-center justify-center mr-4 group-hover:bg-bloom-secondary/20">
                <Users className="w-6 h-6 text-bloom-secondary" />
              </div>
              <div>
                <div className="font-semibold text-gray-900">Je suis Membre</div>
                <div className="text-sm text-gray-500">Je rejoins mon groupe FAMI</div>
              </div>
            </button>

            <button 
              onClick={() => setRole('admin')}
              className="w-full flex items-center p-4 rounded-xl border border-gray-200 hover:border-gray-900 hover:bg-gray-100 transition-all text-left group mt-4"
            >
              <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mr-4 group-hover:bg-gray-200">
                <User className="w-6 h-6 text-gray-600" />
              </div>
              <div>
                <div className="font-semibold text-gray-900">Je suis Super Admin</div>
                <div className="text-sm text-gray-500">Gestion de toutes les FAMI</div>
              </div>
            </button>
          </div>
          </>
        ) : role === 'admin' ? (
          <div className="space-y-6">
            <div>
              <button onClick={() => setRole(null)} className="text-sm text-gray-400 mb-2 hover:text-gray-800">← Retour</button>
              <h3 className="font-semibold text-lg">Accès Super Admin</h3>
              <p className="text-sm text-gray-500">Veuillez entrer le code d'accès administrateur.</p>
            </div>
            <div>
              <input 
                type="password" 
                placeholder="Code d'accès" 
                value={adminCode}
                onChange={e => setAdminCode(e.target.value)}
                className="w-full p-4 rounded-xl border border-gray-200 focus:outline-none focus:border-gray-900 bg-white/50 mb-4"
              />
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">Date de naissance</label>
                <input 
                  type="date" 
                  value={birthDate}
                  onChange={e => setBirthDate(e.target.value)}
                  className="w-full p-4 rounded-xl border border-gray-200 focus:outline-none focus:border-gray-900 bg-white/50"
                  required
                />
              </div>
            </div>
            <button
              onClick={handleComplete}
              disabled={loadingStep || !adminCode || !birthDate}
              className="w-full py-4 rounded-xl bg-gray-900 text-white font-semibold flex items-center justify-center gap-2 hover:bg-gray-800 disabled:opacity-50"
            >
              {loadingStep ? 'Vérification...' : 'Accéder'} <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : role === 'leader' ? (
          <div className="space-y-6">
            <div>
              <button onClick={() => setRole(null)} className="text-sm text-gray-400 mb-2 hover:text-gray-800">← Retour</button>
              <h3 className="font-semibold text-lg">Créer ta FAMI</h3>
              <p className="text-sm text-gray-500">Donne un nom sympa à ton groupe de maison.</p>
            </div>
            <div>
              <input 
                type="text" 
                placeholder="Ex: FAMI Joya" 
                value={famiName}
                onChange={e => setFamiName(e.target.value)}
                className="w-full p-4 rounded-xl border border-gray-200 focus:outline-none focus:border-bloom-primary bg-white/50 mb-4"
              />
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">Date de naissance</label>
                <input 
                  type="date" 
                  value={birthDate}
                  onChange={e => setBirthDate(e.target.value)}
                  className="w-full p-4 rounded-xl border border-gray-200 focus:outline-none focus:border-bloom-primary bg-white/50"
                  required
                />
              </div>
            </div>
            <button
              onClick={handleComplete}
              disabled={loadingStep || !famiName || !birthDate}
              className="w-full py-4 rounded-xl bg-gray-900 text-white font-semibold flex items-center justify-center gap-2 hover:bg-gray-800 disabled:opacity-50"
            >
              {loadingStep ? 'Création...' : 'C\'est parti !'} <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
           <div className="space-y-6">
            <div>
              <button onClick={() => setRole(null)} className="text-sm text-gray-400 mb-2 hover:text-gray-800">← Retour</button>
              <h3 className="font-semibold text-lg">Rejoindre une FAMI</h3>
              <p className="text-sm text-gray-500">Choisis ton groupe dans la liste.</p>
            </div>
            <div>
              <select 
                value={selectedFamiId}
                onChange={e => setSelectedFamiId(e.target.value)}
                className="w-full p-4 rounded-xl border border-gray-200 focus:outline-none focus:border-bloom-secondary bg-white/50 mb-4"
              >
                <option value="">-- Sélectionne ta FAMI --</option>
                {famiList.map(f => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">Date de naissance</label>
                <input 
                  type="date" 
                  value={birthDate}
                  onChange={e => setBirthDate(e.target.value)}
                  className="w-full p-4 rounded-xl border border-gray-200 focus:outline-none focus:border-bloom-secondary bg-white/50"
                  required
                />
              </div>
            </div>
            <button
              onClick={handleComplete}
              disabled={loadingStep || !selectedFamiId || !birthDate}
              className="w-full py-4 rounded-xl bg-gray-900 text-white font-semibold flex items-center justify-center gap-2 hover:bg-gray-800 disabled:opacity-50"
            >
              {loadingStep ? 'Rejoindre...' : 'Rejoindre !'} <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
