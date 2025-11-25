import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/firebaseConfig';
import { useAuth } from '../contexts/AuthContext';
import { BellIcon, TrashIcon } from './Icons'; // Adicionei TrashIcon
import { getAvatarUrl } from './Common';
import ConfirmModal from './ConfirmModal'; // Importamos o modal

const Notifications = () => {
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const [notifications, setNotifications] = useState([]);
    const [isOpen, setIsOpen] = useState(false);
    const [senders, setSenders] = useState({});
    const [showClearModal, setShowClearModal] = useState(false); // Estado do modal de limpar
    const dropdownRef = useRef(null);

    const fetchSenders = useCallback(async (notifications) => {
        const senderIds = [...new Set(notifications.map(n => n.senderId))];
        const newSenderIds = senderIds.filter(id => !senders[id]);

        if (newSenderIds.length > 0) {
            const sendersData = {};
            for (const id of newSenderIds) {
                try {
                    const userSnap = await db.collection("users").doc(id).get();
                    if (userSnap.exists) {
                        sendersData[id] = userSnap.data();
                    }
                } catch(e) { console.error(e); }
            }
            setSenders(prev => ({...prev, ...sendersData}));
        }
    }, [senders]);

    useEffect(() => {
        if (!currentUser) return;

        const q = db.collection("notifications")
                    .where("recipientId", "==", currentUser.uid)
                    .orderBy("timestamp", "desc")
                    .limit(20); // Limitamos a 20 para não explodir a UI

        const unsubscribe = q.onSnapshot(snapshot => {
            const notifs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setNotifications(notifs);
            fetchSenders(notifs);
        });

        return () => unsubscribe();
    }, [currentUser, fetchSenders]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [dropdownRef]);

    const handleNotificationClick = async (notification) => {
        setIsOpen(false);
        if (!notification.read) {
            await db.collection("notifications").doc(notification.id).update({ read: true });
        }
        switch (notification.type) {
            case 'follow':
                navigate(`/profile/${notification.senderId}`);
                break;
            case 'like':
            case 'comment':
                navigate(`/detail/${notification.mediaType}/${notification.mediaId}`);
                break;
            default:
                break;
        }
    };

    const handleClearAll = async () => {
        if (notifications.length === 0) return;

        // Cria um lote de operações (Batch Write)
        const batch = db.batch();

        notifications.forEach(notif => {
            const ref = db.collection("notifications").doc(notif.id);
            batch.delete(ref);
        });

        try {
            await batch.commit(); // Executa todas as deleções de uma vez
            // O onSnapshot vai atualizar a lista automaticamente para vazio
        } catch (error) {
            console.error("Erro ao limpar notificações:", error);
        }
    };

    const getNotificationText = (notification) => {
        const senderName = senders[notification.senderId]?.nome || 'Alguém';
        switch (notification.type) {
            case 'follow':
                return <><strong>{senderName}</strong> começou a seguir você.</>;
            case 'like':
                return <><strong>{senderName}</strong> curtiu sua avaliação.</>;
            case 'comment':
                return <><strong>{senderName}</strong> comentou na sua avaliação.</>;
            default:
                return "Nova notificação.";
        }
    };
    
    const unreadCount = notifications.filter(n => !n.read).length;

    return (
        <div className="relative" ref={dropdownRef}>
            <button onClick={() => setIsOpen(!isOpen)} className="relative text-gray-400 hover:text-white transition-colors">
                <BellIcon className="w-6 h-6" />
                {unreadCount > 0 && (
                    <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
                        {unreadCount}
                    </span>
                )}
            </button>
            
            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 md:w-96 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-50 overflow-hidden animate-fade-in">
                    <div className="p-3 font-bold border-b border-gray-700 flex justify-between items-center bg-gray-900/50">
                        <span>Notificações</span>
                        {notifications.length > 0 && (
                            <button 
                                onClick={() => setShowClearModal(true)} 
                                className="text-xs font-normal text-gray-400 hover:text-red-400 flex items-center gap-1 transition-colors"
                            >
                                <TrashIcon className="w-3 h-3" /> Limpar tudo
                            </button>
                        )}
                    </div>
                    
                    <div className="max-h-96 overflow-y-auto">
                        {notifications.length > 0 ? (
                            notifications.map(notif => (
                                <div
                                    key={notif.id}
                                    onClick={() => handleNotificationClick(notif)}
                                    className={`p-3 flex items-start space-x-3 cursor-pointer hover:bg-gray-700/50 transition-colors border-b border-gray-700/30 last:border-0 ${!notif.read ? 'bg-indigo-500/10' : ''}`}
                                >
                                    <img 
                                        src={getAvatarUrl(senders[notif.senderId]?.foto, senders[notif.senderId]?.nome)} 
                                        onError={(e) => { e.target.onerror = null; e.target.src=getAvatarUrl(null, senders[notif.senderId]?.nome); }}
                                        alt="sender" 
                                        className="w-10 h-10 rounded-full object-cover"
                                    />
                                    <div className="flex-1 text-sm text-gray-300">
                                        {getNotificationText(notif)}
                                        <p className="text-xs text-gray-500 mt-1">
                                            {notif.timestamp ? new Date(notif.timestamp.seconds * 1000).toLocaleString('pt-BR') : ''}
                                        </p>
                                    </div>
                                    {!notif.read && <div className="w-2 h-2 bg-indigo-400 rounded-full self-center shrink-0"></div>}
                                </div>
                            ))
                        ) : (
                            <div className="p-8 text-center">
                                <BellIcon className="w-12 h-12 text-gray-600 mx-auto mb-2" />
                                <p className="text-sm text-gray-400">Nenhuma notificação no momento.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Modal de Confirmação */}
            <ConfirmModal 
                isOpen={showClearModal}
                onClose={() => setShowClearModal(false)}
                onConfirm={handleClearAll}
                title="Limpar Notificações"
                message="Isso apagará permanentemente todas as notificações visíveis. Deseja continuar?"
                confirmText="Limpar"
                isDanger={true}
            />
        </div>
    );
};

export default Notifications;