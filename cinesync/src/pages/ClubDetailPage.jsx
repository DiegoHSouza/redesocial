import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../services/firebaseConfig';
import firebase from 'firebase/compat/app';
import { useAuth } from '../contexts/AuthContext';
import { Spinner, getAvatarUrl } from '../components/Common';
import { UsersIcon, HeartIcon, TrashIcon, MessageSquareIcon } from '../components/Icons';
import ConfirmModal from '../components/ConfirmModal'; // <--- 1. Importado

const ClubDetailPage = () => {
    const { groupId } = useParams();
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    
    const [groupData, setGroupData] = useState(null);
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newPostText, setNewPostText] = useState("");
    const [isPosting, setIsPosting] = useState(false);

    // Estados para o Modal de Exclusão
    const [deleteModalOpen, setDeleteModalOpen] = useState(false); // <--- 2. Estado do Modal
    const [postIdToDelete, setPostIdToDelete] = useState(null);

    useEffect(() => {
        const unsubscribe = db.collection('groups').doc(groupId).onSnapshot(doc => {
            if (doc.exists) {
                setGroupData({ id: doc.id, ...doc.data() });
            } else {
                navigate('/clubs');
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, [groupId, navigate]);

    useEffect(() => {
        const q = db.collection('groups').doc(groupId).collection('posts').orderBy('timestamp', 'desc');
        const unsubscribe = q.onSnapshot(async (snapshot) => {
            const postsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            const authorIds = [...new Set(postsData.map(p => p.authorId))];
            const authors = {};
            if (authorIds.length > 0) {
                const promises = authorIds.map(uid => db.collection('users').doc(uid).get());
                const docs = await Promise.all(promises);
                docs.forEach(d => { if(d.exists) authors[d.id] = d.data(); });
            }
            
            const postsWithAuthors = postsData.map(p => ({ ...p, author: authors[p.authorId] }));
            setPosts(postsWithAuthors);
        });
        return () => unsubscribe();
    }, [groupId]);

    const handleJoin = async () => {
        await db.collection('groups').doc(groupId).update({
            members: firebase.firestore.FieldValue.arrayUnion(currentUser.uid)
        });
    };

    const handlePost = async (e) => {
        e.preventDefault();
        if (!newPostText.trim()) return;
        setIsPosting(true);
        try {
            await db.collection('groups').doc(groupId).collection('posts').add({
                text: newPostText,
                authorId: currentUser.uid,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
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
        const postRef = db.collection('groups').doc(groupId).collection('posts').doc(post.id);
        
        if (isLiked) {
            await postRef.update({ likes: firebase.firestore.FieldValue.arrayRemove(currentUser.uid) });
        } else {
            await postRef.update({ likes: firebase.firestore.FieldValue.arrayUnion(currentUser.uid) });
        }
    };

    // 3. Prepara a exclusão (Abre Modal)
    const requestDeletePost = (e, postId) => {
        e.stopPropagation();
        setPostIdToDelete(postId);
        setDeleteModalOpen(true);
    };

    // 4. Executa a exclusão (Chamado pelo Modal)
    const confirmDeletePost = async () => {
        if (!postIdToDelete) return;
        try {
            await db.collection('groups').doc(groupId).collection('posts').doc(postIdToDelete).delete();
        } catch (error) { console.error(error); }
    };

    if (loading) return <Spinner />;
    if (!groupData) return null;

    const isMember = groupData.members?.includes(currentUser.uid);

    return (
        <div className="container mx-auto p-4 md:p-8 text-white">
            <div className="relative h-48 rounded-2xl overflow-hidden mb-6 bg-gray-800 shadow-2xl">
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-900 to-purple-900 opacity-90"></div>
                <div className="absolute inset-0 flex items-center px-8 gap-6">
                    <img src={groupData.photo} className="w-24 h-24 rounded-2xl border-4 border-gray-900 shadow-xl" alt="" />
                    <div>
                        <h1 className="text-3xl font-bold">{groupData.name}</h1>
                        <p className="text-gray-300 flex items-center gap-2 mt-1">
                            <UsersIcon className="w-5 h-5" /> {groupData.members?.length} Membros
                        </p>
                    </div>
                    <div className="ml-auto">
                        {!isMember ? (
                            <button onClick={handleJoin} className="bg-white text-indigo-900 px-6 py-2 rounded-full font-bold hover:bg-gray-200 transition-colors shadow-lg">
                                Participar
                            </button>
                        ) : (
                            <span className="bg-black/30 px-4 py-1 rounded-full text-sm border border-white/20 backdrop-blur-sm">Membro</span>
                        )}
                    </div>
                </div>
            </div>

            {isMember && (
                <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700 mb-8 shadow-lg">
                    <form onSubmit={handlePost} className="flex gap-4">
                        <img src={getAvatarUrl(null, "Eu")} className="w-10 h-10 rounded-full" alt="" />
                        <div className="flex-1">
                            <input 
                                type="text" 
                                value={newPostText}
                                onChange={e => setNewPostText(e.target.value)}
                                placeholder={`Criar post em ${groupData.name}...`}
                                className="w-full bg-transparent border-b border-gray-600 pb-2 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                            />
                            <div className="flex justify-end mt-2">
                                <button type="submit" disabled={isPosting || !newPostText.trim()} className="bg-indigo-600 px-4 py-1.5 rounded-lg font-bold text-sm hover:bg-indigo-500 disabled:opacity-50 transition-colors">
                                    Postar
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            )}

            <div className="space-y-4 max-w-3xl mx-auto">
                {posts.length > 0 ? posts.map(post => {
                    const isLiked = post.likes?.includes(currentUser.uid);
                    const isAuthor = post.authorId === currentUser.uid;
                    const isAdmin = groupData.adminId === currentUser.uid;
                    
                    return (
                        <div 
                            key={post.id} 
                            onClick={() => navigate(`/club/${groupId}/post/${post.id}`)}
                            className="bg-gray-800/40 border border-gray-700 p-5 rounded-xl animate-fade-in cursor-pointer hover:border-indigo-500/50 hover:bg-gray-800/60 transition-all"
                        >
                            <div className="flex justify-between items-start mb-3">
                                <div className="flex items-center gap-3">
                                    <img 
                                        src={getAvatarUrl(post.author?.foto, post.author?.nome)} 
                                        className="w-10 h-10 rounded-full object-cover"
                                        onError={(e) => { e.target.onerror = null; e.target.src=getAvatarUrl(null, post.author?.nome); }}
                                    />
                                    <div>
                                        <p className="font-bold hover:underline" onClick={(e) => { e.stopPropagation(); navigate(`/profile/${post.authorId}`); }}>{post.author?.nome || "Usuário"}</p>
                                        <p className="text-xs text-gray-500">{post.timestamp ? new Date(post.timestamp.seconds * 1000).toLocaleString() : 'agora'}</p>
                                    </div>
                                </div>
                                {(isAuthor || isAdmin) && (
                                    // Botão de Deletar chama o requestDeletePost
                                    <button onClick={(e) => requestDeletePost(e, post.id)} className="text-gray-500 hover:text-red-400 p-2 rounded-full hover:bg-red-500/10 transition-colors"><TrashIcon className="w-4 h-4" /></button>
                                )}
                            </div>
                            
                            <p className="text-gray-200 mb-4 whitespace-pre-wrap text-lg leading-relaxed line-clamp-3">{post.text}</p>
                            
                            <div className="flex items-center gap-6 pt-3 border-t border-gray-700/50">
                                <button 
                                    onClick={(e) => handleLikePost(e, post)} 
                                    className={`flex items-center gap-2 text-sm font-bold px-3 py-1.5 rounded-lg transition-colors ${isLiked ? 'text-pink-500 bg-pink-500/10' : 'text-gray-400 hover:bg-gray-700 hover:text-white'}`}
                                >
                                    <HeartIcon className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} />
                                    {post.likes?.length || 0}
                                </button>
                                <div className="flex items-center gap-2 text-sm text-gray-400 font-bold px-3 py-1.5">
                                    <MessageSquareIcon className="w-5 h-5" />
                                    {post.commentCount || 0} Comentários
                                </div>
                            </div>
                        </div>
                    );
                }) : (
                    <div className="text-center py-12 text-gray-500 border-2 border-dashed border-gray-800 rounded-2xl">
                        <p className="text-lg">Seja o primeiro a puxar assunto!</p>
                    </div>
                )}
            </div>

            {/* 5. O Modal */}
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