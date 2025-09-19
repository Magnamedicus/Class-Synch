import React, { useState, useEffect } from "react";
import "../../css/TimeInput.css";

interface TimeInputProps {
    value: string; // format: "HH:MM AM/PM"
    onChange: (newTime: string) => void;
}

const TimeInput: React.FC<TimeInputProps> = ({ value, onChange }) => {
    const [hours, setHours] = useState(12);
    const [minutes, setMinutes] = useState(0);
    const [ampm, setAmpm] = useState<"AM" | "PM">("AM");

    // Parse incoming value
    useEffect(() => {
        if (value) {
            const match = value.match(/(\d{1,2}):(\d{2})\s?(AM|PM)/i);
            if (match) {
                setHours(parseInt(match[1], 10));
                setMinutes(parseInt(match[2], 10));
                setAmpm(match[3].toUpperCase() as "AM" | "PM");
            }
        }
    }, [value]);

    const updateTime = (h: number, m: number, ap: "AM" | "PM") => {
        const formatted = `${String(h).padStart(2, "0")}:${String(m).padStart(
            2,
            "0"
        )} ${ap}`;
        onChange(formatted);
    };

    const incrementHours = () => {
        const newHours = hours === 12 ? 1 : hours + 1;
        setHours(newHours);
        updateTime(newHours, minutes, ampm);
    };

    const decrementHours = () => {
        const newHours = hours === 1 ? 12 : hours - 1;
        setHours(newHours);
        updateTime(newHours, minutes, ampm);
    };

    const incrementMinutes = () => {
        const newMinutes = (minutes + 1) % 60;
        setMinutes(newMinutes);
        updateTime(hours, newMinutes, ampm);
    };

    const decrementMinutes = () => {
        const newMinutes = minutes === 0 ? 59 : minutes - 1;
        setMinutes(newMinutes);
        updateTime(hours, newMinutes, ampm);
    };

    const handleHourChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let val = parseInt(e.target.value, 10);
        if (isNaN(val)) val = 1;
        if (val < 1) val = 1;
        if (val > 12) val = 12;
        setHours(val);
        updateTime(val, minutes, ampm);
    };

    const handleMinuteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let val = parseInt(e.target.value, 10);
        if (isNaN(val)) val = 0;
        if (val < 0) val = 0;
        if (val > 59) val = 59;
        setMinutes(val);
        updateTime(hours, val, ampm);
    };

    const toggleAmPm = () => {
        const next = ampm === "AM" ? "PM" : "AM";
        setAmpm(next);
        updateTime(hours, minutes, next);
    };

    return (
        <div className="time-input-container">
            {/* Hours */}
            <div className="time-unit">
                <button className="time-btn" onClick={incrementHours}>▲</button>
                <input
                    type="number"
                    min="1"
                    max="12"
                    value={hours}
                    onChange={handleHourChange}
                    className="time-display-input"
                />
                <button className="time-btn" onClick={decrementHours}>▼</button>
            </div>

            <span className="time-colon">:</span>

            {/* Minutes */}
            <div className="time-unit">
                <button className="time-btn" onClick={incrementMinutes}>▲</button>
                <input
                    type="number"
                    min="0"
                    max="59"
                    value={minutes}
                    onChange={handleMinuteChange}
                    className="time-display-input"
                />
                <button className="time-btn" onClick={decrementMinutes}>▼</button>
            </div>

            {/* AM/PM */}
            <div className="ampm-toggle" onClick={toggleAmPm}>
                {ampm}
            </div>
        </div>
    );
};

export default TimeInput;
