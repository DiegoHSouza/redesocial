import React from 'react';
import { useNavigate } from 'react-router-dom';
import { TMDB_IMAGE_URL } from '../services/tmdbApi';
import { LayoutListIcon } from './Icons'; // Ícone mais apropriado

const ListCard = ({ list }) => {
    const navigate = useNavigate();
    const itemsToShow = list.items?.slice(0, 4) || []; // Usaremos 4 para uma colagem melhor
    
    // Estilos mais dinâmicos para a pilha de pôsteres
    const posterStyles = [
        'z-20 transform-gpu group-hover:scale-105 group-hover:-rotate-3', // Topo
        'z-10 transform-gpu scale-90 rotate-6 right-0 group-hover:scale-95 group-hover:rotate-8 group-hover:-translate-x-2', // Direita
        'z-0 transform-gpu scale-80 -rotate-6 left-0 group-hover:scale-85 group-hover:-rotate-8 group-hover:translate-x-2', // Esquerda
    ];

    const backgroundPoster = itemsToShow.length > 0 ? `${TMDB_IMAGE_URL.replace('/w500', '/w780')}${itemsToShow[0].poster_path}` : '';

    return (
        <div 
            onClick={() => navigate(`/list/${list.id}`)}
            className="relative bg-gray-800/50 border border-gray-700 rounded-2xl p-4 cursor-pointer hover:border-indigo-500/80 transition-all group overflow-hidden"
        >
            {/* Fundo desfocado e ambientado */}
            {backgroundPoster && (
                <div style={{ backgroundImage: `url(${backgroundPoster})` }} className="absolute inset-0 bg-cover bg-center opacity-10 blur-2xl scale-125 transition-all duration-500 group-hover:opacity-20 group-hover:scale-110"></div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-gray-900/50 to-transparent"></div>

            <div className="relative aspect-square w-full mb-4 flex items-center justify-center">
                {itemsToShow.length === 0 && (
                    <div className="w-full h-full bg-gray-700/50 flex items-center justify-center">
                        <LayoutListIcon className="w-12 h-12 text-gray-600" />
                    </div>
                )}
                
                {[...itemsToShow].reverse().map((item, index) => {
                    const styleIndex = Math.min(itemsToShow.length - 1 - index, posterStyles.length - 1);
                    return (
                         <div 
                             key={item.mediaId + '-' + index} 
                             className={`absolute w-[65%] aspect-[2/3] transition-all duration-300 ease-in-out ${posterStyles[styleIndex]}`}
                         >
                            <img 
                                src={item.poster_path ? `${TMDB_IMAGE_URL}${item.poster_path}` : 'https://via.placeholder.com/300x450'} 
                                alt="" 
                                className="w-full h-full object-cover rounded-lg shadow-2xl bg-gray-700 border-2 border-gray-800/60"
                            />
                        </div>
                    );
                })}
            </div>
            <h4 className="font-bold truncate group-hover:text-indigo-400 relative z-10">{list.title}</h4>
            <p className="text-sm text-gray-400">{list.items?.length || 0} itens</p>
        </div>
    );
};

export default ListCard;