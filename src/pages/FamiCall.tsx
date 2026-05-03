import { ZegoUIKitPrebuilt } from '@zegocloud/zego-uikit-prebuilt';
import { useAuth } from '../lib/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { Loader2, ArrowLeft, Link as LinkIcon, Settings } from 'lucide-react';
import { useEffect, useState, useRef } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { toast } from 'sonner';

export function FamiCall() {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const containerRef = useRef<HTMLDivElement>(null);
  
  const searchParams = new URLSearchParams(location.search);
  const roomParam = searchParams.get('room');
  const nameParam = searchParams.get('name');

  const [callDetails, setCallDetails] = useState<{ id: string, name: string } | null>(null);
  const [fetching, setFetching] = useState(true);

  // Configuration ZegoCloud (à définir dans Settings > Environment Variables)
  // @ts-expect-error Vite env types
  const rawAppID = import.meta.env.VITE_ZEGO_APP_ID;
  // @ts-expect-error Vite env types
  const rawSecret = import.meta.env.VITE_ZEGO_SERVER_SECRET;
  
  const appIDStr = rawAppID?.toString().trim();
  const serverSecret = rawSecret?.toString().trim();
  const appID = appIDStr ? Number(appIDStr) : 0;

  const isConfigured = !!appID && !!serverSecret;

  useEffect(() => {
    async function fetchCall(targetFamiId: string) {
      try {
        const famiDoc = await getDoc(doc(db, 'famis', targetFamiId));
        if (famiDoc.exists()) {
          const data = famiDoc.data();
          if (data.activeCall) {
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
      if (roomParam && nameParam) {
        setCallDetails({ id: roomParam, name: nameParam });
        setFetching(false);
        return;
      }

      const targetFamiId = searchParams.get('famiId') || profile?.famiId;
      
      if (!targetFamiId) {
        navigate('/dashboard');
      } else {
        fetchCall(targetFamiId);
      }
    }
  }, [loading, profile?.famiId, location.search, navigate]);

  useEffect(() => {
    if (!containerRef.current || !callDetails || !isConfigured || !user) return;

    let zcInstance: any = null;

    const myMeeting = async (element: HTMLDivElement) => {
      // Générer le jeton (Token) de test
      const kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(
        appID,
        serverSecret,
        callDetails.id, // Room ID
        user.uid,        // User ID
        profile?.name || user.displayName || 'Participant' // User Name
      );

      // Créer l'instance
      zcInstance = ZegoUIKitPrebuilt.create(kitToken);
      
      // Rejoindre la salle avec une configuration interne
      zcInstance.joinRoom({
        container: element,
        sharedLinks: [
          {
            name: 'Lien d\'invitation',
            url: `${window.location.origin}/dashboard/call?room=${encodeURIComponent(callDetails.id)}&name=${encodeURIComponent(callDetails.name)}`
          }
        ],
        scenario: {
          mode: ZegoUIKitPrebuilt.GroupCall, // Pour les réunions d'équipe FAMI
        },
        showPreJoinView: false, // On désactive pour entrer directement vu que c'est géré côté app
        showScreenSharingButton: true,
        showRoomTimer: true,
        branding: {
          logoURL: 'https://i.imgur.com/gTqH06L.png', // Fake Logo
        },
        onLeaveRoom: () => {
          navigate('/dashboard');
        }
      });
    };

    myMeeting(containerRef.current);

    return () => {
      // Nettoyage éventuel : On détruit l'instance ZegoCloud si présente
      if (zcInstance && typeof zcInstance.destroy === 'function') {
        zcInstance.destroy();
      }
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [callDetails, isConfigured, user, profile, appID, serverSecret, navigate]);

  if (loading || fetching) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA]">
        <Loader2 className="w-8 h-8 animate-spin text-bloom-primary" />
      </div>
    );
  }

  if (!isConfigured) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 max-w-xl w-full text-center">
          <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Settings className="w-8 h-8 text-blue-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Configuration Requise</h2>
          <p className="text-gray-500 mb-6 text-sm">
            Pour utiliser l'interface vidéo 100% interne (ZegoCloud), vous devez configurer les clés de l'API dans le menu <strong>Secrets</strong> de l'environnement, sous le nom de :
            <br/><br/>
            <code className="bg-gray-100 px-2 py-1 rounded text-red-500">VITE_ZEGO_APP_ID</code><br/>
            <code className="bg-gray-100 px-2 py-1 rounded text-red-500 mt-2 inline-block">VITE_ZEGO_SERVER_SECRET</code>
          </p>
          <a
            href="https://console.zegocloud.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition-colors inline-block mb-4"
          >
            Créer un compte ZegoCloud (Gratuit)
          </a>
          <button 
            onClick={() => navigate('/dashboard')}
            className="w-full bg-gray-100 text-gray-700 font-bold py-3 rounded-xl hover:bg-gray-200 transition-colors"
          >
            Retour au tableau de bord
          </button>
        </div>
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
    <div className="h-screen w-screen bg-[#111] flex flex-col overflow-hidden">
      <header className="bg-black/90 backdrop-blur-md text-white p-4 flex items-center justify-between border-b border-white/10 z-10 shrink-0">
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

      {/* Le conteneur ZegoCloud qui remplace le composant iframé de Jitsi */}
      <div 
        ref={containerRef} 
        className="flex-1 w-full bg-[#111]"
      />
    </div>
  );
}
