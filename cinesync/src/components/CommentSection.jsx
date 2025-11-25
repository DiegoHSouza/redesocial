import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../services/firebaseConfig'; 
import firebase from 'firebase/compat/app';
import { useAuth } from '../contexts/AuthContext';
import { SendIcon, DotsVerticalIcon, PencilIcon, TrashIcon, CheckIcon, CloseIcon } from './Icons';
import { getAvatarUrl } from './Common';
import ConfirmModal from './ConfirmModal';

const CommentSection = ({ review, onCountChange }) => {
    const navigate = useNavigate();
    const { currentUser, userData } = useAuth();
    const [comments, setComments] = useState([]);
    const [newComment, setNewComment] = useState("");
    const [loading, setLoading] = useState(true);
    const [isPosting, setIsPosting] = useState(false);
    
    const [editingCommentId, setEditingCommentId] = useState(null);
    const [editedText, setEditedText] = useState("");
    const [showOptions, setShowOptions] = useState(null);
    
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [commentToDelete, setCommentToDelete] = useState(null);

    const optionsRef = useRef(null);

    // Buscar comentários em tempo real
    useEffect(() => {
        const q = db.collection("reviews").doc(review.id).collection("comments").orderBy("timestamp", "asc");
        
        const unsubscribe = q.onSnapshot(async (snapshot) => {
            const commentsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const realCount = commentsData.length;

            // 1. Atualiza o pai visualmente imediatamente
            if (onCountChange) {
                onCountChange(realCount);
            }

            // 2. AUTO-CORREÇÃO DO BANCO DE DADOS (Self-Healing)
            // Se o número no banco (review.commentCount) for diferente do número real de itens (realCount),
            // e não estivermos no meio de uma postagem (para evitar conflito), corrigimos o banco agora.
            if (review.commentCount !== realCount && !isPosting) {
                console.log(`Corrigindo contador da review ${review.id}: de ${review.commentCount} para ${realCount}`);
                db.collection("reviews").doc(review.id).update({ commentCount: realCount })
                  .catch(err => console.error("Erro ao auto-corrigir contador:", err));
            }

            // Carregar autores
            const authorIds = [...new Set(commentsData.map(c => c.uidAutor))];
            const authors = {};
            if (authorIds.length > 0) {
                try {
                    const authorPromises = authorIds.map(id => db.collection('users').doc(id).get());
                    const authorDocs = await Promise.all(authorPromises);
                    authorDocs.forEach(doc => {
                        if (doc.exists) authors[doc.id] = doc.data();
                    });
                } catch (e) { console.error(e); }
            }
            const commentsWithAuthors = commentsData.map(c => ({ ...c, authorInfo: authors[c.uidAutor] }));

            setComments(commentsWithAuthors);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [review.id]); // Removemos isPosting e review.commentCount das dependências para evitar loops
    
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (optionsRef.current && !optionsRef.current.contains(event.target)) {
                setShowOptions(null);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handlePostComment = async (e) => {
        e.preventDefault();
        if (!newComment.trim() || !currentUser) return;
        setIsPosting(true);

        const batch = db.batch();
        const reviewRef = db.collection("reviews").doc(review.id);
        const commentRef = reviewRef.collection("comments").doc();

        batch.set(commentRef, {
            text: newComment,
            uidAutor: currentUser.uid,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        });

        // Incrementamos atomicamente para garantir consistência em novas adições
        batch.update(reviewRef, { commentCount: firebase.firestore.FieldValue.increment(1) });
        const userRef = db.collection("users").doc(currentUser.uid);
        batch.update(userRef, { 'stats.comments': firebase.firestore.FieldValue.increment(1) });

        try {
            await batch.commit();
            setNewComment("");
            
            if (review.uidAutor !== currentUser.uid) {
                 await db.collection("notifications").add({
                    recipientId: review.uidAutor,
                    senderId: currentUser.uid,
                    type: 'comment',
                    reviewId: review.id,
                    mediaId: review.movieId,
                    mediaType: review.mediaType || 'movie',
                    read: false,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                });
            }
        } catch (error) {
            console.error("Erro ao postar comentário:", error);
        } finally {
            setIsPosting(false);
        }
    };

    const handleUpdateComment = async (commentId) => {
        if (!editedText.trim()) return;
        try {
            await db.collection("reviews").doc(review.id).collection("comments").doc(commentId).update({ text: editedText });
            setEditingCommentId(null);
            setEditedText("");
        } catch(e) { console.error(e); }
    };

    const requestDelete = (commentId) => {
        setCommentToDelete(commentId);
        setDeleteModalOpen(true);
        setShowOptions(null);
    }

    const confirmDeleteComment = async () => {
        if (!commentToDelete) return;

        const updatedList = comments.filter(c => c.id !== commentToDelete);
        setComments(updatedList);
        
        if (onCountChange) {
            onCountChange(updatedList.length);
        }

        const batch = db.batch();
        const reviewRef = db.collection("reviews").doc(review.id);
        const commentRef = reviewRef.collection("comments").doc(commentToDelete);
        const userRef = db.collection("users").doc(currentUser.uid);

        batch.delete(commentRef);
        batch.update(reviewRef, { commentCount: firebase.firestore.FieldValue.increment(-1) });
        batch.update(userRef, { 'stats.comments': firebase.firestore.FieldValue.increment(-1) });

        try {
            await batch.commit();
        } catch (error) {
            console.error("Erro ao excluir comentário:", error);
        }
    };

    return (
        <div className="space-y-4">
            {loading && <p className="text-xs text-gray-400">Carregando...</p>}
            
            {!loading && comments.length === 0 && (
                <p className="text-xs text-gray-500 italic text-center py-2">Seja o primeiro a comentar!</p>
            )}

            {!loading && comments.length > 0 && (
                <div className="space-y-4">
                    {comments.map(comment => {
                        const isOwner = currentUser && currentUser.uid === comment.uidAutor;
                        const avatarSrc = getAvatarUrl(comment.authorInfo?.foto, comment.authorInfo?.nome);
                        
                        return (
                            <div key={comment.id} className="flex items-start space-x-3 group">
                                <img 
                                    src={avatarSrc} 
                                    alt={comment.authorInfo?.nome} 
                                    className="w-8 h-8 rounded-full object-cover cursor-pointer" 
                                    onClick={() => navigate(`/profile/${comment.uidAutor}`)}
                                    onError={(e) => { e.target.onerror = null; e.target.src=getAvatarUrl(null, comment.authorInfo?.nome); }}
                                />
                                <div className="flex-1 bg-gray-700/40 p-3 rounded-xl relative">
                                        {editingCommentId === comment.id ? (
                                            <div className="flex items-center gap-2">
                                                <input 
                                                    type="text" 
                                                    value={editedText} 
                                                    onChange={(e) => setEditedText(e.target.value)} 
                                                    className="w-full px-2 py-1 bg-gray-800 border border-gray-600 rounded focus:outline-none text-sm text-gray-100" 
                                                    autoFocus 
                                                    onKeyDown={(e) => e.key === 'Enter' && handleUpdateComment(comment.id)}
                                                />
                                                <button onClick={() => handleUpdateComment(comment.id)}><CheckIcon className="w-4 h-4 text-green-400"/></button>
                                                <button onClick={() => setEditingCommentId(null)}><CloseIcon className="w-4 h-4 text-red-400"/></button>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="flex justify-between items-start">
                                                    <p className="font-semibold text-gray-100 cursor-pointer hover:underline text-sm" onClick={() => navigate(`/profile/${comment.uidAutor}`)}>{comment.authorInfo?.nome}</p>
                                                    {isOwner && (
                                                        <div className="relative" ref={showOptions === comment.id ? optionsRef : null}>
                                                            <button onClick={() => setShowOptions(showOptions === comment.id ? null : comment.id)} className="text-gray-400 hover:text-white p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <DotsVerticalIcon className="w-4 h-4"/>
                                                            </button>
                                                            {showOptions === comment.id && (
                                                                <div className="absolute right-0 mt-2 w-32 bg-gray-800 border border-gray-700 rounded-md shadow-lg z-10">
                                                                    <button onClick={() => handleEditComment(comment)} className="w-full text-left flex items-center px-4 py-2 text-xs text-gray-300 hover:bg-indigo-600 hover:text-white"><PencilIcon className="w-3 h-3 mr-2"/> Editar</button>
                                                                    <button onClick={() => requestDelete(comment.id)} className="w-full text-left flex items-center px-4 py-2 text-xs text-red-400 hover:bg-red-500 hover:text-white"><TrashIcon className="w-3 h-3 mr-2"/> Excluir</button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                                <p className="text-gray-300 mt-0.5 text-sm leading-relaxed">{comment.text}</p>
                                            </>
                                        )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
            {currentUser && (
                <form onSubmit={handlePostComment} className="flex items-start space-x-3 pt-4">
                    <img 
                        src={getAvatarUrl(userData?.foto, userData?.nome)} 
                        alt="Eu" 
                        className="w-8 h-8 rounded-full object-cover"
                        onError={(e) => { e.target.onerror = null; e.target.src=getAvatarUrl(null, userData?.nome); }}
                    />
                    <div className="relative flex-1">
                        <input type="text" value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="Adicionar um comentário..." className="w-full px-4 py-2 bg-gray-900/70 border border-gray-600 rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-500 text-gray-100 text-sm pr-12" />
                        {newComment && (
                            <button type="submit" disabled={isPosting} className="absolute inset-y-0 right-0 flex items-center justify-center w-10 text-indigo-400 hover:text-indigo-300 disabled:opacity-50">
                                <SendIcon className="w-5 h-5"/>
                            </button>
                        )}
                    </div>
                </form>
            )}

            <ConfirmModal 
                isOpen={deleteModalOpen}
                onClose={() => setDeleteModalOpen(false)}
                onConfirm={confirmDeleteComment}
                title="Apagar Comentário"
                message="Tem certeza que deseja apagar este comentário?"
                confirmText="Apagar"
                isDanger={true}
            />
        </div>
    );
};

export default CommentSection;