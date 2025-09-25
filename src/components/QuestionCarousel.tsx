import React, { useEffect, useRef } from "react";
import { motion, useMotionValue } from "framer-motion";
import "../css/QuestionCarousel.css";

const SPRING = { type: "spring", mass: 3, stiffness: 400, damping: 50 };

export interface QuestionCarouselProps {
    images: string[];                // one image per question (or loop a shorter list)
    index: number;                   // controlled: current question index (0..n-1)
    onIndexChange: (i: number) => void;
    autoAdvanceMs?: number;          // e.g., 10000 (optional; pass undefined to disable)
    dragBufferPx?: number;           // e.g., 50
    className?: string;
    showDots?: boolean;
    ariaLabel?: string;
}

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(n, max));

const QuestionCarousel: React.FC<QuestionCarouselProps> = ({
                                                               images,
                                                               index,
                                                               onIndexChange,
                                                               autoAdvanceMs,
                                                               dragBufferPx = 50,
                                                               className = "",
                                                               showDots = true,
                                                               ariaLabel = "Question visual carousel"
                                                           }) => {
    const dragX = useMotionValue(0);
    const timerRef = useRef<number | null>(null);

    // Auto-advance only when not being dragged
    useEffect(() => {
        if (!autoAdvanceMs) return;
        stopTimer();
        timerRef.current = window.setInterval(() => {
            const x = dragX.get();
            if (x === 0) {
                const next = (index + 1) % images.length;
                onIndexChange(next);
            }
        }, autoAdvanceMs) as unknown as number;

        return stopTimer;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [index, images.length, autoAdvanceMs]);

    const stopTimer = () => {
        if (timerRef.current !== null) {
            window.clearInterval(timerRef.current);
            timerRef.current = null;
        }
    };

    // Keyboard navigation for accessibility
    const onKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (e) => {
        if (e.key === "ArrowRight") onIndexChange(clamp(index + 1, 0, images.length - 1));
        if (e.key === "ArrowLeft") onIndexChange(clamp(index - 1, 0, images.length - 1));
    };

    const onDragEnd = () => {
        const x = dragX.get();
        if (x <= -dragBufferPx && index < images.length - 1) {
            onIndexChange(index + 1);
        } else if (x >= dragBufferPx && index > 0) {
            onIndexChange(index - 1);
        }
    };

    return (
        <div
            className={`qc-root ${className}`}
            aria-label={ariaLabel}
            role="region"
            tabIndex={0}
            onKeyDown={onKeyDown}
            onFocus={stopTimer}      /* pause on focus/interaction */
            onMouseEnter={stopTimer} /* pause on hover */
            onMouseLeave={() => { /* resume on leave if autoAdvance */ if (autoAdvanceMs) { stopTimer(); } }}
        >
            <div className="qc-viewport">
                <motion.div
                    className="qc-track"
                    drag="x"
                    dragConstraints={{ left: 0, right: 0 }}
                    style={{ x: dragX }}
                    animate={{ translateX: `-${index * 100}%` }}
                    transition={SPRING}
                    onDragEnd={onDragEnd}
                >
                    {images.map((src, i) => (
                        <motion.div
                            key={`${src}-${i}`}
                            className="qc-slide"
                            style={{ backgroundImage: `url(${src})` }}
                            animate={{ scale: index === i ? 0.96 : 0.9 }}
                            transition={SPRING}
                            aria-hidden={index !== i}
                        />
                    ))}
                </motion.div>

                {/* Gradient edges */}
                <div className="qc-edge qc-edge--left" aria-hidden="true" />
                <div className="qc-edge qc-edge--right" aria-hidden="true" />
            </div>

            {showDots && (
                <div className="qc-dots" role="tablist" aria-label="Question images">
                    {images.map((_, i) => (
                        <button
                            key={i}
                            role="tab"
                            aria-selected={index === i}
                            aria-label={`Go to image ${i + 1}`}
                            onClick={() => onIndexChange(i)}
                            className={`qc-dot ${index === i ? "is-active" : ""}`}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export default QuestionCarousel;
