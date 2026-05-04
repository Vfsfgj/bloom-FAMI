import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../lib/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { Loader2, ArrowLeft, Mic, MicOff, PhoneOff, User as UserIcon, Link as LinkIcon, Volume2 } from 'lucide-react';
import { doc, getDoc, setDoc, query, collection, onSnapshot, addDoc, where, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { toast } from 'sonner';

const iceServers = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export function FamiCall() {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const searchParams = new URLSearchParams(location.search);
  const targetFamiId = searchParams.get('famiId') || profile?.famiId;

  const [callDetails, setCallDetails] = useState<{ id: string; name: string } | null>(null);
  const [fetching, setFetching] = useState(true);

  const [isMuted, setIsMuted] = useState(false);
  const [participantsList, setParticipantsList] = useState<{ uid: string; name: string }[]>([]);

  const localStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<{ [uid: string]: RTCPeerConnection }>({});
  const audioElementsRef = useRef<{ [uid: string]: HTMLAudioElement }>({});

  // 1. Fetch Call Details
  useEffect(() => {
    async function fetchCall() {
      if (!targetFamiId) {
        navigate('/dashboard');
        return;
      }
      try {
        const famiDoc = await getDoc(doc(db, 'famis', targetFamiId));
        if (famiDoc.exists()) {
          const data = famiDoc.data();
          if (data.activeCall) {
            setCallDetails({ id: data.activeCall.id, name: data.activeCall.name });
            window.history.replaceState(
              null,
              '',
              `?famiId=${targetFamiId}`
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
      if (!targetFamiId) {
        navigate('/dashboard');
      } else {
        fetchCall();
      }
    }
  }, [loading, targetFamiId, navigate]);

  // 2. WebRTC Mesh Logic
  useEffect(() => {
    if (!callDetails || !user || !targetFamiId) return;

    const myUid = user.uid;
    const callId = callDetails.id;
    const participantsRef = collection(db, 'famis', targetFamiId, 'activeCallInfo', callId, 'participants');
    const signalsRef = collection(db, 'famis', targetFamiId, 'activeCallInfo', callId, 'signals');

    let unsubParticipants: () => void;
    let unsubSignals: () => void;

    // A helper to initialize local media and connect to DB
    const initWebRTC = async () => {
      try {
        // Get local audio
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        localStreamRef.current = stream;

        // Register as participant
        await setDoc(doc(participantsRef, myUid), {
          uid: myUid,
          name: profile?.name || user.displayName || 'Participant',
          joinedAt: Date.now(),
        });

        // Setup Create Peer Function
        const createPeer = (targetUid: string, isInitiator: boolean) => {
          const pc = new RTCPeerConnection(iceServers);
          peersRef.current[targetUid] = pc;

          // Add local tracks
          stream.getTracks().forEach((track) => {
            pc.addTrack(track, stream);
          });

          // Handle incoming tracks
          pc.ontrack = (event) => {
            if (audioElementsRef.current[targetUid]) {
              audioElementsRef.current[targetUid].srcObject = event.streams[0];
            } else {
              const audio = new Audio();
              audio.autoplay = true;
              audio.srcObject = event.streams[0];
              audioElementsRef.current[targetUid] = audio;
              audio.play().catch((e) => console.log("Audio play error:", e));
            }
          };

          // Handle ICE candidates
          pc.onicecandidate = async (event) => {
            if (event.candidate) {
              await addDoc(signalsRef, {
                sender: myUid,
                receiver: targetUid,
                type: 'candidate',
                data: JSON.stringify(event.candidate),
                timestamp: Date.now(),
              });
            }
          };

          // Create offer if initiator
          if (isInitiator) {
            pc.createOffer().then((offer) => {
              pc.setLocalDescription(offer);
              addDoc(signalsRef, {
                sender: myUid,
                receiver: targetUid,
                type: 'offer',
                data: JSON.stringify(offer),
                timestamp: Date.now(),
              });
            });
          }

          return pc;
        };

        // Listen for Participants (Mesh Tie-breaker: greater UID initiates)
        unsubParticipants = onSnapshot(participantsRef, (snapshot) => {
          const currentParticipants: { uid: string; name: string }[] = [];
          snapshot.docs.forEach((d) => currentParticipants.push({ uid: d.id, name: d.data().name }));
          setParticipantsList(currentParticipants);

          snapshot.docChanges().forEach((change) => {
            const pUid = change.doc.id;
            if (pUid === myUid) return;

            if (change.type === 'added') {
              // Create peer if it doesn't exist. Tie-breaker to prevent duplicate offers.
              if (!peersRef.current[pUid]) {
                const isInitiator = myUid > pUid;
                createPeer(pUid, isInitiator);
              }
            } else if (change.type === 'removed') {
              if (peersRef.current[pUid]) {
                peersRef.current[pUid].close();
                delete peersRef.current[pUid];
              }
              if (audioElementsRef.current[pUid]) {
                audioElementsRef.current[pUid].pause();
                delete audioElementsRef.current[pUid];
              }
            }
          });
        });

        // Listen for Signals
        const q = query(signalsRef, where('receiver', '==', myUid));
        unsubSignals = onSnapshot(q, (snapshot) => {
          snapshot.docChanges().forEach(async (change) => {
            if (change.type === 'added') {
              const data = change.doc.data();
              const sender = data.sender;
              let pc = peersRef.current[sender];

              if (data.type === 'offer') {
                if (!pc) pc = createPeer(sender, false);
                const offer = JSON.parse(data.data);
                await pc.setRemoteDescription(new RTCSessionDescription(offer));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);

                // Send Answer
                await addDoc(signalsRef, {
                  sender: myUid,
                  receiver: sender,
                  type: 'answer',
                  data: JSON.stringify(answer),
                  timestamp: Date.now(),
                });
              } else if (data.type === 'answer') {
                if (pc) {
                  const answer = JSON.parse(data.data);
                  await pc.setRemoteDescription(new RTCSessionDescription(answer));
                }
              } else if (data.type === 'candidate') {
                if (pc) {
                  const candidate = JSON.parse(data.data);
                  await pc.addIceCandidate(new RTCIceCandidate(candidate));
                }
              }
            }
          });
        });
      } catch (error) {
        console.error("Error accessing media devices.", error);
        toast.error("Impossible d'accéder au microphone.");
      }
    };

    initWebRTC();

    return () => {
      // Cleanup
      if (unsubParticipants) unsubParticipants();
      if (unsubSignals) unsubSignals();

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      Object.keys(peersRef.current).forEach((uid) => {
        peersRef.current[uid].close();
      });
      peersRef.current = {};

      Object.keys(audioElementsRef.current).forEach((uid) => {
        audioElementsRef.current[uid].pause();
      });
      audioElementsRef.current = {};

      // Remove self from participants
      deleteDoc(doc(participantsRef, myUid)).catch(e => console.error(e));
    };
  }, [callDetails, user, targetFamiId, profile]);

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const copyLink = () => {
    const url = `${window.location.origin}/dashboard/call?famiId=${targetFamiId}`;
    navigator.clipboard.writeText(url);
    toast.success('Lien copié !', {
      description: "Lien d'invitation prêt à être partagé avec votre FAMI.",
    });
  };

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
            <p className="text-xs text-gray-400 font-medium">Appel Vocal FAMI</p>
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

      <div className="flex-1 w-full bg-[#111] flex max-w-7xl mx-auto p-4 md:p-8 overflow-hidden gap-8">
        
        {/* Participants Grid */}
        <div className="flex-1 h-full overflow-y-auto">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {participantsList.map((p) => (
              <div key={p.uid} className="bg-[#222] rounded-3xl aspect-square flex flex-col items-center justify-center p-4 border border-white/5 relative group transition-all hover:bg-[#252525]">
                <div className="w-20 h-20 bg-white/10 flex items-center justify-center rounded-full mb-4">
                  <UserIcon className="w-10 h-10 text-white/70" />
                </div>
                <h3 className="font-medium text-white/90 text-center truncate w-full">{p.name}</h3>
                {p.uid === user?.uid && (
                  <span className="text-xs font-bold bg-bloom-primary text-white px-2 py-0.5 rounded-full mt-2">Moi</span>
                )}
                {p.uid !== user?.uid && (
                  <div className="absolute top-4 right-4 bg-black/40 p-2 rounded-full">
                    <Volume2 className="w-4 h-4 text-green-400" />
                  </div>
                )}
              </div>
            ))}

            {/* Empty state if you are alone */}
            {participantsList.length === 1 && (
               <div className="bg-[#222] border-2 border-dashed border-white/10 rounded-3xl aspect-square flex flex-col items-center justify-center p-4 text-center">
                  <Loader2 className="w-8 h-8 text-white/20 animate-spin mb-4" />
                  <p className="text-white/50 text-sm">En attente que d'autres rejoignent...</p>
               </div>
            )}
          </div>
        </div>

      </div>

      {/* Controls Bar */}
      <div className="bg-black/90 backdrop-blur-md p-6 border-t border-white/10 shrink-0">
        <div className="max-w-md mx-auto flex items-center justify-center gap-6">
          <button 
            onClick={toggleMute}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${isMuted ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-[#333] hover:bg-[#444] text-white'}`}
          >
            {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
          </button>
          
          <button 
            onClick={() => navigate('/dashboard')}
            className="w-16 h-16 rounded-3xl bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-all shadow-lg"
            title="Quitter l'appel"
          >
            <PhoneOff className="w-7 h-7" />
          </button>
        </div>
      </div>
    </div>
  );
}

