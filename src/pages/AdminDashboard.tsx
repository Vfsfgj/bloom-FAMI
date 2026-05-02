import { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, getDocs, updateDoc, doc, where, deleteDoc } from 'firebase/firestore';
import { motion } from 'motion/react';
import { Users, FileText, ArrowRightLeft, LogOut, Loader2, ShieldAlert, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

export function AdminDashboard() {
  const { profile, logOut } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  
  const [famis, setFamis] = useState<any[]>([]);
  const [selectedFamiId, setSelectedFamiId] = useState<string | null>(null);
  
  const [famiMembers, setFamiMembers] = useState<any[]>([]);
  const [famiActivities, setFamiActivities] = useState<any[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Permutation modal state
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [memberToSwap, setMemberToSwap] = useState<any>(null);
  const [targetFamiId, setTargetFamiId] = useState<string>('');

  useEffect(() => {
    async function fetchFamis() {
      try {
        const snap = await getDocs(collection(db, 'famis'));
        const famisData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setFamis(famisData);
        if (famisData.length > 0) {
          setSelectedFamiId(famisData[0].id);
        }
      } catch (error) {
        toast.error('Erreur lors du chargement des FAMIs');
        handleFirestoreError(error, OperationType.LIST, 'famis');
      } finally {
        setLoading(false);
      }
    }
    
    if (profile?.role === 'admin') {
      fetchFamis();
    } else if (profile) {
      navigate('/dashboard');
    }
  }, [profile, navigate]);

  useEffect(() => {
    async function fetchFamiDetails() {
      if (!selectedFamiId) return;
      setLoadingDetails(true);
      try {
        // Fetch members
        const qMembers = query(collection(db, 'users')); // we need all users if we search, but let's query where famiId == selectedFamiId for members.
        // Wait, Firestore query for famiId
        const snapMembers = await getDocs(query(collection(db, 'users'), where('famiId', '==', selectedFamiId)));
        setFamiMembers(snapMembers.docs.map(d => ({ id: d.id, ...d.data() })));
        
        // Fetch activities
        const snapActivities = await getDocs(collection(db, 'famis', selectedFamiId, 'activities'));
        setFamiActivities(snapActivities.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (error) {
        toast.error('Erreur lors du chargement des détails de la FAMI');
        handleFirestoreError(error, OperationType.GET, `famis/${selectedFamiId}/details`);
      } finally {
        setLoadingDetails(false);
      }
    }
    
    fetchFamiDetails();
  }, [selectedFamiId]);

  const handleSwapMember = async () => {
    if (!memberToSwap || !targetFamiId) return;
    try {
      await updateDoc(doc(db, 'users', memberToSwap.id), {
        famiId: targetFamiId
      });
      
      toast.success('Membre transféré avec succès');
      setShowSwapModal(false);
      
      // Remove member from current list if looking at their old FAMI
      if (selectedFamiId === memberToSwap.famiId) {
        setFamiMembers(famiMembers.filter(m => m.id !== memberToSwap.id));
      }
    } catch (error) {
      toast.error('Erreur lors du transfert du membre');
      handleFirestoreError(error, OperationType.UPDATE, `users/${memberToSwap.id}`);
    }
  };

  const handleDeleteLeader = async (member: any) => {
    if (!window.confirm(`Êtes-vous sûr de vouloir supprimer le compte responsable de ${member.name} ? Cela est irréversible.`)) {
      return;
    }
    
    try {
      await deleteDoc(doc(db, 'users', member.id));
      toast.success('Compte responsable supprimé');
      setFamiMembers(famiMembers.filter(m => m.id !== member.id));
    } catch (error) {
      toast.error('Erreur lors de la suppression du compte');
      handleFirestoreError(error, OperationType.DELETE, `users/${member.id}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA]">
        <Loader2 className="w-8 h-8 animate-spin text-bloom-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#FAFAFA]">
      <header className="bg-white border-b border-gray-100 py-4 px-6 fixed w-full top-0 z-10 flex justify-between items-center">
        <div className="flex flex-col">
          <span className="font-bold text-xl text-gray-900 tracking-tight">Bloom Admin</span>
          <span className="text-sm font-medium text-bloom-primary">Portail Super Administrateur</span>
        </div>
        <button 
          onClick={logOut}
          className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
          title="Se déconnecter"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </header>
      
      <main className="flex-1 mt-[72px] flex h-[calc(100vh-72px)] overflow-hidden">
        {/* Sidebar Fami List */}
        <div className="w-80 bg-white border-r border-gray-100 overflow-y-auto hidden md:block p-4 space-y-2">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-2 mb-4">Maison FAMI ({famis.length})</h2>
          {famis.map(fami => (
            <button
              key={fami.id}
              onClick={() => setSelectedFamiId(fami.id)}
              className={`w-full text-left px-4 py-3 rounded-2xl transition-all ${
                selectedFamiId === fami.id 
                  ? 'bg-gray-900 text-white shadow-md' 
                  : 'hover:bg-gray-50 text-gray-700'
              }`}
            >
              <div className="font-bold truncate">{fami.name}</div>
              <div className={`text-xs mt-1 ${selectedFamiId === fami.id ? 'text-gray-400' : 'text-gray-400'}`}>Leader ID: {fami.leaderId?.substring(0,6)}...</div>
            </button>
          ))}
        </div>
        
        {/* Main Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-[#FAFAFA]">
          {/* Mobile Fami selector */}
          <div className="md:hidden mb-6">
            <label className="block text-sm font-bold text-gray-700 mb-2">Sélectionner une FAMI</label>
            <select
              value={selectedFamiId || ''}
              onChange={(e) => setSelectedFamiId(e.target.value)}
              className="w-full bg-white p-3 rounded-xl border border-gray-200 outline-none"
            >
              <option value="" disabled>Choisir une FAMI</option>
              {famis.map(fami => (
                <option key={fami.id} value={fami.id}>{fami.name}</option>
              ))}
            </select>
          </div>

          {selectedFamiId && !loadingDetails ? (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              key={selectedFamiId}
              className="max-w-4xl space-y-8"
            >
              <div className="bg-white p-6 md:p-8 rounded-[2rem] shadow-sm border border-gray-100">
                <h1 className="text-2xl font-bold text-gray-900 mb-6">
                  {famis.find(f => f.id === selectedFamiId)?.name}
                </h1>
                
                <section className="mb-8">
                  <div className="flex items-center gap-2 mb-4">
                    <Users className="w-5 h-5 text-bloom-primary" />
                    <h2 className="text-lg font-bold">Membres ({famiMembers.length})</h2>
                  </div>
                  
                  {famiMembers.length === 0 ? (
                    <div className="p-4 bg-gray-50 rounded-2xl text-center text-sm text-gray-500">
                      Aucun membre rattaché à cette FAMI.
                    </div>
                  ) : (
                    <div className="grid gap-3">
                      {famiMembers.map(member => (
                        <div key={member.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                          <div>
                            <div className="font-bold text-gray-900">{member.name}</div>
                            <div className="text-xs text-gray-500">{member.email} • {member.role}</div>
                          </div>
                          
                          {member.role !== 'admin' && (
                            <div className="flex gap-2 mt-3 sm:mt-0">
                              {member.role === 'leader' && (
                                <button
                                  onClick={() => handleDeleteLeader(member)}
                                  className="px-3 py-2 bg-red-50 text-sm font-bold text-red-600 rounded-xl hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
                                  title="Supprimer ce compte responsable"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  setMemberToSwap(member);
                                  setTargetFamiId('');
                                  setShowSwapModal(true);
                                }}
                                className="px-3 py-2 bg-white text-sm font-bold text-gray-700 border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors flex items-center justify-center gap-2"
                              >
                                <ArrowRightLeft className="w-4 h-4" /> Changer de FAMI
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </section>
                
                <section>
                  <div className="flex items-center gap-2 mb-4">
                    <FileText className="w-5 h-5 text-bloom-primary" />
                    <h2 className="text-lg font-bold">Activités Récentes ({famiActivities.length})</h2>
                  </div>
                  
                  {famiActivities.length === 0 ? (
                    <div className="p-4 bg-gray-50 rounded-2xl text-center text-sm text-gray-500">
                      Aucune activité publiée.
                    </div>
                  ) : (
                    <div className="grid gap-3">
                      {famiActivities.map(activity => (
                        <div key={activity.id} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex flex-col justify-between">
                           <div className="font-bold text-gray-900">{activity.title}</div>
                           <div className="text-xs text-gray-500 mt-1">Publiée le {new Date(activity.createdAt?.seconds * 1000 || Date.now()).toLocaleDateString()}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            </motion.div>
          ) : (
            <div className="flex items-center justify-center p-12 text-gray-400">
              {loadingDetails ? <Loader2 className="w-8 h-8 animate-spin" /> : "Sélectionnez une FAMI pour voir ses détails."}
            </div>
          )}
        </div>
      </main>

      {/* Modal Changement de FAMI */}
      {showSwapModal && memberToSwap && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900">Transférer le membre</h3>
            </div>
            
            <p className="text-sm text-gray-500 mb-6">
              Vous êtes sur le point de changer <strong>{memberToSwap.name}</strong> de FAMI. L'ancien leader n'y aura plus accès.
            </p>
            
            <div className="space-y-4 mb-8">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Choisir la FAMI de destination</label>
                <select 
                  className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-4 focus:ring-bloom-primary/10 focus:border-bloom-primary transition-all outline-none"
                  value={targetFamiId}
                  onChange={(e) => setTargetFamiId(e.target.value)}
                >
                  <option value="" disabled>-- Sélectionnez une FAMI --</option>
                  {famis.filter(f => f.id !== memberToSwap.famiId).map(fami => (
                    <option key={fami.id} value={fami.id}>{fami.name}</option>
                  ))}
                  <option value="none">Retirer de la FAMI actuelle (Sans FAMI)</option>
                </select>
              </div>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowSwapModal(false)}
                className="flex-1 py-3 px-4 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={() => {
                   if (targetFamiId === 'none') {
                     // Need to send null for famiId
                     updateDoc(doc(db, 'users', memberToSwap.id), { famiId: null })
                       .then(() => {
                          toast.success('Membre retiré de sa FAMI.');
                          setShowSwapModal(false);
                          setFamiMembers(famiMembers.filter(m => m.id !== memberToSwap.id));
                       }).catch((error) => {
                          toast.error('Erreur...');
                          handleFirestoreError(error, OperationType.UPDATE, `users/${memberToSwap.id}`);
                       });
                   } else {
                     handleSwapMember();
                   }
                }}
                disabled={!targetFamiId}
                className="flex-1 py-3 px-4 bg-gray-900 text-white rounded-xl font-bold hover:bg-black transition-colors disabled:opacity-50"
              >
                Confirmer
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
