import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { db } from '../services/firebaseConfig';
import { useAuth } from '../contexts/AuthContext';
import { Spinner, ErrorMessage, getAvatarUrl } from '../components/Common';
import ContentCard from '../components/ContentCard'; // Mantido
import { ShareIcon, CloseIcon, ArrowLeftIcon } from '../components/Icons';
import firebase from 'firebase/compat/app';

const ListPage = () => {
    const { listId } = useParams();
    const [searchParams] = useSearchParams();
    const { currentUser } = useAuth();
    const [listData, setListData] = useState(null);
    const [authorData, setAuthorData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [copySuccess, setCopySuccess] = useState('');
    const [headerOpacity, setHeaderOpacity] = useState(1);
    const [isEditing, setIsEditing] = useState(false);
    const navigate = useNavigate();
    const [confirmingDelete, setConfirmingDelete] = useState(false);

    useEffect(() => {
        // Habilita o modo de edição se o parâmetro 'editing' estiver na URL
        if (searchParams.get('editing') === 'true') {
            setIsEditing(true);
        }

        const unsubscribe = db.collection("lists").doc(listId).onSnapshot(async (doc) => {
            if (doc.exists) {
                const data = { id: doc.id, ...doc.data() };
                setListData(data);
                const userSnap = await db.collection("users").doc(data.uidAutor).get();
                if (userSnap.exists) setAuthorData({uid: userSnap.id, ...userSnap.data()});
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

    // Efeito de fade no header ao rolar a página
    useEffect(() => {
        const handleScroll = () => {
            const newOpacity = Math.max(0, 1 - window.scrollY / 300);
            setHeaderOpacity(newOpacity);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

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

    // Pega os primeiros 10 pôsteres para o mural
    const headerPosters = listData.items?.slice(0, 10).map(item => item.poster_path).filter(Boolean) || [];

    return (
        <div className="text-white">
            {/* --- BOTÃO DE VOLTAR --- */}
            <button 
                onClick={() => navigate(-1)} 
                className="absolute top-28 left-5 z-20 p-2 bg-gray-800/50 backdrop-blur-sm rounded-full hover:bg-gray-700 transition-colors"
                aria-label="Voltar"
            >
                <ArrowLeftIcon className="w-6 h-6" />
            </button>

            {/* --- NOVO HEADER VISUAL --- */}
            <div className="relative h-80 md:h-96 w-full overflow-hidden" style={{ opacity: headerOpacity }}>
                <div className="absolute inset-0 grid grid-cols-5 grid-rows-2 gap-1 transform -rotate-3 scale-110">
                    {headerPosters.map((path, i) => (
                        <img key={i} src={`https://image.tmdb.org/t/p/w500${path}`} alt="" className="w-full h-full object-cover opacity-40" />
                    ))}
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/80 to-transparent"></div>
                <div className="absolute bottom-0 left-0 p-4 md:p-8 container mx-auto w-full">
                    <h1 className="text-4xl md:text-6xl font-black text-shadow-lg">{listData.title}</h1>
                    <p className="text-gray-300 mt-2 max-w-2xl text-shadow">{listData.description}</p>
                    <div className="flex items-center space-x-3 mt-4 cursor-pointer group" onClick={() => navigate(`/profile/${listData.uidAutor}`)}>
                        <img src={getAvatarUrl(authorData.foto, authorData.nome)} alt={authorData.nome} className="w-10 h-10 rounded-full object-cover border-2 border-transparent group-hover:border-indigo-400 transition-colors" />
                        <div>
                            <p className="text-sm text-gray-400">Criada por</p>
                            <p className="font-bold text-white group-hover:underline">{authorData.nome}</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="container mx-auto p-4 md:p-8">
                {/* Barra de Ações */}
                <div className="flex items-center justify-end space-x-2 mb-8 -mt-4 md:-mt-16 relative z-10">
                    <div className="bg-gray-800/50 backdrop-blur-md border border-gray-700 p-2 rounded-full flex items-center space-x-2">
                        <button onClick={handleShare} className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-full transition-colors flex items-center space-x-2 text-sm">
                            <ShareIcon className="w-4 h-4"/>
                            <span>{copySuccess || 'Compartilhar'}</span>
                        </button>
                        {isOwner && (
                            <button onClick={() => setIsEditing(!isEditing)} className={`font-bold py-2 px-4 rounded-full transition-colors text-sm ${isEditing ? 'bg-green-600 hover:bg-green-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
                                {isEditing ? 'Concluir' : 'Editar'}
                            </button>
                        )}
                    </div>
                </div>

                {isOwner && isEditing && (
                    <div className="bg-red-900/20 border border-dashed border-red-500/50 p-4 rounded-xl mb-8 flex flex-col sm:flex-row justify-between items-center gap-4 animate-fade-in">
                        <p className="text-red-300 text-sm font-medium">Você está no modo de edição. Clique no 'X' para remover itens.</p>
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
                                    <button onClick={() => handleDeleteItem(item)} className="absolute -top-2 -left-2 bg-red-600 text-white rounded-full p-1.5 shadow-lg z-10 hover:bg-red-700 transition-colors transform hover:scale-110">
                                        <CloseIcon className="w-5 h-5"/>
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-20 bg-gray-800/50 border-2 border-dashed border-gray-700 rounded-2xl">
                        <h3 className="text-xl font-bold text-white mb-2">Lista Vazia</h3>
                        <p className="text-gray-400">Adicione filmes e séries para começar a colecionar.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ListPage;