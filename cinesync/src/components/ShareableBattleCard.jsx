import React, { forwardRef } from 'react';
import { FireIcon } from './Icons'; // Certifique-se que o caminho está certo

const TMDB_IMAGE_HD = 'https://image.tmdb.org/t/p/original'; // Usar imagem HD para o print

const ShareableBattleCard = forwardRef(({ battle, userChoice, userName }, ref) => {
    const movieA_Chosen = userChoice === battle.movieA_Id;
    const movieB_Chosen = userChoice === battle.movieB_Id;

    return (
        // Container Principal: Fixo em alta resolução (quadrado para instagram/twitter) e fora da tela
        <div 
            ref={ref}
            style={{ 
                position: 'absolute', 
                top: '-9999px', 
                left: '-9999px',
                width: '1080px', // Resolução alta fixa
                height: '1080px' 
            }}
            className="bg-gradient-to-br from-gray-900 to-black text-white overflow-hidden flex flex-col relative"
        >
            {/* Header com Branding */}
            <div className="bg-black/50 p-8 flex items-center justify-between border-b border-white/10 z-20">
                <h1 className="text-4xl font-black tracking-tighter bg-gradient-to-r from-indigo-400 to-purple-500 bg-clip-text text-transparent">
                    CineSync Battles
                </h1>
                <div className="flex items-center gap-3 bg-orange-600/20 px-6 py-3 rounded-full border border-orange-500/30">
                    <FireIcon className="w-8 h-8 text-orange-500" />
                    <span className="text-xl font-bold text-orange-200 uppercase tracking-widest">Duelo Épico</span>
                </div>
            </div>

            {/* Arena Visual */}
            <div className="flex-1 flex relative">
                {/* LADO A */}
                <div className="flex-1 relative h-full border-r-4 border-black">
                    <img src={`${TMDB_IMAGE_HD}${battle.movieA_Poster}`} crossOrigin="anonymous" className={`w-full h-full object-cover ${movieB_Chosen ? 'grayscale brightness-50' : ''}`} alt="" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent"></div>
                    
                    {movieA_Chosen && (
                        <div className="absolute top-8 left-8 bg-blue-600 text-white px-6 py-3 rounded-full text-2xl font-black uppercase tracking-widest shadow-lg z-30 border-2 border-white">
                            {userName || 'Você'} Votou
                        </div>
                    )}

                    <div className="absolute bottom-0 left-0 w-full p-10 flex flex-col justify-end h-full z-20">
                        <h2 className="text-5xl font-black text-white leading-tight drop-shadow-2xl">{battle.movieA_Title}</h2>
                    </div>
                </div>
                
                {/* VS Central */}
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-40">
                    <div className="bg-black/80 backdrop-blur-xl rounded-full w-32 h-32 flex items-center justify-center border-8 border-gray-800 shadow-2xl">
                        <span className="text-4xl font-black text-white italic tracking-tighter">VS</span>
                    </div>
                </div>
                
                {/* LADO B */}
                <div className="flex-1 relative h-full">
                    <img src={`${TMDB_IMAGE_HD}${battle.movieB_Poster}`} crossOrigin="anonymous" className={`w-full h-full object-cover ${movieA_Chosen ? 'grayscale brightness-50' : ''}`} alt="" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent"></div>

                    {movieB_Chosen && (
                         <div className="absolute top-8 right-8 bg-red-600 text-white px-6 py-3 rounded-full text-2xl font-black uppercase tracking-widest shadow-lg z-30 border-2 border-white">
                            {userName || 'Você'} Votou
                        </div>
                    )}

                    <div className="absolute bottom-0 right-0 w-full p-10 flex flex-col justify-end h-full text-right z-20">
                        <h2 className="text-5xl font-black text-white leading-tight drop-shadow-2xl">{battle.movieB_Title}</h2>
                    </div>
                </div>
            </div>

             {/* Footer Call to Action */}
             <div className="bg-black/80 p-6 text-center z-20 border-t border-white/10">
                <p className="text-2xl text-gray-300 font-bold uppercase tracking-wide">Quem vence? Vote agora no app!</p>
            </div>
        </div>
    );
});

export default ShareableBattleCard;