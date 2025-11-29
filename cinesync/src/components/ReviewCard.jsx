import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/firebaseConfig';
import firebase from 'firebase/compat/app';
import { useAuth } from '../contexts/AuthContext';
import { HeartIcon, MessageSquareIcon, StarIcon, DotsVerticalIcon, PencilIcon, TrashIcon, ShareIcon } from './Icons';
import ReactionPicker, { REACTIONS } from '../pages/ReactionPicker'; // Importar
import CommentSection from './CommentSection';
import { getAvatarUrl } from './Common';
import ReviewModal from './ReviewModal';
import ConfirmModal from './ConfirmModal'; 
import html2canvas from 'html2canvas'; 

const ReviewCard = ({ review: initialReview, activeTab }) => { // 1. Receber activeTab
    const navigate = useNavigate();
    const { currentUser, userData: loggedInUserData } = useAuth(); // 2. Pegar dados do usuário logado
    
    const [review, setReview] = useState(initialReview);
    const [authorData, setAuthorData] = useState(null);
    const [showComments, setShowComments] = useState(false);
    const [realCommentCount, setRealCommentCount] = useState(initialReview.commentCount || 0);
    const [showOptions, setShowOptions] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [isFollowing, setIsFollowing] = useState(false); // 3. Estado para seguir
    const [commentConfirmModal, setCommentConfirmModal] = useState(null); // Estado para o modal de confirmação do comentário
    const [showReactions, setShowReactions] = useState(false); // Estado para o seletor de reações
    
    const optionsRef = useRef(null);
    const cardRef = useRef(null);

    const getCorsUrl = (url) => {
        if (!url) return '';
        if (url.startsWith('data:') || url.startsWith('blob:')) return url;
        // Não adicione parâmetros extras para imagens do TMDB
        if (url.startsWith('https://image.tmdb.org/')) return url;
        // Se quiser cache busting para outras imagens, mantenha abaixo:
        return `${url}${url.includes('?') ? '&' : '?'}t=${new Date().getTime()}`;
    };

    useEffect(() => {
        setReview(initialReview);
        if (!showComments) setRealCommentCount(initialReview.commentCount || 0);
    }, [initialReview, showComments]);

    useEffect(() => {
        const unsubscribe = db.collection("reviews").doc(initialReview.id)
            .onSnapshot((doc) => {
                if (doc.exists) { // Atualiza o estado local com dados do DB em tempo real
                    const data = doc.data();
                    setReview(prev => ({ ...prev, id: doc.id, ...data }));
                    if (!showComments) setRealCommentCount(data.commentCount || 0);
                }
            });
        return () => unsubscribe();
    }, [initialReview.id, showComments]);

    useEffect(() => {
        const getAuthor = async () => {
            if (review.authorInfo) {
                setAuthorData(review.authorInfo);
            } else if (review.uidAutor) {
                const docRef = db.collection("users").doc(review.uidAutor);
                const docSnap = await docRef.get();
                if (docSnap.exists) {
                    setAuthorData({ uid: docSnap.id, ...docSnap.data() });
                }
            }
        };
        getAuthor();
    }, [review.uidAutor, review.authorInfo]);

    // 4. Efeito para saber se já segue o autor
    useEffect(() => {
        if (loggedInUserData && authorData) {
            const seguindo = loggedInUserData.seguindo || [];
            setIsFollowing(seguindo.includes(authorData.uid));
        }
    }, [loggedInUserData, authorData]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (optionsRef.current && !optionsRef.current.contains(event.target)) {
                setShowOptions(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // 5. Lógica para seguir/deixar de seguir
    const handleFollow = async (e) => {
        e.stopPropagation(); // Impede que o clique no botão acione o clique no card
        if (!currentUser || !authorData) return;

        const userRef = db.collection("users").doc(currentUser.uid);
        const targetRef = db.collection("users").doc(authorData.uid);
        
        const originalFollowingState = isFollowing;
        setIsFollowing(!originalFollowingState); // Atualização otimista da UI

        const batch = db.batch();
        
        if (isFollowing) { // Se ESTAVA seguindo, agora vai DEIXAR de seguir
            batch.update(userRef, { seguindo: firebase.firestore.FieldValue.arrayRemove(authorData.uid) });
            batch.update(targetRef, { seguidores: firebase.firestore.FieldValue.arrayRemove(currentUser.uid) });
        } else { // Se NÃO ESTAVA seguindo, agora vai SEGUIR
            batch.update(userRef, { seguindo: firebase.firestore.FieldValue.arrayUnion(authorData.uid) });
            batch.update(targetRef, { seguidores: firebase.firestore.FieldValue.arrayUnion(currentUser.uid) });
            
            // Criar notificação
            const notificationRef = db.collection("notifications").doc();
            batch.set(notificationRef, { recipientId: authorData.uid, senderId: currentUser.uid, type: 'follow', read: false, timestamp: firebase.firestore.FieldValue.serverTimestamp() });
        }
        
        try {
            await batch.commit();
        } catch (error) {
            console.error("Erro ao seguir/deixar de seguir:", error);
            setIsFollowing(originalFollowingState); // Reverte a UI em caso de erro
        }
    };

    const handleReaction = async (emoji) => {
        if (!currentUser) {
            setShowReactions(false);
            return;
        }
    
        const reviewRef = db.collection("reviews").doc(review.id);
        
        // Usamos uma transação para garantir consistência
        await db.runTransaction(async (transaction) => {
            const doc = await transaction.get(reviewRef);
            if (!doc.exists) throw "Document does not exist!";
    
            const currentReactions = doc.data().reactions || {};
            let userPreviousReaction = null;
    
            // Encontra a reação anterior do usuário, se houver
            for (const key in currentReactions) {
                if (currentReactions[key].includes(currentUser.uid)) {
                    userPreviousReaction = key;
                    break;
                }
            }
    
            // Remove a reação anterior
            if (userPreviousReaction) {
                currentReactions[userPreviousReaction] = currentReactions[userPreviousReaction].filter(uid => uid !== currentUser.uid);
                if (currentReactions[userPreviousReaction].length === 0) {
                    delete currentReactions[userPreviousReaction];
                }
            }
    
            // Adiciona a nova reação (se não for a mesma que a anterior)
            if (userPreviousReaction !== emoji) {
                if (!currentReactions[emoji]) {
                    currentReactions[emoji] = [];
                }
                currentReactions[emoji].push(currentUser.uid);
    
                // Envia notificação apenas se for uma nova reação (não um "deslike")
                if (review.uidAutor !== currentUser.uid) {
                    const notificationRef = db.collection("notifications").doc();
                    transaction.set(notificationRef, { recipientId: review.uidAutor, senderId: currentUser.uid, type: 'like', reviewId: review.id, mediaId: review.movieId, mediaType: review.mediaType || 'movie', read: false, timestamp: firebase.firestore.FieldValue.serverTimestamp() });
                }
            }
    
            transaction.update(reviewRef, { reactions: currentReactions });
        });
    };

    const confirmDeleteReview = async () => {
        try {
            const batch = db.batch();
            const reviewRef = db.collection("reviews").doc(review.id);
            batch.delete(reviewRef);
            const userRef = db.collection("users").doc(currentUser.uid);
            batch.update(userRef, { 'stats.reviews': firebase.firestore.FieldValue.increment(-1) });
            await batch.commit();
        } catch (error) { console.error("Erro ao deletar review:", error); }
    };

    const handleShare = async () => {
        if (!cardRef.current) return;
        try {
            const canvas = await html2canvas(cardRef.current, {
                useCORS: true,
                allowTaint: true, 
                backgroundColor: '#111827', // Fundo escuro para o print
                scale: 2,
                logging: false,
                imageTimeout: 15000, 
            });

            const link = `${window.location.origin}/detail/${review.mediaType || 'movie'}/${review.movieId}`;
            await navigator.clipboard.writeText(link);

            canvas.toBlob(async (blob) => {
                if (blob) {
                    const file = new File([blob], "cinesync-review.png", { type: "image/png" });
                    if (navigator.share && navigator.canShare({ files: [file] })) {
                        await navigator.share({ title: 'Minha review no CineSync', text: 'Confira minha avaliação! Link copiado.', files: [file] });
                    } else {
                        const a = document.createElement('a');
                        a.href = canvas.toDataURL('image/png');
                        a.download = 'cinesync-review.png';
                        a.click();
                        alert("Imagem baixada e Link copiado!");
                    }
                }
            });
        } catch (error) {
            console.error("Erro ao compartilhar:", error);
            alert("Não foi possível gerar a imagem completa. O link foi copiado!");
            const link = `${window.location.origin}/detail/${review.mediaType || 'movie'}/${review.movieId}`;
            navigator.clipboard.writeText(link);
        }
    };

    if (!authorData) return <div className="bg-gray-800/50 border border-gray-700 p-4 rounded-lg animate-pulse h-64 mb-4"></div>;

    // Lógica para reações
    const reactions = review.reactions || {};
    const userReaction = currentUser ? Object.keys(reactions).find(emoji => reactions[emoji].includes(currentUser.uid)) : null;
    const sortedReactions = Object.entries(reactions)
        .filter(([emoji, uids]) => uids && uids.length > 0)
        .sort((a, b) => b[1].length - a[1].length);
    
    // O total de reações é a soma de todos os UIDs em todas as reações
    const totalReactions = Object.values(reactions).reduce((acc, uids) => acc + (uids?.length || 0), 0);


    const avatarSrc = getAvatarUrl(authorData.foto, authorData.nome);
    const isOwner = currentUser && currentUser.uid === review.uidAutor;
    const posterUrl = getCorsUrl(review.moviePoster);

    // --- NOVO DESIGN DO CARD ---
    const CardContent = () => (
        <div ref={cardRef} className="relative overflow-hidden rounded-2xl bg-gray-900 shadow-2xl border border-gray-800 group transition-all duration-300 hover:border-gray-700">
            
            {/* 1. BACKGROUND AMBIENTADO (Blur do Poster) */}
            <div 
                className="absolute inset-0 bg-cover bg-center opacity-20 blur-3xl scale-125 transition-transform duration-1000 group-hover:scale-110"
                style={{ backgroundImage: `url(${posterUrl})` }}
            ></div>
            <div className="absolute inset-0 bg-gradient-to-b from-gray-900/60 via-gray-900/90 to-gray-900"></div>

            <div className="relative z-10 p-5">
                
                {/* 2. HEADER: Usuário */}
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3 cursor-pointer group/user" onClick={() => navigate(`/profile/${review.uidAutor}`)}>
                        <div className="relative">
                            <img 
                                src={avatarSrc} 
                                alt={authorData.nome} 
                                className="w-10 h-10 rounded-full object-cover border border-white/10 group-hover/user:border-indigo-500 transition-colors"
                                onError={(e) => { e.target.onerror = null; e.target.src=getAvatarUrl(null, authorData.nome); }}
                            />
                        </div>
                        <div>
                            <p className="font-bold text-gray-200 group-hover/user:text-white text-sm">{authorData.nome} {authorData.sobrenome}</p>
                            <p className="text-xs text-gray-400">{review.timestamp ? new Date(review.timestamp.seconds * 1000).toLocaleDateString('pt-BR') : 'agora'}</p>
                        </div>
                    </div>

                    {/* 6. Botão de Seguir condicional */}
                    {currentUser && !isOwner && activeTab === 'paraVoce' && (
                        <button 
                            onClick={handleFollow}
                            className={`ml-4 text-xs font-bold px-3 py-1 rounded-full transition-colors ${
                                isFollowing ? 'bg-gray-700 text-gray-300 hover:bg-red-800/50 hover:text-red-400' : 'bg-indigo-600 text-white hover:bg-indigo-500'
                            }`}
                        >
                            {isFollowing ? 'Seguindo' : 'Seguir'}
                        </button>
                    )}
                    <div className="flex items-center gap-2">
                         {/* Botão Share */}
                        <button onClick={(e) => { e.stopPropagation(); handleShare(); }} className="text-gray-400 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors" title="Compartilhar" data-html2canvas-ignore="true">
                            <ShareIcon className="w-5 h-5" />
                        </button>

                        {isOwner && (
                            <div className="relative" ref={optionsRef} data-html2canvas-ignore="true">
                                <button onClick={(e) => { e.stopPropagation(); setShowOptions(!showOptions); }} className="text-gray-400 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors"><DotsVerticalIcon className="w-5 h-5" /></button>
                                {showOptions && (
                                    <div className="absolute right-0 mt-2 w-32 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-20 overflow-hidden">
                                        <button onClick={() => { setShowOptions(false); setIsEditing(true); }} className="w-full text-left flex items-center px-4 py-3 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"><PencilIcon className="w-4 h-4 mr-2"/> Editar</button>
                                        <button onClick={() => { setShowOptions(false); setShowDeleteModal(true); }} className="w-full text-left flex items-center px-4 py-3 text-sm text-red-400 hover:bg-red-900/20 hover:text-red-300 transition-colors"><TrashIcon className="w-4 h-4 mr-2"/> Excluir</button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* 3. CONTEÚDO PRINCIPAL: Poster + Info */}
                <div className="flex flex-col sm:flex-row gap-5 mt-2">
                    {/* Poster em Destaque */}
                    <div 
                        className="w-full sm:w-28 flex-shrink-0 cursor-pointer relative group/poster"
                        onClick={() => navigate(`/detail/${review.mediaType || 'movie'}/${review.movieId}`)}
                    >
                        <div className="aspect-[2/3] w-full sm:w-28 rounded-lg overflow-hidden shadow-lg shadow-black/50 border border-white/10 relative transform transition-transform duration-300 group-hover/poster:scale-105 group-hover/poster:shadow-indigo-500/20">
                            <img 
                                src={posterUrl} 
                                alt={review.movieTitle} 
                                className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover/poster:bg-black/10 transition-colors"></div>
                        </div>
                    </div>

                    {/* Texto da Review */}
                    <div className="flex-1 flex flex-col">
                        <div className="flex items-start justify-between mb-2">
                             <h3 
                                className="text-xl font-bold text-white cursor-pointer hover:text-indigo-400 transition-colors leading-tight" 
                                onClick={() => navigate(`/detail/${review.mediaType || 'movie'}/${review.movieId}`)}
                            >
                                {review.movieTitle}
                            </h3>
                            <div className="flex items-center bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-2.5 py-1 ml-2 shrink-0">
                                <StarIcon className="w-4 h-4 text-yellow-400 mr-1.5" />
                                <span className="text-base font-bold text-yellow-100">{review.nota}</span>
                            </div>
                        </div>

                        {review.comentario ? (
                            <div className="bg-gray-800/50 border border-white/5 p-4 rounded-xl flex-1">
                                <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
                                    {review.comentario}
                                </p>
                            </div>
                        ) : (
                            <p className="text-gray-500 text-sm italic mt-2">Sem comentário escrito.</p>
                        )}
                    </div>
                </div>

                {/* 4. FOOTER: Ações */}
                <div className="mt-4 pt-4 border-t border-white/5 flex items-center gap-6" data-html2canvas-ignore="true">
                    <div className="relative">
                        <button 
                            onClick={() => setShowReactions(!showReactions)} 
                            className={`flex items-center gap-2 text-sm font-medium transition-all duration-200 group/like ${userReaction ? 'text-indigo-400' : 'text-gray-400 hover:text-gray-200'}`}
                        >
                            <div className={`p-2 rounded-full transition-colors ${userReaction ? 'bg-indigo-500/10' : 'bg-transparent group-hover/like:bg-gray-800'}`}>
                                {userReaction ? <span className="text-xl">{userReaction}</span> : <HeartIcon className="w-5 h-5"/>}
                            </div>
                            <div className="flex items-center">
                                {sortedReactions.slice(0, 3).map(([emoji]) => <span key={emoji} className="text-xs -ml-1">{emoji}</span>)}
                                <span className="ml-1.5">{totalReactions}</span>
                            </div>
                        </button>
                        {showReactions && (
                            <ReactionPicker 
                                onSelect={handleReaction} 
                                onClose={() => setShowReactions(false)} 
                            />
                        )}
                    </div>
                    
                    <button 
                        onClick={() => setShowComments(!showComments)} 
                        className={`flex items-center gap-2 text-sm font-medium transition-all duration-200 group/comment ${showComments ? 'text-indigo-400' : 'text-gray-400 hover:text-gray-200'}`}
                    >
                        <div className={`p-2 rounded-full transition-colors ${showComments ? 'bg-indigo-500/10' : 'bg-transparent group-hover/comment:bg-gray-800'}`}>
                            <MessageSquareIcon className="w-5 h-5"/>
                        </div>
                        <span>{realCommentCount}</span>
                    </button>
                </div>
            </div>
        </div>
    );

    return (
        <div className="mb-6 animate-fade-in">
            <CardContent />
            
            {showComments && (
                <div className="mt-[-10px] mx-2 bg-gray-800/30 border-x border-b border-gray-700 rounded-b-xl p-4 pt-6 relative z-0">
                    <CommentSection 
                        review={review} 
                        onCountChange={setRealCommentCount} 
                        renderConfirmModal={(modal) => { setTimeout(() => setCommentConfirmModal(modal), 0); return null; }}
                    />
                </div>
            )}
            
            {isEditing && <ReviewModal movie={{ id: review.movieId, title: review.movieTitle, poster_path: review.moviePoster.replace('https://image.tmdb.org/t/p/w500', '') }} mediaType={review.mediaType || 'movie'} existingReview={review} onClose={() => setIsEditing(false)} />}
            <ConfirmModal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} onConfirm={confirmDeleteReview} title="Apagar Avaliação" message="Tem certeza?" confirmText="Apagar" isDanger={true} />
            {commentConfirmModal}
        </div>
    );
};

export default ReviewCard;