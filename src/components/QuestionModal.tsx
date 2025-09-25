import React, { useEffect, useRef } from "react";
import "../css/QuestionModal.css";

interface QuestionModalProps {
    isOpen: boolean;
    title?: string;
    onClose: () => void;
    onSubmit: () => void;
    submitLabel?: string;
    children: React.ReactNode;
}

const QuestionModal: React.FC<QuestionModalProps> = ({
                                                         isOpen,
                                                         title,
                                                         onClose,
                                                         onSubmit,
                                                         submitLabel = "Submit",
                                                         children,
                                                     }) => {
    const dialogRef = useRef<HTMLDivElement>(null);

    // basic focus handling
    useEffect(() => {
        if (!isOpen) return;
        const prev = document.activeElement as HTMLElement | null;
        dialogRef.current?.focus();
        return () => prev?.focus();
    }, [isOpen]);

    // ESC to close, Enter to submit (when not inside textarea, etc.)
    const onKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (e) => {
        if (e.key === "Escape") onClose();
        // Only submit if focus isn't on a button that already handles Enter
        if (e.key === "Enter") {
            const tag = (e.target as HTMLElement).tagName.toLowerCase();
            if (!["textarea", "button"].includes(tag)) onSubmit();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="qm-overlay" role="presentation" onMouseDown={onClose}>
            <div
                className="qm-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby={title ? "qm-title" : undefined}
                tabIndex={-1}
                ref={dialogRef}
                onKeyDown={onKeyDown}
                onMouseDown={(e) => e.stopPropagation()} // prevent overlay close
            >
                {title ? <h2 id="qm-title" className="qm-title">{title}</h2> : null}

                <div className="qm-body">
                    {children}
                </div>

                <div className="qm-actions">
                    <button className="qm-btn qm-btn--ghost" onClick={onClose} type="button">
                        Cancel
                    </button>
                    <button className="qm-btn qm-btn--primary" onClick={onSubmit} type="button">
                        {submitLabel}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default QuestionModal;
