import React from 'react';
import { Link } from 'react-router-dom';

const AboutPage = () => {
    return (
        <div className="container mx-auto p-4 md:p-8 text-gray-300">
            <div className="max-w-4xl mx-auto bg-gray-800/50 border border-gray-700 rounded-xl p-8">
                <h1 className="text-3xl font-bold text-white mb-6">Sobre o CineSync</h1>

                <p className="mb-4 text-lg leading-relaxed">
                    O CineSync nasceu da paixão por filmes e séries e da vontade de conectar pessoas com gostos parecidos. 
                    Em um mundo com tantas opções de streaming, encontrar a próxima grande maratona ou o filme perfeito para a noite pode ser um desafio.
                </p>

                <h2 className="text-2xl font-bold text-white mt-8 mb-3">Nossa Missão</h2>
                <p className="mb-4">
                    Nossa missão é simples: ser a sua central definitiva para descobrir, organizar e discutir conteúdo audiovisual. Queremos que você passe menos tempo procurando e mais tempo assistindo.
                    Aqui, suas avaliações e listas ajudam a construir uma comunidade onde as recomendações são genuínas e vêm de pessoas como você.
                </p>

                <h2 className="text-2xl font-bold text-white mt-8 mb-3">Como Funciona?</h2>
                <p className="mb-4">
                    Utilizamos a vasta base de dados do TMDB (The Movie Database) para trazer informações atualizadas, mas a mágica acontece com a sua participação. Cada review, cada lista criada e cada interação enriquece a experiência de todos.
                </p>

                <p className="mt-8">
                    Obrigado por fazer parte da nossa comunidade!
                </p>
            </div>
        </div>
    );
};

export default AboutPage;