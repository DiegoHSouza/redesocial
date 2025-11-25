import React, { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { StarIcon } from './Icons';
import { TMDB_IMAGE_URL } from '../services/tmdbApi';

const ContentCard = memo(({ content, mediaType }) => {
    const navigate = useNavigate();

    const handleClick = () => {
        // Navegação ajustada para usar a URL correta
        navigate(`/detail/${mediaType || content.media_type}/${content.id || content.mediaId}`);
    };

    return (
        <div className="cursor-pointer group" onClick={handleClick}>
            <div className="relative">
                <img 
                    src={content.poster_path ? `${TMDB_IMAGE_URL}${content.poster_path}` : 'https://via.placeholder.com/500x750?text=No+Image'} 
                    alt={content.title || content.name} 
                    className="rounded-lg shadow-lg transform group-hover:scale-105 transition-transform duration-300 w-full aspect-[2/3] object-cover bg-gray-700" 
                />
                <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-all duration-300 rounded-lg"></div>
                <div className="absolute top-2 right-2 bg-black/70 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center space-x-1 backdrop-blur-sm">
                    <StarIcon className="w-3 h-3 text-yellow-400" />
                    <span>{content.vote_average ? content.vote_average.toFixed(1) : 'N/A'}</span>
                </div>
            </div>
            <h3 className="text-sm font-semibold mt-2 group-hover:text-indigo-400 transition-colors truncate">
                {content.title || content.name}
            </h3>
        </div>
    );
});

export default ContentCard;