import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { db } from '../services/firebaseConfig';
import firebase from 'firebase/compat/app';
import { useAuth } from '../contexts/AuthContext';
import { MapPinIcon, HeartIcon, RefreshIcon, PlusIcon } from '../components/Icons';
import { Spinner, ErrorMessage, getAvatarUrl } from '../components/Common';
import ReviewCard from '../components/ReviewCard';
import ListCard from '../components/ListCard';
import UserListModal from '../components/UserListModal'; 
import EditProfileModal from '../components/EditProfileModal';
import { calculateLevel, getNextLevelXp, BADGES, triggerUserRecalculation } from '../utils/gamification';

const ProfilePage = () => {
    const { userId } = useParams();
    const navigate = useNavigate();
    const { currentUser, userData: loggedInUserData } = useAuth();
    
    const [profileData, setProfileData] = useState(null);
    const [reviews, setReviews] = useState([]);
    const [userLists, setUserLists] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isFollowingLoading, setIsFollowingLoading] = useState(false);
    const [isFollowing, setIsFollowing] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showUserList, setShowUserList] = useState(null);
    const [listData, setListData] = useState([]);
    const [listLoading, setListLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('reviews');
    
    const [isSyncing, setIsSyncing] = useState(false);
    const [compatibility, setCompatibility] = useState(null);

    useEffect(() => {
        setLoading(true);
        const userRef = db.collection("users").doc(userId);
        const unsubUser = userRef.onSnapshot((userSnap) => {
             if (userSnap.exists) {
                setProfileData({ uid: userSnap.id, ...userSnap.data() });
            } else {
                setProfileData(null);
            }
            setLoading(false); 
        }, (error) => {
            console.error("Erro ao buscar dados do perfil:", error);
            setLoading(false); 
        });

        const reviewsQuery = db.collection("reviews").where("uidAutor", "==", userId).orderBy("timestamp", "desc");
        const unsubReviews = reviewsQuery.onSnapshot((snapshot) => {
            const reviewsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setReviews(reviewsData);
        });
        
        const listsQuery = db.collection("lists").where("uidAutor", "==", userId).orderBy("createdAt", "desc");
        const unsubLists = listsQuery.onSnapshot((snapshot) => {
            const listsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setUserLists(listsData);
        });

        return () => {
            unsubUser();
            unsubReviews();
            unsubLists();
        };
    }, [userId]);

    useEffect(() => {
        if (loggedInUserData && profileData) {
            const seguindo = loggedInUserData.seguindo || [];
            setIsFollowing(seguindo.includes(profileData.uid));
        }
    }, [loggedInUserData, profileData]);

    const handleFollow = async () => {
        if (!currentUser || !profileData) return;
        
        setIsFollowingLoading(true);
        const originalFollowingState = isFollowing;

        const userRef = db.collection("users").doc(currentUser.uid);
        const targetRef = db.collection("users").doc(profileData.uid);
        
        const batch = db.batch();
        
        if (isFollowing) {
            batch.update(userRef, { seguindo: firebase.firestore.FieldValue.arrayRemove(profileData.uid) });
            batch.update(targetRef, { seguidores: firebase.firestore.FieldValue.arrayRemove(currentUser.uid) });
        } else {
            batch.update(userRef, { seguindo: firebase.firestore.FieldValue.arrayUnion(profileData.uid) });
            batch.update(targetRef, { seguidores: firebase.firestore.FieldValue.arrayUnion(currentUser.uid) });
        }
        
        try {
            await batch.commit();
            setIsFollowing(!originalFollowingState);
        } catch (error) {
            setIsFollowingLoading(false);
            console.error("Erro ao seguir/deixar de seguir:", error);
            setIsFollowing(originalFollowingState);
        }
    };

    const handleShowList = async (type) => {
        const uids = type === 'followers' ? (profileData.seguidores || []) : (profileData.seguindo || []);
        if (uids.length === 0) return;

        setShowUserList(type);
        setListLoading(true);
        setListData([]);

        try {
            const userPromises = uids.slice(0, 20).map(uid => db.collection("users").doc(uid).get());
            const userDocs = await Promise.all(userPromises);
            const usersData = userDocs
                .filter(docSnap => docSnap.exists)
                .map(docSnap => ({ id: docSnap.id, uid: docSnap.id, ...docSnap.data() }));
            setListData(usersData);
        } catch (error) {
            console.error("Erro ao buscar lista de usuários:", error);
        } finally {
            setListLoading(false);
        }
    };

    const handleMessage = async () => {
        if (!currentUser || !loggedInUserData || !profileData || currentUser.uid === profileData.uid) return;
    
        const sortedIds = [currentUser.uid, profileData.uid].sort();
        const conversationId = sortedIds.join('_');
        const conversationRef = db.collection("conversations").doc(conversationId);
        
        try {
            const conversationData = {
                participants: sortedIds,
                participantInfo: {
                    [currentUser.uid]: { nome: loggedInUserData.nome, foto: loggedInUserData.foto },
                    [profileData.uid]: { nome: profileData.nome, foto: profileData.foto }
                },
            };
            await conversationRef.set(conversationData, { merge: true });
            navigate(`/chat/${conversationId}`);
        } catch (error) {
            console.error("Erro ao iniciar conversa:", error);
        }
    };

    const handleSyncXP = async () => {
        if (!currentUser || currentUser.uid !== userId) return;
        const confirmSync = window.confirm("Deseja recalcular seus pontos com base no histórico?");
        if (!confirmSync) return;
        
        setIsSyncing(true);
        try {
            await triggerUserRecalculation();
        } catch (error) {
            console.error("A sincronização falhou.", error);
        } finally {
            setIsSyncing(false);
        }
    };

    // --- LÓGICA DE EVOLUÇÃO DAS MEDALHAS (COM PROGRESSO) ---
    const getEvolutionaryBadges = (userBadgesIds = [], userStats = {}) => {
        const groups = {};

        // 1. Agrupa
        Object.values(BADGES).forEach(badge => {
            if (badge.type) {
                if (!groups[badge.type]) groups[badge.type] = [];
                groups[badge.type].push(badge);
            }
        });

        const displayList = [];

        // 2. Processa cada grupo
        Object.keys(groups).forEach(type => {
            const family = groups[type].sort((a, b) => a.rank - b.rank);
            const highestOwned = [...family].reverse().find(b => userBadgesIds.includes(b.id));

            // Determina qual medalha mostrar e qual é o próximo alvo
            let badgeToShow = highestOwned;
            let nextBadge = null;
            
            if (highestOwned) {
                // Se tem uma medalha, a próxima é a de rank imediatamente superior
                const currentIndex = family.findIndex(b => b.id === highestOwned.id);
                if (currentIndex < family.length - 1) {
                    nextBadge = family[currentIndex + 1];
                }
            } else {
                // Se não tem nenhuma, mostra a primeira (Bronze) como alvo
                if (type !== 'LEGACY') {
                    badgeToShow = family[0];
                    nextBadge = family[0]; // O alvo é ela mesma (para desbloquear)
                }
            }

            if (badgeToShow) {
                // Calcula progresso se houver um próximo nível
                let progressInfo = null;
                
                if (nextBadge && badgeToShow.statField) {
                    const currentVal = userStats[badgeToShow.statField] || 0;
                    const targetVal = nextBadge.limit;
                    const percent = Math.min(100, Math.floor((currentVal / targetVal) * 100));
                    
                    progressInfo = {
                        current: currentVal,
                        target: targetVal,
                        percent: percent
                    };
                } 
                // Caso especial: se já tem a última medalha (Ouro), mostra 100%
                else if (!nextBadge && highestOwned && badgeToShow.statField) {
                     const currentVal = userStats[badgeToShow.statField] || 0;
                     progressInfo = {
                        current: currentVal,
                        target: currentVal, // Meta atingida
                        percent: 100,
                        isMax: true
                    };
                }

                displayList.push({ 
                    ...badgeToShow, 
                    unlocked: !!highestOwned, // Se highestOwned existe, está desbloqueada. Se não, é a Bronze bloqueada.
                    progress: progressInfo
                });
            }
        });

        return displayList;
    };

    if (loading) return <Spinner/>;
    if (!profileData) return <div className="p-8"><ErrorMessage message="Perfil não encontrado." /></div>;

    const followersCount = (profileData.seguidores || []).length;
    const followingCount = (profileData.seguindo || []).length;
    
    const xp = profileData.xp || 0;
    const level = calculateLevel(xp);
    const nextLevelXp = getNextLevelXp(level);
    const prevLevelXp = getNextLevelXp(level - 1) || 0;
    const progress = Math.min(100, Math.max(0, ((xp - prevLevelXp) / (nextLevelXp - prevLevelXp)) * 100));
    const userBadgesIds = profileData.badges || [];
    const userStats = profileData.stats || {}; // Pega as estatísticas do usuário
    
    // Gera a lista com progresso
    const displayBadges = getEvolutionaryBadges(userBadgesIds, userStats);

    let coverSrc = profileData.fotoCapa;
    if (!coverSrc || (typeof coverSrc === 'string' && coverSrc.startsWith('blob:'))) {
        coverSrc = 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=1000&q=80';
    }

    const getLevelBorderClass = (level) => {
        if (level >= 40) return 'border-purple-500 shadow-purple-500/40';
        if (level >= 30) return 'border-cyan-400 shadow-cyan-400/40';
        if (level >= 20) return 'border-yellow-400 shadow-yellow-400/40';
        if (level >= 10) return 'border-gray-400 shadow-gray-400/40';
        if (level >= 1) return 'border-yellow-700 shadow-yellow-700/40';
        return 'border-gray-800';
    };

    return (
        <div className="container mx-auto p-4 sm:p-0 md:p-8 text-white">
            <div className="max-w-4xl mx-auto">
                <div className="relative">
                    <img 
                        src={coverSrc} 
                        alt="Capa" 
                        className="w-full h-48 md:h-64 object-cover rounded-t-xl bg-gray-700"
                        onError={(e) => { e.target.onerror = null; e.target.src='https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=1000&q=80'; }}
                    />
                    <div className="absolute -bottom-16 left-1/2 -translate-x-1/2 md:left-8 md:translate-x-0">
                        <div className={`relative p-1 rounded-full ${getLevelBorderClass(level)} bg-gray-900 shadow-lg`}>
                            <img 
                                src={getAvatarUrl(profileData.foto, profileData.nome)} 
                                alt={profileData.nome} 
                                className="w-32 h-32 md:w-40 md:h-40 rounded-full object-cover bg-gray-800"
                                onError={(e) => { e.target.onerror = null; e.target.src=getAvatarUrl(null, profileData.nome); }}
                            />
                            <div className="absolute bottom-0 right-0 bg-indigo-600 text-white text-xs font-bold px-2 py-1 rounded-full border-2 border-gray-900 shadow-lg">
                                Lvl {level}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-gray-800/50 border border-gray-700 p-6 rounded-b-xl shadow-lg pt-20 md:pt-8">
                     <div className="flex flex-col md:flex-row justify-end items-stretch md:items-center gap-2 mb-4">
                        {currentUser && currentUser.uid !== userId && compatibility !== null && (
                            <div className="bg-gray-900/80 px-3 py-1.5 rounded-lg border border-pink-500/30 flex items-center gap-2 mr-0 md:mr-2 animate-fade-in self-center md:self-auto">
                                <HeartIcon className="w-4 h-4 text-pink-500" />
                                <span className="text-sm font-bold text-pink-200">{compatibility}% Match</span>
                            </div>
                        )}

                        {currentUser && (
                            currentUser.uid === userId ? (
                                <button
                                    onClick={() => setShowEditModal(true)}
                                    className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg transition-colors text-sm w-full md:w-auto"
                                >
                                    Editar Perfil
                                </button>
                            ) : (
                                <>
                                    <button
                                        onClick={handleMessage}
                                        className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg transition-colors text-sm w-full md:w-auto"
                                    >
                                        Mensagem
                                    </button>
                                    <button
                                        onClick={handleFollow}
                                        className={`${isFollowing ? 'bg-gray-600' : 'bg-gradient-to-r from-indigo-500 to-purple-600 hover:opacity-90'} text-white font-bold py-2 px-4 rounded-lg transition-all text-sm w-full md:w-auto`}
                                    >
                                        {isFollowing ? 'Deixar de Seguir' : 'Seguir'}
                                    </button>
                                </>
                            )
                        )}
                    </div>

                    <div className="text-center md:text-left md:ml-48">
                        <h2 className="text-2xl md:text-3xl font-bold tracking-tight">{profileData.nome} {profileData.sobrenome}</h2>
                        <p className="text-gray-400">@{profileData.username}</p>
                        
                        <div className="mt-3 max-w-xs mx-auto md:mx-0">
                            <div className="flex justify-between text-xs text-gray-400 mb-1 items-center">
                                <span>{xp} XP</span>
                                <div className="flex items-center gap-2">
                                    <span className="flex items-center gap-1">Próx: {nextLevelXp}</span>
                                    {currentUser && currentUser.uid === userId && !isSyncing && (
                                        <button onClick={handleSyncXP} className="text-indigo-400 hover:text-white transition-colors" title="Sincronizar XP">
                                            <RefreshIcon className="w-3 h-3" />
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div className="w-full bg-gray-700 rounded-full h-2.5">
                                <div className="bg-gradient-to-r from-indigo-500 to-purple-500 h-2.5 rounded-full shadow-[0_0_10px_rgba(99,102,241,0.5)]" style={{ width: `${progress}%` }}></div>
                            </div>
                        </div>

                        {/* Badges no Header (Apenas as desbloqueadas) */}
                        {displayBadges.length > 0 && (
                            <div className="flex gap-2 mt-3 justify-center md:justify-start">
                                {displayBadges.filter(b => b.unlocked).map(badge => (
                                    <span key={badge.id} className="text-lg cursor-help hover:scale-110 transition-transform" title={`${badge.name}: ${badge.desc}`}>
                                        {badge.icon}
                                    </span>
                                ))}
                            </div>
                        )}

                        {profileData.localizacao && 
                            <div className="flex items-center justify-center md:justify-start text-gray-400 text-sm mt-3">
                                <MapPinIcon className="w-4 h-4 mr-1"/>
                                <span>{profileData.localizacao}</span>
                            </div>
                        }
                        <p className="text-gray-300 mt-4 leading-relaxed max-w-lg mx-auto md:mx-0">{profileData.bio}</p>
                        
                        <div className="flex justify-center md:justify-start flex-wrap gap-2 mt-4">
                            {profileData.favoriteStreaming && (
                                <span className="bg-indigo-500/20 text-indigo-300 text-xs font-semibold px-2.5 py-1 rounded-full">
                                    {profileData.favoriteStreaming}
                                </span>
                            )}
                            {profileData.favoriteGenre && (
                                <span className="bg-purple-500/20 text-purple-300 text-xs font-semibold px-2.5 py-1 rounded-full">
                                    {profileData.favoriteGenre}
                                </span>
                            )}
                        </div>

                        <div className="flex justify-center md:justify-start space-x-6 mt-6 text-gray-300 text-sm border-t border-gray-700 pt-4">
                            <button onClick={() => handleShowList('followers')} disabled={followersCount === 0} className="hover:text-white">
                                <span className="font-bold text-base text-white block">{followersCount}</span> Seguidores
                            </button>
                            <button onClick={() => handleShowList('following')} disabled={followingCount === 0} className="hover:text-white">
                                <span className="font-bold text-base text-white block">{followingCount}</span> Seguindo
                            </button>
                            <div className="text-center"><span className="font-bold text-base text-white block">{reviews.length}</span> Avaliações</div>
                        </div>
                    </div>
                </div>
    
                <div className="mt-10">
                    <div className="flex border-b border-gray-700 mb-6">
                        <button onClick={() => setActiveTab('reviews')} className={`py-2 px-4 font-semibold ${activeTab === 'reviews' ? 'text-white border-b-2 border-indigo-500' : 'text-gray-400'}`}>Avaliações</button>
                        <button onClick={() => setActiveTab('lists')} className={`py-2 px-4 font-semibold ${activeTab === 'lists' ? 'text-white border-b-2 border-indigo-500' : 'text-gray-400'}`}>Listas</button>
                        <button onClick={() => setActiveTab('achievements')} className={`py-2 px-4 font-semibold ${activeTab === 'achievements' ? 'text-white border-b-2 border-indigo-500' : 'text-gray-400'}`}>Conquistas</button>
                    </div>
                    
                    {activeTab === 'reviews' && (
                        <div className="space-y-8">
                            {reviews.length > 0 ? reviews.map(review => (
                                <ReviewCard key={review.id} review={review} />
                            )) : <p className="text-gray-400 text-center py-4">Este usuário ainda não fez nenhuma avaliação.</p>}
                        </div>
                    )}

                    {activeTab === 'lists' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {currentUser && currentUser.uid === userId && (
                                <div 
                                    onClick={() => navigate('/create-list')}
                                    className="flex flex-col items-center justify-center bg-gray-800/50 border-2 border-dashed border-gray-700 rounded-2xl p-4 cursor-pointer hover:border-indigo-500 hover:bg-gray-800 transition-all group aspect-square"
                                >
                                    <div className="w-16 h-16 bg-gray-700/80 rounded-full flex items-center justify-center mb-4 group-hover:bg-indigo-500/30 transition-colors">
                                        <PlusIcon className="w-8 h-8 text-gray-400 group-hover:text-indigo-300" />
                                    </div>
                                    <h4 className="font-bold text-white group-hover:text-indigo-400">Criar Nova Lista</h4>
                                    <p className="text-sm text-gray-400">Comece uma nova coleção</p>
                                </div>
                            )}
                            {userLists.map(list => (
                                <ListCard key={list.id} list={list} />
                            ))}
                            {userLists.length === 0 && <p className="text-gray-400 sm:col-span-2 lg:col-span-3 text-center py-4">Este usuário ainda não criou nenhuma lista.</p>}
                        </div>
                    )}

                    {activeTab === 'achievements' && (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 animate-fade-in">
                            {displayBadges.map(badge => (
                                <div 
                                    key={badge.id}
                                    className={`
                                        relative p-6 rounded-xl border-2 flex flex-col items-center text-center transition-all overflow-hidden group
                                        ${badge.unlocked 
                                            ? 'bg-gray-800 border-yellow-500/50 shadow-[0_0_15px_rgba(234,179,8,0.2)]' 
                                            : 'bg-gray-900/50 border-gray-800 opacity-60 grayscale'
                                        }
                                    `}
                                >
                                    <div className="text-5xl mb-3 drop-shadow-md">{badge.icon}</div>
                                    <h3 className={`font-bold text-lg ${badge.unlocked ? 'text-white' : 'text-gray-500'}`}>
                                        {badge.name}
                                    </h3>
                                    <p className="text-xs text-gray-400 mt-2 z-10 relative">{badge.desc}</p>
                                    
                                    {/* Etiqueta de Nível */}
                                    {badge.unlocked && badge.rank > 0 && (
                                        <div className="absolute top-2 right-2 px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-[10px] font-bold rounded-full border border-yellow-500/30">
                                            NV {badge.rank}
                                        </div>
                                    )}
                                    
                                    {/* Etiqueta de Bloqueado */}
                                    {!badge.unlocked && (
                                        <div className="absolute top-2 right-2 px-2 py-0.5 bg-gray-700/50 text-gray-400 text-[10px] font-bold rounded-full">
                                            Bloqueado
                                        </div>
                                    )}

                                    {/* BARRA DE PROGRESSO (NOVIDADE) */}
                                    {badge.progress && (
                                        <div className="w-full mt-4">
                                            <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                                                <span>Progresso</span>
                                                <span className={badge.progress.isMax ? "text-yellow-400 font-bold" : ""}>
                                                    {badge.progress.isMax ? "MÁXIMO" : `${badge.progress.current}/${badge.progress.target}`}
                                                </span>
                                            </div>
                                            <div className="w-full bg-gray-700 rounded-full h-1.5">
                                                <div 
                                                    className={`h-1.5 rounded-full transition-all duration-1000 ${badge.progress.isMax ? 'bg-yellow-500' : 'bg-indigo-500'}`} 
                                                    style={{ width: `${badge.progress.percent}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {showEditModal && (
                <EditProfileModal 
                    profileData={profileData} 
                    onClose={() => setShowEditModal(false)}
                />
            )}

            {showUserList && (
                <UserListModal
                    title={showUserList === 'followers' ? 'Seguidores' : 'Seguindo'}
                    users={listData}
                    loading={listLoading}
                    onClose={() => setShowUserList(null)}
                />
            )}
        </div>
    );
};

export default ProfilePage;