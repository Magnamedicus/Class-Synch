// src/utils/questions.ts

import schoolwork_priority from "../assets/question_images/SchoolWork_PriorityQ.png";
import schoolwork_ClassAmount from "../assets/question_images/SchoolWork_ClassAmountQ.png";
import schoolwork_AddClasses from "../assets/question_images/SchoolWork_AddClassesQ.png";
import schoolwork_MaxStudy from "../assets/question_images/SchoolWork_MaxStudyQ.png";
import schoolwork_StudyBreaks from "../assets/question_images/SchoolWork_StudyBreaksQ.png";
import schoolwork_Commute from "../assets/question_images/SchoolWork_CommuteQ.png";
import schoolwork_NoStudy from "../assets/question_images/SchoolWork_NoStudyQ.png";

import sleep_Priority from "../assets/question_images/Sleep_PriorityQ.png";
import sleep_HoursNeed from "../assets/question_images/Sleep_HoursNeedQ.png";
import sleep_BedTime from "../assets/question_images/Sleep_BedTimeQ.png";
import sleep_WakeUp from "../assets/question_images/Sleep_WakeUpQ.png";
import sleep_ConsistentBedtime from "../assets/question_images/Sleep_ConsistentBedTimeQ.png";
import sleep_NapBool from "../assets/question_images/Sleep_NapBool.png";
import sleep_NapTimes from "../assets/question_images/Sleep_NapTimesQ.png";
import sleep_NapLength from "../assets/question_images/Sleep_NapLengthQ.png";

import work_Boolean from "../assets/question_images/Work_BooleanQ.png";
import work_Priority from "../assets/question_images/Work_PriorityQ.png";
import work_FixedShifts from "../assets/question_images/Work_FixedShiftsQ.png";
import work_AddShifts from "../assets/question_images/Work_AddShifts.png";
import work_HoursAmount from "../assets/question_images/Work_HoursAmountQ.png";

/* --------------------------------- Types ---------------------------------- */

export type BucketId =
    | "school"
    | "sleep"
    | "work"
    | "social"
    | "selfCare"
    | "exercise"
    | "leisure"
    | "custom";

export type QuestionType =
// Basic
    | "priority"
    | "number"
    | "boolean"
    | "text"
    // Time-based
    | "time"
    | "time-range"
    | "weekday-time-intervals"
    // Structured
    | "chips"
    | "enter-classes"
    | "list"
    | "time-selection"
    | "day-selection"
    | "enter-social"
    // Custom structured inputs
    | "selfcare-selector"
    | "exercise-selector"
    | "leisure-selector"
    | "custom-obligations-selector"; // ⬅️ NEW

export type Condition =
    | { id: string; equals?: any; notEquals?: any; truthy?: boolean; falsy?: boolean }
    | { allOf: Condition[] }
    | { anyOf: Condition[] };

export type Question = {
    id: string;
    image: string;
    description: string;
    type: QuestionType;
    required?: boolean;
    hint?: string;
    defaultValue?: number | string | boolean;
    options?: string[];
    when?: Condition;
};

export type Bucket = {
    id: BucketId;
    name: string;
    skippable: boolean;
    coverImage: string;
    questions: Question[];
};

/* ------------------------------ Config & Data ------------------------------ */

export const IMG_PLACEHOLDER = "src/assets/logo.png";

/** Single source of truth for bucket order */
export const BUCKET_ORDER: BucketId[] = [
    "school",
    "sleep",
    "work",
    "social",
    "selfCare",
    "exercise",
    "leisure",
    "custom",
];

