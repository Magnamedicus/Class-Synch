import React from "react";
import "../../css/DaySelection.css";

export type DayName =
    | "monday"
    | "tuesday"
    | "wednesday"
    | "thursday"
    | "friday"
    | "saturday"
    | "sunday";

const DAYS: Array<{ key: DayName; short: string; label: string }> = [
    { key: "monday", short: "Mon", label: "Monday" },
    { key: "tuesday", short: "Tue", label: "Tuesday" },
    { key: "wednesday", short: "Wed", label: "Wednesday" },
    { key: "thursday", short: "Thu", label: "Thursday" },
    { key: "friday", short: "Fri", label: "Friday" },
    { key: "saturday", short: "Sat", label: "Saturday" },
    { key: "sunday", short: "Sun", label: "Sunday" },
];

export interface DaySelectionProps {
    value: DayName[];                         // selected days
    onChange: (days: DayName[]) => void;      // update selection
    disabled?: boolean;
    className?: string;
    ariaLabel?: string;
}

const DaySelection: React.FC<DaySelectionProps> = ({
                                                       value,
                                                       onChange,
                                                       disabled = false,
                                                       className = "",
                                                       ariaLabel = "Select days of the week",
                                                   }) => {
    const toggle = (d: DayName) => {
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

export default DaySelection;
