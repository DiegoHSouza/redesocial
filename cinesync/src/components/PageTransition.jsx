import React from 'react';
import { motion } from 'framer-motion';

const PageTransition = ({ children }) => {
    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }} // Começa invisível e levemente deslocado p/ direita
            animate={{ opacity: 1, x: 0 }}  // Fica visível e na posição original
            exit={{ opacity: 0, x: -20 }}   // Sai ficando invisível e indo p/ esquerda
            transition={{ duration: 0.3, ease: "easeInOut" }} // Duração suave
            className="w-full h-full"
        >
            {children}
        </motion.div>
    );
};

export default PageTransition;