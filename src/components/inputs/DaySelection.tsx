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
    value?: DayName[]; // selected days (optional now)
    onChange: (days: DayName[]) => void;
    disabled?: boolean;
    className?: string;
    ariaLabel?: string;
}

const DaySelection: React.FC<DaySelectionProps> = ({
                                                       value = [], // ✅ fallback to empty array if undefined
                                                       onChange,
                                                       disabled = false,
                                                       className = "",
                                                       ariaLabel = "Select days of the week",
                                                   }) => {
    const toggle = (day: DayName) => {
        if (disabled) return;

        // ✅ ensure value is always an array
        const current = Array.isArray(value) ? [...value] : [];
        const set = new Set(current);

        if (set.has(day)) set.delete(day);
        else set.add(day);

        onChange(Array.from(set));
    };

    return (
        <div
            className={`daysel-root ${className}`}
            role="group"
            aria-label={ariaLabel}
        >
            {DAYS.map((d) => {
                // ✅ safely check for inclusion
                const selected =
                    Array.isArray(value) && value.includes(d.key);

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
