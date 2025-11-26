import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/firebaseConfig';
import { useAuth } from '../contexts/AuthContext';
import { Spinner } from '../components/Common';
import { PlusIcon, UsersIcon, SearchIcon } from '../components/Icons';
import firebase from 'firebase/compat/app';

const CineClubsPage = () => {
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const [groups, setGroups] = useState([]);
    const [filteredGroups, setFilteredGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const unsubscribe = db.collection('groups').orderBy('createdAt', 'desc').onSnapshot(snap => {
            const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setGroups(data);
            setFilteredGroups(data);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // Lógica de Busca Local (Filtragem)
    useEffect(() => {
        if (searchTerm.trim() === '') {
            setFilteredGroups(groups);
        } else {
            const lowerTerm = searchTerm.toLowerCase();
            const filtered = groups.filter(group => group.name.toLowerCase().includes(lowerTerm));
            setFilteredGroups(filtered);
        }
    }, [searchTerm, groups]);

    const createGroup = async (e) => {
        e.preventDefault();
        if (!newGroupName.trim()) return;
        const docRef = await db.collection('groups').add({
            name: newGroupName,
            adminId: currentUser.uid,
            members: [currentUser.uid],
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            photo: `https://ui-avatars.com/api/?name=${newGroupName}&background=random&color=fff`
        });
        setNewGroupName('');
        setShowCreate(false);
        navigate(`/club/${docRef.id}`); // Vai direto pro clube criado
    };

    const joinGroup = async (e, groupId) => {
        e.stopPropagation();
        await db.collection('groups').doc(groupId).update({
            members: firebase.firestore.FieldValue.arrayUnion(currentUser.uid)
        });
        navigate(`/club/${groupId}`);
    };

    if (loading) return <Spinner />;

    return (
        <div className="container mx-auto p-4 md:p-8 text-white animate-fade-in">
            {/* Botão de Voltar */}
            <div className="mb-4">
                <button onClick={() => navigate('/home')} className="text-gray-400 hover:text-white font-bold flex items-center gap-2 transition-colors text-sm">
                    <span className="text-xl leading-none">←</span> Voltar para Explorar
                </button>
            </div>
            {/* --- HERO SECTION --- */}
            <div className="text-center py-12 md:py-16 px-6 bg-gray-900/30 rounded-3xl border border-gray-800/50 mb-10" style={{background: 'radial-gradient(ellipse at top, var(--tw-gradient-stops))', '--tw-gradient-from': 'rgba(31, 41, 55, 0.3)', '--tw-gradient-to': 'rgba(17, 24, 39, 0.1)'}}>
                <h1 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-500 mb-3">
                    Bem-vindo aos CineClubes
                </h1>
                <p className="text-lg text-gray-400 max-w-2xl mx-auto mb-8">
                    Encontre sua tribo. Crie ou participe de comunidades para discutir seus filmes e séries favoritos.
                </p>
                <div className="flex flex-col md:flex-row items-center justify-center gap-3 max-w-xl mx-auto">
                     <div className="relative flex-1 w-full">
                         <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-gray-400">
                             <SearchIcon className="w-5 h-5"/>
                         </span>
                         <input 
                             type="text" 
                             name="search-club"
                             placeholder="Buscar por nome do clube..." 
                             value={searchTerm}
                             onChange={(e) => setSearchTerm(e.target.value)}
                             className="w-full pl-11 pr-4 py-3 bg-gray-800/70 border border-gray-700 rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-500 text-white transition-all"
                         />
                     </div>
                     <button onClick={() => setShowCreate(!showCreate)} className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold py-3 px-6 rounded-full transition-transform hover:scale-105 w-full md:w-auto flex items-center justify-center gap-2">
                         <PlusIcon className="w-5 h-5" /> Criar Clube
                     </button>
                </div>
            </div>

            {showCreate && (
                <form onSubmit={createGroup} className="mb-10 bg-gray-800 p-4 rounded-xl border border-gray-700 flex flex-col md:flex-row gap-3 animate-fade-in-down">
                    <input 
                        type="text" 
                        name="new-group-name"
                        value={newGroupName} 
                        onChange={e => setNewGroupName(e.target.value)} 
                        placeholder="Nome do Clube (ex: Terror Anos 80)" 
                        className="flex-1 bg-gray-900 border border-gray-600 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500"
                    />
                    <div className="flex gap-3">
                        <button type="submit" className="flex-1 bg-green-600 px-6 py-2.5 rounded-lg font-bold hover:bg-green-500 transition-colors">Confirmar Criação</button>
                        <button type="button" onClick={() => setShowCreate(false)} className="bg-gray-600 px-4 py-2.5 rounded-lg hover:bg-gray-500 transition-colors">Cancelar</button>
                    </div>
                </form>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredGroups.map(group => {
                    const isMember = group.members?.includes(currentUser?.uid);
                    return (
                        <div 
                            key={group.id} 
                            onClick={() => navigate(`/club/${group.id}`)}
                            className="bg-gray-800/50 border border-gray-700/80 rounded-2xl overflow-hidden transition-all duration-300 cursor-pointer group hover:border-indigo-500/60 hover:shadow-2xl hover:shadow-indigo-900/30 hover:-translate-y-1"
                        >
                            <div className="relative h-32 bg-cover bg-center" style={{backgroundImage: `url(${group.photo})`}}>
                                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent"></div>
                                <h3 className="absolute bottom-3 left-4 text-2xl font-bold text-white drop-shadow-lg">{group.name}</h3>
                            </div>
                            <div className="p-4">
                                <p className="text-sm text-gray-400 flex items-center gap-2 mb-4">
                                    <UsersIcon className="w-4 h-4" /> {group.members?.length || 0} Membros
                                </p>
                                <button 
                                    onClick={(e) => {
                                        if(!isMember) joinGroup(e, group.id);
                                        else navigate(`/club/${group.id}`);
                                    }}
                                    className={`w-full py-2.5 rounded-lg font-bold transition-colors text-sm ${isMember ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-indigo-600 hover:bg-indigo-500 text-white'}`}
                                >
                                    {isMember ? 'Acessar Clube' : 'Participar'}
                                </button>
                            </div>
                        </div>
                    );
                })}
                {filteredGroups.length === 0 && (
                    <div className="col-span-full text-center text-gray-500 mt-8 bg-gray-800/30 border-2 border-dashed border-gray-700 rounded-2xl p-12">
                        <h3 className="text-xl font-bold text-white mb-2">Nenhum clube encontrado com "{searchTerm}"</h3>
                        <p>Que tal criar um novo clube com esse tema?</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CineClubsPage;