import React from 'react';
import '../../css/TextInput.css';

interface TextInputProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
}

const TextInput: React.FC<TextInputProps> = ({ value, onChange, placeholder }) => {
    return (
        <div className="text-input-container">
            <input
                type="text"
                className="custom-text-input"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder || "Type your answer..."}
            />
        </div>
    );
};

export default TextInput;
