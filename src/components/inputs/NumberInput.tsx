import React from 'react';
import '../../css/NumberInput.css';

interface NumberInputProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string | number; // ✅ allow numbers too
}

const NumberInput: React.FC<NumberInputProps> = ({ value, onChange, placeholder }) => {
    const handleIncrement = () => {
        const newValue = (parseInt(value || '0', 10) + 1).toString();
        onChange(newValue);
    };

    const handleDecrement = () => {
        const current = parseInt(value || '0', 10);
        const newValue = Math.max(0, current - 1).toString(); // ✅ clamp at 0
        onChange(newValue);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newVal = e.target.value;
        // ✅ If user clears field, allow empty string
        if (newVal === '') {
            onChange('');
            return;
        }
        const parsed = parseInt(newVal, 10);
        onChange(Math.max(0, parsed).toString()); // clamp at 0
    };

    return (
        <div className="custom-number-wrapper">
            <button
                type="button"
                className="num-btn"
                onClick={handleDecrement}
            >
                −
            </button>
            <input
                type="number"
                className="custom-number-input"
                value={value}
                onChange={handleChange}
                placeholder={placeholder !== undefined ? String(placeholder) : 'Enter a number'} // ✅ always stringify
                min="0" // ✅ browser enforcement
            />
            <button
                type="button"
                className="num-btn"
                onClick={handleIncrement}
            >
                +
            </button>
        </div>
    );
};

export default NumberInput;
