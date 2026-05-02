import { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, getDocs, addDoc, doc, getDoc, updateDoc, deleteDoc, serverTimestamp, orderBy, where } from 'firebase/firestore';
import { motion } from 'motion/react';
import { Plus, Users, FileText, LogOut, Loader2, Trash2, Heart, AlertCircle, Calendar, Video, Link as LinkIcon, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { FullScreenLoader } from '../components/Loader';

export function LeaderDashboard() {
  const { user, profile, logOut } = useAuth();
  const navigate = useNavigate();
  const [famiName, setFamiName] = useState('');
  const [activities, setActivities] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [totalMembers, setTotalMembers] = useState(0);
  const [latestStats, setLatestStats] = useState({ responses: 0, criticalVibes: 0 });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCallModal, setShowCallModal] = useState(false);
  const [callName, setCallName] = useState('');
  const [isStartingCall, setIsStartingCall] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [globalRemark, setGlobalRemark] = useState('');
  const [activeCallDetails, setActiveCallDetails] = useState<any>(null);
  const [absenceNotes, setAbsenceNotes] = useState<Record<string, string>>({});
  const [newQuestions, setNewQuestions] = useState<any[]>([
    { id: '1', type: 'text', text: 'Comment s\'est passée ta semaine ?' }
  ]);

  const addQuestion = (type: 'text' | 'qcm') => {
    setNewQuestions([...newQuestions, { 
      id: Math.random().toString(36).substring(2, 9), 
      type, 
      text: '', 
      options: type === 'qcm' ? ['', ''] : undefined 
    }]);
  };

  const removeQuestion = (id: string) => {
    setNewQuestions(newQuestions.filter(q => q.id !== id));
  };

  const updateQuestion = (id: string, updates: any) => {
    setNewQuestions(newQuestions.map(q => q.id === id ? { ...q, ...updates } : q));
  };

  useEffect(() => {
    async function loadData() {
      if (!profile?.famiId) return;
      try {
        const famiDoc = await getDoc(doc(db, 'famis', profile.famiId));
        if (famiDoc.exists()) {
          const data = famiDoc.data();
          setFamiName(data.name);
          setActiveCallDetails(data.activeCall || null);
        }

        const membersSnap = await getDocs(query(collection(db, 'users'), where('famiId', '==', profile.famiId)));
        const loadedMembers = membersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setMembers(loadedMembers);
        setTotalMembers(loadedMembers.length);

        const activitiesQuery = query(
          collection(db, 'famis', profile.famiId, 'activities'),
          orderBy('createdAt', 'desc')
        );
        const activitiesSnap = await getDocs(activitiesQuery);
        const loadedActivities = activitiesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setActivities(loadedActivities);

        if (loadedActivities.length > 0) {
          const respSnap = await getDocs(collection(db, 'famis', profile.famiId, 'activities', loadedActivities[0].id, 'responses'));
          const responses = respSnap.docs.map(d => d.data());
          setLatestStats({
            responses: responses.length,
            criticalVibes: responses.filter((r: any) => r.vibe?.includes('Fatigué')).length
          });
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `famis/${profile.famiId}`);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [profile?.famiId]);

  const handleCreateActivity = async () => {
    if (!newTitle || !profile?.famiId) return;
    setIsSubmitting(true);
    try {
      const docRef = await addDoc(collection(db, 'famis', profile.famiId, 'activities'), {
        title: newTitle,
        content: newContent,
        questions: newQuestions,
        date: new Date().toISOString(),
        createdAt: serverTimestamp()
      });
      setActivities([...activities, { id: docRef.id, title: newTitle, content: newContent }]);
      setShowCreate(false);
      setNewTitle('');
      setNewContent('');
      setNewQuestions([{ id: '1', type: 'text', text: 'Comment s\'est passée ta semaine ?' }]);
      toast.success('Activité créée avec succès', {
        description: 'Les membres peuvent maintenant répondre à cette activité.'
      });
    } catch (error) {
      toast.error('Erreur lors de la création de l\'activité');
      handleFirestoreError(error, OperationType.CREATE, `famis/${profile?.famiId}/activities`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const removeMember = async (memberId: string, memberName: string) => {
    if (!window.confirm(`Êtes-vous sûr de vouloir retirer ${memberName || 'ce membre'} de la FAMI ?`)) return;
    try {
      await updateDoc(doc(db, 'users', memberId), { famiId: "" });
      setMembers(members.filter(m => m.id !== memberId));
      setTotalMembers(prev => prev - 1);
      toast.info('Membre retiré', {
        description: `${memberName || 'Le membre'} a bien été retiré de votre FAMI.`
      });
    } catch (error) {
      toast.error('Erreur lors de la suppression du membre');
      handleFirestoreError(error, OperationType.UPDATE, `users/${memberId}`);
    }
  };

  const handleDeleteActivity = async (activityId: string, activityTitle: string) => {
    if (!profile?.famiId) return;
    if (!window.confirm(`Êtes-vous sûr de vouloir supprimer l'activité "${activityTitle}" ?`)) return;
    try {
      await deleteDoc(doc(db, 'famis', profile.famiId, 'activities', activityId));
      setActivities(activities.filter(a => a.id !== activityId));
      toast.info('Activité supprimée');
    } catch (error) {
      toast.error('Erreur lors de la suppression de l\'activité');
      handleFirestoreError(error, OperationType.DELETE, `famis/${profile?.famiId}/activities/${activityId}`);
    }
  };

  const copyCallLink = async () => {
    // Si on veut juste copier le lien sans lancer l'appel, c'est compliqué car la room n'existe pas forcément.
    // On peut copier le lien générique qui renverra vers "Aucun appel en cours" si non lancé.
    const callUrl = `${window.location.origin}/dashboard/call`;
    navigator.clipboard.writeText(callUrl);
    toast.success('Lien copié !', {
      description: 'Le lien pointera vers votre espace d\'appel.'
    });
  };

  const handleStartCall = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!callName.trim() || !profile?.famiId) return;
    
    setIsStartingCall(true);
    try {
      const roomSlug = callName.trim().replace(/\s+/g, '-').toLowerCase().replace(/[^a-z0-9-]/g, '');
      const roomId = `fami-${profile.famiId}-${roomSlug}-${Date.now()}`;
      
      await updateDoc(doc(db, 'famis', profile.famiId), {
        activeCall: {
          id: roomId,
          name: callName.trim(),
          updatedAt: serverTimestamp()
        }
      });

      await addDoc(collection(db, 'famis', profile.famiId, 'calls'), {
        id: roomId,
        name: callName.trim(),
        date: new Date().toISOString(),
        createdAt: serverTimestamp()
      });
      
      setShowCallModal(false);
      navigate(`/dashboard/call?room=${encodeURIComponent(roomId)}&name=${encodeURIComponent(callName.trim())}`);
    } catch (error) {
      toast.error("Erreur lors du lancement de l'appel");
      handleFirestoreError(error, OperationType.UPDATE, `famis/${profile.famiId}`);
    } finally {
      setIsStartingCall(false);
    }
  };

  const handleEndCall = async () => {
    if (!profile?.famiId) return;
    if (!window.confirm("Êtes-vous sûr de vouloir clôturer l'appel en cours ?")) return;
    
    try {
      // Pour Firestore on doit enlever la clé activeCall, updateDoc avec la suppression dépend de field delete
      const { deleteField } = await import('firebase/firestore');
      await updateDoc(doc(db, 'famis', profile.famiId), {
        activeCall: deleteField()
      });
      setActiveCallDetails(null);
      toast.success("Appel clôturé");
    } catch (error) {
      toast.error("Erreur lors de la clôture de l'appel");
      handleFirestoreError(error, OperationType.UPDATE, `famis/${profile.famiId}`);
    }
  };

  if (loading) return <FullScreenLoader />;

  return (
    <div className="min-h-screen bg-[#FAFAFA] pb-20">
      <header className="bg-white border-b border-gray-100 p-4 sticky top-0 z-10 shadow-sm">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-bloom-primary/10 rounded-xl flex items-center justify-center text-bloom-primary font-bold">
              L
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">Connecté en tant que leader</p>
              <h1 className="font-display font-semibold text-gray-900">{profile?.name || 'Responsable'}</h1>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={copyCallLink}
              className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-bold rounded-xl hover:bg-gray-200 flex items-center gap-2 transition-colors shadow-sm"
              title="Copier le lien d'invitation"
            >
              <LinkIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Inviter</span>
            </button>
            {activeCallDetails ? (
              <>
                <button 
                  onClick={() => handleEndCall()}
                  className="px-4 py-2 bg-red-100 text-red-600 text-sm font-bold rounded-xl hover:bg-red-200 flex items-center gap-2 transition-colors shadow-sm"
                  title="Clôturer l'appel"
                >
                  <X className="w-4 h-4" />
                  <span className="hidden sm:inline">Clôturer l'appel</span>
                </button>
                <button 
                  onClick={() => navigate('/dashboard/call')}
                  className="px-4 py-2 bg-bloom-primary text-white text-sm font-bold rounded-xl hover:bg-bloom-primary/90 flex items-center gap-2 transition-colors shadow-sm animate-pulse"
                  title="Rejoindre l'appel en cours"
                >
                  <Video className="w-4 h-4" />
                  <span className="hidden sm:inline">Rejoindre l'appel</span>
                </button>
              </>
            ) : (
              <button 
                onClick={() => setShowCallModal(true)}
                className="px-4 py-2 bg-bloom-primary text-white text-sm font-bold rounded-xl hover:bg-bloom-primary/90 flex items-center gap-2 transition-colors shadow-sm"
                title="Lancer l'appel FAMI"
              >
                <Video className="w-4 h-4" />
                <span className="hidden sm:inline">Appel vidéo</span>
              </button>
            )}
            <button onClick={() => { logOut(); navigate('/'); }} className="p-2 text-gray-400 hover:text-red-500 bg-gray-50 hover:bg-red-50 rounded-xl transition-colors">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 md:p-6 mt-4">
        {/* 🔖 Statistiques globales Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12 text-left">
          <motion.div 
            whileHover={{ y: -4 }}
            className="glass-panel p-6 rounded-3xl border border-gray-100 flex items-start gap-4 shadow-sm"
          >
            <div className="w-12 h-12 bg-bloom-primary/10 rounded-2xl flex items-center justify-center text-bloom-primary shrink-0">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Ma FAMI</p>
              <h3 className="text-xl font-bold text-gray-900">{famiName || 'Active'}</h3>
              <p className="text-sm text-gray-500">{totalMembers} membres inscrits</p>
            </div>
          </motion.div>

          <motion.div 
            whileHover={{ y: -4 }}
            className="glass-panel p-6 rounded-3xl border border-gray-100 flex items-start gap-4 shadow-sm"
          >
            <div className="w-12 h-12 bg-bloom-secondary/10 rounded-2xl flex items-center justify-center text-bloom-secondary shrink-0">
              <Heart className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Participation</p>
              <h3 className="text-xl font-bold text-gray-900">
                {totalMembers > 0 ? Math.round((latestStats.responses / totalMembers) * 100) : 0}%
              </h3>
              <p className="text-sm text-gray-500">{latestStats.responses} rapports cette semaine</p>
            </div>
          </motion.div>

          <motion.div 
            whileHover={{ y: -4 }}
            className="glass-panel p-6 rounded-3xl border border-gray-100 flex items-start gap-4 shadow-sm"
          >
            <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center text-red-500 shrink-0">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Alertes & Besoins</p>
              <h3 className="text-xl font-bold text-gray-900">{latestStats.criticalVibes} Alerte(s)</h3>
              <p className="text-sm text-gray-500">Membres en difficulté</p>
            </div>
          </motion.div>
        </div>

        {activities.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-12 p-8 bg-gray-900 rounded-[2rem] text-white overflow-hidden relative group cursor-pointer shadow-xl hover:shadow-2xl transition-all"
            onClick={() => setShowReportModal(true)}
          >
            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 bg-bloom-primary/20 text-bloom-primary px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest mb-4">
                Disponible maintenant
              </div>
              <h2 className="text-3xl font-bold mb-2">Rapport Hebdomadaire Global</h2>
              <p className="text-gray-400 mb-8 max-w-md text-lg">
                Fournissez vos remarques et motifs d'absence pour générer le document officiel de la FAMI.
              </p>
              <button 
                className="flex items-center gap-2 bg-bloom-primary hover:bg-bloom-primary/90 text-white px-8 py-4 rounded-2xl font-bold transition-all shadow-lg active:scale-95"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowReportModal(true);
                }}
              >
                <FileText className="w-5 h-5" /> Préparer le Rapport
              </button>
            </div>
            <div className="absolute -right-10 -bottom-10 opacity-10 group-hover:scale-110 transition-transform duration-700">
               <FileText className="w-80 h-80" />
            </div>
            <div className="absolute top-0 right-0 w-64 h-64 bg-bloom-primary/20 blur-[120px] -z-10 rounded-full" />
          </motion.div>
        )}

        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Membres de la FAMI</h2>
            <p className="text-gray-500 text-sm">Liste des membres rattachés à votre groupe</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
          {members.map(member => (
            <motion.div 
              key={member.id} 
              whileHover={{ scale: 1.02 }}
              className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3"
            >
              <div className="w-10 h-10 bg-bloom-primary/10 rounded-xl flex items-center justify-center text-bloom-primary font-bold">
                {member.name?.charAt(0) || '?'}
              </div>
              <div className="text-left flex-1">
                <h4 className="font-semibold text-gray-900 text-sm">{member.name}</h4>
                <div className="flex items-center gap-2">
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                    {member.role === 'leader' ? 'Responsable' : 'Membre'}
                  </p>
                  {member.birthDate && (
                    <span className="text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-medium">
                      🎂 {new Date(member.birthDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                    </span>
                  )}
                </div>
              </div>
              {member.id !== user?.uid && (
                <button 
                  onClick={() => removeMember(member.id, member.name)}
                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  aria-label="Remove member"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </motion.div>
          ))}
        </div>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Suivi hebdomadaire</h2>
            <p className="text-gray-500 text-sm">Gère les rapports et l'état spirituel du groupe</p>
          </div>
          <button 
            onClick={() => setShowCreate(!showCreate)}
            className="flex items-center gap-2 bg-gray-900 text-white px-6 py-3 rounded-2xl font-bold shadow-lg hover:scale-[1.02] active:scale-95 transition-all"
          >
           <Plus className="w-5 h-5" /> Nouvelle activité
          </button>
        </div>

        {showCreate && (
           <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-panel rounded-2xl p-6 mb-8 text-left"
          >
            <h3 className="text-lg font-semibold mb-4 text-gray-900">Créer une activité interactive</h3>
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Titre</label>
                <input 
                  type="text" 
                  placeholder="Ex: Semaine de la Fraternité" 
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  className="w-full p-3 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-bloom-primary/20"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Message d'introduction</label>
                <textarea 
                  placeholder="Écris un petit mot pour encourager ton groupe..." 
                  value={newContent}
                  onChange={e => setNewContent(e.target.value)}
                  className="w-full p-3 rounded-xl border border-gray-200 h-24 outline-none focus:ring-2 focus:ring-bloom-primary/20"
                />
              </div>

              <div className="space-y-4 pt-4 border-t border-gray-100">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-gray-900">Questions du rapport</h4>
                </div>
                
                <div className="space-y-4">
                  {newQuestions.map((q, idx) => (
                    <div key={q.id} className="p-4 bg-gray-50 rounded-xl space-y-3 relative group">
                      <button 
                        onClick={() => removeQuestion(q.id)}
                        className="absolute top-2 right-2 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-white border border-gray-200 flex items-center justify-center text-xs font-bold text-gray-400">
                          {idx + 1}
                        </span>
                        <input 
                          type="text"
                          placeholder="Ta question..."
                          value={q.text}
                          onChange={e => updateQuestion(q.id, { text: e.target.value })}
                          className="flex-1 bg-transparent border-none font-medium text-gray-800 placeholder:text-gray-400 focus:ring-0"
                        />
                        <span className="text-[10px] uppercase font-black tracking-widest text-gray-400">
                          {q.type === 'qcm' ? 'Choix Multiple' : 'Texte Libre'}
                        </span>
                      </div>

                      {q.type === 'qcm' && (
                        <div className="pl-9 space-y-2">
                          {q.options.map((opt: string, optIdx: number) => (
                            <div key={optIdx} className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full border border-gray-300" />
                              <input 
                                type="text"
                                placeholder={`Option ${optIdx + 1}`}
                                value={opt}
                                onChange={e => {
                                  const newOpts = [...q.options];
                                  newOpts[optIdx] = e.target.value;
                                  updateQuestion(q.id, { options: newOpts });
                                }}
                                className="flex-1 text-sm bg-white p-1 rounded border-none focus:ring-0 outline-none"
                              />
                            </div>
                          ))}
                          <button 
                            onClick={() => {
                              const newOpts = [...q.options, ''];
                              updateQuestion(q.id, { options: newOpts });
                            }}
                            className="text-xs text-bloom-primary hover:underline ml-4"
                          >
                            + Ajouter une option
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex gap-3">
                  <button 
                    onClick={() => addQuestion('text')}
                    className="flex-1 py-3 border-2 border-dashed border-gray-200 rounded-xl text-sm font-medium text-gray-500 hover:border-bloom-primary hover:text-bloom-primary transition-all"
                  >
                    + Question Ouverte
                  </button>
                  <button 
                    onClick={() => addQuestion('qcm')}
                    className="flex-1 py-3 border-2 border-dashed border-gray-200 rounded-xl text-sm font-medium text-gray-500 hover:border-bloom-secondary hover:text-bloom-secondary transition-all"
                  >
                    + QCM (Choix)
                  </button>
                </div>
              </div>

              <div className="flex gap-3 pt-6 border-t border-gray-100">
                <button 
                  onClick={() => setShowCreate(false)}
                  className="flex-1 py-3 rounded-xl font-medium text-gray-500 hover:bg-gray-100 transition-colors"
                >
                  Annuler
                </button>
                <button 
                  onClick={handleCreateActivity}
                  disabled={!newTitle || newQuestions.some(q => !q.text) || isSubmitting}
                  className="flex-1 py-3 bg-gray-900 text-white rounded-xl font-bold disabled:opacity-50 hover:bg-gray-800 transition-all shadow-md flex justify-center items-center gap-2"
                >
                  {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                  {isSubmitting ? 'Publication...' : 'Publier dans la FAMI'}
                </button>
              </div>
            </div>
          </motion.div>
        )}

        <div className="grid gap-4">
          {activities.length === 0 ? (
            <div className="text-center py-16 px-4 bg-white border border-dashed border-gray-200 rounded-3xl shadow-sm">
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8 text-gray-300" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Aucune activité</h3>
              <p className="text-gray-500 mb-6 max-w-sm mx-auto text-sm">
                Créez votre première activité interactive hebdomadaire pour engager vos membres et recueillir leurs nouvelles.
              </p>
              <button 
                onClick={() => setShowCreate(true)}
                className="bg-gray-100 text-gray-900 px-6 py-2.5 rounded-xl font-bold hover:bg-gray-200 transition-colors"
              >
                Créer une activité
              </button>
            </div>
          ) : (
            activities.map(activity => (
              <motion.div 
                key={activity.id} 
                whileHover={{ x: 4 }}
                className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center justify-between hover:shadow-md transition-all group"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-[10px] font-bold text-bloom-primary bg-bloom-primary/10 px-2 py-1 rounded-lg uppercase tracking-wider">
                      {new Date(activity.createdAt?.seconds * 1000 || Date.now()).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                    </span>
                    <h3 className="font-bold text-lg text-gray-900 group-hover:text-bloom-primary transition-colors">{activity.title}</h3>
                  </div>
                  <p className="text-sm text-gray-500 line-clamp-1 pr-8 leading-relaxed mb-3">
                    {activity.content}
                  </p>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-400">
                      <Users className="w-3.5 h-3.5" />
                      {activity.questions?.length || 0} Questions
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                     onClick={() => navigate(`/dashboard/leader/report/${activity.id}?type=subject`)}
                     className="bg-gray-50 text-gray-900 px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-bloom-primary hover:text-white transition-all flex items-center gap-2 group-active:scale-95 shadow-sm"
                  >
                    Rapport <FileText className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => handleDeleteActivity(activity.id, activity.title)}
                    className="p-2.5 bg-gray-50 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all shadow-sm"
                    title="Supprimer l'activité"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            ))
          )}
        </div>
        {/* Modale de création d'appel */}
        {showCallModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900">Lancer un appel</h3>
                <button 
                  onClick={() => setShowCallModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              
              <form onSubmit={handleStartCall} className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Nom de l'appel
                  </label>
                  <input 
                    type="text"
                    value={callName}
                    onChange={(e) => setCallName(e.target.value)}
                    placeholder="Ex: Partage biblique du dimanche"
                    className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-4 focus:ring-bloom-primary/10 focus:border-bloom-primary transition-all outline-none"
                    autoFocus
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    Ce nom sera visible par tous les membres lorsqu'ils rejoindront la salle.
                  </p>
                </div>
                
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowCallModal(false)}
                    className="flex-1 py-3 px-4 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={!callName.trim() || isStartingCall}
                    className="flex-1 py-3 px-4 bg-bloom-primary text-white rounded-xl font-bold hover:bg-bloom-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isStartingCall ? <Loader2 className="w-5 h-5 animate-spin" /> : <Video className="w-5 h-5" />}
                    {isStartingCall ? 'Lancement...' : 'Démarrer'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* Modale de préparation du Rapport Global */}
        {showReportModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-3xl p-6 max-w-2xl w-full shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900">Préparation du Rapport Global</h3>
                <button 
                  onClick={() => setShowReportModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Remarque Globale (Bilan de la semaine)
                  </label>
                  <textarea 
                    value={globalRemark}
                    onChange={(e) => setGlobalRemark(e.target.value)}
                    placeholder="Ex: Belle semaine, beaucoup de partages profonds. Il faut veiller sur les membres qui sont restés discrets..."
                    className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-4 focus:ring-bloom-primary/10 focus:border-bloom-primary transition-all outline-none min-h-[120px]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Motifs d'absence (si applicable)
                  </label>
                  <p className="text-xs text-gray-500 mb-4">Laissez vide si le membre était présent ou a participé.</p>
                  <div className="space-y-3">
                    {members.map((member) => (
                      <div key={member.id} className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                        <div className="font-semibold text-sm w-1/3">
                          {member.name}
                        </div>
                        <input
                          type="text"
                          placeholder="Motif d'absence (ex: Malade, Voyage...)"
                          value={absenceNotes[member.id] || ''}
                          onChange={(e) => setAbsenceNotes({ ...absenceNotes, [member.id]: e.target.value })}
                          className="flex-1 p-2 text-sm bg-white border border-gray-200 rounded-lg outline-none focus:border-bloom-primary"
                        />
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="flex gap-3 pt-4 border-t border-gray-100">
                  <button
                    onClick={() => setShowReportModal(false)}
                    className="flex-1 py-3 px-4 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={() => {
                       setShowReportModal(false);
                       navigate(`/dashboard/leader/report/global?type=weekly`, { 
                         state: { globalRemark, absenceNotes } 
                       });
                    }}
                    className="flex-1 py-3 px-4 bg-gray-900 text-white rounded-xl font-bold hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
                  >
                    <FileText className="w-5 h-5" />
                    Générer le PDF
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

      </main>
    </div>
  );
}
