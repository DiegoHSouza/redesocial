import React from 'react';
import { motion } from 'framer-motion';

export const REACTIONS = ['❤️', '😂', '🤯', '😢', '🤔'];

const ReactionPicker = ({ onSelect, onClose }) => {
    return (
        <div 
            className="absolute bottom-full mb-2 left-0 flex items-center bg-gray-900/80 backdrop-blur-md border border-gray-700 rounded-full shadow-lg p-1.5 z-20"
            onClick={(e) => e.stopPropagation()}
        >
            {REACTIONS.map((emoji, index) => (
                <motion.button
                    key={emoji}
                    onClick={() => {
                        onSelect(emoji);
                        onClose();
                    }}
                    className="text-2xl p-1.5 rounded-full hover:bg-gray-700/50 transition-colors"
                    whileHover={{ scale: 1.3, rotate: [0, -15, 15, -15, 0] }}
                    transition={{ duration: 0.3 }}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    custom={index}
                >
                    {emoji}
                </motion.button>
            ))}
        </div>
    );
};

export default ReactionPicker;