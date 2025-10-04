import React from "react";
import "../../css/TimeOfDaySelection.css";

export type TimeName =
    | "Late Morning"
    | "Early Afternoon"
    | "Mid Afternoon"
    | "Late Afternoon"
    | "Evening"


const DAYS: Array<{ key: TimeName; short: string; label: string }> = [
    { key: "Late Morning", short: "Late Morning", label: "Late Morning" },
    { key: "Early Afternoon", short: "Early Afternoon", label: "Early Afternoon" },
    { key: "Mid Afternoon", short: "Mid Afternoon", label: "Mid Afternoon" },
    { key: "Late Afternoon", short: "Late Afternoon", label: "Late Afternoon" },
    { key: "Evening", short: "Evening", label: "Evening" },

];

export interface TimeSelectionProps {
    value: TimeName[];                         // selected days
    onChange: (days: TimeName[]) => void;      // update selection
    disabled?: boolean;
    className?: string;
    ariaLabel?: string;
}

const TimeOfDaySelection: React.FC<TimeSelectionProps> = ({
                                                       value,
                                                       onChange,
                                                       disabled = false,
                                                       className = "",
                                                       ariaLabel = "Select a time of day",
                                                   }) => {
    const toggle = (d: TimeName) => {
        if (disabled) return;
        const set = new Set(value);
        if (set.has(d)) set.delete(d);
        else set.add(d);
        onChange(Array.from(set));
    };

    return (
        <div className={`daysel-root ${className}`} role="group" aria-label={ariaLabel}>
            {DAYS.map((d) => {
                const selected = value.includes(d.key);
                return (
                    <button
                        key={d.key}
                        type="button"
                        className={`daysel-cell ${selected ? "is-selected" : ""}`}
                        onClick={() => toggle(d.key)}
                        aria-pressed={selected}
                        aria-label={d.label}
                        disabled={disabled}
                    >
                        <span className="daysel-short">{d.short}</span>
                    </button>
                );
            })}
        </div>
    );
};

export default TimeOfDaySelection;
