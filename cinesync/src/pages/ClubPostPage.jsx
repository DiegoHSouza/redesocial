import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../services/firebaseConfig';
import { 
    doc, onSnapshot, collection, query, orderBy, 
    addDoc, serverTimestamp, updateDoc, increment, 
    deleteDoc, arrayRemove, arrayUnion, getDoc 
} from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { Spinner, getAvatarUrl } from '../components/Common';
import { 
    HeartIcon, TrashIcon, MessageSquareIcon, 
    ArrowLeftIcon, ShareIcon, CalendarIcon, SendIcon 
} from '../components/Icons'; // Certifique-se de que os ícones existem

const ClubPostPage = () => {
    const { groupId, postId } = useParams();
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    
    // -- State --
    const [groupData, setGroupData] = useState(null);
    const [post, setPost] = useState(null);
    const [comments, setComments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newComment, setNewComment] = useState("");
    const [isPosting, setIsPosting] = useState(false);

    // 1. Load Post, Group & Author
    useEffect(() => {
        const groupRef = doc(db, 'groups', groupId);
        const unsubGroup = onSnapshot(groupRef, (doc) => {
            if (doc.exists()) setGroupData({ id: doc.id, ...doc.data() });
        });

        const postRef = doc(db, 'groups', groupId, 'posts', postId);
        const unsubPost = onSnapshot(postRef, (postDoc) => {
            if (!postDoc.exists()) {
                navigate(`/club/${groupId}`);
                return;
            }
            const postData = { id: postDoc.id, ...postDoc.data() };
            
            // Fetch Post Author
            if (postData.authorId) {
                const userRef = doc(db, 'users', postData.authorId);
                getDoc(userRef).then(userSnap => {
                    if (userSnap.exists()) {
                        setPost({ ...postData, author: userSnap.data() });
                    } else {
                        setPost(postData);
                    }
                    setLoading(false);
                });
            } else {
                setPost(postData);
                setLoading(false);
            }
        });

        return () => { unsubGroup(); unsubPost(); };
    }, [groupId, postId, navigate]);

    // 2. Load Comments Real-time
    useEffect(() => {
        const commentsQuery = query(collection(db, 'groups', groupId, 'posts', postId, 'comments'), orderBy('timestamp', 'asc'));
        const unsubscribe = onSnapshot(commentsQuery, async (snapshot) => {
            const commentsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            // Batch fetch comment authors
            const authorIds = [...new Set(commentsData.map(c => c.authorId))];
            const authors = {};
            if (authorIds.length > 0) {
                const authorSnapshots = await Promise.all(authorIds.map(uid => getDoc(doc(db, 'users', uid))));
                authorSnapshots.forEach(userDoc => {
                    if (userDoc.exists()) authors[userDoc.id] = userDoc.data();
                });
            }
            const enrichedComments = commentsData.map(c => ({ ...c, author: authors[c.authorId] }));
            setComments(enrichedComments);
        });
        return () => unsubscribe();
    }, [groupId, postId]);

    // -- Actions --
    const handlePostComment = async (e) => {
        e.preventDefault();
        if (!newComment.trim()) return;
        setIsPosting(true);
        try {
            const commentsColRef = collection(db, 'groups', groupId, 'posts', postId, 'comments');
            await addDoc(commentsColRef, {
                text: newComment,
                authorId: currentUser.uid,
                timestamp: serverTimestamp()
            });

            const postRef = doc(db, 'groups', groupId, 'posts', postId);
            await updateDoc(postRef, { commentCount: increment(1) });
            setNewComment("");
        } catch (error) {
            console.error("Erro ao comentar:", error);
        }
        setIsPosting(false);
    };

    const handleDeleteComment = async (commentId) => {
        if(!window.confirm("Apagar comentário permanentemente?")) return;
        try {
            const commentRef = doc(db, 'groups', groupId, 'posts', postId, 'comments', commentId);
            await deleteDoc(commentRef);
            const postRef = doc(db, 'groups', groupId, 'posts', postId);
            await updateDoc(postRef, { commentCount: increment(-1) });
        } catch (error) {
            console.error(error);
        }
    };

    const handleLikePost = async () => {
        const isLiked = post.likes?.includes(currentUser.uid);
        const postRef = doc(db, 'groups', groupId, 'posts', postId);
        try {
            if (isLiked) await updateDoc(postRef, { likes: arrayRemove(currentUser.uid) });
            else await updateDoc(postRef, { likes: arrayUnion(currentUser.uid) });
        } catch (error) {
            console.error(error);
        }
    };

    if (loading) return <Spinner />;
    if (!post || !groupData) return null;

    const isLiked = post.likes?.includes(currentUser?.uid);

    return (
        <div className="min-h-screen bg-gray-950 text-gray-100 font-sans pb-20">
            
            {/* --- IMMERSIVE MINI-HEADER --- */}
            <div className="relative h-[200px] w-full overflow-hidden group">
                <div 
                    className="absolute inset-0 bg-cover bg-center blur-lg opacity-40 scale-105"
                    style={{ backgroundImage: `url(${groupData.photo})` }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-950/50 to-transparent" />
                
                <div className="absolute top-6 left-4 lg:left-8 z-20 flex items-center justify-between w-[95%] mx-auto">
                    <button onClick={() => navigate(`/club/${groupId}`)} className="flex items-center gap-2 px-4 py-2 bg-black/40 backdrop-blur-md rounded-full text-white hover:bg-white/20 transition-all text-sm font-medium border border-white/10">
                        <ArrowLeftIcon className="w-4 h-4" /> Voltar para {groupData.name}
                    </button>
                </div>
            </div>

            {/* --- MAIN CONTENT --- */}
            <div className="container mx-auto px-4 lg:px-8 max-w-6xl -mt-24 relative z-10">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    
                    {/* LEFT COL: CONTENT (8 cols) */}
                    <div className="lg:col-span-8">
                        
                        {/* 1. THE MAIN POST CARD */}
                        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 md:p-8 shadow-2xl mb-6">
                            
                            {/* Author Info */}
                            <div className="flex items-center gap-4 mb-6">
                                <div className="cursor-pointer" onClick={() => navigate(`/profile/${post.authorId}`)}>
                                    <img 
                                        src={getAvatarUrl(post.author?.foto, post.author?.nome)} 
                                        className="w-12 h-12 rounded-full object-cover border-2 border-gray-800"
                                        alt={post.author?.nome}
                                    />
                                </div>
                                <div>
                                    <h1 
                                        className="font-bold text-lg text-white hover:text-indigo-400 cursor-pointer transition-colors"
                                        onClick={() => navigate(`/profile/${post.authorId}`)}
                                    >
                                        {post.author?.nome || "Usuário Desconhecido"}
                                    </h1>
                                    <div className="flex items-center gap-2 text-xs text-gray-500">
                                        <span>Postado em {post.timestamp?.seconds ? new Date(post.timestamp.seconds * 1000).toLocaleString() : 'Recentemente'}</span>
                                        {post.authorId === groupData.adminId && (
                                            <span className="bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded text-[10px] font-bold">ADMIN</span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Post Content */}
                            <div className="mb-8">
                                <p className="text-gray-200 text-lg leading-relaxed whitespace-pre-wrap">
                                    {post.text}
                                </p>
                            </div>

                            {/* Actions Bar */}
                            <div className="flex items-center justify-between pt-6 border-t border-gray-800">
                                <div className="flex gap-4">
                                    <button 
                                        onClick={handleLikePost} 
                                        className={`flex items-center gap-2 px-4 py-2 rounded-full font-bold transition-all ${
                                            isLiked 
                                            ? 'bg-pink-500/10 text-pink-500 ring-1 ring-pink-500/50' 
                                            : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
                                        }`}
                                    >
                                        <HeartIcon className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} />
                                        <span>{post.likes?.length || 0}</span>
                                    </button>
                                    
                                    <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-gray-800 text-gray-400 font-bold cursor-default">
                                        <MessageSquareIcon className="w-5 h-5" />
                                        <span>{comments.length}</span>
                                    </div>
                                </div>
                                
                                <button className="p-2 text-gray-500 hover:text-white transition-colors">
                                    <ShareIcon className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* 2. COMMENTS SECTION */}
                        <div className="bg-gray-900/50 border border-gray-800/50 rounded-2xl p-6 md:p-8">
                            <h3 className="text-lg font-bold text-gray-300 mb-6 flex items-center gap-2">
                                Discussão <span className="text-gray-600 text-sm font-normal">({comments.length})</span>
                            </h3>

                            {/* Input Form */}
                            <form onSubmit={handlePostComment} className="flex gap-4 mb-10 items-start">
                                <img src={getAvatarUrl(null, 'Eu')} className="w-10 h-10 rounded-full border border-gray-700 hidden md:block" alt=""/>
                                <div className="flex-1 relative group">
                                    <textarea 
                                        value={newComment}
                                        onChange={e => setNewComment(e.target.value)}
                                        placeholder="O que você acha disso?"
                                        className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-4 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-transparent transition-all min-h-[60px] resize-y shadow-inner"
                                        rows="2"
                                    />
                                    <div className="absolute bottom-3 right-3">
                                        <button 
                                            type="submit" 
                                            disabled={!newComment.trim() || isPosting}
                                            className="bg-indigo-600 hover:bg-indigo-500 text-white p-2 rounded-lg transition-all disabled:opacity-50 disabled:scale-95 shadow-lg"
                                        >
                                            <SendIcon className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </form>

                            {/* Comments List */}
                            <div className="space-y-8">
                                {comments.map((comment, index) => (
                                    <div key={comment.id} className="flex gap-4 animate-fade-in relative group">
                                        {/* Thread Line */}
                                        {index !== comments.length - 1 && (
                                            <div className="absolute left-5 top-12 bottom-[-32px] w-[2px] bg-gray-800 group-hover:bg-gray-700 transition-colors"></div>
                                        )}

                                        <div className="flex-shrink-0 z-10 cursor-pointer" onClick={() => navigate(`/profile/${comment.authorId}`)}>
                                            <img 
                                                src={getAvatarUrl(comment.author?.foto, comment.author?.nome)} 
                                                className="w-10 h-10 rounded-full object-cover border border-gray-800"
                                                alt=""
                                            />
                                        </div>
                                        
                                        <div className="flex-1">
                                            <div className="flex items-center justify-between mb-1">
                                                <div className="flex items-center gap-2">
                                                    <span 
                                                        className="font-bold text-sm text-gray-200 hover:underline cursor-pointer"
                                                        onClick={() => navigate(`/profile/${comment.authorId}`)}
                                                    >
                                                        {comment.author?.nome || "Usuário"}
                                                    </span>
                                                    <span className="text-xs text-gray-600">•</span>
                                                    <span className="text-xs text-gray-500">
                                                        {comment.timestamp ? new Date(comment.timestamp.seconds * 1000).toLocaleDateString() : 'agora'}
                                                    </span>
                                                </div>
                                                
                                                {currentUser && currentUser.uid === comment.authorId && (
                                                    <button 
                                                        onClick={() => handleDeleteComment(comment.id)} 
                                                        className="text-gray-600 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                                        title="Apagar"
                                                    >
                                                        <TrashIcon className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                            
                                            <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
                                                {comment.text}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                                
                                {comments.length === 0 && (
                                    <div className="text-center py-10 border-2 border-dashed border-gray-800 rounded-xl">
                                        <p className="text-gray-500">Nenhum comentário ainda.</p>
                                        <p className="text-indigo-400 text-sm mt-1">Seja a primeira pessoa a opinar!</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* RIGHT COL: SIDEBAR (4 cols) */}
                    <div className="lg:col-span-4 hidden lg:block">
                        <div className="sticky top-24 space-y-6">
                            
                            {/* Group Mini Info */}
                            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-xl">
                                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Sobre a Comunidade</h3>
                                <div className="flex items-center gap-4 mb-4 cursor-pointer hover:bg-gray-800/50 p-2 -mx-2 rounded-lg transition-colors" onClick={() => navigate(`/club/${groupId}`)}>
                                    <img src={groupData.photo} className="w-12 h-12 rounded-xl object-cover" alt="" />
                                    <div>
                                        <h2 className="font-bold text-white leading-tight">{groupData.name}</h2>
                                        <p className="text-xs text-gray-400 mt-1">{groupData.members?.length} Membros</p>
                                    </div>
                                </div>
                                <p className="text-sm text-gray-400 leading-relaxed mb-6 border-t border-gray-800 pt-4">
                                    {groupData.description || "Uma comunidade do CineSync."}
                                </p>
                                
                                <button 
                                    onClick={() => navigate(`/club/${groupId}`)}
                                    className="w-full bg-gray-800 hover:bg-gray-700 text-white font-bold py-3 rounded-xl transition-colors text-sm"
                                >
                                    Ver todos os posts
                                </button>
                            </div>

                            {/* Rules (Optional) */}
                            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
                                <h3 className="font-bold text-gray-100 mb-3 text-sm flex items-center gap-2">
                                    <span className="w-1 h-4 bg-indigo-500 rounded-full"></span>
                                    Regras
                                </h3>
                                <ul className="text-xs text-gray-400 space-y-3">
                                    <li className="flex gap-2"><span className="font-bold text-gray-600">1.</span> Respeito acima de tudo.</li>
                                    <li className="flex gap-2"><span className="font-bold text-gray-600">2.</span> Sem spoilers no título.</li>
                                    <li className="flex gap-2"><span className="font-bold text-gray-600">3.</span> Mantenha o foco no tema.</li>
                                </ul>
                            </div>

                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default ClubPostPage;