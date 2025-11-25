import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../services/firebaseConfig';
import { useAuth } from '../contexts/AuthContext';
import { Spinner, ErrorMessage } from '../components/Common';
import ContentCard from '../components/ContentCard';
import { ShareIcon, CloseIcon } from '../components/Icons';
import firebase from 'firebase/compat/app';

const ListPage = () => {
    const { listId } = useParams();
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const [listData, setListData] = useState(null);
    const [authorData, setAuthorData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [copySuccess, setCopySuccess] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [confirmingDelete, setConfirmingDelete] = useState(false);

    useEffect(() => {
        const unsubscribe = db.collection("lists").doc(listId).onSnapshot(async (doc) => {
            if (doc.exists) {
                const data = { id: doc.id, ...doc.data() };
                setListData(data);
                const userSnap = await db.collection("users").doc(data.uidAutor).get();
                if (userSnap.exists) setAuthorData(userSnap.data());
            } else {
                setError("Lista não encontrada.");
            }
            setLoading(false);
        }, err => {
            console.error(err);
            setError("Erro ao carregar a lista.");
            setLoading(false);
        });
        return () => unsubscribe();
    }, [listId]);

    const handleShare = () => {
        navigator.clipboard.writeText(window.location.href).then(() => {
            setCopySuccess('Link copiado!');
            setTimeout(() => setCopySuccess(''), 2000);
        });
    };

    const handleDeleteItem = async (item) => {
        if (!currentUser || currentUser.uid !== listData.uidAutor) return;
        try {
            await db.collection("lists").doc(listId).update({
                items: firebase.firestore.FieldValue.arrayRemove(item)
            });
        } catch (error) { console.error(error); }
    };

    const handleDeleteList = async () => {
        if (!currentUser || currentUser.uid !== listData.uidAutor) return;
        if (!confirmingDelete) { setConfirmingDelete(true); return; }
        try {
            await db.collection("lists").doc(listId).delete();
            navigate(`/profile/${currentUser.uid}`);
        } catch (error) { console.error(error); }
    };

    if (loading) return <Spinner />;
    if (error) return <div className="p-8"><ErrorMessage message={error} /></div>;
    if (!listData || !authorData) return null;

    const isOwner = currentUser && currentUser.uid === listData.uidAutor;

    return (
        <div className="container mx-auto p-4 md:p-8 text-white">
            <div className="flex flex-col md:flex-row md:items-start justify-between mb-6">
                <div>
                    <h1 className="text-3xl md:text-4xl font-bold">{listData.title}</h1>
                    <p className="text-gray-400 mt-2">{listData.description}</p>
                    <div className="flex items-center space-x-2 mt-3 text-sm">
                        <img src={authorData.foto} alt={authorData.nome} className="w-6 h-6 rounded-full object-cover" onError={(e) => { e.target.onerror = null; e.target.src=`https://ui-avatars.com/api/?name=${authorData.nome}`; }}/>
                        <span>Criada por <strong className="cursor-pointer hover:underline" onClick={() => navigate(`/profile/${listData.uidAutor}`)}>{authorData.nome}</strong></span>
                    </div>
                </div>
                <div className="flex items-center space-x-2 mt-4 md:mt-0">
                    <button onClick={handleShare} className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg transition-colors flex items-center space-x-2">
                        <ShareIcon className="w-5 h-5"/>
                        <span>{copySuccess || 'Compartilhar'}</span>
                    </button>
                    {isOwner && (
                        <button onClick={() => setIsEditing(!isEditing)} className={`font-bold py-2 px-4 rounded-lg transition-colors ${isEditing ? 'bg-green-600 hover:bg-green-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
                            {isEditing ? 'Concluir' : 'Editar'}
                        </button>
                    )}
                </div>
            </div>

            {isOwner && isEditing && (
                <div className="bg-gray-800/50 border border-dashed border-red-500/50 p-4 rounded-lg mb-6 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <p className="text-red-300 text-sm font-medium">Você está no modo de edição.</p>
                    <button onClick={handleDeleteList} className={`text-white font-bold py-2 px-4 rounded-lg transition-colors text-sm ${confirmingDelete ? 'bg-red-700' : 'bg-red-500 hover:bg-red-600'}`}>
                        {confirmingDelete ? 'Confirmar Exclusão?' : 'Excluir Lista'}
                    </button>
                </div>
            )}

            {listData.items && listData.items.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-4 gap-y-8">
                    {listData.items.map(item => (
                        <div key={item.mediaId} className="relative group/item">
                            <ContentCard content={item} mediaType={item.mediaType} />
                            {isOwner && isEditing && (
                                <button onClick={() => handleDeleteItem(item)} className="absolute top-2 left-2 bg-red-600 text-white rounded-full p-1.5 shadow-lg z-10 hover:bg-red-700 transition-colors">
                                    <CloseIcon className="w-5 h-5"/>
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            ) : (
                <p className="text-gray-400 text-center py-10">Esta lista ainda está vazia.</p>
            )}
        </div>
    );
};

export default ListPage;