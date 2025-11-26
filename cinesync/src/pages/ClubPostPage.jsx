import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../services/firebaseConfig';
import { doc, onSnapshot, collection, query, orderBy, addDoc, serverTimestamp, updateDoc, increment, deleteDoc, arrayRemove, arrayUnion, getDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { Spinner, getAvatarUrl } from '../components/Common';
import { HeartIcon, TrashIcon, MessageSquareIcon, SendIcon } from '../components/Icons';

const ClubPostPage = () => {
    const { groupId, postId } = useParams();
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    
    const [groupData, setGroupData] = useState(null);
    const [post, setPost] = useState(null);
    const [comments, setComments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newComment, setNewComment] = useState("");
    const [isPosting, setIsPosting] = useState(false);

    // Carrega Post e Autor
    useEffect(() => {
        const groupRef = doc(db, 'groups', groupId);
        const unsubGroup = onSnapshot(groupRef, (doc) => {
            if (doc.exists()) setGroupData({ id: doc.id, ...doc.data() });
        });

        const postRef = doc(db, 'groups', groupId, 'posts', postId);
        const unsubPost = onSnapshot(postRef, async (postDoc) => {
            if (!postDoc.exists()) {
                navigate(`/club/${groupId}`); // Se apagarem o post, volta pro clube
                return;
            }
            const postData = { id: postDoc.id, ...postDoc.data() };
            
            // Busca autor do post
            if (postData.authorId) {
                const userRef = doc(db, 'users', postData.authorId);
                onSnapshot(userRef, (userDoc) => {
                    if (userDoc.exists()) {
                        postData.author = userDoc.data();
                        setPost(postData); // Atualiza o estado com o autor
                    }
                });
            }
            setPost(postData);
            setLoading(false);
        });
        return () => { unsubGroup(); unsubPost(); };
    }, [groupId, postId, navigate]);

    // Carrega Comentários em Tempo Real
    useEffect(() => {
        const commentsQuery = query(collection(db, 'groups', groupId, 'posts', postId, 'comments'), orderBy('timestamp', 'asc'));
        const unsubscribe = onSnapshot(commentsQuery, async (snapshot) => {
            const commentsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            // Popula autores dos comentários
            const authorIds = [...new Set(commentsData.map(c => c.authorId))];
            const authors = {};
            if (authorIds.length > 0) {
                const authorSnapshots = await Promise.all(authorIds.map(uid => getDoc(doc(db, 'users', uid)))); // Busca todos os documentos de autor de uma vez
                authorSnapshots.forEach(userDoc => {
                    if (userDoc.exists()) authors[userDoc.id] = userDoc.data();
                });
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
        
        const commentsColRef = collection(db, 'groups', groupId, 'posts', postId, 'comments');
        await addDoc(commentsColRef, {
            text: newComment,
            authorId: currentUser.uid,
            timestamp: serverTimestamp()
        });

        const postRef = doc(db, 'groups', groupId, 'posts', postId);
        await updateDoc(postRef, { commentCount: increment(1) });

        setNewComment("");
        setIsPosting(false);
    };

    const handleDeleteComment = async (commentId) => {
        if(!window.confirm("Apagar comentário?")) return;
        
        const commentRef = doc(db, 'groups', groupId, 'posts', postId, 'comments', commentId);
        await deleteDoc(commentRef);

        const postRef = doc(db, 'groups', groupId, 'posts', postId);
        await updateDoc(postRef, { commentCount: increment(-1) });
    };

    const handleLikePost = async () => {
        const isLiked = post.likes?.includes(currentUser.uid);
        const postRef = doc(db, 'groups', groupId, 'posts', postId);
        if (isLiked) await updateDoc(postRef, { likes: arrayRemove(currentUser.uid) });
        else await updateDoc(postRef, { likes: arrayUnion(currentUser.uid) });
    };

    if (loading) return <Spinner />;
    if (!post || !groupData) return null;

    const isLiked = post.likes?.includes(currentUser?.uid);

    return (
        <div className="container mx-auto p-4 md:p-8 text-white">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* --- COLUNA PRINCIPAL (POST E COMENTÁRIOS) --- */}
                <div className="lg:col-span-2">
                    {/* Botão de Voltar */}
                    <button onClick={() => navigate(`/club/${groupId}`)} className="mb-4 text-gray-400 hover:text-white font-bold flex items-center gap-2 transition-colors text-sm">
                        <span className="text-xl leading-none">←</span> Voltar para o Clube
                    </button>

                    {/* POST PRINCIPAL */}
                    <div className="bg-gray-800/70 border border-gray-700 rounded-xl shadow-xl mb-8">
                        <div className="p-5">
                            <div className="flex items-center gap-3 mb-4 cursor-pointer" onClick={() => navigate(`/profile/${post.authorId}`)}>
                                <img 
                                    src={getAvatarUrl(post.author?.foto, post.author?.nome)} 
                                    className="w-10 h-10 rounded-full object-cover"
                                    alt=""
                                />
                                <div>
                                    <h1 className="font-bold text-base text-white hover:underline">{post.author?.nome}</h1>
                                    <p className="text-xs text-gray-500">{post.timestamp?.seconds ? new Date(post.timestamp.seconds * 1000).toLocaleString() : 'agora'}</p>
                                </div>
                            </div>
                            
                            <p className="text-lg text-gray-200 whitespace-pre-wrap leading-relaxed mb-5">{post.text}</p>

                            <div className="flex items-center gap-4 border-t border-gray-700/50 pt-4">
                                <button onClick={handleLikePost} className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full transition-colors ${isLiked ? 'text-pink-400 bg-pink-500/10' : 'text-gray-400 hover:bg-gray-700 hover:text-white'}`}>
                                    <HeartIcon className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
                                    {post.likes?.length || 0}
                                </button>
                                <div className="flex items-center gap-1.5 text-xs text-gray-400 font-bold px-3 py-1.5">
                                    <MessageSquareIcon className="w-4 h-4" />
                                    {comments.length}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* SESSÃO DE COMENTÁRIOS */}
                    <div className="bg-gray-800/70 rounded-xl p-4 md:p-6 border border-gray-700">
                        {/* Input de Comentário */}
                        <form onSubmit={handlePostComment} className="flex gap-3 mb-8 items-start">
                            <img src={getAvatarUrl(null, 'Eu')} className="w-9 h-9 rounded-full mt-1" alt=""/>
                            <div className="flex-1">
                                <textarea 
                                    value={newComment}
                                    onChange={e => setNewComment(e.target.value)}
                                    placeholder="Deixe seu comentário..."
                                    className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 transition-colors min-h-[48px] resize-y"
                                    rows="1"
                                />
                                <div className="flex justify-end mt-2">
                                    <button 
                                        type="submit" 
                                        disabled={!newComment.trim() || isPosting}
                                        className="bg-indigo-600 px-4 py-1.5 rounded-lg font-bold text-sm hover:bg-indigo-500 disabled:opacity-50 transition-colors"
                                    >
                                        Comentar
                                    </button>
                                </div>
                            </div>
                        </form>

                        {/* Lista de Comentários */}
                        <div className="space-y-5">
                            {comments.map(comment => (
                                <div key={comment.id} className="flex gap-3 animate-fade-in relative pl-5">
                                    {/* Linha da Thread */}
                                    <div className="absolute left-4 top-10 bottom-0 w-0.5 bg-gray-700/50"></div>

                                    <div className="flex-shrink-0 z-10" onClick={() => navigate(`/profile/${comment.authorId}`)}>
                                        <img 
                                            src={getAvatarUrl(comment.author?.foto, comment.author?.nome)} 
                                            className="w-8 h-8 rounded-full object-cover cursor-pointer"
                                            alt=""
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <div className="bg-gray-800 p-3 rounded-lg border border-gray-700/50">
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="font-bold text-sm hover:underline cursor-pointer" onClick={() => navigate(`/profile/${comment.authorId}`)}>{comment.author?.nome}</span>
                                                {currentUser && currentUser.uid === comment.authorId && (
                                                    <button onClick={() => handleDeleteComment(comment.id)} className="text-gray-500 hover:text-red-400" title="Apagar">
                                                        <TrashIcon className="w-3 h-3" />
                                                    </button>
                                                )}
                                            </div>
                                            <p className="text-gray-300 text-sm whitespace-pre-wrap">{comment.text}</p>
                                        </div>
                                        <div className="ml-2 mt-1.5 flex gap-3 text-xs text-gray-500">
                                            <span>{comment.timestamp ? new Date(comment.timestamp.seconds * 1000).toLocaleDateString() : 'agora'}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {comments.length === 0 && <p className="text-center text-gray-500 py-6">Nenhum comentário ainda. Seja o primeiro!</p>}
                        </div>
                    </div>
                </div>

                {/* --- COLUNA LATERAL (SOBRE O CLUBE) --- */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-gray-800/70 p-5 rounded-xl border border-gray-700">
                        <div className="flex items-center gap-3 mb-4">
                            <img src={groupData.photo} className="w-12 h-12 rounded-lg bg-gray-700" alt="" />
                            <div>
                                <p className="text-xs text-gray-400">Postado em</p>
                                <h3 className="font-bold text-lg">{groupData.name}</h3>
                            </div>
                        </div>
                        <p className="text-gray-400 text-sm mb-4">Um espaço para fãs de {groupData.name}.</p>
                        <div className="flex items-center gap-4 text-sm border-t border-gray-700 pt-3">
                            <div className="text-center">
                                <p className="font-bold text-xl">{groupData.members?.length}</p>
                                <p className="text-gray-400">Membros</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ClubPostPage;