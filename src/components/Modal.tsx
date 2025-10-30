// app/components/Modal.tsx
import React from "react";
import { createPortal } from "react-dom";
import "../css/Modal.css";

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    children: React.ReactNode;
}

export default function Modal({ isOpen, onClose, children }: ModalProps) {
    if (!isOpen) return null;

    const overlay = (
        <div className="modal-overlay" onClick={onClose}>
            <div
                className="modal-card"
                onClick={(e) => e.stopPropagation()}
            >
                {children}
            </div>
        </div>
    );

    // Render into body to avoid transformed/stacking-context parents affecting positioning
    return createPortal(overlay, document.body);
}
