import React, { useState } from 'react';
import QuestionCard from '../components/QuestionCard';
import ContinueButton from '../components/ContinueButton';
import BackButton from '../components/BackButton';
import NumberInput from '../components/inputs/NumberInput'; // ✅ custom input
import TextInput from '../components/inputs/TextInput';
import '../css/QuestionnairePage.css';

import logo from '../assets/logo.png';



const questionnaire = [
    {
        bucket: 'School Work',
        questions: [
            { id: 'q1', text: 'How many classes are you taking?', inputType: 'number', hint: 'Enter a number' },
            { id: 'q2', text: 'Name your classes (comma separated)', inputType: 'text', hint: 'Type class names' }
        ]
    },
    {
        bucket: 'Sleep',
        questions: [
            { id: 'q3', text: 'How many hours would you like to sleep per night?', inputType: 'number', hint: 'Enter a number' },
            { id: 'q4', text: 'What time do you usually go to bed?', inputType: 'time', hint: 'Choose a time' }
        ]
    }
];

const QuestionnairePage: React.FC = () => {
    const [bucketIndex, setBucketIndex] = useState(0);
    const [questionIndex, setQuestionIndex] = useState(0);
    const [inputValue, setInputValue] = useState('');
    const [answers, setAnswers] = useState<{ [key: string]: string }>({});

    const currentBucket = questionnaire[bucketIndex];
    const currentQuestion = currentBucket?.questions[questionIndex];

    // ✅ Renderer function for inputs
    const renderInput = () => {
        if (!currentQuestion) return null;

        switch (currentQuestion.inputType) {
            case 'number':
                return (
                    <NumberInput
                        value={inputValue}
                        onChange={setInputValue}
                        placeholder={0}
                    />
                );
            case 'text':
                return (
                    <TextInput

                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder={currentQuestion.hint}
                    />
                );
            case 'time':
                return (
                    <input
                        type="time"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                    />
                );
            default:
                return (
                    <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder="Enter your answer"
                    />
                );
        }
    };

    const handleContinue = () => {
        if (!currentQuestion) return;

        setAnswers(prev => ({
            ...prev,
            [currentQuestion.id]: inputValue
        }));

        setInputValue('');

        // Next question or bucket
        if (questionIndex < currentBucket.questions.length - 1) {
            setQuestionIndex(prev => prev + 1);
        } else if (bucketIndex < questionnaire.length - 1) {
            setBucketIndex(prev => prev + 1);
            setQuestionIndex(0);
        } else {
            console.log('🎉 Done! Answers:', answers);
        }
    };

    const handleBack = () => {
        if (questionIndex > 0) {
            setQuestionIndex(prev => prev - 1);
        } else if (bucketIndex > 0) {
            const prevBucketIndex = bucketIndex - 1;
            const prevQuestionIndex = questionnaire[prevBucketIndex].questions.length - 1;
            setBucketIndex(prevBucketIndex);
            setQuestionIndex(prevQuestionIndex);
        }
    };

    return (
        <div className="questionnaire-page">
            {/* ✅ Title goes at the very top */}
            <img src={logo} alt="App Logo" className="page-logo" />


            {/* Existing layout */}
            <div className="questionnaire-layout">
                <div className="card-side">
                    {currentQuestion && (
                        <QuestionCard
                            category={currentBucket.bucket}
                            questionIndex={questionIndex}
                            question={currentQuestion.text}
                            inputHint={currentQuestion.hint}
                        />
                    )}
                </div>

                <div className="back-btn-wrapper">
                    {currentQuestion && <BackButton onClick={handleBack} />}
                </div>

                <div className="form-side">
                    {currentQuestion ? (
                        <>{renderInput()}</>
                    ) : (
                        <p>🎉 All done! Thanks for completing the questionnaire.</p>
                    )}
                </div>

                <div className="continue-btn-wrapper">
                    {currentQuestion && (
                        <ContinueButton
                            onClick={handleContinue}
                            disabled={!inputValue.trim()}
                        />
                    )}
                </div>
            </div>
        </div>
    );

};

export default QuestionnairePage;
