import { JitsiMeeting } from '@jitsi/react-sdk';
import { useAuth } from '../lib/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { Loader2, ArrowLeft, Link as LinkIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { toast } from 'sonner';

export function FamiCall() {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  const searchParams = new URLSearchParams(location.search);
  const roomParam = searchParams.get('room');
  const nameParam = searchParams.get('name');

  const [callDetails, setCallDetails] = useState<{ id: string, name: string } | null>(null);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    async function fetchCall() {
      if (!profile?.famiId) return;
      try {
        const famiDoc = await getDoc(doc(db, 'famis', profile.famiId));
        if (famiDoc.exists()) {
          const data = famiDoc.data();
          if (data.activeCall) {
            // Check if URL parameters match, or just use the active call
            if (roomParam && data.activeCall.id !== roomParam) {
               // The URL call is not active anymore, use the active one
            }
            setCallDetails(data.activeCall);
            // Mettre à jour l'URL sans recharger la page pour que le lien copié soit correct
            window.history.replaceState(
              null, 
              '', 
              `?room=${encodeURIComponent(data.activeCall.id)}&name=${encodeURIComponent(data.activeCall.name)}`
            );
          } else {
            setCallDetails(null);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setFetching(false);
      }
    }
    
    if (!loading) {
      if (!profile?.famiId) {
        navigate('/dashboard');
      } else {
        fetchCall();
      }
    }
  }, [loading, profile?.famiId, navigate]);

  if (loading || fetching) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA]">
        <Loader2 className="w-8 h-8 animate-spin text-bloom-primary" />
      </div>
    );
  }

  if (!callDetails) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Loader2 className="w-8 h-8 text-gray-400" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Aucun appel en cours</h2>
          <p className="text-gray-500 mb-6">
            Le responsable de votre FAMI n'a pas encore lancé d'appel, ou celui-ci a été clôturé.
          </p>
          <button 
            onClick={() => navigate('/dashboard')}
            className="w-full bg-gray-900 text-white font-bold py-3 rounded-xl hover:bg-gray-800 transition-colors"
          >
            Retour au tableau de bord
          </button>
        </div>
      </div>
    );
  }

  const copyLink = () => {
    const url = `${window.location.origin}/dashboard/call?room=${encodeURIComponent(callDetails.id)}&name=${encodeURIComponent(callDetails.name)}`;
    navigator.clipboard.writeText(url);
    toast.success('Lien copié !', {
      description: 'Lien d\'invitation prêt à être partagé avec votre FAMI.'
    });
  };

  return (
    <div className="min-h-screen bg-[#111] flex flex-col h-screen">
      <header className="bg-black text-white p-4 flex items-center justify-between border-b border-white/10">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/dashboard')}
            className="p-2 hover:bg-white/10 rounded-xl transition-colors flex items-center gap-2"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium hidden sm:inline">Retour</span>
          </button>
          <div className="h-6 w-px bg-white/20 hidden sm:block"></div>
          <div>
            <h1 className="font-bold text-lg leading-tight">{callDetails.name}</h1>
            <p className="text-xs text-gray-400 font-medium">Appel FAMI Bloom</p>
          </div>
        </div>
        
        <button 
          onClick={copyLink}
          className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-bold flex items-center gap-2 transition-colors"
        >
          <LinkIcon className="w-4 h-4" />
          <span className="hidden sm:inline">Copier le lien</span>
        </button>
      </header>

      <div className="flex-1 w-full bg-[#111]">
        <JitsiMeeting
          domain="meet.jit.si"
          roomName={callDetails.id}
          configOverwrite={{
            startWithAudioMuted: false,
            startWithVideoMuted: false,
            disableModeratorIndicator: true,
            enableEmailInStats: false,
            prejoinPageEnabled: false
          }}
          interfaceConfigOverwrite={{
            DISABLE_JOIN_LEAVE_NOTIFICATIONS: true,
          }}
          userInfo={{
            displayName: profile?.name || user?.displayName || 'Membre Bloom',
            email: user?.email || undefined
          }}
          onApiReady={(externalApi) => {
            externalApi.executeCommand('subject', callDetails.name);
          }}
          getIFrameRef={(iframeRef) => {
            iframeRef.style.height = '100%';
            iframeRef.style.width = '100%';
          }}
          spinner={() => (
            <div className="flex items-center justify-center h-full w-full">
               <Loader2 className="w-10 h-10 animate-spin text-bloom-primary" />
            </div>
          )}
        />
      </div>
    </div>
  );
}
