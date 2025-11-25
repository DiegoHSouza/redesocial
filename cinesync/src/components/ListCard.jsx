import React from 'react';
import { useNavigate } from 'react-router-dom';
import { TMDB_IMAGE_URL } from '../services/tmdbApi';
import { LayoutGridIcon } from './Icons';

const ListCard = ({ list }) => {
    const navigate = useNavigate();
    const itemsToShow = list.items?.slice(0, 3) || [];
    
    const posterStyles = [
        'z-10 group-hover:scale-102 group-hover:-rotate-2',
        'z-5 scale-90 rotate-4 right-0 group-hover:scale-92 group-hover:rotate-6 group-hover:-translate-x-2',
        'z-0 scale-80 -rotate-4 left-0 group-hover:scale-82 group-hover:-rotate-6 group-hover:translate-x-2',
    ];

    return (
        <div 
            onClick={() => navigate(`/list/${list.id}`)}
            className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 cursor-pointer hover:border-indigo-500/80 transition-all group"
        >
            <div className="relative aspect-square w-full mb-4 flex items-center justify-center overflow-hidden rounded-lg bg-gray-900/30">
                {itemsToShow.length === 0 && (
                    <div className="w-full h-full bg-gray-700/50 flex items-center justify-center">
                        <LayoutGridIcon className="w-12 h-12 text-gray-600" />
                    </div>
                )}
                
                {[...itemsToShow].reverse().map((item, index) => {
                    const styleIndex = itemsToShow.length - 1 - index;
                    return (
                         <div 
                             key={item.mediaId + '-' + index} 
                             className={`absolute w-[65%] aspect-[2/3] transition-all duration-300 ease-in-out ${posterStyles[styleIndex]}`}
                         >
                            <img 
                                src={item.poster_path ? `${TMDB_IMAGE_URL}${item.poster_path}` : 'https://via.placeholder.com/300x450'} 
                                alt="" 
                                className="w-full h-full object-cover rounded-md shadow-lg bg-gray-700 border border-gray-800/60"
                            />
                        </div>
                    );
                })}
            </div>
            <h4 className="font-bold truncate group-hover:text-indigo-400">{list.title}</h4>
            <p className="text-sm text-gray-400">{list.items?.length || 0} itens</p>
        </div>
    );
};

export default ListCard;