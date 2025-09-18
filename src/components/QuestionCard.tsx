import React from 'react';
import '../css/QuestionCard.css';

interface QuestionCardProps {
    category: string;
    questionIndex: number;
    question: string;
    inputHint: string;
}

export default function QuestionCard({ category, questionIndex, question, inputHint }: QuestionCardProps) {
    return (
        <div className="container">
            <div className="cardbody">
                <div className="front">
                    <p className="front-heading">{category}</p>
                    <p>Question #{questionIndex + 1}</p>
                </div>
                <div className="back">
                    <p className="back-heading">{question}</p>
                    <p>{inputHint}</p>
                </div>
            </div>
        </div>
    );
}
