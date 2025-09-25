import React, { useEffect, useRef } from "react";
import "../css/QuestionModal.css";

interface Props {
    isOpen: boolean;
    title?: string;
    onClose: () => void;
    onSubmit?: () => void;
    submitLabel?: string;
    children?: React.ReactNode;
}

const QuestionModal: React.FC<Props> = ({
                                            isOpen,
                                            title,
                                            onClose,
                                            onSubmit,
                                            submitLabel = "Submit",
                                            children,
                                        }) => {
    const dialogRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isOpen) return;
        const prev = document.activeElement as HTMLElement | null;
        dialogRef.current?.focus();
        return () => prev?.focus();
    }, [isOpen]);

    if (!isOpen) return null;

    const onKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (e) => {
        if (e.key === "Escape") onClose();
    };

    return (
        <div className="qm-overlay" role="presentation" aria-hidden={!isOpen}>
            <div
                className="qm-dialog"
                role="dialog"
                aria-modal="true"
                aria-label={title || "Question"}
                tabIndex={-1}
                ref={dialogRef}
                onKeyDown={onKeyDown}
            >
                {title ? <div className="qm-header">{title}</div> : null}

                <div className="qm-body">
                    {children}
                </div>

                <div className="qm-actions">
                    <button className="qm-btn qm-btn--ghost" type="button" onClick={onClose}>
                        Cancel
                    </button>
                    {onSubmit ? (
                        <button className="qm-btn qm-btn--primary" type="button" onClick={onSubmit}>
                            {submitLabel}
                        </button>
                    ) : null}
                </div>
            </div>
        </div>
    );
};

export default QuestionModal;
