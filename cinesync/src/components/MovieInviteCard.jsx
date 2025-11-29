import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/firebaseConfig';
import { doc, updateDoc, arrayUnion, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { TMDB_IMAGE_URL } from '../services/tmdbApi';
import { TicketIcon, CheckIcon } from './Icons';

const MovieInviteCard = ({ message, conversationId }) => {
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const [isAccepting, setIsAccepting] = useState(false);

    if (!message?.movie) return null;

    const { movie, senderId, senderName, acceptedBy = [] } = message;
    const isSender = currentUser?.uid === senderId;
    const hasAccepted = acceptedBy.includes(currentUser?.uid);
    const hasBeenAcceptedByAnyone = acceptedBy.length > 0;

    const handleAccept = async (e) => {
        e.stopPropagation();
        if (isAccepting || hasAccepted || isSender) return;

        setIsAccepting(true);
        try {
            const messageRef = doc(db, 'conversations', conversationId, 'messages', message.id);
            await updateDoc(messageRef, {
                acceptedBy: arrayUnion(currentUser.uid)
            });

            // Notificar o remetente (usando API modular)
            if (senderId !== currentUser.uid) {
                await addDoc(collection(db, "notifications"), {
                    recipientId: senderId,
                    senderId: currentUser.uid,
                    type: 'invite_accepted',
                    movieTitle: movie.title,
                    read: false,
                    timestamp: serverTimestamp()
                });
            }
        } catch (error) {
            console.error("Erro ao aceitar convite:", error);
        } finally {
            setIsAccepting(false);
        }
    };

    return (
        <div className={`bg-gray-800/50 border rounded-xl overflow-hidden max-w-xs w-full transition-colors ${hasBeenAcceptedByAnyone ? 'border-green-500/50' : 'border-gray-700'}`}>
            <div className="p-4">
                <p className="text-sm text-gray-300 mb-3"><strong className="text-white">{senderName || 'Alguém'}</strong> te convidou para assistir:</p>
                <div className="flex items-start gap-4">
                    <img 
                        src={`${TMDB_IMAGE_URL}${movie.poster_path}`} 
                        alt={movie.title}
                        className="w-16 rounded-md object-cover shadow-lg cursor-pointer"
                        onClick={() => navigate(`/detail/${movie.mediaType || 'movie'}/${movie.id}`)}
                    />
                    <div className="flex-1">
                        <h4 className="font-bold text-white leading-tight">{movie.title}</h4>
                        <div className="flex items-center gap-2 mt-3">
                            <button onClick={() => navigate(`/detail/${movie.mediaType || 'movie'}/${movie.id}`)} className="bg-gray-700 hover:bg-gray-600 text-white text-xs font-bold py-1.5 px-3 rounded-md transition-colors flex items-center gap-1.5">
                                <TicketIcon className="w-4 h-4" /> Detalhes
                            </button>
                            {!isSender && (
                                <button onClick={handleAccept} disabled={hasAccepted || isAccepting} className={`text-white text-xs font-bold py-1.5 px-3 rounded-md transition-colors flex items-center gap-1.5 ${hasAccepted ? 'bg-green-600 cursor-default' : 'bg-indigo-600 hover:bg-indigo-500'}`}>
                                    <CheckIcon className="w-4 h-4" /> {hasAccepted ? 'Aceito' : 'Aceitar'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MovieInviteCard;