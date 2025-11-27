import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/firebaseConfig';
import firebase from 'firebase/compat/app'; 
import { useAuth } from '../contexts/AuthContext';
import { Spinner, getAvatarUrl } from '../components/Common'; // <--- IMPORTADO
import { PlusIcon, TrashIcon } from '../components/Icons';
import UserSearchModal from '../components/UserSearchModal';
import ConfirmModal from '../components/ConfirmModal';

const ChatListPage = () => {
    const navigate = useNavigate();
    const { currentUser, userData } = useAuth();
    const [conversations, setConversations] = useState([]);
    const [loading, setLoading] = useState(true);
    
    const [showSearchModal, setShowSearchModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [conversationIdToDelete, setConversationIdToDelete] = useState(null);

    useEffect(() => {
        if (!currentUser || !userData) return;
        setLoading(true);
        
        const q = db.collection("conversations")
            .where("participants", "array-contains", currentUser.uid)
            .orderBy("lastMessageTimestamp", "desc");

        const unsubscribe = q.onSnapshot(snapshot => {
            const convos = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            // Recalcula os IDs permitidos a cada atualização
            const seguindo = userData?.seguindo || [];
            const seguidores = userData?.seguidores || [];
            const allowedIds = new Set([...seguindo, ...seguidores]);

            const visibleConvos = convos.filter(c => {
                if (c.deletedBy && c.deletedBy[currentUser.uid]) return false;
                const otherId = c.participants.find(p => p !== currentUser.uid);
                return allowedIds.has(otherId) || !!c.lastMessageTimestamp;
            });

            setConversations(visibleConvos);
            setLoading(false);
        }, error => {
            console.error("Erro ao buscar conversas: ", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [currentUser, userData]); // Manter userData aqui é crucial

    const startConversation = async (targetUser) => {
        setShowSearchModal(false);
        if (!currentUser || !userData || !targetUser?.id || currentUser.uid === targetUser.id) {
            return;
        }

        // Permitir apenas se o usuário está em seguindo ou seguidores
        const seguindo = userData.seguindo || [];
        const seguidores = userData.seguidores || [];
        if (![...seguindo, ...seguidores].includes(targetUser.id)) {
            alert("Você só pode iniciar conversas com seguidores ou seguidos.");
            return;
        }

        const sortedIds = [currentUser.uid, targetUser.id].sort();
        const conversationId = sortedIds.join('_');
        const conversationRef = db.collection("conversations").doc(conversationId);
        
        try {
            const conversationData = {
                participants: sortedIds,
                participantInfo: {
                    [currentUser.uid]: { 
                        nome: userData.nome || "Usuário", 
                        foto: userData.foto || "" 
                    },
                    [targetUser.id]: { 
                        nome: targetUser.nome || "Usuário", 
                        foto: targetUser.foto || "" 
                    }
                },
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            await conversationRef.set(conversationData, { merge: true });
            
            await conversationRef.update({
                [`deletedBy.${currentUser.uid}`]: false
            });

            navigate(`/chat/${conversationId}`);
        } catch (error) {
            console.error("Erro ao iniciar conversa:", error);
        }
    };

    const requestDelete = (e, convoId) => {
        e.stopPropagation();
        setConversationIdToDelete(convoId);
        setShowDeleteModal(true);
    };

    const confirmDelete = async () => {
        if (!conversationIdToDelete) return;
        
        try {
            await db.collection("conversations").doc(conversationIdToDelete).update({
                [`deletedBy.${currentUser.uid}`]: true,
                [`historyClearedAt.${currentUser.uid}`]: firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch (error) { 
            console.error(error); 
        }
    };

    if (loading) return <Spinner />;

    return (
        <div className="container mx-auto p-4 md:p-8 text-white">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold">Conversas</h1>
                <button onClick={() => setShowSearchModal(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white p-2 rounded-full transition-colors">
                    <PlusIcon className="w-6 h-6" />
                </button>
            </div>
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg">
                {conversations.length > 0 ? (
                    <div className="divide-y divide-gray-700">
                        {conversations.map(convo => {
                            const otherParticipantId = convo.participants.find(p => p !== currentUser.uid);
                            const otherParticipantInfo = convo.participantInfo ? convo.participantInfo[otherParticipantId] : null;
                            
                            if (!otherParticipantInfo) return null;

                            let lastMsgText = convo.lastMessage?.text || 'Inicie a conversa...';
                            const clearedAt = convo.historyClearedAt?.[currentUser.uid]?.seconds || 0;
                            const lastMsgTime = convo.lastMessageTimestamp?.seconds || 0;
                            
                            if (lastMsgTime <= clearedAt) {
                                lastMsgText = ''; 
                            }

                            return (
                                <div key={convo.id} onClick={() => navigate(`/chat/${convo.id}`)} className="p-4 flex items-center space-x-4 cursor-pointer hover:bg-gray-700/50 transition-colors group">
                                    {/* CORREÇÃO AQUI */}
                                    <img 
                                        src={getAvatarUrl(otherParticipantInfo.foto, otherParticipantInfo.nome)} 
                                        alt="" 
                                        className="w-14 h-14 rounded-full object-cover" 
                                        onError={(e) => { e.target.onerror = null; e.target.src=getAvatarUrl(null, otherParticipantInfo.nome); }}
                                    />
                                    <div className="flex-1 overflow-hidden">
                                        <p className="font-bold text-lg">{otherParticipantInfo.nome}</p>
                                        <p className="text-sm text-gray-400 truncate">{lastMsgText}</p>
                                    </div>
                                    <div className="flex flex-col items-end space-y-2">
                                        <span className="text-xs text-gray-500">
                                            {convo.lastMessageTimestamp ? new Date(convo.lastMessageTimestamp.seconds * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}
                                        </span>
                                        <button onClick={(e) => requestDelete(e, convo.id)} className="text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <TrashIcon className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <p className="text-center text-gray-400 p-8">Nenhuma conversa ativa.</p>
                )}
            </div>

            {showSearchModal && (
                <UserSearchModal 
                    onClose={() => setShowSearchModal(false)} 
                    onSelectUser={startConversation} 
                    currentUser={currentUser} 
                />
            )}

            <ConfirmModal 
                isOpen={showDeleteModal}
                onClose={() => setShowDeleteModal(false)}
                onConfirm={confirmDelete}
                title="Apagar Conversa"
                message="Tem certeza que deseja apagar esta conversa e limpar o histórico para você?"
                confirmText="Sim, apagar"
                cancelText="Cancelar"
                isDanger={true}
            />
        </div>
    );
};

export default ChatListPage;