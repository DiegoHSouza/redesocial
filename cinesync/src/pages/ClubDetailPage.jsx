import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../services/firebaseConfig';
import { collection, doc, onSnapshot, query, orderBy, getDocs, updateDoc, arrayUnion, addDoc, serverTimestamp, arrayRemove, deleteDoc, where, getDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { Spinner, getAvatarUrl } from '../components/Common';
import { UsersIcon, HeartIcon, TrashIcon, MessageSquareIcon, CloseIcon, CheckIcon } from '../components/Icons';
import ConfirmModal from '../components/ConfirmModal';

const ClubDetailPage = () => {
    const { groupId } = useParams();
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    
    const [groupData, setGroupData] = useState(null);
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newPostText, setNewPostText] = useState("");
    const [isPosting, setIsPosting] = useState(false);

    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [postIdToDelete, setPostIdToDelete] = useState(null);

    useEffect(() => {
        const groupRef = doc(db, 'groups', groupId);
        const unsubscribe = onSnapshot(groupRef, (doc) => {
            if (doc.exists()) {
                setGroupData({ id: doc.id, ...doc.data() });
            } else {
                navigate('/clubs');
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, [groupId, navigate]);

    useEffect(() => {
        const q = query(collection(db, 'groups', groupId, 'posts'), orderBy('timestamp', 'desc'));
        const unsubscribe = onSnapshot(q, async (snapshot) => {
            const postsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            const authorIds = [...new Set(postsData.map(p => p.authorId))];
            const authors = {};
            if (authorIds.length > 0) {
                // Busca os dados de cada autor de forma eficiente
                const authorSnapshots = await Promise.all(authorIds.map(uid => getDoc(doc(db, 'users', uid))));
                authorSnapshots.forEach(userDoc => {
                    if (userDoc.exists()) authors[userDoc.id] = userDoc.data();
                });
            }
            
            const postsWithAuthors = postsData.map(p => ({ ...p, author: authors[p.authorId] }));
            setPosts(postsWithAuthors);
        });
        return () => unsubscribe();
    }, [groupId]);

    const handleJoin = async () => {
        await updateDoc(doc(db, 'groups', groupId), {
            members: arrayUnion(currentUser.uid)
        });
    };

    const handleLeave = async () => {
        if (!window.confirm("Tem certeza que deseja sair deste clube?")) return;
        await updateDoc(doc(db, 'groups', groupId), {
            members: arrayRemove(currentUser.uid)
        });
    };

    const handlePost = async (e) => {
        e.preventDefault();
        if (!newPostText.trim()) return;
        setIsPosting(true);
        try {
            await addDoc(collection(db, 'groups', groupId, 'posts'), {
                text: newPostText,
                authorId: currentUser.uid,
                timestamp: serverTimestamp(),
                likes: [],
                commentCount: 0
            });
            setNewPostText("");
        } catch (error) { console.error(error); }
        setIsPosting(false);
    };

    const handleLikePost = async (e, post) => {
        e.stopPropagation(); 
        const isLiked = post.likes?.includes(currentUser.uid);
        const postRef = doc(db, 'groups', groupId, 'posts', post.id);
        
        if (isLiked) {
            await updateDoc(postRef, { likes: arrayRemove(currentUser.uid) });
        } else {
            await updateDoc(postRef, { likes: arrayUnion(currentUser.uid) });
        }
    };

    const requestDeletePost = (e, postId) => {
        e.stopPropagation();
        setPostIdToDelete(postId);
        setDeleteModalOpen(true);
    };

    const confirmDeletePost = async () => {
        if (!postIdToDelete) return;
        try {
            await deleteDoc(doc(db, 'groups', groupId, 'posts', postIdToDelete));
        } catch (error) { console.error(error); }
    };

    if (loading) return <Spinner />;
    if (!groupData) return null;

    const isMember = groupData.members?.includes(currentUser.uid);

    return (
        <div className="text-white">
            {/* --- BANNER --- */}
            <div className="h-32 md:h-48 bg-gradient-to-r from-indigo-900 to-purple-900"></div>
            <div className="bg-gray-800/80 backdrop-blur-md border-b border-gray-700 shadow-lg">
                <div className="container mx-auto px-4 md:px-8 flex items-end gap-4 -mt-12 md:-mt-16">
                    <img src={groupData.photo} className="w-24 h-24 md:w-32 md:h-32 rounded-2xl border-4 border-gray-800 shadow-xl bg-gray-700" alt="" />
                    <div className="py-4 flex-1">
                        <h1 className="text-2xl md:text-4xl font-bold">{groupData.name}</h1>
                        <p className="text-gray-400 text-sm">c/{groupData.name.toLowerCase().replace(/\s+/g, '')}</p>
                    </div>
                </div>
            </div>

            <div className="container mx-auto p-4 md:p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Botão de Voltar */}
                <div className="lg:col-span-3 mb-0 -mt-4">
                    <button onClick={() => navigate('/clubs')} className="text-gray-400 hover:text-white font-bold flex items-center gap-2 transition-colors text-sm">
                        <span className="text-xl leading-none">←</span> Voltar para todos os clubes
                    </button>
                </div>
                {/* --- COLUNA PRINCIPAL (POSTS) --- */}
                <div className="lg:col-span-2 space-y-6">
                    {/* O formulário de postagem foi movido para a ordem natural do fluxo no mobile */}
                    {isMember && (
                        <form onSubmit={handlePost} className="bg-gray-800 p-4 rounded-xl border border-gray-700 shadow-lg">
                            <div className="flex gap-3 items-start">
                                <img src={getAvatarUrl(null, "Eu")} className="w-10 h-10 rounded-full flex-shrink-0" alt="" />
                                <textarea
                                    value={newPostText}
                                    onChange={e => setNewPostText(e.target.value)}
                                    placeholder={`O que está pensando, membro?`}
                                    className="flex-1 bg-gray-700/50 border border-gray-600 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 transition-colors w-full min-h-[48px] resize-y"
                                    rows="1"
                                />
                            </div>
                            <div className="flex justify-end mt-3">
                                <button type="submit" disabled={isPosting || !newPostText.trim()} className="bg-indigo-600 px-5 py-2 rounded-lg font-bold text-sm hover:bg-indigo-500 disabled:opacity-50 transition-colors">
                                    Postar
                                </button>
                            </div>
                        </form>
                    )}

                    {posts.length > 0 ? posts.map(post => {
                        const isLiked = post.likes?.includes(currentUser.uid);
                        const isAuthor = post.authorId === currentUser.uid;
                        const isAdmin = groupData.adminId === currentUser.uid;
                        
                        return (
                            <div 
                                key={post.id} 
                                onClick={() => navigate(`/club/${groupId}/post/${post.id}`)}
                                className="bg-gray-800/70 border border-gray-700 rounded-xl animate-fade-in cursor-pointer hover:border-indigo-500/40 transition-all group relative pl-4"
                            >
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-gray-700 group-hover:bg-indigo-500 transition-colors rounded-l-xl"></div>
                                <div className="p-4">
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex items-center gap-3">
                                            <img 
                                                src={getAvatarUrl(post.author?.foto, post.author?.nome)} 
                                                className="w-9 h-9 rounded-full object-cover"
                                                onError={(e) => { e.target.onerror = null; e.target.src=getAvatarUrl(null, post.author?.nome); }}
                                            />
                                            <div>
                                                <p className="font-bold text-sm hover:underline" onClick={(e) => { e.stopPropagation(); navigate(`/profile/${post.authorId}`); }}>{post.author?.nome || "Usuário"}</p>
                                                <p className="text-xs text-gray-500">{post.timestamp ? new Date(post.timestamp.seconds * 1000).toLocaleString() : 'agora'}</p>
                                            </div>
                                        </div>
                                        {(isAuthor || isAdmin) && (
                                            <button onClick={(e) => requestDeletePost(e, post.id)} className="text-gray-500 hover:text-red-400 p-2 rounded-full hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"><TrashIcon className="w-4 h-4" /></button>
                                        )}
                                    </div>
                                    
                                    <p className="text-gray-200 mb-4 whitespace-pre-wrap text-base leading-relaxed line-clamp-4">{post.text}</p>
                                    
                                    <div className="flex items-center gap-4 pt-3 border-t border-gray-700/50">
                                        <button 
                                            onClick={(e) => handleLikePost(e, post)} 
                                            className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full transition-colors ${isLiked ? 'text-pink-400 bg-pink-500/10' : 'text-gray-400 hover:bg-gray-700 hover:text-white'}`}
                                        >
                                            <HeartIcon className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
                                            {post.likes?.length || 0}
                                        </button>
                                        <div className="flex items-center gap-1.5 text-xs text-gray-400 font-bold px-3 py-1.5">
                                            <MessageSquareIcon className="w-4 h-4" />
                                            {post.commentCount || 0}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    }) : (
                        <div className="text-center py-16 text-gray-500 border-2 border-dashed border-gray-800 rounded-2xl">
                            <p className="text-lg font-medium">Ainda não há posts neste clube.</p>
                            <p className="text-sm">Seja o primeiro a puxar assunto!</p>
                        </div>
                    )}
                </div>

                {/* --- COLUNA LATERAL (SOBRE O CLUBE) --- */}
                <div className="lg:col-span-1 space-y-6 lg:order-first">
                    <div className="bg-gray-800/70 p-5 rounded-xl border border-gray-700">
                        <h3 className="font-bold text-lg border-b border-gray-700 pb-2 mb-3">Sobre o Clube</h3>
                        <p className="text-gray-400 text-sm mb-4">Um espaço para fãs de {groupData.name}.</p>
                        <div className="flex items-center gap-6 text-sm">
                            <div className="text-center flex-1">
                                <p className="font-bold text-xl">{groupData.members?.length}</p>
                                <p className="text-gray-400">Membros</p>
                            </div>
                            <div className="text-center flex-1">
                                <p className="font-bold text-xl">{posts.length}</p>
                                <p className="text-gray-400">Posts</p>
                            </div>
                        </div>
                        <div className="mt-6">
                            {isMember ? (
                                <button onClick={handleLeave} className="w-full bg-gray-700 hover:bg-red-800/50 text-red-400 border border-red-500/20 py-2 rounded-lg font-bold transition-colors flex items-center justify-center gap-2">
                                    <CloseIcon className="w-4 h-4" /> Sair do Clube
                                </button>
                            ) : (
                                <button onClick={handleJoin} className="w-full bg-indigo-600 hover:bg-indigo-500 py-2 rounded-lg font-bold transition-colors">
                                    Participar
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <ConfirmModal 
                isOpen={deleteModalOpen}
                onClose={() => setDeleteModalOpen(false)}
                onConfirm={confirmDeletePost}
                title="Apagar Post"
                message="Tem certeza que deseja apagar este post? A ação não pode ser desfeita."
                confirmText="Apagar"
                isDanger={true}
            />
        </div>
    );
};

export default ClubDetailPage;