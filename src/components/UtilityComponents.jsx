// Path: src/components/UtilityComponents.jsx

import React from 'react';

// Displays a loading spinner with an optional message
export const LoadingSpinner = ({ message = "Loading..." }) => (
    <div className="loading-spinner">
        <div className="spinner"></div>
        <p>{message}</p>
    </div>
);

// Displays a dismissible message box
export const MessageBox = ({ message, type = 'info', onClose }) => {
    if (!message) return null; // Don't render if no message
    return (
        <div className={`message-box message-box-${type}`}>
            <p>{message}</p>
            {onClose && <button onClick={onClose} className="message-box-close">X</button>}
        </div>
    );
};

// Generic Modal Component
export const Modal = ({ isOpen, onClose, title, children }) => {
    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}> {/* Prevent clicks inside from closing */}
                <div className="modal-header">
                    <h2>{title}</h2>
                    <button onClick={onClose} className="modal-close-button">&times;</button>
                </div>
                <div className="modal-body">
                    {children}
                </div>
            </div>
        </div>
    );
};
