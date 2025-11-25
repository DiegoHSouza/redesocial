import React, { useState, useEffect, useRef } from 'react';
import { auth, db, storage } from '../services/firebaseConfig';
import { tmdbApi } from '../services/tmdbApi';
import { CameraIcon, SearchIcon } from './Icons';
import { Spinner } from './Common';
import ContentSearchModal from './ContentSearchModal'; // <--- Importado
import GeneratedImageSelectionModal from './GeneratedImageSelectionModal'; // <--- Importado

const STREAMING_SERVICES = [
    { id: 8, name: 'Netflix' }, { id: 119, name: 'Prime Video' },
    { id: 337, name: 'Disney+' }, { id: 1899, name: 'Max' }, { id: 350, name: 'Apple TV+' },
];

const EditProfileModal = ({ profileData, onClose }) => {
    const [formData, setFormData] = useState({
        nomeCompleto: `${profileData.nome} ${profileData.sobrenome}`.trim(),
        username: profileData.username || '',
        bio: profileData.bio || '',
        localizacao: profileData.localizacao || '',
        favoriteStreaming: profileData.favoriteStreaming || '',
        favoriteGenre: profileData.favoriteGenre || '',
    });
    
    const [foto, setFoto] = useState({ file: null, preview: profileData.foto });
    const [fotoCapa, setFotoCapa] = useState({ file: null, preview: profileData.fotoCapa });
    
    const [genres, setGenres] = useState([]);
    const [usernameStatus, setUsernameStatus] = useState({ available: true, message: '' });
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState({ type: '', message: '' });
    
    // Estados para o fluxo de busca de conteúdo
    const [showSearch, setShowSearch] = useState(false);
    const [showImageSelection, setShowImageSelection] = useState(false);
    const [selectedMedia, setSelectedMedia] = useState(null);
    const [targetImageType, setTargetImageType] = useState(null); // 'avatar' ou 'cover'

    const fileInputAvatarRef = useRef(null);
    const fileInputCoverRef = useRef(null);
    const debounceTimeoutRef = useRef(null);

    useEffect(() => {
        const fetchGenres = async () => {
            try {
                const movieGenres = await tmdbApi.getGenres('movie');
                const tvGenres = await tmdbApi.getGenres('tv');
                const allGenres = [...movieGenres.genres, ...tvGenres.genres];
                const uniqueGenres = Array.from(new Map(allGenres.map(item => [item['id'], item])).values());
                setGenres(uniqueGenres);
            } catch (error) { console.error("Erro ao buscar gêneros:", error); }
        };
        fetchGenres();
    }, []);
    
    useEffect(() => {
        if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
        if (!formData.username || formData.username === profileData.username) {
            setUsernameStatus({ available: true, message: '' });
            return;
        }
        
        debounceTimeoutRef.current = setTimeout(async () => {
            const username = formData.username.trim().toLowerCase();
            if(username.length < 3) {
                 setUsernameStatus({ available: false, message: 'Mínimo de 3 caracteres.' });
                 return;
            }
            const q = db.collection("users").where("username", "==", username);
            const snapshot = await q.get();
            if (snapshot.empty) {
                setUsernameStatus({ available: true, message: 'Disponível!' });
            } else {
                setUsernameStatus({ available: false, message: 'Indisponível.' });
            }
        }, 500);
    }, [formData.username, profileData.username]);
    
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };            

    const handleFileSelect = (e, type) => {
        const file = e.target.files[0];
        if (file) {
            const previewUrl = URL.createObjectURL(file);
            if (type === 'avatar') setFoto({ file: file, preview: previewUrl });
            if (type === 'cover') setFotoCapa({ file: file, preview: previewUrl });
        }
    };

    // Inicia o fluxo de busca
    const openSearch = (type) => {
        setTargetImageType(type);
        setShowSearch(true);
    };

    // Quando o filme é selecionado
    const handleMediaSelect = (media) => {
        setSelectedMedia(media);
        setShowSearch(false);
        setShowImageSelection(true);
    };

    // Quando a imagem final é escolhida
    const handleFinalImageSelect = (url) => {
        if (targetImageType === 'avatar') {
            setFoto({ file: null, preview: url });
        } else {
            setFotoCapa({ file: null, preview: url });
        }
        // Reseta os modais
        setShowImageSelection(false);
        setSelectedMedia(null);
        setTargetImageType(null);
    };

    const uploadImageToStorage = async (file, path) => {
        if (!file) return null;
        const storageRef = storage.ref();
        const fileRef = storageRef.child(path);
        await fileRef.put(file);
        return await fileRef.getDownloadURL();
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!usernameStatus.available) {
            setStatus({ type: 'error', message: 'O nome de usuário escolhido não está disponível.' });
            return;
        }
        setLoading(true);
        setStatus({ type: 'info', message: 'Atualizando perfil...' });

        try {
            const userRef = db.collection("users").doc(profileData.uid);
            const nomeParts = formData.nomeCompleto.trim().split(' ');
            const nome = nomeParts.shift() || '';
            const sobrenome = nomeParts.join(' ');

            let avatarUrl = profileData.foto;
            let coverUrl = profileData.fotoCapa;

            if (foto.file) {
                setStatus({ type: 'info', message: 'Enviando foto de perfil...' });
                avatarUrl = await uploadImageToStorage(foto.file, `users/${profileData.uid}/avatar_${Date.now()}`);
            } else if (foto.preview && !foto.preview.startsWith('blob:')) {
                avatarUrl = foto.preview;
            }

            if (fotoCapa.file) {
                setStatus({ type: 'info', message: 'Enviando foto de capa...' });
                coverUrl = await uploadImageToStorage(fotoCapa.file, `users/${profileData.uid}/cover_${Date.now()}`);
            } else if (fotoCapa.preview && !fotoCapa.preview.startsWith('blob:')) {
                coverUrl = fotoCapa.preview;
            }

            const updateData = {
                ...formData,
                nome,
                sobrenome,
                foto: avatarUrl,
                fotoCapa: coverUrl,
                nome_lowercase: nome.toLowerCase(),
                sobrenome_lowercase: sobrenome.toLowerCase(),
                nome_completo_lowercase: formData.nomeCompleto.trim().toLowerCase(),
                username: formData.username.trim().toLowerCase(),
            };

            await userRef.update(updateData);
            
            if (auth.currentUser) {
                await auth.currentUser.updateProfile({
                    displayName: formData.nomeCompleto.trim(),
                    photoURL: avatarUrl
                });
            }
            
            setStatus({ type: 'success', message: 'Perfil atualizado!'});
            setTimeout(onClose, 1500);
            
        } catch (error) {
            console.error("Erro ao atualizar perfil:", error);
            setStatus({ type: 'error', message: `Falha na atualização: ${error.message}`});
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[60] p-4 animate-fade-in" onClick={onClose}>
                <div 
                    className="bg-gray-800/95 backdrop-filter backdrop-blur-lg border border-gray-700 rounded-xl shadow-2xl shadow-black/30 w-full max-w-2xl text-white max-h-[90vh] flex flex-col"
                    onClick={e => e.stopPropagation()}
                >
                    <div className="p-6 border-b border-gray-700">
                        <h2 className="text-xl font-bold">Editar Perfil</h2>
                    </div>

                    <form onSubmit={handleSubmit} className="overflow-y-auto">
                        <div className="p-6 md:p-8 space-y-8">
                            {/* Imagem de Capa */}
                            <div className="relative h-40 md:h-48 rounded-lg bg-gray-700/50 group">
                                <img 
                                    src={fotoCapa.preview || 'https://source.unsplash.com/random/1200x400/?texture'} 
                                    onError={(e) => { e.target.onerror = null; e.target.src='https://source.unsplash.com/random/1200x400/?texture'; }}
                                    className="w-full h-full object-cover rounded-lg opacity-80 group-hover:opacity-40 transition-opacity" 
                                    alt="Foto de capa" 
                                />
                                <input type="file" ref={fileInputCoverRef} onChange={(e) => handleFileSelect(e, 'cover')} accept="image/*" className="hidden" />
                                
                                <div className="absolute inset-0 flex items-center justify-center gap-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button type="button" onClick={() => fileInputCoverRef.current.click()} className="flex flex-col items-center justify-center text-gray-200 hover:text-white">
                                        <div className="bg-black/50 p-2 rounded-full mb-1"><CameraIcon className="w-6 h-6" /></div>
                                        <span className="text-xs font-semibold">Upload</span>
                                    </button>
                                    <button type="button" onClick={() => openSearch('cover')} className="flex flex-col items-center justify-center text-gray-200 hover:text-white">
                                        <div className="bg-black/50 p-2 rounded-full mb-1"><SearchIcon className="w-6 h-6" /></div>
                                        <span className="text-xs font-semibold">Catálogo</span>
                                    </button>
                                </div>
                            </div>

                            {/* Imagem de Avatar */}
                            <div className="relative -mt-24 flex justify-center">
                                <div className="relative w-32 h-32 rounded-full border-4 border-gray-800 bg-gray-700 group">
                                    <img 
                                        src={foto.preview || `https://ui-avatars.com/api/?name=${formData.nomeCompleto.charAt(0)}&background=4f46e5&color=fff`}
                                        onError={(e) => { e.target.onerror = null; e.target.src=`https://ui-avatars.com/api/?name=${formData.nomeCompleto.charAt(0)}&background=4f46e5&color=fff`; }}
                                        className="w-full h-full object-cover rounded-full opacity-100 group-hover:opacity-40 transition-opacity" 
                                        alt="Foto de perfil" 
                                    />
                                    <input type="file" ref={fileInputAvatarRef} onChange={(e) => handleFileSelect(e, 'avatar')} accept="image/*" className="hidden" />
                                    
                                    <div className="absolute inset-0 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button type="button" onClick={() => fileInputAvatarRef.current.click()} className="bg-black/60 p-2 rounded-full text-gray-200 hover:text-white hover:bg-black/80" title="Upload do Computador">
                                            <CameraIcon className="w-5 h-5" />
                                        </button>
                                        <button type="button" onClick={() => openSearch('avatar')} className="bg-black/60 p-2 rounded-full text-gray-200 hover:text-white hover:bg-black/80" title="Escolher Personagem">
                                            <SearchIcon className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                            
                            {/* Campos de Texto */}
                            <div className="space-y-6 max-w-lg mx-auto">
                                <div className="space-y-4">
                                    <h3 className="text-lg font-semibold text-gray-200 border-b border-gray-700 pb-2">Informações</h3>
                                    <div>
                                        <label className="block mb-2 text-sm font-medium text-gray-400">Nome Completo</label>
                                        <input type="text" name="nomeCompleto" value={formData.nomeCompleto} onChange={handleInputChange} className="input-style" required />
                                    </div>
                                    <div>
                                        <label className="block mb-2 text-sm font-medium text-gray-400">Nome de Usuário</label>
                                        <div className="relative">
                                            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">@</span>
                                            <input type="text" name="username" value={formData.username} onChange={handleInputChange} className="w-full pl-7 pr-24 px-4 py-2 bg-gray-900 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-500 text-gray-100" required />
                                            <span className={`absolute inset-y-0 right-0 flex items-center pr-3 text-xs font-semibold ${usernameStatus.available ? 'text-green-400' : 'text-red-400'}`}>{usernameStatus.message}</span>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block mb-2 text-sm font-medium text-gray-400">Bio</label>
                                        <textarea name="bio" value={formData.bio} onChange={handleInputChange} rows="3" className="input-style"></textarea>
                                    </div>
                                    <div>
                                        <label className="block mb-2 text-sm font-medium text-gray-400">Localização</label>
                                        <input type="text" name="localizacao" value={formData.localizacao} onChange={handleInputChange} className="input-style" placeholder="Ex: São Paulo, Brasil"/>
                                    </div>
                                    <div className="space-y-4">
                                        <h3 className="text-lg font-semibold text-gray-200 border-b border-gray-700 pb-2">Preferências</h3>
                                        <div>
                                            <label className="block mb-2 text-sm font-medium text-gray-400">Streaming Favorito</label>
                                            <select name="favoriteStreaming" value={formData.favoriteStreaming} onChange={handleInputChange} className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-100">
                                                <option value="">Nenhum</option>
                                                {STREAMING_SERVICES.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block mb-2 text-sm font-medium text-gray-400">Gênero Favorito</label>
                                            <select name="favoriteGenre" value={formData.favoriteGenre} onChange={handleInputChange} className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-100">
                                                <option value="">Nenhum</option>
                                                {genres.map(g => <option key={g.id} value={g.name}>{g.name}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div className="p-6 border-t border-gray-700 bg-gray-900/50">
                            {status.message && (
                                <div className={`p-3 rounded-lg mb-4 text-sm text-center ${
                                    status.type === 'success' ? 'bg-green-500/10 text-green-300' :
                                    status.type === 'info' ? 'bg-blue-500/10 text-blue-300 flex items-center justify-center' :
                                    'bg-red-500/10 text-red-300'
                                }`}>
                                    {status.type === 'info' && <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-indigo-400 mr-3"></div>}
                                    <span className="font-semibold">{status.message}</span>
                                </div>
                            )}
                            <div className="flex justify-end space-x-4 max-w-lg mx-auto">
                                <button type="button" onClick={onClose} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg transition-colors">Cancelar</button>
                                <button type="submit" disabled={loading} className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold py-2 px-4 rounded-lg transition-opacity hover:opacity-90 disabled:opacity-50">
                                    {loading ? 'Salvando...' : 'Salvar Alterações'}
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            </div>

            {/* Modais auxiliares do fluxo de busca */}
            {showSearch && (
                <ContentSearchModal 
                    onClose={() => setShowSearch(false)}
                    onSelectMedia={handleMediaSelect}
                />
            )}

            {showImageSelection && selectedMedia && (
                <GeneratedImageSelectionModal
                    media={selectedMedia}
                    targetType={targetImageType}
                    onSelectImage={handleFinalImageSelect}
                    onBack={() => { setShowImageSelection(false); setShowSearch(true); }}
                    onClose={() => { setShowImageSelection(false); setShowSearch(false); }}
                />
            )}
        </>
    );
};

export default EditProfileModal;