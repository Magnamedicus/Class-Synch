import React, { useMemo, useRef } from "react";
import "../../css/PrioritySlider.css";

type PriorityMode = "raw" | "normalized";
type PriorityVariant = "bucket" | "obligation";

export interface Mark { value: number; label?: string; }

export interface PrioritySliderProps {
    label?: string;
    value: number;
    onChange: (v: number) => void;
    onChangeEnd?: (v: number) => void;
    mode?: PriorityMode;
    variant?: PriorityVariant;
    min?: number;
    max?: number;
    step?: number;
    marks?: Mark[];
    showValue?: boolean;
    helpText?: string;
    disabled?: boolean;
    id?: string;
    "aria-label"?: string;
    "aria-labelledby"?: string;
    format?: (v01: number) => string;
    color?: string;
}

const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max);
const to01 = (v: number, mode: PriorityMode, max: number) =>
    mode === "normalized" ? clamp(v, 0, 1) : clamp(v / max, 0, 1);

const defaultMarksRaw: Mark[] = [
    { value: 0, label: "Low" },
    { value: 50, label: "Medium" },
    { value: 100, label: "High" },
];

const PrioritySlider: React.FC<PrioritySliderProps> = ({
                                                           label = "Priority",
                                                           value,
                                                           onChange,
                                                           onChangeEnd,
                                                           mode = "raw",
                                                           variant = "obligation",
                                                           min,
                                                           max,
                                                           step,
                                                           marks,
                                                           showValue = true,
                                                           helpText,
                                                           disabled,
                                                           id,
                                                           "aria-label": ariaLabel,
                                                           "aria-labelledby": ariaLabelledBy,
                                                           format,
                                                           color,
                                                       }) => {
    const isNormalized = mode === "normalized";
    const effectiveMin = min ?? 0;
    const effectiveMax = max ?? (isNormalized ? 1 : 100);
    const effectiveStep = step ?? (isNormalized ? 0.01 : 1);
    const inputRef = useRef<HTMLInputElement>(null);

    const v01 = useMemo(() => to01(value, mode, effectiveMax), [value, mode, effectiveMax]);
    const percent = Math.round(v01 * 100);
    const displayText = format ? format(v01) : `${percent}%`;

    const usedMarks: Mark[] =
        marks ??
        (isNormalized
            ? defaultMarksRaw.map(m => ({ value: m.value / 100, label: m.label }))
            : defaultMarksRaw);

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
        const raw = Number(e.target.value);
        if (!Number.isNaN(raw)) onChange(raw);
    }

    function handleChangeEnd() {
        if (!onChangeEnd) return;
        const raw = inputRef.current ? Number(inputRef.current.value) : value;
        if (!Number.isNaN(raw)) onChangeEnd(raw);
    }

    return (
        <div
            className={`priority-slider priority-slider--${variant} ${disabled ? "is-disabled" : ""}`}
            style={color ? ({ ["--ps-color" as any]: color } as React.CSSProperties) : undefined}
        >
            {label || showValue ? (
                <div className="ps-header">
                    {label ? (
                        <label className="ps-label" htmlFor={id ?? undefined}>{label}</label>
                    ) : <span className="ps-spacer" />}
                    {showValue && <span className="ps-badge" aria-hidden="true">{displayText}</span>}
                </div>
            ) : null}

            <div className="ps-track-wrap">
                <input
                    ref={inputRef}
                    className="ps-input"
                    type="range"
                    id={id}
                    min={effectiveMin}
                    max={effectiveMax}
                    step={effectiveStep}
                    value={value}
                    onChange={handleChange}
                    onMouseUp={handleChangeEnd}
                    onTouchEnd={handleChangeEnd}
                    disabled={!!disabled}
                    aria-valuemin={effectiveMin}
                    aria-valuemax={effectiveMax}
                    aria-valuenow={value}
                    aria-label={ariaLabel}
                    aria-labelledby={ariaLabelledBy}
                />
                <div className="ps-progress" style={{ width: `${percent}%` }} aria-hidden="true" />
            </div>

            {usedMarks?.length ? (
                <div className="ps-marks" aria-hidden="true">
                    {usedMarks.map((m, i) => {
                        const p = to01(m.value, mode, effectiveMax) * 100;
                        return (
                            <div key={i} className="ps-mark" style={{ left: `${p}%` }}>
                                <span className="ps-tick" />
                                {m.label ? <span className="ps-mark-label">{m.label}</span> : null}
                            </div>
                        );
                    })}
                </div>
            ) : null}

            {helpText ? <div className="ps-help">{helpText}</div> : null}
        </div>
    );
};

export default PrioritySlider;
