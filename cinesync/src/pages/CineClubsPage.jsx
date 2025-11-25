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
        <div className="container mx-auto p-4 md:p-8 text-white">
            <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
                <h1 className="text-3xl font-bold">CineClubes</h1>
                
                <div className="flex items-center gap-2 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                            <SearchIcon className="w-5 h-5"/>
                        </span>
                        <input 
                            type="text" 
                            placeholder="Buscar clubes..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-indigo-500 text-white"
                        />
                    </div>
                    <button onClick={() => setShowCreate(true)} className="bg-indigo-600 px-4 py-2 rounded-lg flex items-center gap-2 font-bold hover:bg-indigo-500 transition-colors whitespace-nowrap">
                        <PlusIcon className="w-5 h-5" /> Novo
                    </button>
                </div>
            </div>

            {showCreate && (
                <form onSubmit={createGroup} className="mb-8 bg-gray-800 p-4 rounded-xl border border-gray-700 flex gap-2 animate-fade-in">
                    <input 
                        type="text" 
                        value={newGroupName} 
                        onChange={e => setNewGroupName(e.target.value)} 
                        placeholder="Nome do Clube (ex: Terror Anos 80)" 
                        className="flex-1 bg-gray-900 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500"
                    />
                    <button type="submit" className="bg-green-600 px-6 py-2 rounded-lg font-bold hover:bg-green-500">Criar</button>
                    <button type="button" onClick={() => setShowCreate(false)} className="bg-gray-600 px-4 py-2 rounded-lg hover:bg-gray-500">Cancelar</button>
                </form>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredGroups.map(group => {
                    const isMember = group.members?.includes(currentUser?.uid);
                    return (
                        <div 
                            key={group.id} 
                            onClick={() => navigate(`/club/${group.id}`)} // Clica no card para abrir
                            className="bg-gray-800/50 border border-gray-700 p-6 rounded-2xl hover:border-indigo-500/50 transition-all cursor-pointer group"
                        >
                            <div className="flex items-center gap-4 mb-4">
                                <img src={group.photo} className="w-16 h-16 rounded-xl object-cover shadow-lg group-hover:scale-105 transition-transform" alt={group.name} />
                                <div>
                                    <h3 className="text-xl font-bold group-hover:text-indigo-400 transition-colors">{group.name}</h3>
                                    <p className="text-sm text-gray-400 flex items-center gap-1">
                                        <UsersIcon className="w-4 h-4" /> {group.members?.length || 0} Membros
                                    </p>
                                </div>
                            </div>
                            <button 
                                onClick={(e) => {
                                    if(!isMember) joinGroup(e, group.id);
                                    else navigate(`/club/${group.id}`);
                                }}
                                className={`w-full py-2 rounded-lg font-bold transition-colors ${isMember ? 'bg-gray-700 text-gray-400 hover:bg-gray-600' : 'bg-indigo-600 hover:bg-indigo-500 text-white'}`}
                            >
                                {isMember ? 'Acessar Clube' : 'Participar'}
                            </button>
                        </div>
                    );
                })}
                {filteredGroups.length === 0 && (
                    <p className="col-span-full text-center text-gray-500 mt-8">Nenhum clube encontrado.</p>
                )}
            </div>
        </div>
    );
};

export default CineClubsPage;