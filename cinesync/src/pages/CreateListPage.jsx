import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/firebaseConfig';
import { useAuth } from '../contexts/AuthContext';
import firebase from 'firebase/compat/app';
import { Spinner } from '../components/Common';
import { ArrowLeftIcon } from '../components/Icons';
// REMOVIDO: import { awardXP } from '../utils/gamification';

const CreateListPage = () => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const { currentUser } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!title.trim()) {
            setError('O título é obrigatório.');
            return;
        }
        if (!currentUser) {
            setError('Você precisa estar logado para criar uma lista.');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const newList = {
                title,
                description,
                uidAutor: currentUser.uid,
                items: [],
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            };

            // Salva a lista no Firestore
            const docRef = await db.collection('lists').add(newList);
            
            // NOTA: A lógica de XP foi removida daqui.
            // O Backend (Cloud Functions) detecta o evento 'onListCreated' 
            // e atribui os pontos e verifica a medalha 'Maratonista' automaticamente.

            // Redireciona para a página da nova lista em modo de edição
            navigate(`/list/${docRef.id}?editing=true`); 
        } catch (err) {
            console.error("Erro ao criar lista:", err);
            setError('Ocorreu um erro ao criar a lista. Tente novamente.');
            setLoading(false);
        }
    };

    return (
        <div className="container mx-auto p-4 md:p-8 text-white">
            <div className="max-w-2xl mx-auto bg-gray-800/50 border border-gray-700 rounded-xl p-8">
                <div className="flex items-center mb-6">
                    <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-gray-700 transition-colors mr-4" aria-label="Voltar">
                        <ArrowLeftIcon className="w-6 h-6" />
                    </button>
                    <h1 className="text-3xl font-bold">Criar Nova Lista</h1>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <label htmlFor="title" className="block text-gray-300 text-sm font-bold mb-2">Título</label>
                        <input type="text" id="title" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Ex: Meus Filmes de Terror Favoritos" />
                    </div>
                    <div className="mb-6">
                        <label htmlFor="description" className="block text-gray-300 text-sm font-bold mb-2">Descrição (Opcional)</label>
                        <textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-lg py-2 px-3 h-24 focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Uma breve descrição sobre o que é esta lista..."></textarea>
                    </div>
                    {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
                    <button type="submit" disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg transition-colors disabled:bg-gray-500 flex items-center justify-center">
                        {loading ? <Spinner size="small" /> : 'Criar Lista'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default CreateListPage;