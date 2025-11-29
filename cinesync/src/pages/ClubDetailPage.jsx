import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { db } from '../services/firebaseConfig';
import { 
    doc, onSnapshot, query, collection, orderBy, 
    addDoc, updateDoc, deleteDoc, 
    serverTimestamp, arrayUnion, arrayRemove, getDoc 
} from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { Spinner, getAvatarUrl } from '../components/Common';
import { 
    UsersIcon, HeartIcon, TrashIcon, MessageSquareIcon, 
    ArrowLeftIcon, ShareIcon, CalendarIcon, FireIcon, ClockIcon 
} from '../components/Icons'; 
import ConfirmModal from '../components/ConfirmModal';
// REMOVIDO: import { toast } from 'react-toastify'; 

const ClubDetailPage = () => {
    const { groupId } = useParams();
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    
    // -- State --
    const [groupData, setGroupData] = useState(null);
    const [posts, setPosts] = useState([]);
    const [membersPreview, setMembersPreview] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newPostText, setNewPostText] = useState("");
    const [isPosting, setIsPosting] = useState(false);
    const [activeTab, setActiveTab] = useState('feed'); 
    const [sortBy, setSortBy] = useState('new'); 

    // -- Modals --
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [postIdToDelete, setPostIdToDelete] = useState(null);

    // 1. Fetch Group Metadata
    useEffect(() => {
        const groupRef = doc(db, 'groups', groupId);
        const unsubscribe = onSnapshot(groupRef, async (docSnap) => {
            if (docSnap.exists()) {
                const data = { id: docSnap.id, ...docSnap.data() };
                setGroupData(data);
                
                if (data.members && data.members.length > 0) {
                    const previewIds = data.members.slice(0, 6);
                    const membersProms = previewIds.map(uid => getDoc(doc(db, 'users', uid)));
                    const membersSnaps = await Promise.all(membersProms);
                    const membersData = membersSnaps
                        .filter(s => s.exists())
                        .map(s => ({ uid: s.id, ...s.data() }));
                    setMembersPreview(membersData);
                }
            } else {
                navigate('/home');
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, [groupId, navigate]);

    // 2. Fetch Posts & Authors
    useEffect(() => {
        const q = query(collection(db, 'groups', groupId, 'posts'), orderBy('timestamp', 'desc'));
        const unsubscribe = onSnapshot(q, async (snapshot) => {
            const postsData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            
            const authorIds = [...new Set(postsData.map(p => p.authorId))];
            const authors = {};
            
            if (authorIds.length > 0) {
                const authorSnaps = await Promise.all(authorIds.map(uid => getDoc(doc(db, 'users', uid))));
                authorSnaps.forEach(u => { if(u.exists()) authors[u.id] = u.data(); });
            }
            
            const enrichedPosts = postsData.map(p => ({ ...p, author: authors[p.authorId] }));
            setPosts(enrichedPosts);
        });
        return () => unsubscribe();
    }, [groupId]);

    // -- Derived State --
    const isMember = useMemo(() => groupData?.members?.includes(currentUser.uid), [groupData, currentUser.uid]);
    
    const sortedPosts = useMemo(() => {
        let sorted = [...posts];
        if (sortBy === 'top') {
            sorted.sort((a, b) => (b.likes?.length || 0) - (a.likes?.length || 0));
        }
        return sorted;
    }, [posts, sortBy]);

    // -- Actions --
    const handleJoinToggle = async () => {
        const ref = doc(db, 'groups', groupId);
        try {
            if (isMember) {
                if (!window.confirm("Sair desta comunidade?")) return;
                await updateDoc(ref, { members: arrayRemove(currentUser.uid) });
            } else {
                await updateDoc(ref, { members: arrayUnion(currentUser.uid) });
            }
        } catch (error) {
            console.error("Erro ao entrar/sair:", error);
            alert("Erro ao atualizar status de membro.");
        }
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
        } catch (error) {
            console.error("Erro ao postar:", error);
            alert("Não foi possível enviar o post.");
        }
        setIsPosting(false);
    };

    const handleLike = async (e, post) => {
        e.stopPropagation();
        const postRef = doc(db, 'groups', groupId, 'posts', post.id);
        const isLiked = post.likes?.includes(currentUser.uid);
        await updateDoc(postRef, {
            likes: isLiked ? arrayRemove(currentUser.uid) : arrayUnion(currentUser.uid)
        });
    };

    const confirmDelete = async () => {
        if (postIdToDelete) {
            try {
                await deleteDoc(doc(db, 'groups', groupId, 'posts', postIdToDelete));
                setDeleteModalOpen(false);
                setPostIdToDelete(null);
            } catch (error) {
                console.error("Erro ao deletar:", error);
                alert("Erro ao deletar post.");
            }
        }
    };

    if (loading) return <Spinner />;
    if (!groupData) return null;

    return (
        <div className="min-h-screen bg-gray-950 text-gray-100 font-sans pb-20">
            
            {/* --- IMMERSIVE HEADER --- */}
            <div className="relative h-[300px] w-full overflow-hidden group">
                <div 
                    className="absolute inset-0 bg-cover bg-center blur-xl opacity-50 scale-110"
                    style={{ backgroundImage: `url(${groupData.photo})` }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-950/60 to-transparent" />
                
                <div className="absolute top-4 left-4 z-20">
                    <button onClick={() => navigate('/clubs')} className="flex items-center gap-2 px-4 py-2 bg-black/40 backdrop-blur-md rounded-full text-white hover:bg-white/20 transition-all text-sm font-medium">
                        <ArrowLeftIcon className="w-4 h-4" /> Voltar
                    </button>
                </div>
            </div>

            {/* --- MAIN CONTENT CONTAINER --- */}
            <div className="container mx-auto px-4 lg:px-8 max-w-6xl -mt-32 relative z-10">
                
                {/* Header Info Block */}
                <div className="flex flex-col md:flex-row items-end gap-6 mb-8">
                    <div className="relative">
                        <img 
                            src={groupData.photo} 
                            alt={groupData.name} 
                            className="w-32 h-32 md:w-40 md:h-40 rounded-3xl border-4 border-gray-950 shadow-2xl object-cover bg-gray-800"
                        />
                        {isMember && (
                            <div className="absolute -bottom-2 -right-2 bg-green-500 border-4 border-gray-950 w-6 h-6 rounded-full" title="Você é membro" />
                        )}
                    </div>
                    
                    <div className="flex-1 mb-2">
                        <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight leading-none mb-2 drop-shadow-lg">
                            {groupData.name}
                        </h1>
                        <p className="text-gray-300 font-medium text-sm md:text-base max-w-2xl line-clamp-2 drop-shadow-md">
                            {groupData.description || "Uma comunidade para discutir cinema, séries e compartilhar experiências."}
                        </p>
                    </div>

                    <div className="flex gap-3 w-full md:w-auto mb-2">
                        <button 
                            onClick={handleJoinToggle}
                            className={`flex-1 md:flex-none px-8 py-3 rounded-full font-bold transition-all shadow-lg transform active:scale-95 ${
                                isMember 
                                ? 'bg-gray-800 hover:bg-red-900/80 text-gray-300 hover:text-white border border-gray-700' 
                                : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                            }`}
                        >
                            {isMember ? 'Membro' : 'Participar'}
                        </button>
                        <button className="p-3 bg-gray-800 rounded-full border border-gray-700 text-gray-400 hover:text-white hover:bg-gray-700 transition-colors">
                            <ShareIcon className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* --- LAYOUT GRID --- */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    
                    {/* LEFT COLUMN: FEED (8 cols) */}
                    <div className="lg:col-span-8 space-y-6">
                        
                        {/* Feed Filters / Tabs */}
                        <div className="flex items-center justify-between border-b border-gray-800 pb-1 sticky top-[70px] bg-gray-950/95 backdrop-blur z-20 pt-2">
                            <div className="flex gap-6">
                                <button 
                                    onClick={() => setActiveTab('feed')}
                                    className={`pb-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'feed' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                                >
                                    Discussões
                                </button>
                                <button 
                                    onClick={() => setActiveTab('members')}
                                    className={`pb-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'members' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                                >
                                    Membros ({groupData.members?.length})
                                </button>
                            </div>
                            
                            {activeTab === 'feed' && (
                                <div className="flex gap-2 mb-2">
                                    <button onClick={() => setSortBy('new')} className={`p-1.5 rounded-md transition-colors ${sortBy === 'new' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'}`} title="Mais Recentes">
                                        <ClockIcon className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => setSortBy('top')} className={`p-1.5 rounded-md transition-colors ${sortBy === 'top' ? 'bg-gray-800 text-orange-400' : 'text-gray-500 hover:text-gray-300'}`} title="Em Alta">
                                        <FireIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            )}
                        </div>

                        {activeTab === 'feed' && (
                            <>
                                {/* Create Post Input */}
                                {isMember ? (
                                    <div className="bg-gray-900 border border-gray-800 p-4 rounded-2xl shadow-sm transition-all focus-within:ring-2 focus-within:ring-indigo-500/30 focus-within:border-indigo-500/50">
                                        <form onSubmit={handlePost}>
                                            <div className="flex gap-4">
                                                <img src={getAvatarUrl(null, "Eu")} className="w-10 h-10 rounded-full bg-gray-700" alt="Avatar" />
                                                <textarea
                                                    value={newPostText}
                                                    onChange={e => setNewPostText(e.target.value)}
                                                    placeholder="Puxe um assunto com a comunidade..."
                                                    className="flex-1 bg-transparent border-none focus:ring-0 text-white placeholder-gray-500 resize-none min-h-[50px] py-2"
                                                    rows={1}
                                                    onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
                                                />
                                            </div>
                                            <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-800">
                                                <span className="text-xs text-gray-500 font-medium">Use markdown para formatar</span>
                                                <button 
                                                    type="submit" 
                                                    disabled={!newPostText.trim() || isPosting}
                                                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-1.5 rounded-full text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    {isPosting ? 'Enviando...' : 'Postar'}
                                                </button>
                                            </div>
                                        </form>
                                    </div>
                                ) : (
                                    <div onClick={handleJoinToggle} className="bg-gradient-to-r from-indigo-900/20 to-purple-900/20 border border-indigo-500/30 p-4 rounded-xl text-center cursor-pointer hover:bg-gray-800/50 transition-colors">
                                        <p className="text-indigo-300 font-medium">Entre na comunidade para participar das discussões.</p>
                                    </div>
                                )}

                                {/* Posts Feed */}
                                <div className="space-y-4">
                                    {sortedPosts.length > 0 ? sortedPosts.map(post => (
                                        <div 
                                            key={post.id} 
                                            onClick={() => navigate(`/club/${groupId}/post/${post.id}`)}
                                            className="bg-gray-900 border border-gray-800 hover:border-gray-700 p-5 rounded-2xl cursor-pointer transition-all hover:bg-gray-800/50 group"
                                        >
                                            <div className="flex items-start gap-3 mb-3">
                                                <img 
                                                    src={getAvatarUrl(post.author?.foto, post.author?.nome)} 
                                                    className="w-10 h-10 rounded-full bg-gray-800 object-cover" 
                                                    alt=""
                                                />
                                                <div className="flex-1">
                                                    <div className="flex justify-between items-start">
                                                        <div>
                                                            <span className="font-bold text-gray-200 hover:underline hover:text-indigo-400" onClick={(e) => { e.stopPropagation(); navigate(`/profile/${post.authorId}`)}}>
                                                                {post.author?.nome || "Usuário"}
                                                            </span>
                                                            <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                                                                <span>{post.timestamp ? new Date(post.timestamp.seconds * 1000).toLocaleDateString() : 'Agora'}</span>
                                                                {post.authorId === groupData.adminId && (
                                                                    <span className="bg-indigo-500/20 text-indigo-300 px-1.5 rounded text-[10px] font-bold">ADMIN</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        
                                                        {(post.authorId === currentUser.uid || groupData.adminId === currentUser.uid) && (
                                                            <button 
                                                                onClick={(e) => { e.stopPropagation(); setPostIdToDelete(post.id); setDeleteModalOpen(true); }}
                                                                className="text-gray-600 hover:text-red-400 p-1.5 rounded-full hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
                                                            >
                                                                <TrashIcon className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="pl-[52px]">
                                                <p className="text-gray-300 text-base whitespace-pre-wrap leading-relaxed mb-4">
                                                    {post.text}
                                                </p>
                                                
                                                <div className="flex items-center gap-4">
                                                    <button 
                                                        onClick={(e) => handleLike(e, post)}
                                                        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold transition-colors ${
                                                            post.likes?.includes(currentUser.uid) 
                                                            ? 'text-pink-500 bg-pink-500/10' 
                                                            : 'text-gray-500 hover:bg-gray-800 hover:text-gray-300'
                                                        }`}
                                                    >
                                                        <HeartIcon className={`w-4 h-4 ${post.likes?.includes(currentUser.uid) ? 'fill-current' : ''}`} />
                                                        {post.likes?.length || 0}
                                                    </button>
                                                    
                                                    <button className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold text-gray-500 hover:bg-gray-800 hover:text-gray-300 transition-colors">
                                                        <MessageSquareIcon className="w-4 h-4" />
                                                        {post.commentCount || 0} <span className="hidden sm:inline">Comentários</span>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )) : (
                                        <div className="text-center py-20 px-4">
                                            <div className="inline-block p-4 bg-gray-900 rounded-full mb-4">
                                                <MessageSquareIcon className="w-8 h-8 text-gray-600" />
                                            </div>
                                            <h3 className="text-lg font-bold text-gray-300">Nenhum post ainda</h3>
                                            <p className="text-gray-500">Seja a primeira pessoa a iniciar uma conversa!</p>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                        
                        {activeTab === 'members' && (
                            <MembersTab 
                                members={groupData?.members || []}
                                adminId={groupData?.adminId}
                            />
                        )}
                    </div>

                    {/* RIGHT COLUMN: SIDEBAR (4 cols) */}
                    <div className="lg:col-span-4 space-y-6">
                        <div className="sticky top-24 space-y-6">
                            
                            {/* About Card */}
                            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-xl">
                                <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-800">
                                    <h3 className="font-bold text-gray-100">Sobre a Comunidade</h3>
                                    {groupData.category && (
                                        <span className="text-xs font-bold bg-indigo-500/20 text-indigo-300 px-2 py-1 rounded uppercase">
                                            {groupData.category}
                                        </span>
                                    )}
                                </div>
                                
                                <p className="text-sm text-gray-400 leading-relaxed mb-6">
                                    {groupData.description}
                                </p>

                                <div className="grid grid-cols-2 gap-4 mb-6">
                                    <div className="bg-gray-950/50 p-3 rounded-xl">
                                        <div className="text-2xl font-bold text-white">{groupData.members?.length}</div>
                                        <div className="text-xs text-gray-500 font-medium uppercase">Membros</div>
                                    </div>
                                    <div className="bg-gray-950/50 p-3 rounded-xl">
                                        <div className="text-2xl font-bold text-white flex items-center gap-1">
                                            {posts.length}
                                        </div>
                                        <div className="text-xs text-gray-500 font-medium uppercase">Posts</div>
                                    </div>
                                </div>
                                
                                <div className="flex items-center gap-2 text-xs text-gray-500">
                                    <CalendarIcon className="w-4 h-4" />
                                    Criado em {groupData.createdAt?.toDate().toLocaleDateString()}
                                </div>
                            </div>

                            {/* Members Grid (Orkut Style) */}
                            {membersPreview.length > 0 && (
                                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
                                    <h3 className="font-bold text-gray-100 mb-4 text-sm uppercase tracking-wide">Membros Recentes</h3>
                                    <div className="grid grid-cols-4 gap-2">
                                        {membersPreview.map(m => (
                                            <div key={m.uid} className="group cursor-pointer" onClick={() => navigate(`/profile/${m.uid}`)}>
                                                <div className="aspect-square rounded-lg overflow-hidden border border-gray-700 group-hover:border-indigo-500 transition-colors">
                                                    <img 
                                                        src={getAvatarUrl(m.foto, m.nome)} 
                                                        alt={m.nome} 
                                                        className="w-full h-full object-cover"
                                                        title={m.nome}
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                        {groupData.members?.length > 6 && (
                                            <div onClick={() => setActiveTab('members')} className="aspect-square rounded-lg bg-gray-800 flex items-center justify-center border border-gray-700 text-xs font-bold text-gray-400 cursor-pointer hover:bg-gray-700 hover:border-indigo-500">
                                                +{groupData.members.length - 6}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Rules or Extra Info */}
                            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                                <h3 className="font-bold text-gray-100 mb-3 text-sm">Regras da Casa</h3>
                                <ul className="text-sm text-gray-400 space-y-2 list-disc pl-4">
                                    <li>Seja respeitoso com opiniões diferentes.</li>
                                    <li>Sem spoilers sem aviso prévio.</li>
                                    <li>Divirta-se!</li>
                                </ul>
                            </div>
                        </div>
                    </div>

                </div>
            </div>

            {/* --- MODALS --- */}
            <ConfirmModal 
                isOpen={deleteModalOpen}
                onClose={() => setDeleteModalOpen(false)}
                onConfirm={confirmDelete}
                title="Excluir Postagem"
                message="Tem certeza? Todo o conteúdo e comentários serão perdidos permanentemente."
                confirmText="Sim, excluir"
                isDanger={true}
            />
        </div>
    );
};

const MembersTab = ({ members, adminId }) => {
    const navigate = useNavigate();
    const [fullMembersList, setFullMembersList] = useState([]);
    const [loadingMembers, setLoadingMembers] = useState(false);

    useEffect(() => {
        const fetchMembers = async () => {
            if (members.length > 0 && fullMembersList.length === 0) {
                setLoadingMembers(true);
                try {
                    const memberPromises = members.map(uid => getDoc(doc(db, 'users', uid)));
                    const memberSnapshots = await Promise.all(memberPromises);
                    const membersData = memberSnapshots
                        .filter(snap => snap.exists())
                        .map(snap => ({ id: snap.id, ...snap.data() }));
                    setFullMembersList(membersData);
                } catch (error) {
                    console.error("Erro ao buscar membros:", error);
                } finally {
                    setLoadingMembers(false);
                }
            }
        };
        fetchMembers();
    }, [members, fullMembersList.length]);

    if (loadingMembers) {
        return (
            <div className="flex justify-center items-center p-20">
                <Spinner />
            </div>
        );
    }
    
    if (fullMembersList.length === 0) {
        return (
             <div className="bg-gray-900 rounded-2xl border border-gray-800 p-8 text-center text-gray-500">
                <UsersIcon className="w-12 h-12 mx-auto mb-4 text-gray-600"/>
                <h3 className="text-lg font-bold text-gray-300">Comunidade sem membros</h3>
                <p className="text-sm">Parece que este lugar ainda está vazio. Convide alguém!</p>
            </div>
        )
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {fullMembersList.map(member => (
                <div key={member.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex flex-col items-center text-center transition-all hover:border-gray-700 hover:bg-gray-800/50">
                    <div className="relative mb-3">
                         <img 
                            src={getAvatarUrl(member.foto, member.nome)} 
                            alt={member.nome}
                            className="w-24 h-24 rounded-full object-cover border-4 border-gray-800"
                        />
                        {member.id === adminId && (
                             <span className="absolute bottom-0 right-0 bg-indigo-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full border-2 border-gray-900">
                                ADMIN
                            </span>
                        )}
                    </div>
                    <Link to={`/profile/${member.id}`} className="font-bold text-lg text-gray-200 hover:text-indigo-400 truncate w-full">
                        {member.nome || 'Usuário Anônimo'}
                    </Link>
                    <span className="text-sm text-gray-500 mb-4">@{member.username || member.id.substring(0,6)}</span>
                    
                    <button 
                        onClick={() => navigate(`/profile/${member.id}`)}
                        className="mt-auto w-full bg-gray-800 hover:bg-indigo-600 border border-gray-700 hover:border-indigo-600 text-gray-300 hover:text-white font-bold py-2 px-4 rounded-lg transition-colors text-sm"
                    >
                        Ver Perfil
                    </button>
                </div>
            ))}
        </div>
    );
};

export default ClubDetailPage;