import React from 'react';
import { Link } from 'react-router-dom';

const PrivacyPolicyPage = () => {
    return (
        <div className="container mx-auto p-4 md:p-8 text-gray-300">
            <div className="max-w-4xl mx-auto bg-gray-800/50 border border-gray-700 rounded-xl p-8">
                <h1 className="text-3xl font-bold text-white mb-6">Política de Privacidade</h1>
                
                <p className="mb-4">Última atualização: 24 de Julho de 2024</p>

                <p className="mb-4">
                    Bem-vindo ao CineSync. A sua privacidade é importante para nós. Esta política de privacidade explica como coletamos, usamos, divulgamos e protegemos suas informações quando você visita nosso site.
                </p>

                <h2 className="text-2xl font-bold text-white mt-6 mb-3">Coleta de Informações</h2>
                <p className="mb-4">
                    Coletamos informações que você nos fornece diretamente, como quando você cria uma conta, faz uma avaliação ou cria uma lista. As informações podem incluir seu nome, e-mail e conteúdo gerado pelo usuário.
                </p>

                <h2 className="text-2xl font-bold text-white mt-6 mb-3">Uso de Informações</h2>
                <p className="mb-4">
                    Usamos as informações coletadas para operar e manter o site, personalizar sua experiência, nos comunicarmos com você e entender como nossos usuários utilizam o serviço para que possamos melhorá-lo.
                </p>

                <h2 className="text-2xl font-bold text-white mt-6 mb-3">Cookies e Anúncios de Terceiros</h2>
                <p className="mb-4">
                    Nosso site utiliza cookies para melhorar a sua experiência. Também usamos serviços de publicidade de terceiros, como o Google AdSense, para exibir anúncios quando você visita nosso site.
                </p>
                <p className="mb-4">
                    O Google, como fornecedor de terceiros, utiliza cookies para veicular anúncios com base nas visitas anteriores dos usuários ao nosso site ou a outros sites. O uso do cookie de publicidade da Google permite que ela e seus parceiros veiculem anúncios para seus usuários com base na visita a seus sites e/ou outros sites na Internet.
                </p>
                <p className="mb-4">
                    Você pode desativar a publicidade personalizada visitando as <a href="https://www.google.com/settings/ads" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">Configurações de anúncios</a> do Google.
                </p>

                <h2 className="text-2xl font-bold text-white mt-6 mb-3">Seus Direitos</h2>
                <p className="mb-4">
                    Você tem o direito de acessar, corrigir ou excluir suas informações pessoais a qualquer momento através das configurações do seu perfil.
                </p>

                <h2 className="text-2xl font-bold text-white mt-6 mb-3">Contato</h2>
                <p>
                    Se você tiver alguma dúvida sobre esta Política de Privacidade, entre em contato conosco em <a href="mailto:poldefacer@gmail.com" className="text-indigo-400 hover:underline">contato@cinesync.com</a>.
                </p>

                <div className="mt-8 text-center">
                    <Link to="/" className="text-indigo-400 hover:underline">Voltar para a página inicial</Link>
                </div>
            </div>
        </div>
    );
};

export default PrivacyPolicyPage;