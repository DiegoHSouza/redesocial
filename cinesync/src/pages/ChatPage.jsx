import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../services/firebaseConfig';
import firebase from 'firebase/compat/app';
import { useAuth } from '../contexts/AuthContext';
import { SendIcon, PencilIcon, TrashIcon, CheckIcon, CloseIcon } from '../components/Icons';
import { getAvatarUrl, Spinner } from '../components/Common';
import ConfirmModal from '../components/ConfirmModal';
import MovieInviteCard from '../components/MovieInviteCard';

const ChatPage = () => {
    const { conversationId } = useParams();
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState("");
    const [conversation, setConversation] = useState(null);
    const [participantDetails, setParticipantDetails] = useState({}); // Para guardar detalhes dos usuários
    const [editingMessage, setEditingMessage] = useState(null);
    const messagesEndRef = useRef(null);

    // Estados do Modal
    const [deleteModalOpen, setDeleteModalOpen] = useState(false); // <--- 2. Estados
    const [messageToDelete, setMessageToDelete] = useState(null);

    useEffect(() => {
        const convoRef = db.collection("conversations").doc(conversationId);
        const unsubConvo = convoRef.onSnapshot(async (doc) => {
            if (doc.exists) {
                const convoData = doc.data();
                setConversation(convoData);

                // Busca detalhes dos participantes se ainda não tiver
                const participantIds = convoData.participants || [];
                const missingDetails = participantIds.filter(id => !participantDetails[id]);
                
                if (missingDetails.length > 0) {
                    const newDetails = {};
                    for (const id of missingDetails) {
                        const userDoc = await db.collection('users').doc(id).get();
                        if (userDoc.exists) {
                            newDetails[id] = userDoc.data();
                        }
                    }
                    setParticipantDetails(prev => ({ ...prev, ...newDetails }));
                }

            } else {
                navigate('/chats');
            }
        });
        
        const messagesRef = convoRef.collection("messages").orderBy("timestamp", "asc");
        const unsubMessages = messagesRef.onSnapshot(snapshot => {
            setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        return () => { unsubConvo(); unsubMessages(); };
    }, [conversationId, navigate, participantDetails]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !currentUser) return;

        const messageData = {
            text: newMessage,
            senderId: currentUser.uid,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        };

        const batch = db.batch();
        const convoRef = db.collection("conversations").doc(conversationId);
        const msgRef = convoRef.collection("messages").doc();
        
        batch.set(msgRef, messageData);
        batch.update(convoRef, {
            lastMessage: { text: newMessage, senderId: currentUser.uid },
            lastMessageTimestamp: firebase.firestore.FieldValue.serverTimestamp(),
            [`deletedBy.${currentUser.uid}`]: false 
        });

        await batch.commit();
        setNewMessage("");
    };

    const handleUpdateMessage = async () => {
        if (!editingMessage?.text.trim()) return;
        await db.collection("conversations").doc(conversationId).collection("messages").doc(editingMessage.id).update({
            text: editingMessage.text,
            edited: true
        });
        setEditingMessage(null);
    };

    // 3. Prepara deleção
    const requestDelete = (msgId) => {
        setMessageToDelete(msgId);
        setDeleteModalOpen(true);
    }

    // 4. Executa deleção
    const confirmDeleteMessage = async () => {
        if (!messageToDelete) return;
        await db.collection("conversations").doc(conversationId).collection("messages").doc(messageToDelete).update({
            text: "Mensagem apagada",
            deleted: true
        });
    };

    const otherParticipantId = conversation?.participants.find(p => p !== currentUser?.uid);
    const otherParticipantInfo = otherParticipantId ? participantDetails[otherParticipantId] : null;

    const historyClearedAt = conversation?.historyClearedAt?.[currentUser.uid]?.seconds || 0;

    const visibleMessages = messages.filter(msg => {
        if (!msg.timestamp) return true;
        return msg.timestamp.seconds > historyClearedAt;
    });

    return (
        <div className="h-[calc(100vh-65px)] md:h-[calc(100vh-81px)] flex flex-col container mx-auto">
            <div className="p-4 border-b border-gray-700 flex items-center space-x-4 bg-gray-900/80 backdrop-blur-lg sticky top-0 z-10">
                <button onClick={() => navigate(`/profile/${otherParticipantId}`)} className="flex items-center space-x-3 hover:opacity-80 transition-opacity">
                    {otherParticipantInfo ? (
                        <>
                            <img 
                                src={getAvatarUrl(otherParticipantInfo.foto, otherParticipantInfo.nome)} 
                                className="w-10 h-10 rounded-full object-cover" 
                                alt={otherParticipantInfo.nome}
                            />
                            <h2 className="text-xl font-bold text-white">{otherParticipantInfo.nome || "Usuário"}</h2>
                        </>
                    ) : <Spinner />}
                </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {visibleMessages.length === 0 && (
                    <div className="text-center text-gray-500 mt-10">
                        <p>Nenhuma mensagem recente.</p>
                        <p className="text-xs">O histórico antigo foi limpo.</p>
                    </div>
                )}

                {visibleMessages.map(msg => {
                    const isSender = msg.senderId === currentUser.uid;
                    const isEditingThis = editingMessage?.id === msg.id;
                    const senderDetails = participantDetails[msg.senderId];

                    return (
                        <div key={msg.id} className={`flex items-end gap-2 group ${isSender ? 'justify-end' : 'justify-start'}`}>
                            {isSender && !msg.deleted && msg.type !== 'movie_invite' && (
                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity mb-1">
                                    <button onClick={() => setEditingMessage({ id: msg.id, text: msg.text })} className="text-gray-400 hover:text-white"><PencilIcon className="w-3 h-3" /></button>
                                    <button onClick={() => requestDelete(msg.id)} className="text-gray-400 hover:text-red-400"><TrashIcon className="w-3 h-3" /></button>
                                </div>
                            )}

                            {/* RENDERIZAÇÃO CONDICIONAL */}
                            {msg.type === 'movie_invite' ? (
                                <MovieInviteCard 
                                    message={{ ...msg, senderName: senderDetails?.nome }} 
                                    conversationId={conversationId} 
                                />
                            ) : (
                                <div className={`max-w-[75%] md:max-w-md p-3 rounded-2xl break-words ${isSender ? 'bg-indigo-600 text-white rounded-br-sm' : 'bg-gray-700 text-gray-200 rounded-bl-sm'}`}>
                                    {isEditingThis ? (
                                        <div className="flex items-center gap-2">
                                            <input 
                                                type="text" 
                                                value={editingMessage.text} 
                                                onChange={(e) => setEditingMessage({...editingMessage, text: e.target.value})} 
                                                className="bg-indigo-700 text-white p-1 rounded focus:outline-none w-full text-sm" 
                                                autoFocus 
                                                onKeyDown={e => e.key === 'Enter' && handleUpdateMessage()} 
                                            />
                                            <button onClick={handleUpdateMessage}><CheckIcon className="w-4 h-4 text-green-300"/></button>
                                            <button onClick={() => setEditingMessage(null)}><CloseIcon className="w-4 h-4 text-red-300"/></button>
                                        </div>
                                    ) : (
                                        <p className={`text-sm md:text-base ${msg.deleted ? 'italic text-white/50' : ''}`}>{msg.text}</p>
                                    )}
                                    {msg.edited && !msg.deleted && <span className="text-[10px] text-white/60 block text-right mt-1">(editado)</span>}
                                </div>
                            )}
                        </div>
                    );
                })}
                <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-700 flex items-center space-x-3 bg-gray-900">
                <input 
                    type="text" 
                    name="new-message"
                    value={newMessage} 
                    onChange={e => setNewMessage(e.target.value)} 
                    placeholder="Digite uma mensagem..." 
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-500 text-white flex-1" 
                />
                <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-full p-3 disabled:opacity-50 transition-colors" disabled={!newMessage.trim()}>
                    <SendIcon className="w-6 h-6"/>
                </button>
            </form>

            {/* 5. Modal */}
            <ConfirmModal 
                isOpen={deleteModalOpen}
                onClose={() => setDeleteModalOpen(false)}
                onConfirm={confirmDeleteMessage}
                title="Apagar Mensagem"
                message="Tem certeza que deseja apagar esta mensagem? Ela será substituída por 'Mensagem apagada' para todos."
                confirmText="Apagar"
                isDanger={true}
            />
        </div>
    );
};

export default ChatPage;