export const QUESTIONS: Record<BucketId, Bucket> = {
    /* ----------------------------------- SCHOOL ----------------------------------- */
    school: {
        id: "school",
        name: "School Work",
        skippable: false,
        coverImage: IMG_PLACEHOLDER,
        questions: [
            {
                id: "school_priority",
                image: schoolwork_priority,
                description: "How much do you prioritize schoolwork in your schedule? (0-100%)",
                type: "priority",
                required: true,
                defaultValue: 70,
            },
            {
                id: "school_class_amount",
                image: schoolwork_ClassAmount,
                description: "How many classes are you taking this semester?",
                type: "number",
                required: true,
            },
            {
                id: "school_classes",
                image: schoolwork_AddClasses,
                description: "Add each class you're taking right now, or upload your schedule",
                type: "enter-classes",
                required: true,
            },
            {
                id: "school_max_session_length",
                image: schoolwork_MaxStudy,
                description:
                    "What's the longest amount of time you'd want to study in one sitting (enter minutes)?",
                type: "number",
                hint: "Minutes, e.g., 90",
            },
            {
                id: "school_break_frequency",
                image: schoolwork_StudyBreaks,
                description:
                    "How often do you like to take breaks during study sessions (minutes between breaks)?",
                type: "number",
                hint: "Minutes between breaks, e.g., 45",
            },
            {
                id: "school_commute_time",
                image: schoolwork_Commute,
                description: "What is your average commute time to/from campus (in minutes).",
                type: "number",
                hint: "One-way or round-trip—your call, just be consistent",
            },
            {
                id: "school_no_go_times",
                image: schoolwork_NoStudy,
                description: "Select any days in which you do not want studying to be scheduled",
                type: "day-selection",
            },
        ],
    },

    /* ----------------------------------- SLEEP ------------------------------------ */
    sleep: {
        id: "sleep",
        name: "Sleep",
        skippable: false,
        coverImage: IMG_PLACEHOLDER,
        questions: [
            {
                id: "sleep_priority",
                image: sleep_Priority,
                description: "How much priority do you place on getting good sleep each night? (0-100)",
                type: "priority",
                defaultValue: 70,
            },
            {
                id: "sleep_hours_per_night",
                image: sleep_HoursNeed,
                description: "How many hours would you ideally like to sleep each night?",
                type: "number",
                hint: "e.g., 7.5",
            },
            {
                id: "sleep_earliest_bedtime",
                image: sleep_BedTime,
                description: "What’s your earliest acceptable bedtime?",
                type: "time",
            },
            {
                id: "sleep_latest_wake",
                image: sleep_WakeUp,
                description: "What’s your latest acceptable wake time (HH:MM)?",
                type: "time",
            },
            {
                id: "sleep_consistency",
                image: sleep_ConsistentBedtime,
                description: "Do you prefer to go to sleep at approximately the same time each night?",
                type: "boolean",
                defaultValue: false,
            },
            {
                id: "sleep_naps",
                image: sleep_NapBool,
                description: "Do you take naps during the day?",
                type: "boolean",
                defaultValue: false,
            },
            {
                id: "sleep_nap_windows",
                image: sleep_NapTimes,
                description: "Preferred nap windows (weekday time intervals).",
                type: "time-selection",
                when: { id: "sleep_naps", equals: true },
            },
            {
                id: "nap-length",
                image: sleep_NapLength,
                description: "How long do you usually like to nap? (enter minutes)",
                type: "number",
                when: { id: "sleep_naps", equals: true },
            },
        ],
    },

    /* ------------------------------------ WORK ------------------------------------ */
    work: {
        id: "work",
        name: "Employment / Work",
        skippable: true,
        coverImage: IMG_PLACEHOLDER,
        questions: [
            {
                id: "work_is_employed",
                image: work_Boolean,
                description:
                    "Are you currently employed? (Includes any kind of scheduled, paid or unpaid, work).",
                type: "boolean",
                defaultValue: true,
            },
            {
                id: "work_priority",
                image: work_Priority,
                description: "How much do you prioritize your employment obligations?",
                type: "priority",
                defaultValue: 70,
                when: { id: "work_is_employed", equals: true },
            },
            {
                id: "work_has_fixed_shifts",
                image: work_FixedShifts,
                description: "Do you have scheduled shift times each week?",
                type: "boolean",
                defaultValue: true,
                when: { id: "work_is_employed", equals: true },
            },
            {
                id: "work_fixed_shift_times",
                image: work_AddShifts,
                description: "Add your scheduled shift times (weekday time intervals).",
                type: "weekday-time-intervals",
                when: {
                    allOf: [
                        { id: "work_is_employed", equals: true },
                        { id: "work_has_fixed_shifts", equals: true },
                    ],
                },
            },
            {
                id: "work_hours_target",
                image: work_HoursAmount,
                description: "Total work hours per week.",
                type: "number",
                when: { id: "work_is_employed", equals: true },
            },
            {
                id: "work_commute",
                image: IMG_PLACEHOLDER,
                description: "Do you commute from your home to work?",
                type: "boolean",
                defaultValue: true,
                when: { id: "work_is_employed", equals: true },
            },
            {
                id: "work_commute_time",
                image: IMG_PLACEHOLDER,
                description: "Average commute time to/from work (minutes).",
                type: "number",
                when: {
                    allOf: [
                        { id: "work_is_employed", equals: true },
                        { id: "work_commute", equals: true },
                    ],
                },
            },
            {
                id: "work_from_home",
                image: IMG_PLACEHOLDER,
                description: "Do you work from home?",
                type: "boolean",
                defaultValue: false,
                when: {
                    allOf: [
                        { id: "work_is_employed", equals: true },
                        { id: "work_commute", equals: false },
                    ],
                },
            },
            {
                id: "work_cannot_schedule_times",
                image: IMG_PLACEHOLDER,
                description: "Are there any times when you do not want work to be scheduled?",
                type: "weekday-time-intervals",
                when: { id: "work_is_employed", equals: true },
            },
        ],
    },

    /* ------------------------------------ SOCIAL ---------------------------------- */
    social: {
        id: "social",
        name: "Social Life",
        skippable: true,
        coverImage: IMG_PLACEHOLDER,
        questions: [
            {
                id: "social_boolean",
                image: IMG_PLACEHOLDER,
                description: "Do you want social obligations included in your schedule?",
                type: "boolean",
                defaultValue: true,
            },
            {
                id: "social_priority",
                image: IMG_PLACEHOLDER,
                description: "How much do you place on your social life? (0–100).",
                type: "priority",
                when: { id: "social_boolean", equals: true },
            },
            {
                id: "social_hours_target",
                image: IMG_PLACEHOLDER,
                description: "How many hours per week do you anticipate socializing?",
                type: "number",
                when: { id: "social_boolean", equals: true },
            },
            {
                id: "social_time_prefs",
                image: IMG_PLACEHOLDER,
                description: "What time of day do you prefer to socialize?",
                type: "time-selection",
                options: ["morning", "afternoon", "evening", "night"],
                when: { id: "social_boolean", equals: true },
            },
            {
                id: "social_recurring_obligations",
                image: IMG_PLACEHOLDER,
                description:
                    "List your recurring social obligations (we’ll ask days & times next).",
                type: "enter-social",
                when: { id: "social_boolean", equals: true },
            },
            {
                id: "social_friends_study_overlap",
                image: IMG_PLACEHOLDER,
                description:
                    "Would you like to co-locate social time with group study sessions when possible?",
                type: "boolean",
                defaultValue: false,
                when: { id: "social_boolean", equals: true },
            },
        ],
    },

    /* ---------------------------------- SELF CARE --------------------------------- */
    selfCare: {
        id: "selfCare",
        name: "Self Care",
        skippable: true,
        coverImage: IMG_PLACEHOLDER,
        questions: [
            {
                id: "selfcare_boolean",
                image: IMG_PLACEHOLDER,
                description: "Do you want self-care included in your schedule?",
                type: "boolean",
                defaultValue: true,
            },
            {
                id: "selfcare_priority",
                image: IMG_PLACEHOLDER,
                description: "How important is Self Care? Set a percentage priority (0–100).",
                type: "priority",
                when: { id: "selfcare_boolean", equals: true },
            },
            {
                id: "selfcare_activities",
                image: IMG_PLACEHOLDER,
                description:
                    "Choose the self-care activities you want included (we’ll ask priority, preferred time, duration, and frequency for each).",
                type: "selfcare-selector",
                when: { id: "selfcare_boolean", equals: true },
            },
        ],
    },

    /* ----------------------------------- EXERCISE --------------------------------- */
    exercise: {
        id: "exercise",
        name: "Exercise",
        skippable: true,
        coverImage: IMG_PLACEHOLDER,
        questions: [
            {
                id: "exercise_boolean",
                image: IMG_PLACEHOLDER,
                description: "Do you want exercise to be included in your schedule?",
                type: "boolean",
                defaultValue: true,
            },
            {
                id: "exercise_priority",
                image: IMG_PLACEHOLDER,
                description: "How important is Exercise? Set a percentage priority (0–100).",
                type: "priority",
                when: { id: "exercise_boolean", equals: true },
            },
            {
                id: "exercise_activities",
                image: IMG_PLACEHOLDER,
                description:
                    "Choose the exercise you want included (we’ll ask priority, preferred time, duration, frequency, rest period, and optional strict time windows for each).",
                type: "exercise-selector",
                when: { id: "exercise_boolean", equals: true },
            },
            {
                id: "exercise_gym_commute_boolean",
                image: IMG_PLACEHOLDER,
                description:
                    "do you want travel time to and from your place of exercise to be included?",
                type: "boolean",
                defaultValue: false,
            },
            {
                id: "exercise_gym_commute_time",
                image: IMG_PLACEHOLDER,
                description:
                    "How long does it take to travel to where you mainly workout?",
                type: "number",
                when: { id: "exercise_gym_commute_boolean", equals: true },
            },
            {
                id: "exercise_gym_commute_recovery_boolean",
                image: IMG_PLACEHOLDER,
                description:
                    "Do you want your post-workout rest time, and your commute home, to be combined?",
                type: "boolean",
                defaultValue: false,
                when: { id: "exercise_gym_commute_boolean", equals: true },
            },
        ],
    },

    /* ----------------------------------- LEISURE ---------------------------------- */
    leisure: {
        id: "leisure",
        name: "Leisure",
        skippable: true,
        coverImage: IMG_PLACEHOLDER,
        questions: [
            {
                id: "leisure_boolean",
                image: IMG_PLACEHOLDER,
                description:
                    "Do you want leisure activities to be included in your schedule?",
                type: "boolean",
                defaultValue: true,
            },
            {
                id: "leisure_priority",
                image: IMG_PLACEHOLDER,
                description: "How much priority do you place on leisure?",
                type: "priority",
                when: { id: "leisure_boolean", equals: true },
            },
            {
                id: "leisure_activities",
                image: IMG_PLACEHOLDER,
                description:
                    "Choose the leisure & relaxation activities you want included (we’ll ask priority, preferred time, duration, and frequency for each).",
                type: "leisure-selector",
                when: { id: "leisure_boolean", equals: true },
            },
        ],
    },

    /* ----------------------------------- CUSTOM ----------------------------------- */
    custom: {
        id: "custom",
        name: "Custom",
        skippable: true,
        coverImage: IMG_PLACEHOLDER,
        questions: [
            {
                id: "custom_enabled",
                image: IMG_PLACEHOLDER,
                description: "Would you like to add additional custom obligations/activities?",
                type: "boolean",
                defaultValue: false,
            },
            {
                id: "custom_obligations",
                image: IMG_PLACEHOLDER,
                description:
                    "Add any additional custom obligations/activities (we’ll ask priority, preferred time, duration, frequency, and strict time windows for each).",
                type: "custom-obligations-selector", // ⬅️ NEW
                when: { id: "custom_enabled", equals: true },
            },
        ],
    },
};

/* ------------------------------- Small helpers ------------------------------ */

export function flattenQuestions() {
    type Flat = Question & {
        __bucketId: BucketId;
        __bucketName: string;
        __bucketIndex: number;
        __qIndex: number;
    };
    const out: Flat[] = [];
    let bi = 0;
    for (const bId of BUCKET_ORDER) {
        const bucket = QUESTIONS[bId];
        if (!bucket) continue;
        bucket.questions.forEach((q, qi) => {
            out.push({
                ...q,
                __bucketId: bId,
                __bucketName: bucket.name,
                __bucketIndex: bi,
                __qIndex: qi,
            });
        });
        bi++;
    }
    return out;
}

export default QUESTIONS;
