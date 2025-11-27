import React from 'react';
import { useNavigate } from 'react-router-dom';
import { TMDB_IMAGE_URL } from '../services/tmdbApi';
import { TicketIcon } from './Icons';

const MovieInviteCard = ({ movie, senderName }) => {
    const navigate = useNavigate();

    if (!movie) return null;

    return (
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl overflow-hidden max-w-xs w-full">
            <div className="p-4">
                <p className="text-sm text-gray-300 mb-3"><strong className="text-white">{senderName || 'Alguém'}</strong> te convidou para assistir:</p>
                <div className="flex items-start gap-4">
                    <img 
                        src={`${TMDB_IMAGE_URL}${movie.poster_path}`} 
                        alt={movie.title}
                        className="w-16 rounded-md object-cover shadow-lg"
                    />
                    <div className="flex-1">
                        <h4 className="font-bold text-white leading-tight">{movie.title}</h4>
                        <button onClick={() => navigate(`/detail/${movie.mediaType || 'movie'}/${movie.id}`)} className="mt-3 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold py-1.5 px-3 rounded-md transition-colors flex items-center gap-1.5">
                            <TicketIcon className="w-4 h-4" /> Ver Detalhes
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MovieInviteCard;