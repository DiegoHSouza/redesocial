import React, { useEffect } from 'react';

const AdSenseBlock = ({ adSlot, style = { display: 'block' } }) => {

    useEffect(() => {
        try {
            // Tenta carregar o anúncio.
            // A biblioteca adsbygoogle é carregada a partir do script no index.html
            (window.adsbygoogle = window.adsbygoogle || []).push({});
        } catch (e) {
            console.error("Erro ao carregar anúncio do AdSense:", e);
        }
    }, []);

    return (
        <div className="my-8 flex justify-center">
            <ins 
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