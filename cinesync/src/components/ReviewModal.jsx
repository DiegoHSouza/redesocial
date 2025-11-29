import React, { useState } from 'react';
import { db, auth } from '../services/firebaseConfig';
import firebase from 'firebase/compat/app';
import { ErrorMessage } from './Common';
import { TMDB_IMAGE_URL } from '../services/tmdbApi';
// REMOVIDO: import { awardXP } ... (O Backend agora gerencia isso via Triggers)

const ReviewModal = ({ movie, onClose, existingReview, mediaType }) => {
    const { currentUser } = auth;
    const [nota, setNota] = useState(existingReview ? existingReview.nota : 5);
    const [comentario, setComentario] = useState(existingReview ? existingReview.comentario : "");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            if (existingReview) {
                // Atualizar review existente
                const reviewRef = db.collection("reviews").doc(existingReview.id);
                await reviewRef.update({
                    nota: nota,
                    comentario: comentario,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                });
            } else {
                // Criar nova review
                await db.collection("reviews").add({
                    uidAutor: currentUser.uid,
                    movieId: movie.id.toString(),
                    movieTitle: movie.title || movie.name,
                    moviePoster: movie.poster_path ? `${TMDB_IMAGE_URL}${movie.poster_path}` : null,
                    nota: nota,
                    comentario: comentario,
                    curtidas: [],
                    mediaType: mediaType || 'movie', // Garante fallback se mediaType vier vazio
                    commentCount: 0,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                });
                
                // NOTA: As linhas de XP (awardXP) e Stats (increment) foram removidas daqui.
                // O Backend (Cloud Functions) vai detectar a criação deste documento 
                // e automaticamente:
                // 1. Dar o XP para o usuário
                // 2. Incrementar o contador de reviews do usuário
                // 3. Verificar se ele ganhou alguma medalha nova
            }
            onClose();
        } catch (err) {
            console.error(err);
            setError("Não foi possível postar sua avaliação.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[90] p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-gray-800/90 backdrop-filter backdrop-blur-lg border border-gray-700 p-8 rounded-xl shadow-2xl w-full max-w-lg text-white" onClick={e => e.stopPropagation()}>
                <h2 className="text-2xl font-bold mb-4">Sua avaliação para: <span className="font-semibold text-indigo-400">{movie.title || movie.name}</span></h2>
                {error && <ErrorMessage message={error} />}
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block mb-2 text-gray-300 font-medium">Nota: <span className="font-bold text-yellow-400 text-lg ml-1">{nota.toFixed(1)}</span></label>
                        <input 
                            type="range" 
                            min="0.5" 
                            max="10" 
                            step="0.5" 
                            value={nota} 
                            onChange={e => setNota(parseFloat(e.target.value))} 
                            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500" 
                        />
                        <div className="flex justify-between text-xs text-gray-500 mt-1">
                            <span>0</span>
                            <span>5</span>
                            <span>10</span>
                        </div>
                    </div>
                    <div>
                         <label className="block mb-2 text-gray-300 font-medium">Comentário (opcional):</label>
                         <textarea 
                            name="comentario"
                            value={comentario} 
                            onChange={e => setComentario(e.target.value)} 
                            rows="4" 
                            className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-500 text-gray-100 resize-none" 
                            placeholder="O que você achou da história, atuações, etc..."
                        ></textarea>
                    </div>
                    <div className="flex justify-end space-x-3 pt-2">
                        <button type="button" onClick={onClose} className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2.5 px-5 rounded-lg transition-colors">Cancelar</button>
                        <button type="submit" disabled={loading} className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold py-2.5 px-6 rounded-lg transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/30">
                            {loading ? 'Postando...' : (existingReview ? 'Salvar Edição' : 'Publicar Avaliação')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ReviewModal;