import { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, getDocs, doc, getDoc, setDoc, serverTimestamp, orderBy } from 'firebase/firestore';
import { LogOut, Loader2, Send, Video, FileText, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { FullScreenLoader } from '../components/Loader';
import { motion } from 'motion/react';

export function MemberDashboard() {
  const { user, profile, logOut } = useAuth();
  const navigate = useNavigate();
  const [famiName, setFamiName] = useState('');
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCall, setActiveCall] = useState<any>(null);
  const [responses, setResponses] = useState<Record<string, Record<string, string>>>({});
  const [vibe, setVibe] = useState('🤩 Au top !');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function loadData() {
      if (!profile?.famiId) return;
      try {
        const famiDoc = await getDoc(doc(db, 'famis', profile.famiId));
        if (famiDoc.exists()) {
          const data = famiDoc.data();
          setFamiName(data.name);
          setActiveCall(data.activeCall || null);
        }

        const activitiesQuery = query(
          collection(db, 'famis', profile.famiId, 'activities'),
          orderBy('createdAt', 'desc')
        );
        const activitiesSnap = await getDocs(activitiesQuery);
        setActivities(activitiesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `famis/${profile.famiId}`);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [profile?.famiId]);

  const submitResponse = async (activityId: string) => {
    if (!profile?.famiId || !user?.uid) return;
    setIsSubmitting(true);
    try {
      const respRef = doc(db, 'famis', profile.famiId, 'activities', activityId, 'responses', user.uid);
      await setDoc(respRef, {
        userId: user.uid,
        userName: profile.name,
        vibe: vibe,
        answers: responses[activityId] || {},
        submittedAt: serverTimestamp()
      }, { merge: true });
      toast.success('Réponse envoyée !', {
        description: "Merci pour ton partage cette semaine."
      });
    } catch (error) {
      toast.error("Erreur lors de l'envoi", {
        description: "Veuillez réessayer dans quelques instants."
      });
      handleFirestoreError(error, OperationType.CREATE, `responses/${user.uid}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <FullScreenLoader />;

  return (
    <div className="min-h-screen bg-[#FAFAFA] pb-20">
      <header className="bg-white border-b border-gray-100 p-4 sticky top-0 z-10 shadow-sm">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-bloom-primary/10 text-bloom-primary rounded-xl flex items-center justify-center font-bold">
              <User className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">Connecté(e) en tant que</p>
              <h1 className="font-display font-semibold text-gray-900">{profile?.name || 'Membre'}</h1>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {activeCall && (
              <button 
                onClick={() => navigate('/dashboard/call')}
                className="px-4 py-2 bg-bloom-primary text-white text-sm font-bold rounded-xl hover:bg-bloom-primary/90 flex items-center gap-2 transition-colors shadow-sm animate-pulse"
                title="Rejoindre l'appel FAMI"
              >
                <Video className="w-4 h-4" />
                <span className="hidden sm:inline">Rejoindre l'appel</span>
              </button>
            )}
            <button onClick={() => { logOut(); navigate('/'); }} className="p-2 text-gray-400 hover:text-red-500 bg-gray-50 hover:bg-red-50 rounded-xl transition-colors">
              <LogOut className="w-5 h-5" />
            </button>
          </div>

        </div>
      </header>

      <main className="max-w-3xl mx-auto p-4 md:p-6 mt-4">
        <div className="mb-8">
          <h2 className="text-2xl font-display font-bold text-gray-900">
            Bienvenue dans, <span className="text-bloom-primary">{famiName || 'ta FAMI'}</span> 👋
          </h2>
          <p className="text-gray-500 mt-2 text-sm md:text-base">
            Réponds aux activités de ton responsable et reste connecté avec le groupe.
          </p>
        </div>

         <div className="grid gap-6">
          {activities.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-16 px-4 bg-white border border-dashed border-gray-200 rounded-3xl shadow-sm"
            >
              <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Aucune activité en cours</h3>
              <p className="text-gray-500 max-w-sm mx-auto text-sm">
                Ton responsable n'a pas encore publié d'activité pour cette semaine. Reviens un peu plus tard !
              </p>
            </motion.div>
          ) : (
            activities.map((activity, itemIndex) => (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: itemIndex * 0.1 }}
                key={activity.id} 
                className="bg-white p-6 md:p-8 rounded-3xl border border-gray-100 shadow-sm space-y-8"
              >
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="px-3 py-1 bg-bloom-secondary/10 text-bloom-secondary text-xs font-bold rounded-lg uppercase tracking-wider">Activité de la semaine</span>
                  </div>
                  <h3 className="font-bold text-2xl mb-3 text-gray-900">{activity.title}</h3>
                  <p className="text-gray-600 leading-relaxed bg-gray-50 p-4 rounded-2xl text-sm md:text-base">{activity.content}</p>
                </div>
                
                <div className="space-y-8 pt-8 border-t border-gray-100">
                  <div className="space-y-4">
                    <label className="text-sm font-bold text-gray-700 uppercase tracking-wider">Mon état d'esprit cette semaine</label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                       {['🤩 Au top !', '🙏 Spirituelle', '😴 Fatigué(e)'].map(v => (
                         <button
                           key={v}
                           onClick={() => setVibe(v)}
                           className={`p-4 rounded-2xl border text-sm md:text-base font-semibold transition-all flex items-center justify-center gap-2 ${vibe === v ? 'bg-bloom-primary text-white border-bloom-primary shadow-md transform scale-[1.02]' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}
                         >
                           {v}
                         </button>
                       ))}
                    </div>
                  </div>

                  <div className="space-y-8">
                    {activity.questions?.map((q: any, qIdx: number) => (
                      <div key={q.id || `idx-${qIdx}`} className="space-y-4">
                        <label className="text-sm font-bold text-gray-800 block flex items-start gap-2">
                          <span className="text-bloom-primary mt-0.5">•</span>
                          {q.text}
                        </label>
                        {q.type === 'qcm' ? (
                          <div className="grid gap-3">
                            {q.options?.map((opt: string, index: number) => (
                              <button
                                key={`${opt}-${index}`}
                                onClick={() => setResponses({
                                  ...responses,
                                  [activity.id]: { ...(responses[activity.id] || {}), [q.id]: opt }
                                })}
                                className={`p-4 rounded-2xl border text-left text-sm md:text-base transition-all ${responses[activity.id]?.[q.id] === opt ? 'bg-bloom-secondary/10 border-bloom-secondary text-bloom-secondary font-medium ring-2 ring-bloom-secondary/20' : 'bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}
                              >
                                <div className="flex items-center gap-4">
                                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${responses[activity.id]?.[q.id] === opt ? 'border-bloom-secondary' : 'border-gray-300'}`}>
                                    {responses[activity.id]?.[q.id] === opt && <div className="w-2.5 h-2.5 rounded-full bg-bloom-secondary" />}
                                  </div>
                                  {opt}
                                </div>
                              </button>
                            ))}
                          </div>
                        ) : (
                          <textarea 
                            value={responses[activity.id]?.[q.id] || ''}
                            onChange={e => setResponses({
                              ...responses,
                              [activity.id]: { ...(responses[activity.id] || {}), [q.id]: e.target.value }
                            })}
                            placeholder="Partage tes pensées ici..."
                            className="w-full p-5 rounded-2xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-4 focus:ring-bloom-primary/10 focus:border-bloom-primary outline-none transition-all h-32 resize-none text-sm md:text-base"
                          />
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="pt-4 mt-8">
                    <button 
                      onClick={() => submitResponse(activity.id)}
                      disabled={isSubmitting}
                      className="w-full h-14 flex items-center justify-center gap-3 bg-gray-900 text-white rounded-2xl font-bold text-base hover:bg-gray-800 active:scale-[0.98] transition-all shadow-lg disabled:opacity-75 disabled:pointer-events-none"
                    >
                      {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                      {isSubmitting ? 'Envoi en cours...' : 'Envoyer mon rapport'}
                    </button>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
