import React, { useState, useEffect } from "react";
import "../../css/TimeInput.css";

interface TimeInputProps {
    /** format: "HH:MM AM/PM" (12-hour) */
    value: string;
    onChange: (newTime: string) => void;
}

const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max);
const pad2 = (n: number) => String(n).padStart(2, "0");

const TimeInput: React.FC<TimeInputProps> = ({ value, onChange }) => {
    const [hours, setHours] = useState<number>(12);        // 1..12
    const [minutes, setMinutes] = useState<number>(0);     // 0..59
    const [ampm, setAmpm] = useState<"AM" | "PM">("AM");

    // Sync from prop
    useEffect(() => {
        if (!value) return;
        const m = value.match(/^\s*(\d{1,2}):(\d{2})\s*(AM|PM)\s*$/i);
        if (m) {
            const h = clamp(parseInt(m[1], 10), 1, 12);
            const min = clamp(parseInt(m[2], 10), 0, 59);
            const ap = m[3].toUpperCase() as "AM" | "PM";
            setHours(h);
            setMinutes(min);
            setAmpm(ap);
        }
    }, [value]);

    const emit = (h: number, m: number, ap: "AM" | "PM") => {
        onChange(`${pad2(h)}:${pad2(m)} ${ap}`);
    };

    // Hours
    const incHours = () => { const h = hours === 12 ? 1 : hours + 1; setHours(h); emit(h, minutes, ampm); };
    const decHours = () => { const h = hours === 1 ? 12 : hours - 1; setHours(h); emit(h, minutes, ampm); };
    const onHoursChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
        const raw = parseInt(e.target.value.replace(/\D+/g, "") || "1", 10);
        const h = clamp(raw, 1, 12);
        setHours(h); emit(h, minutes, ampm);
    };

    // Minutes (always display with leading zero)
    const incMinutes = () => { const m = (minutes + 1) % 60; setMinutes(m); emit(hours, m, ampm); };
    const decMinutes = () => { const m = minutes === 0 ? 59 : minutes - 1; setMinutes(m); emit(hours, m, ampm); };
    const onMinutesChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
        const digits = e.target.value.replace(/\D+/g, "");       // keep only 0-9
        const raw = digits === "" ? 0 : parseInt(digits, 10);
        const m = clamp(raw, 0, 59);
        setMinutes(m);
        emit(hours, m, ampm);
    };

    // AM/PM
    const toggleAmPm = () => {
        const next = ampm === "AM" ? "PM" : "AM";
        setAmpm(next);
        emit(hours, minutes, next);
    };

    return (
        <div className="time-input" role="group" aria-label="Time input">
            {/* Hours */}
            <div className="segment hours">
                <button type="button" className="inc" aria-label="Increase hours" onClick={incHours}>▲</button>
                <input
                    className="value"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={String(hours)}           // no leading zero for 12h look
                    onChange={onHoursChange}
                    onFocus={(e) => e.currentTarget.select()}
                    aria-label="Hours"
                />
                <button type="button" className="dec" aria-label="Decrease hours" onClick={decHours}>▼</button>
            </div>

            {/* Colon */}
            <span className="colon" aria-hidden="true">:</span>

            {/* Minutes */}
            <div className="segment minutes">
                <button type="button" className="inc" aria-label="Increase minutes" onClick={incMinutes}>▲</button>
                <input
                    className="value"
                    type="text"                 /* text to allow leading zero */
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={pad2(minutes)}       /* always 00..59 */
                    onChange={onMinutesChange}
                    onFocus={(e) => e.currentTarget.select()}
                    aria-label="Minutes"
                />
                <button type="button" className="dec" aria-label="Decrease minutes" onClick={decMinutes}>▼</button>
            </div>

            {/* AM/PM */}
            <button type="button" className="ampm" onClick={toggleAmPm} aria-label="Toggle AM/PM">
                {ampm}
            </button>
        </div>
    );
};

export default TimeInput;
