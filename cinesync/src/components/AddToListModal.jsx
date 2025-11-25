import React, { useState, useEffect } from 'react';
import { db } from '../services/firebaseConfig';
import { useAuth } from '../contexts/AuthContext';
import firebase from 'firebase/compat/app';
import { Spinner } from './Common';
import { PlusIcon } from './Icons';

const AddToListModal = ({ movie, mediaType, onClose }) => {
    const { currentUser } = useAuth();
    const [lists, setLists] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [newListName, setNewListName] = useState("");
    const [newListDesc, setNewListDesc] = useState("");
    const [isCreating, setIsCreating] = useState(false);
    
    useEffect(() => {
        if (!currentUser) return;
        const q = db.collection("lists").where("uidAutor", "==", currentUser.uid);
        const unsubscribe = q.onSnapshot(snapshot => {
            const userLists = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setLists(userLists);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [currentUser]);

    const itemPayload = {
        mediaId: movie.id,
        mediaType: mediaType,
        title: movie.title || movie.name,
        poster_path: movie.poster_path,
        vote_average: movie.vote_average
    };

    const handleAddItem = async (listId) => {
        const listRef = db.collection("lists").doc(listId);
        await listRef.update({
            items: firebase.firestore.FieldValue.arrayUnion(itemPayload)
        });
        onClose();
    };
    
    const handleCreateAndAdd = async (e) => {
        e.preventDefault();
        if (!newListName.trim()) return;
        setIsCreating(true);
        try {
            await db.collection("lists").add({
                uidAutor: currentUser.uid,
                title: newListName,
                description: newListDesc,
                items: [itemPayload],
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            });
            onClose();
        } catch (error) {
            console.error("Erro ao criar lista:", error);
        } finally {
            setIsCreating(false);
        }
    };
    
    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-gray-800/80 backdrop-filter backdrop-blur-lg border border-gray-700 p-6 rounded-xl shadow-lg w-full max-w-md text-white" onClick={e => e.stopPropagation()}>
                <h2 className="text-xl font-bold mb-4">Adicionar a uma lista</h2>
                {loading ? <Spinner/> : (
                     showCreateForm ? (
                        <form onSubmit={handleCreateAndAdd}>
                             <h3 className="text-lg font-semibold mb-2">Nova Lista</h3>
                             <div className="space-y-4">
                                <input type="text" value={newListName} onChange={e => setNewListName(e.target.value)} placeholder="Título da lista" className="input-style" required />
                                <textarea value={newListDesc} onChange={e => setNewListDesc(e.target.value)} placeholder="Descrição (opcional)" rows="2" className="input-style"></textarea>
                             </div>
                             <div className="flex justify-end space-x-2 mt-4">
                                 <button type="button" onClick={() => setShowCreateForm(false)} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg transition-colors text-sm">Voltar</button>
                                 <button type="submit" disabled={isCreating} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg transition-colors text-sm disabled:opacity-50">
                                    {isCreating ? 'Criando...' : 'Criar e Adicionar'}
                                 </button>
                             </div>
                        </form>
                    ) : (
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                            {lists.map(list => {
                                const alreadyExists = list.items?.some(item => item.mediaId === movie.id);
                                return (
                                    <button key={list.id} onClick={() => handleAddItem(list.id)} disabled={alreadyExists} className="w-full text-left p-3 bg-gray-900/50 rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                                        {list.title}
                                        {alreadyExists && <span className="text-xs text-gray-400 ml-2">(Já adicionado)</span>}
                                    </button>
                                );
                            })}
                            <button onClick={() => setShowCreateForm(true)} className="w-full flex items-center justify-center p-3 mt-2 bg-gray-700/60 rounded-lg hover:bg-gray-700 transition-colors">
                                <PlusIcon className="w-5 h-5 mr-2" /> Criar nova lista
                            </button>
                        </div>
                    )
                )}
            </div>
        </div>
    );
};

export default AddToListModal;