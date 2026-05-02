import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, doc, getDoc, getDocs, query, where, orderBy } from 'firebase/firestore';
import Markdown from 'react-markdown';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { useRef } from 'react';
import { Loader2, ArrowLeft, FileDown, Sparkles, Download } from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { FullScreenLoader } from '../components/Loader';

export function ReportGenerator() {
  const { activityId } = useParams();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const reportType = searchParams.get('type') || 'subject'; // 'weekly' or 'subject'
  const isGlobal = activityId === 'global' || reportType === 'weekly';
  const { profile } = useAuth();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [famiName, setFamiName] = useState('');
  const [totalMembers, setTotalMembers] = useState(0);
  const [activityTitle, setActivityTitle] = useState('');
  const [aggregatedData, setAggregatedData] = useState<any>(null);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedReport, setGeneratedReport] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  // Pour le rapport global
  const globalRemark = location.state?.globalRemark || 'Aucune remarque globale.';
  const absenceNotes = location.state?.absenceNotes || {};

  useEffect(() => {
    async function loadData() {
      if (!profile?.famiId) return;
      try {
        const famiDoc = await getDoc(doc(db, 'famis', profile.famiId));
        if (famiDoc.exists()) setFamiName(famiDoc.data().name);

        const membersQuery = query(collection(db, 'users'), where('famiId', '==', profile.famiId));
        const membersSnap = await getDocs(membersQuery);
        setTotalMembers(membersSnap.size);
        const allMembers = membersSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));

        if (isGlobal) {
          // Fetch activities
          const activitiesSnap = await getDocs(query(collection(db, 'famis', profile.famiId, 'activities'), orderBy('createdAt', 'desc')));
          const activities = activitiesSnap.docs.map(d => d.data());

          // Fetch calls
          const callsSnap = await getDocs(query(collection(db, 'famis', profile.famiId, 'calls'), orderBy('createdAt', 'desc')));
          const calls = callsSnap.docs.map(d => d.data());

          setAggregatedData({
            type: 'global',
            activities,
            calls,
            members: allMembers,
            globalRemark,
            absenceNotes
          });

        } else if (activityId) {
          const actDoc = await getDoc(doc(db, 'famis', profile.famiId, 'activities', activityId));
          let questions: any[] = [];
          if (actDoc.exists()) {
            setActivityTitle(actDoc.data().title);
            questions = actDoc.data().questions || [];
          }

          const respSnap = await getDocs(query(collection(db, 'famis', profile.famiId, 'activities', activityId, 'responses')));
          const responses = respSnap.docs.map(d => d.data());
          
          let agg = ``;
          agg += `Total membres Fami: ${membersSnap.size}\n`;
          agg += `Réponses reçues: ${responses.length}\n\n`;
          responses.forEach((r: any, idx: number) => {
            agg += `--- Membre ${idx+1} (${r.userName || 'Anonyme'}) ---\n`;
            agg += `État d'esprit : ${r.vibe}\n`;
            questions.forEach(q => {
              const answer = r.answers?.[q.id] || 'Pas de réponse';
              agg += `Question: ${q.text}\nRéponse: ${answer}\n`;
            });
            agg += `\n`;
          });
          setAggregatedData({ type: 'subject', text: agg, responsesCount: responses.length, responses });
        }
      } catch (error) {
         handleFirestoreError(error, OperationType.GET, 'reports_data');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [profile, activityId, isGlobal, globalRemark, absenceNotes]);

  const generateReport = async () => {
    setIsGenerating(true);
    // Simulate generation time for UX
    await new Promise(resolve => setTimeout(resolve, 800));
    
    try {
      const today = new Date();
      const lastWeek = new Date();
      lastWeek.setDate(today.getDate() - 7);
      
      let reportMd = '';

      if (aggregatedData.type === 'global') {
        const { activities, calls, members, globalRemark, absenceNotes } = aggregatedData;
        
        reportMd = `
# 🏠 Rapport Global de la FAMI ${famiName}

### 🌟 Au cœur de notre groupe
*Ce rapport a été préparé par votre leader, ${profile?.name || 'votre serviteur'}.*

### 📊 Activités et Réunions de la FAMI

**Activités interactives (${activities.length})**
${activities.length > 0 ? activities.map((a: any) => `- **${a.title}** (publiée le ${new Date(a.createdAt?.seconds * 1000 || Date.now()).toLocaleDateString()})`).join('\n') : "Aucune activité pour le moment."}

**Appels vidéo de la FAMI (${calls.length})**
${calls.length > 0 ? calls.map((c: any) => `- **${c.name}** (lancé le ${new Date(c.createdAt?.seconds * 1000 || Date.now()).toLocaleString()})`).join('\n') : "Aucun appel enregistré pour le moment."}

### 👥 Présences et Absences
Notre groupe compte **${totalMembers} membres**.

**Membres présents / ayant participé :**
${members.filter((m: any) => !absenceNotes[m.id]).map((m: any) => `- ${m.name}`).join('\n') || "Aucun membre."}

**Membres absents :**
${members.filter((m: any) => absenceNotes[m.id]).length > 0 
  ? members.filter((m: any) => absenceNotes[m.id]).map((m: any) => `- **${m.name}** (Tél: ${m.phone || 'Non renseigné'}) - Raison : *${absenceNotes[m.id]}*`).join('\n') 
  : "Aucun membre absent à signaler !"}

### 📈 Remarque du Responsable
> ${globalRemark}

### ✍️ Message de fin
"Que le Dieu de l'espérance vous remplisse de toute joie et de toute paix dans la foi." Nous continuons de marcher ensemble, guidés par sa lumière, pour le bien de chacun.

*Généré avec Bloom — Pour une église plus proche de ses membres.*
`;

      } else {
        // Parse aggregated data for internal synthesis
        const responsesCount = aggregatedData.responsesCount;
        
        // Extract members data for the table
        const memberBlocks = aggregatedData.text.split('--- Membre').slice(1);
        const membersList = memberBlocks.map((block: string) => {
          const name = block.match(/\((.*?)\)/)?.[1] || 'Anonyme';
          const vibe = block.match(/État d'esprit : (.*)/)?.[1] || 'Non spécifié';
          const answers = block.split('\n').filter((line: string) => line.startsWith('Réponse: ')).map((l: string) => l.replace('Réponse: ', ''));
          return { name, vibe, needs: answers.join(', ') || 'Aucun mentionné' };
        });

        const tiredCount = membersList.filter((m: any) => m.vibe.includes('Fatigué') || m.vibe.includes('Besoin')).length;
        const goodCount = membersList.filter((m: any) => m.vibe.includes('En forme') || m.vibe.includes('Super')).length;

        const criticalMembers = membersList.filter((m: any) => m.vibe.includes('Fatigué') || m.vibe.includes('Besoin'));
        const stableMembers = membersList.filter((m: any) => !m.vibe.includes('Fatigué') && !m.vibe.includes('Besoin'));

        reportMd = `
# 💡 Échos de notre partage : ${activityTitle}

### 🔖 Au cœur de notre rencontre
Cette semaine, notre FAMI **${famiName}** s'est réunie autour d'un sujet essentiel : **"${activityTitle}"**. Ce document rassemble les fruits de nos échanges et la manière dont la Parole a résonné dans les cœurs.

### 🗣️ Ce qui a marqué les esprits
Voici les réflexions et les témoignages partagés par les membres de la FAMI :

${membersList.map((m: any) => `**${m.name}** a été touché par cette thématique et a partagé ceci : "${m.needs || 'A participé au partage sans note spécifique.'}"`).join('\n\n')}

### 🧠 Synthèse et Impact spirituel
À la lecture de ces partages, nous constatons que le thème a suscité ${responsesCount > 0 ? "de magnifiques réflexions et une réelle volonté de mettre en pratique les enseignements reçus" : "un besoin d'approfondir encore certains points pour que chacun puisse pleinement s'approprier le message"}.

### 🔄 Pour la suite de notre cheminement
Nous prendrons le temps de revenir sur les questions restées en suspens et sur les points les plus marquants lors de notre prochaine rencontre, afin de fortifier notre vision commune.

---
*Rapport de partage thématique — FAMI ${famiName}*
`;
      }

      setGeneratedReport(reportMd.trim());
      toast.success('Rapport prêt !', {
        description: "Vous pouvez le lire et le télécharger en PDF."
      });
    } catch (err) {
      console.error("Erreur lors de la synthèse :", err);
      toast.error('Erreur de génération', {
        description: "Le rapport n'a pas pu être généré."
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadPDF = async () => {
    if (!reportRef.current) return;
    setIsDownloading(true);
    toast.info('Génération du PDF...', {
      description: "Le téléchargement va commencer dans un instant."
    });
    try {
      const canvas = await html2canvas(reportRef.current, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL('image/png');
      const pdfWidth = canvas.width / 2;
      const pdfHeight = canvas.height / 2;
      const pdf = new jsPDF('p', 'pt', [pdfWidth, pdfHeight]);
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Rapport_${famiName.replace(/\s+/g, '_')}.pdf`);
      toast.success('Téléchargement terminé !');
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors du téléchargement', {
        description: "Le document n'a pas pu être exporté."
      });
    } finally {
      setIsDownloading(false);
    }
  };

  if (loading) return <FullScreenLoader />;

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <header className="bg-white border-b border-gray-100 p-4 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/dashboard/leader')}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="font-display font-semibold text-xl">Prévisualisation du Rapport</h1>
          </div>
          
          <div className="flex items-center gap-3">
            {generatedReport && (
              <button 
                onClick={downloadPDF}
                disabled={isDownloading}
                className="flex items-center gap-2 bg-bloom-primary text-white px-6 py-2.5 rounded-xl font-bold shadow-lg hover:opacity-90 transition-all disabled:opacity-50"
              >
                {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Télécharger le PDF
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 py-12">
        {!generatedReport ? (
          <div className="bg-white p-12 rounded-[2.5rem] border border-gray-100 shadow-sm text-center">
             <div className="w-20 h-20 bg-bloom-primary/10 rounded-3xl flex items-center justify-center text-bloom-primary mx-auto mb-6">
                <Sparkles className="w-10 h-10" />
             </div>
             <h2 className="text-3xl font-bold text-gray-900 mb-4">Génération du Rapport Global</h2>
             <p className="text-gray-500 mb-10 max-w-md mx-auto leading-relaxed">
               Bloom va synthétiser toutes les réponses des membres pour créer un document complet et professionnel.
             </p>
             
             <div className="max-w-sm mx-auto p-4 bg-gray-50 rounded-2xl mb-10 text-left">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Sources de données</p>
                <div className="flex items-center justify-between text-sm text-gray-700">
                   <span>{aggregatedData?.type === 'global' ? 'Membres analysés' : 'Réponses membres'}</span>
                   <span className="font-bold text-bloom-primary">
                     {totalMembers > 0 
                       ? (aggregatedData?.type === 'global' 
                           ? aggregatedData.members.length 
                           : aggregatedData?.responsesCount || '0') 
                       : '...'}
                   </span>
                </div>
             </div>

             <button 
               onClick={generateReport}
               disabled={isGenerating || !aggregatedData}
               className="w-full max-w-md bg-gray-900 text-white py-5 rounded-[1.5rem] font-bold text-lg shadow-2xl hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
             >
               {isGenerating ? (
                 <>
                   <Loader2 className="w-6 h-6 animate-spin" />
                   Rédaction par l'IA...
                 </>
               ) : (
                 <>
                   <Sparkles className="w-6 h-6 text-bloom-primary" />
                   Générer le Rapport Officiel
                 </>
               )}
             </button>
          </div>
        ) : (
          <div className="space-y-8 pb-20">
            <div className="flex items-center justify-between px-2">
               <p className="text-sm text-gray-400">Cliquez sur télécharger une fois la prévisualisation validée.</p>
               <button 
                 onClick={() => setGeneratedReport('')}
                 className="text-xs font-bold text-gray-400 hover:text-red-500 uppercase tracking-widest transition-colors"
                >
                  Réinitialiser
                </button>
            </div>
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              ref={reportRef}
              className="bg-white p-12 md:p-20 rounded-3xl shadow-[0_32px_64px_-12px_rgba(0,0,0,0.1)] border border-gray-100 markdown-body prose prose-slate max-w-none min-h-[1123px] text-left relative overflow-hidden"
              style={{ fontFamily: "'Inter', sans-serif" }}
            >
              <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                <div className="w-32 h-32 bg-bloom-primary rounded-full blur-[60px]" />
              </div>
              <Markdown>{generatedReport}</Markdown>
            </motion.div>
          </div>
        )}
      </main>
    </div>
  );
}
