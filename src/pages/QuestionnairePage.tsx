import React, { useState } from 'react';
import { Link } from "react-router-dom";
import QuestionCard from '../components/QuestionCard';
import ContinueButton from '../components/ContinueButton';
import BackButton from '../components/BackButton';
import NumberInput from '../components/inputs/NumberInput';
import TextInput from '../components/inputs/TextInput';
import EnterClasses from "../components/inputs/EnterClasses";
import TimeInput from '../components/inputs/TimeInput';
import '../css/QuestionnairePage.css';

import logo from '../assets/logo.png';

const questionnaire = [
    {
        bucket: 'School Work',
        questions: [
            { id: 'q1', text: 'How many classes are you taking?', inputType: 'number', hint: 'Enter a number' },
            { id: 'q2', text: 'Name your classes (or upload schedule)', inputType: 'enter-classes', hint: 'Type class names' }
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
    const [classes, setClasses] = useState<string[]>([]); // ✅ track classes here

    const currentBucket = questionnaire[bucketIndex];
    const currentQuestion = currentBucket?.questions[questionIndex];

    const renderInput = () => {
        if (!currentQuestion) return null;

        switch (currentQuestion.inputType) {
            case 'number':
                return (
                    <NumberInput
                        value={inputValue}
                        onChange={setInputValue}
                        placeholder="0"
                    />
                );
            case 'text':
                return (
                    <TextInput
                        value={inputValue}
                        onChange={setInputValue}
                        placeholder={currentQuestion.hint}
                    />
                );
            case 'enter-classes':
                return (
                    <EnterClasses
                        value={classes}
                        onChange={setClasses}
                    />
                );
            case 'time':
                return (
                    <TimeInput
                        type="time"
                        value={inputValue}
                        onChange={setInputValue}
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

        if (currentQuestion.inputType === 'enter-classes') {
            setAnswers(prev => ({
                ...prev,
                [currentQuestion.id]: classes.join(',')
            }));
        } else {
            setAnswers(prev => ({
                ...prev,
                [currentQuestion.id]: inputValue
            }));
            setInputValue('');
        }

        // ✅ Progress to next question
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

    const isClassesQuestion = currentQuestion?.inputType === 'enter-classes';
    const disableContinue = isClassesQuestion
        ? classes.length === 0
        : !inputValue.trim();

    return (
        <div className="questionnaire-page">
            <img src={logo} alt="App Logo" className="page-logo" />

            <Link to="/">
                <img src={logo} alt="App Logo" className="page-logo" />
            </Link>

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
                            disabled={disableContinue}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

export default QuestionnairePage;
