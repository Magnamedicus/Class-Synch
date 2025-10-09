import React from "react";
import "../../css/EnterObligations.css"; // reuse styling

interface EnterObligationsProps {
    value: string[];
    onChange: (list: string[]) => void;
    placeholder?: string;
    label?: string;
}

const EnterObligations: React.FC<EnterObligationsProps> = ({
                                                               value,
                                                               onChange,
                                                               placeholder = "Add a recurring social obligation (e.g., Club meeting, Choir, D&D night)…",
                                                               label = "Recurring Social Obligations",
                                                           }) => {
    const [draft, setDraft] = React.useState("");

    const add = () => {
        const v = draft.trim();
        if (!v) return;
        if (value.includes(v)) return;
        onChange([...value, v]);
        setDraft("");
    };

    const remove = (i: number) => {
        const next = value.slice();
        next.splice(i, 1);
        onChange(next);
    };

    const onKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            add();
        }
    };

    return (
        <div className="enter-classes">
            <label className="enter-classes__label">{label}</label>
            <div className="enter-classes__row">
                <input
                    type="text"
                    className="enter-classes__input"
                    placeholder={placeholder}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={onKeyDown}
                />
                <button className="enter-classes__add" type="button" onClick={add}>
                    Add
                </button>
            </div>

            {value.length > 0 && (
                <ul className="enter-classes__list">
                    {value.map((name, i) => (
                        <li key={`${name}-${i}`} className="enter-classes__chip">
                            <span className="enter-classes__chip-text">{name}</span>
                            <button
                                type="button"
                                className="enter-classes__chip-remove"
                                onClick={() => remove(i)}
                                aria-label={`Remove ${name}`}
                            >
                                ×
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default EnterObligations;
