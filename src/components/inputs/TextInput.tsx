import React from 'react';
import '../../css/TextInput.css';

interface TextInputProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
}

const TextInput: React.FC<TextInputProps> = ({ value, onChange, placeholder }) => {
    return (

        <div className="input-container">
            <input placeholder = {placeholder} type="text" />
        </div>

    );
};

export default TextInput;
