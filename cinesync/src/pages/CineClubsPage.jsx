import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/firebaseConfig';
import { useAuth } from '../contexts/AuthContext';
import { Spinner } from '../components/Common';
import { PlusIcon, UsersIcon, SearchIcon, XIcon, ImageIcon, ArrowLeftIcon } from '../components/Icons'; 
import firebase from 'firebase/compat/app';

// ------------------------------------------------------------------
// CONFIGURATION & ENV
// ------------------------------------------------------------------
// Ensure your .env has VITE_TMDB_API_KEY or REACT_APP_TMDB_API_KEY defined
const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY || process.env.REACT_APP_TMDB_API_KEY;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_URL = 'https://image.tmdb.org/t/p/w780';

const CineClubsPage = () => {
    const navigate = useNavigate();
    const { currentUser } = useAuth();

    // -- State Management --
    const [groups, setGroups] = useState([]);
    const [filteredGroups, setFilteredGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // -- Modal & Creation State --
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');
    const [newGroupDesc, setNewGroupDesc] = useState('');
    
    // TMDB Search State
    const [coverSearchTerm, setCoverSearchTerm] = useState('');
    const [coverResults, setCoverResults] = useState([]);
    const [selectedCover, setSelectedCover] = useState(null);
    const [isSearchingCover, setIsSearchingCover] = useState(false);

    // ------------------------------------------------------------------
    // DATA FETCHING (Real-time)
    // ------------------------------------------------------------------
    useEffect(() => {
        // Real-time listener with automatic cleanup to prevent memory leaks
        const unsubscribe = db.collection('groups')
            .orderBy('createdAt', 'desc')
            .onSnapshot(
                snap => {
                    const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    setGroups(data);
                    setFilteredGroups(data);
                    setLoading(false);
                },
                error => {
                    console.error("[Firestore] Error fetching groups:", error);
                    setLoading(false);
                }
            );
        return () => unsubscribe();
    }, []);

    // ------------------------------------------------------------------
    // SEARCH LOGIC (Client-side filtering)
    // ------------------------------------------------------------------
    useEffect(() => {
        // Optimizing for client-side search since group count is expected to be < 1000 initially
        const lowerTerm = searchTerm.toLowerCase();
        const filtered = groups.filter(group => 
            group.name.toLowerCase().includes(lowerTerm) || 
            (group.description && group.description.toLowerCase().includes(lowerTerm))
        );
        setFilteredGroups(filtered);
    }, [searchTerm, groups]);

    // ------------------------------------------------------------------
    // TMDB INTEGRATION
    // ------------------------------------------------------------------
    const searchCoverImages = async () => {
        if (!coverSearchTerm.trim()) return;
        setIsSearchingCover(true);

        try {
            // Using 'multi' search to allow users to find movies OR series for their community cover
            const response = await fetch(
                `${TMDB_BASE_URL}/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(coverSearchTerm)}&language=pt-BR&page=1`
            );
            
            if (!response.ok) throw new Error(`TMDB API Error: ${response.status}`);
            
            const data = await response.json();
            
            // Filter: Only results with valid backdrops
            const validResults = data.results
                .filter(item => item.backdrop_path)
                .slice(0, 6); // Hard limit to keep UI clean
                
            setCoverResults(validResults);
        } catch (error) {
            console.error("[TMDB] Failed to fetch images:", error);
        } finally {
            setIsSearchingCover(false);
        }
    };

    // ------------------------------------------------------------------
    // HANDLERS
    // ------------------------------------------------------------------
    const createGroup = async (e) => {
        e.preventDefault();
        if (!newGroupName.trim()) return;

        // Fallback to UI Avatars if no TMDB image is selected
        const defaultImage = `https://ui-avatars.com/api/?name=${newGroupName}&background=random&color=fff&size=512`;
        const finalImage = selectedCover ? `${TMDB_IMAGE_URL}${selectedCover}` : defaultImage;

        try {
            const docRef = await db.collection('groups').add({
                name: newGroupName,
                description: newGroupDesc || 'Comunidade criada no CineSync.',
                adminId: currentUser.uid,
                members: [currentUser.uid],
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                photo: finalImage,
                category: 'Geral', // TODO: Implement category selector in future iterations
                stats: {
                    postsCount: 0,
                    activeLastWeek: true
                }
            });

            // Reset Form & Redirect
            setNewGroupName('');
            setNewGroupDesc('');
            setSelectedCover(null);
            setCoverResults([]);
            setIsModalOpen(false);
            navigate(`/club/${docRef.id}`);
        } catch (error) {
            console.error("[Firestore] Create Group failed:", error);
            // In a real prod env, trigger a toast notification here
        }
    };

    const joinGroup = async (e, groupId) => {
        e.stopPropagation(); // Prevent card click event
        try {
            // Atomically add user to array to prevent race conditions
            await db.collection('groups').doc(groupId).update({
                members: firebase.firestore.FieldValue.arrayUnion(currentUser.uid)
            });
            navigate(`/club/${groupId}`);
        } catch (error) {
            console.error("[Firestore] Join Group failed:", error);
        }
    };

    if (loading) return <Spinner />;

    return (
        <div className="min-h-screen bg-gray-950 text-gray-100 font-sans pb-20">
            
            {/* --- STICKY HEADER --- */}
            <header className="sticky top-0 z-30 bg-gray-950/80 backdrop-blur-md border-b border-gray-800 px-4 py-3 shadow-lg">
                <div className="container mx-auto flex items-center justify-between">
                    <button 
                        onClick={() => navigate('/home')} 
                        className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors group"
                        aria-label="Voltar para home"
                    >
                        <ArrowLeftIcon className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                        <span className="font-medium hidden md:inline">Voltar</span>
                    </button>
                    
                    <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                        Comunidades
                    </h1>

                    <button 
                        onClick={() => setIsModalOpen(true)}
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-full font-bold text-sm transition-all hover:shadow-indigo-500/25 hover:shadow-lg transform active:scale-95"
                    >
                        <PlusIcon className="w-4 h-4" />
                        <span className="hidden sm:inline">Criar Clube</span>
                    </button>
                </div>
            </header>

            <main className="container mx-auto px-4 py-8">
                
                {/* --- HERO & FILTER SECTION --- */}
                <div className="mb-12 text-center max-w-2xl mx-auto animate-fade-in">
                    <h2 className="text-3xl md:text-4xl font-black text-white mb-4 tracking-tight">
                        Encontre sua <span className="text-indigo-500">Tribo</span>
                    </h2>
                    <p className="text-gray-400 mb-8 text-lg">
                        Discussões profundas, teorias e a nostalgia das comunidades clássicas.
                    </p>
                    
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-500 group-focus-within:text-indigo-400 transition-colors">
                            <SearchIcon className="w-5 h-5" />
                        </div>
                        <input 
                            type="text" 
                            placeholder="Buscar comunidades (ex: Terror, Marvel, Clássicos)..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-700 text-white rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all shadow-xl"
                        />
                    </div>
                </div>

                {/* --- CLUBS GRID (Masonry-like) --- */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {filteredGroups.map(group => {
                        const isMember = group.members?.includes(currentUser?.uid);
                        
                        return (
                            <div 
                                key={group.id}
                                onClick={() => navigate(`/club/${group.id}`)}
                                className="group relative bg-gray-900 rounded-xl overflow-hidden border border-gray-800 hover:border-indigo-500/50 transition-all duration-300 hover:shadow-2xl hover:shadow-indigo-900/20 cursor-pointer flex flex-col h-full animate-fade-in-up"
                            >
                                {/* Cover Image */}
                                <div className="h-36 overflow-hidden relative bg-gray-800">
                                    <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-transparent to-transparent z-10" />
                                    <img 
                                        src={group.photo} 
                                        alt={group.name} 
                                        loading="lazy"
                                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                    />
                                    {isMember && (
                                        <div className="absolute top-3 right-3 z-20 bg-green-500/90 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider backdrop-blur-sm shadow-sm">
                                            Membro
                                        </div>
                                    )}
                                </div>

                                {/* Card Content */}
                                <div className="p-5 flex-1 flex flex-col">
                                    <h3 className="text-xl font-bold text-white mb-2 group-hover:text-indigo-400 transition-colors line-clamp-1">
                                        {group.name}
                                    </h3>
                                    
                                    <p className="text-gray-400 text-sm mb-6 line-clamp-2 flex-1 leading-relaxed">
                                        {group.description || "Sem descrição disponível."}
                                    </p>

                                    <div className="flex items-center justify-between mt-auto pt-4 border-t border-gray-800">
                                        <div className="flex items-center text-gray-500 text-xs font-medium uppercase tracking-wide">
                                            <UsersIcon className="w-4 h-4 mr-1.5" />
                                            {group.members?.length || 0} Membros
                                        </div>
                                        
                                        {!isMember && (
                                            <button 
                                                onClick={(e) => joinGroup(e, group.id)}
                                                className="text-indigo-400 hover:text-indigo-300 text-sm font-bold uppercase tracking-wide hover:underline decoration-2 underline-offset-4"
                                            >
                                                Participar
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Empty State */}
                {filteredGroups.length === 0 && (
                    <div className="text-center py-20 border-2 border-dashed border-gray-800 rounded-3xl mt-4">
                        <div className="inline-block p-4 rounded-full bg-gray-800/50 mb-4 text-gray-500">
                            <SearchIcon className="w-8 h-8" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-300">Nenhum clube encontrado</h3>
                        <p className="text-gray-500 mt-2">Seja o primeiro a criar uma comunidade sobre "{searchTerm}"!</p>
                    </div>
                )}
            </main>

            {/* --- CREATE MODAL (Overlay) --- */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-gray-900 w-full max-w-lg rounded-2xl border border-gray-700 shadow-2xl flex flex-col max-h-[90vh] animate-scale-up">
                        
                        <div className="p-5 border-b border-gray-800 flex justify-between items-center bg-gray-800/50">
                            <h3 className="text-xl font-bold text-white">Criar Nova Comunidade</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white transition-colors">
                                <XIcon className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto custom-scrollbar">
                            <form id="create-club-form" onSubmit={createGroup} className="space-y-6">
                                
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1">Nome</label>
                                    <input 
                                        type="text" 
                                        value={newGroupName} 
                                        onChange={e => setNewGroupName(e.target.value)} 
                                        placeholder="Ex: Wes Anderson Fans" 
                                        className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1">Descrição</label>
                                    <textarea 
                                        value={newGroupDesc} 
                                        onChange={e => setNewGroupDesc(e.target.value)} 
                                        placeholder="Sobre o que é essa comunidade? (Opcional)" 
                                        className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none h-24 resize-none"
                                    />
                                </div>

                                {/* TMDB Cover Picker */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1">Capa (Busca via TMDB)</label>
                                    <div className="flex gap-2 mb-3">
                                        <input 
                                            type="text" 
                                            value={coverSearchTerm}
                                            onChange={e => setCoverSearchTerm(e.target.value)}
                                            placeholder="Busque filmes/séries..."
                                            className="flex-1 bg-gray-950 border border-gray-700 rounded-lg px-4 py-2 text-sm text-white focus:border-indigo-500 outline-none"
                                        />
                                        <button 
                                            type="button" 
                                            onClick={searchCoverImages}
                                            disabled={isSearchingCover}
                                            className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                                        >
                                            {isSearchingCover ? <Spinner size="sm" /> : <SearchIcon className="w-5 h-5" />}
                                        </button>
                                    </div>

                                    {/* Results Grid */}
                                    {coverResults.length > 0 && (
                                        <div className="grid grid-cols-3 gap-2 mb-4 animate-fade-in">
                                            {coverResults.map((item) => (
                                                <div 
                                                    key={item.id}
                                                    onClick={() => setSelectedCover(item.backdrop_path)}
                                                    className={`relative aspect-video rounded-md overflow-hidden cursor-pointer border-2 transition-all ${selectedCover === item.backdrop_path ? 'border-indigo-500 ring-2 ring-indigo-500/30' : 'border-transparent hover:border-gray-600'}`}
                                                >
                                                    <img 
                                                        src={`${TMDB_IMAGE_URL}${item.backdrop_path}`} 
                                                        alt={item.title || item.name} 
                                                        className="w-full h-full object-cover"
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Selected Preview Area */}
                                    <div className="relative w-full h-32 bg-gray-950 rounded-lg border border-dashed border-gray-700 flex items-center justify-center overflow-hidden">
                                        {selectedCover ? (
                                            <>
                                                <img src={`${TMDB_IMAGE_URL}${selectedCover}`} alt="Preview" className="w-full h-full object-cover opacity-80" />
                                                <button 
                                                    type="button" 
                                                    onClick={() => { setSelectedCover(null); setCoverResults([]); }}
                                                    className="absolute top-2 right-2 bg-black/60 hover:bg-red-500/90 p-1.5 rounded-full text-white transition-colors backdrop-blur-sm"
                                                >
                                                    <XIcon className="w-4 h-4"/>
                                                </button>
                                            </>
                                        ) : (
                                            <div className="flex flex-col items-center text-gray-600">
                                                <ImageIcon className="w-6 h-6 mb-1 opacity-50"/>
                                                <span className="text-xs">Nenhuma capa selecionada</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </form>
                        </div>

                        <div className="p-5 border-t border-gray-800 bg-gray-800/30 flex gap-3">
                            <button 
                                type="button" 
                                onClick={() => setIsModalOpen(false)} 
                                className="flex-1 py-3 rounded-xl font-bold text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button 
                                type="submit" 
                                form="create-club-form"
                                className="flex-1 py-3 rounded-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-900/30 transition-all active:scale-95"
                            >
                                Criar Comunidade
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CineClubsPage;