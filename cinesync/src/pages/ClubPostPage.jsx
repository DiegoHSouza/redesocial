import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../services/firebaseConfig';
import firebase from 'firebase/compat/app';
import { useAuth } from '../contexts/AuthContext';
import { Spinner, getAvatarUrl } from '../components/Common';
import { HeartIcon, TrashIcon, MessageSquareIcon, SendIcon } from '../components/Icons';

const ClubPostPage = () => {
    const { groupId, postId } = useParams();
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    
    const [post, setPost] = useState(null);
    const [comments, setComments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newComment, setNewComment] = useState("");
    const [isPosting, setIsPosting] = useState(false);

    // Carrega Post e Autor
    useEffect(() => {
        const docRef = db.collection('groups').doc(groupId).collection('posts').doc(postId);
        const unsubscribe = docRef.onSnapshot(async (doc) => {
            if (!doc.exists) {
                navigate(`/club/${groupId}`); // Se apagarem o post, volta pro clube
                return;
            }
            const postData = { id: doc.id, ...doc.data() };
            
            // Busca autor do post
            if (postData.authorId) {
                const userDoc = await db.collection('users').doc(postData.authorId).get();
                if (userDoc.exists) postData.author = userDoc.data();
            }
            setPost(postData);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [groupId, postId, navigate]);

    // Carrega Comentários em Tempo Real
    useEffect(() => {
        const commentsRef = db.collection('groups').doc(groupId).collection('posts').doc(postId).collection('comments').orderBy('timestamp', 'asc');
        const unsubscribe = commentsRef.onSnapshot(async (snapshot) => {
            const commentsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            // Popula autores dos comentários
            const authorIds = [...new Set(commentsData.map(c => c.authorId))];
            const authors = {};
            if (authorIds.length > 0) {
                const promises = authorIds.map(uid => db.collection('users').doc(uid).get());
                const docs = await Promise.all(promises);
                docs.forEach(d => { if(d.exists) authors[d.id] = d.data(); });
            }
            const enrichedComments = commentsData.map(c => ({ ...c, author: authors[c.authorId] }));
            setComments(enrichedComments);
        });
        return () => unsubscribe();
    }, [groupId, postId]);

    const handlePostComment = async (e) => {
        e.preventDefault();
        if (!newComment.trim()) return;
        setIsPosting(true);
        
        const batch = db.batch();
        const commentRef = db.collection('groups').doc(groupId).collection('posts').doc(postId).collection('comments').doc();
        const postRef = db.collection('groups').doc(groupId).collection('posts').doc(postId);

        batch.set(commentRef, {
            text: newComment,
            authorId: currentUser.uid,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Atualiza contador de comentários no post principal (para mostrar no feed)
        batch.update(postRef, { commentCount: firebase.firestore.FieldValue.increment(1) });

        await batch.commit();
        setNewComment("");
        setIsPosting(false);
    };

    const handleDeleteComment = async (commentId) => {
        if(!window.confirm("Apagar comentário?")) return;
        const batch = db.batch();
        const commentRef = db.collection('groups').doc(groupId).collection('posts').doc(postId).collection('comments').doc(commentId);
        const postRef = db.collection('groups').doc(groupId).collection('posts').doc(postId);

        batch.delete(commentRef);
        batch.update(postRef, { commentCount: firebase.firestore.FieldValue.increment(-1) });
        await batch.commit();
    };

    const handleLikePost = async () => {
        const isLiked = post.likes?.includes(currentUser.uid);
        const postRef = db.collection('groups').doc(groupId).collection('posts').doc(postId);
        if (isLiked) await postRef.update({ likes: firebase.firestore.FieldValue.arrayRemove(currentUser.uid) });
        else await postRef.update({ likes: firebase.firestore.FieldValue.arrayUnion(currentUser.uid) });
    };

    if (loading) return <Spinner />;
    if (!post) return null;

    const isLiked = post.likes?.includes(currentUser?.uid);

    return (
        <div className="container mx-auto p-4 md:p-8 text-white max-w-4xl">
            <button onClick={() => navigate(`/club/${groupId}`)} className="mb-4 text-gray-400 hover:text-white font-bold flex items-center gap-2">
                ← Voltar para o Clube
            </button>

            {/* POST PRINCIPAL */}
            <div className="bg-gray-800/60 border border-gray-700 p-6 rounded-2xl shadow-xl mb-6">
                <div className="flex items-center gap-3 mb-4 cursor-pointer" onClick={() => navigate(`/profile/${post.authorId}`)}>
                    <img 
                        src={getAvatarUrl(post.author?.foto, post.author?.nome)} 
                        className="w-12 h-12 rounded-full object-cover border-2 border-indigo-500"
                        alt=""
                    />
                    <div>
                        <h1 className="font-bold text-lg text-white">{post.author?.nome}</h1>
                        <p className="text-xs text-gray-400">{post.timestamp?.seconds ? new Date(post.timestamp.seconds * 1000).toLocaleString() : 'agora'}</p>
                    </div>
                </div>
                
                <div className="prose prose-invert max-w-none mb-6">
                    <p className="text-xl text-gray-200 whitespace-pre-wrap leading-relaxed">{post.text}</p>
                </div>

                <div className="flex items-center gap-6 border-t border-gray-700 pt-4">
                    <button onClick={handleLikePost} className={`flex items-center gap-2 font-bold transition-colors ${isLiked ? 'text-pink-500' : 'text-gray-400 hover:text-white'}`}>
                        <HeartIcon className={`w-6 h-6 ${isLiked ? 'fill-current' : ''}`} />
                        {post.likes?.length || 0} Curtidas
                    </button>
                    <div className="flex items-center gap-2 text-gray-400 font-bold">
                        <MessageSquareIcon className="w-6 h-6" />
                        {comments.length} Comentários
                    </div>
                </div>
            </div>

            {/* SESSÃO DE COMENTÁRIOS */}
            <div className="bg-gray-900/50 rounded-xl p-4 md:p-6 border border-gray-800">
                <h3 className="text-lg font-bold mb-6">Discussão</h3>
                
                {/* Input de Comentário */}
                <form onSubmit={handlePostComment} className="flex gap-4 mb-8">
                    <img src={getAvatarUrl(null, 'Eu')} className="w-10 h-10 rounded-full" alt=""/>
                    <div className="flex-1 relative">
                        <textarea 
                            value={newComment}
                            onChange={e => setNewComment(e.target.value)}
                            placeholder="O que você acha disso?"
                            className="w-full bg-gray-800 border border-gray-700 rounded-xl p-3 text-white focus:outline-none focus:border-indigo-500 min-h-[80px] resize-y"
                        />
                        <button 
                            type="submit" 
                            disabled={!newComment.trim() || isPosting}
                            className="absolute bottom-3 right-3 bg-indigo-600 p-2 rounded-lg hover:bg-indigo-500 disabled:opacity-50 transition-colors"
                        >
                            <SendIcon className="w-4 h-4 text-white" />
                        </button>
                    </div>
                </form>

                {/* Lista de Comentários */}
                <div className="space-y-6">
                    {comments.map(comment => (
                        <div key={comment.id} className="flex gap-3 animate-fade-in">
                            <div className="flex-shrink-0 cursor-pointer" onClick={() => navigate(`/profile/${comment.authorId}`)}>
                                <img 
                                    src={getAvatarUrl(comment.author?.foto, comment.author?.nome)} 
                                    className="w-8 h-8 rounded-full object-cover"
                                    alt=""
                                />
                            </div>
                            <div className="flex-1">
                                <div className="bg-gray-800 p-3 rounded-2xl rounded-tl-none border border-gray-700/50">
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="font-bold text-sm hover:underline cursor-pointer" onClick={() => navigate(`/profile/${comment.authorId}`)}>{comment.author?.nome}</span>
                                        {currentUser && currentUser.uid === comment.authorId && (
                                            <button onClick={() => handleDeleteComment(comment.id)} className="text-gray-500 hover:text-red-400" title="Apagar">
                                                <TrashIcon className="w-3 h-3" />
                                            </button>
                                        )}
                                    </div>
                                    <p className="text-gray-300 text-sm whitespace-pre-wrap">{comment.text}</p>
                                </div>
                                <div className="ml-2 mt-1 flex gap-3 text-xs text-gray-500">
                                    <span>{comment.timestamp ? new Date(comment.timestamp.seconds * 1000).toLocaleDateString() : 'agora'}</span>
                                    {/* Futuro: Botão Responder */}
                                </div>
                            </div>
                        </div>
                    ))}
                    {comments.length === 0 && <p className="text-center text-gray-500 py-4">Nenhum comentário ainda.</p>}
                </div>
            </div>
        </div>
    );
};

export default ClubPostPage;