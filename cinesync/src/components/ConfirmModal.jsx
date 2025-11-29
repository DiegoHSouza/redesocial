import React, { useEffect, useRef } from 'react';

const ConfirmModal = ({ 
    isOpen, 
    onClose = () => {}, // Define uma função vazia como padrão
    onConfirm = () => {}, // Define uma função vazia como padrão
    title, 
    message, 
    confirmText = "Confirm", 
    cancelText = "Cancel", 
    isDanger = false,
    showCancel = true
}) => {
    const confirmButtonRef = useRef(null);
    const modalRef = useRef(null);
    const previouslyFocusedRef = useRef(null);
    const messageId = `confirm-modal-message`;

    useEffect(() => {
        if (!isOpen) return;

        // UX: prevent background from scrolling while modal is open to avoid layout shifts on mobile.
        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        // ACCESSIBILITY: remember previously focused element to restore focus on close.
        previouslyFocusedRef.current = document.activeElement;

        // Focus the primary action after ensuring DOM painted.
        requestAnimationFrame(() => confirmButtonRef.current?.focus());

        // KEY HANDLING: trap Tab key inside modal and close on Escape.
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                onClose();
                return;
            }
            if (e.key === 'Tab') {
                // Focus-trap: keep focus within modal by cycling focusable elements.
                const focusable = modalRef.current?.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])') || [];
                const nodes = Array.prototype.filter.call(focusable, el => !el.hasAttribute('disabled'));
                if (nodes.length === 0) {
                    e.preventDefault();
                    return;
                }
                const first = nodes[0];
                const last = nodes[nodes.length - 1];
                if (e.shiftKey) {
                    if (document.activeElement === first) {
                        e.preventDefault();
                        last.focus();
                    }
                } else {
                    if (document.activeElement === last) {
                        e.preventDefault();
                        first.focus();
                    }
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = originalOverflow;
            // Restore focus to previously focused element for seamless keyboard UX.
            try { previouslyFocusedRef.current?.focus(); } catch (_) { /* noop */ }
        };
    }, [isOpen, onClose]);

    // PERFORMANCE: Render nothing if the modal is not open.
    if (!isOpen) return null;

    return (
        // ACCESSIBILITY (WCAG): `role="dialog"` and `aria-modal="true"` are essential for screen readers.
        // `aria-labelledby` points to the title for context.
        <div 
            className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in" 
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-modal-title"
            aria-describedby={messageId}
        >
            <div 
                ref={modalRef}
                className="bg-gray-800 border border-gray-700 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-6 text-center">
                    <h3 id="confirm-modal-title" className="text-xl font-bold text-white mb-2">{title}</h3>
                    <p id={messageId} className="text-gray-300 mb-6">{message}</p>
                    
                    {/* UI/UX: Use `justify-end` to prevent layout shifts when the cancel button is hidden. */}
                    <div className="flex justify-end space-x-3">
                        {showCancel && (
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 rounded-lg bg-gray-700 text-gray-200 hover:bg-gray-600 transition-colors font-medium"
                            >
                                {cancelText}
                            </button>
                        )}
                        <button
                            type="button"
                            ref={confirmButtonRef}
                            onClick={onConfirm}
                            className={`px-6 py-2 rounded-lg text-white font-bold transition-colors ${
                                isDanger ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700'
                            }`}
                        >
                            {confirmText}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ConfirmModal;