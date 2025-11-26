import React, { useEffect, useRef } from 'react';

const AdSenseBlock = ({ adSlot, style = { display: 'block' } }) => {
    const adRef = useRef(null);
    const hasPushedAd = useRef(false);

    useEffect(() => {
        // Se o anúncio já foi carregado para este componente, não faz nada.
        if (hasPushedAd.current) {
            return;
        }

        try {
            // Tenta carregar o anúncio.
            // A biblioteca adsbygoogle é carregada a partir do script no index.html
            (window.adsbygoogle = window.adsbygoogle || []).push({});
            hasPushedAd.current = true; // Marca que o anúncio foi carregado.
        } catch (e) {
            console.error("Erro ao carregar anúncio do AdSense:", e);
        }
    }, []);

    return (
        <div className="my-8 flex justify-center min-h-[100px]">
            <ins 
                ref={adRef}
                className="adsbygoogle"
                style={style}
                data-ad-client="ca-pub-9862724529882534" // Seu ID de cliente
                data-ad-slot={adSlot} // O ID do bloco de anúncio específico
                data-ad-format="auto"
                data-full-width-responsive="true"
            ></ins>
        </div>
    );
};

export default AdSenseBlock;