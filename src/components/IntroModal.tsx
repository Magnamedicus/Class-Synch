import React, { useEffect, useRef } from "react";
import "../css/IntroModal.css";

interface IntroModalProps {
    isOpen: boolean;
    imageSrc: string;
    onClose: () => void;
    buttonLabel?: string;
    overlayNote?: string;
}

const IntroModal: React.FC<IntroModalProps> = ({
                                                   isOpen,
                                                   imageSrc,
                                                   onClose,
                                                   buttonLabel = "Get Started",
                                                   overlayNote,
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
        if (e.key === "Escape" || e.key === "Enter") onClose();
    };

    return (
        <div className="im-overlay" role="presentation" aria-hidden={!isOpen}>
            <div
                className="im-dialog im-dialog--immersive im-dialog--frame"
                role="dialog"
                aria-modal="true"
                aria-label="Questionnaire introduction"
                tabIndex={-1}
                ref={dialogRef}
                onKeyDown={onKeyDown}
            >
                {/* Inset canvas adds a small mat around the image */}
                <div className="im-canvas">
                    {/* Blurred backdrop fills letterboxing without cropping */}
                    <div
                        className="im-backdrop"
                        style={{ backgroundImage: `url(${imageSrc})` }}
                        aria-hidden="true"
                    />
                    {/* The main image: always fully visible */}
                    <img
                        src={imageSrc}
                        alt="Questionnaire introduction artwork"
                        className="im-img-bleed"
                    />

                    {/* Gradient scrim + CTA overlaid on the image */}
                    <div className="im-cta">
                        {overlayNote ? <span className="im-note">{overlayNote}</span> : null}
                        <button className="im-btn im-btn--primary" type="button" onClick={onClose}>
                            {buttonLabel}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default IntroModal;
