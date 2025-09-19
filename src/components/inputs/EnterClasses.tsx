import React, { useState, useEffect, useRef } from "react";
import "../../css/EnterClasses.css";

interface EnterClassesProps {
    value: string[];
    onChange: (newClasses: string[]) => void;
}

const EnterClasses: React.FC<EnterClassesProps> = ({ value, onChange }) => {
    const [input, setInput] = useState("");
    const [open, setOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const handleAdd = () => {
        if (input.trim() !== "") {
            onChange([...value, input.trim()]);
            setInput("");
        }
    };

    const handleRemove = (cls: string) => {
        onChange(value.filter((c) => c !== cls));
    };

    // ✅ Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    return (
        <div className="enter-classes-container">
            <h3 className="option-header">Option 1: Enter Classes Manually</h3>
            <div className="input-row">
                <input
                    type="text"
                    placeholder="Type a class name..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    className="class-input"
                />
                <button onClick={handleAdd} className="add-btn">+ Add</button>
            </div>

            {/* Dropdown */}
            <div className="dropdown-wrapper" ref={dropdownRef}>
                <button
                    type="button"
                    className="dropdown-toggle"
                    onClick={() => setOpen((prev) => !prev)}
                >
                    {value.length} Classes Added ▾
                </button>

                {open && (
                    <ul className="dropdown-list">
                        {value.map((cls, i) => (
                            <li key={i} className="dropdown-item">
                                {cls}
                                <button
                                    type="button"
                                    className="remove-btn-small"
                                    onClick={() => handleRemove(cls)}
                                >
                                    ✕
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <h3 className="option-header">Option 2: Upload Your Schedule</h3>
            <form className="file-upload-form">
                <label htmlFor="file" className="file-upload-label">
                    <div className="file-upload-design">
                        <svg viewBox="0 0 640 512" height="2.5em">
                            <path d="M144 480C64.5 480 0 415.5 0 336c0-62.8 40.2-116.2
                96.2-135.9c-.1-2.7-.2-5.4-.2-8.1c0-88.4 71.6-160
                160-160c59.3 0 111 32.2 138.7 80.2C409.9 102
                428.3 96 448 96c53 0 96 43 96 96c0 12.2-2.3
                23.8-6.4 34.6C596 238.4 640 290.1 640 352c0
                70.7-57.3 128-128 128H144zm79-217c-9.4 9.4-9.4
                24.6 0 33.9s24.6 9.4 33.9 0l39-39V392c0 13.3
                10.7 24 24 24s24-10.7 24-24V257.9l39 39c9.4
                9.4 24.6 9.4 33.9 0s9.4-24.6 0-33.9l-80-80c-9.4
                -9.4-24.6-9.4-33.9 0l-80 80z"/>
                        </svg>
                        <p>Drag & Drop</p>
                        <span className="browse-button">Browse File</span>
                    </div>
                    <input id="file" type="file" />
                </label>
            </form>
        </div>
    );
};

export default EnterClasses;
