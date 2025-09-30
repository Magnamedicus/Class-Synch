// src/utils/questions.ts

import schoolwork_priority from "../assets/question_images/SchoolWork_PriorityQ.png"
import schoolwork_ClassAmount from "../assets/question_images/SchoolWork_ClassAmountQ.png"
import schoolwork_AddClasses from "../assets/question_images/SchoolWork_AddClassesQ.png"
import schoolwork_MaxStudy from "../assets/question_images/SchoolWork_MaxStudyQ.png"
import schoolwork_StudyBreaks from "../assets/question_images/SchoolWork_StudyBreaksQ.png"
import schoolwork_Commute from "../assets/question_images/SchoolWork_CommuteQ.png"
import schoolwork_NoStudy from "../assets/question_images/SchoolWork_NoStudyQ.png"


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
    | "day-selection";

export type Question = {
    id: string;              // unique within bucket
    image: string;           // path to placeholder (logo)
    description: string;     // visible prompt
    type: QuestionType;      // determines input UI
};

export type Bucket = {
    id: BucketId;
    name: string;
    skippable: boolean;      // School & Sleep are not skippable
    coverImage: string;      // path to placeholder (logo)
    questions: Question[];
};

const IMG_PLACEHOLDER = "src/assets/logo.png";

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
                description:
                    "How much do you prioritize schoolwork in your schedule? (0-100%)",
                type: "priority",
            },

            {
                id: "school_class_amount",
                image: schoolwork_ClassAmount,
                description:
                    "How many classes are you taking this semester?",
                type: "number",
            },
            {
                id: "school_classes",
                image: schoolwork_AddClasses,
                description:
                    "Add each class you're taking right now, or upload your schedule",
                type: "enter-classes",
            },

            {
                id: "school_max_session_length",
                image: schoolwork_MaxStudy,
                description:
                    "What's the longest amount of time you'd want to study in one sitting (enter minutes)?",
                type: "number",
            },
            {
                id: "school_break_frequency",
                image: schoolwork_StudyBreaks,
                description:
                    "How often do you like to take breaks during study sessions (minutes between breaks)?",
                type: "number",
            },
            {
                id: "school_commute_time",
                image: schoolwork_Commute,
                description: "What is your average commute time to/from campus (in minutes).",
                type: "number",
            },
            {
                id: "school_no_go_times",
                image: schoolwork_NoStudy,
                description:
                    "Select any days in which you do not want studying to be scheduled?",
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
                image: IMG_PLACEHOLDER,
                description:
                    "How important is getting your desired sleep each night? Set a percentage priority (0–100).",
                type: "priority",
            },
            {
                id: "sleep_hours_per_night",
                image: IMG_PLACEHOLDER,
                description: "Target hours of sleep per night (e.g., 7.5).",
                type: "number",
            },
            {
                id: "sleep_earliest_bedtime",
                image: IMG_PLACEHOLDER,
                description: "What’s your earliest acceptable bedtime (HH:MM)?",
                type: "time",
            },
            {
                id: "sleep_latest_wake",
                image: IMG_PLACEHOLDER,
                description: "What’s your latest acceptable wake time (HH:MM)?",
                type: "time",
            },
            {
                id: "sleep_consistency",
                image: IMG_PLACEHOLDER,
                description: "Do you prefer consistent sleep times across all days?",
                type: "boolean",
            },
            {
                id: "sleep_naps",
                image: IMG_PLACEHOLDER,
                description: "Do you take naps during the day?",
                type: "boolean",
            },
            {
                id: "sleep_nap_windows",
                image: IMG_PLACEHOLDER,
                description: "Preferred nap windows (weekday time intervals).",
                type: "weekday-time-intervals",
            },
            {
                id: "sleep_no_go_times",
                image: IMG_PLACEHOLDER,
                description:
                    "Any times you must be awake (add intervals to avoid sleep then)?",
                type: "weekday-time-intervals",
            },
            {
                id: "sleep_note",
                image: IMG_PLACEHOLDER,
                description: "Anything else about your sleep we should consider?",
                type: "text",
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
                id: "work_priority",
                image: IMG_PLACEHOLDER,
                description:
                    "How important is Work relative to other areas? Set a percentage priority (0–100).",
                type: "priority",
            },
            {
                id: "work_has_fixed_shifts",
                image: IMG_PLACEHOLDER,
                description: "Do you have fixed shift times each week?",
                type: "boolean",
            },
            {
                id: "work_fixed_shift_times",
                image: IMG_PLACEHOLDER,
                description: "Add your fixed shift times (weekday intervals).",
                type: "weekday-time-intervals",
            },
            {
                id: "work_hours_target",
                image: IMG_PLACEHOLDER,
                description: "Target total work hours per week (if flexible).",
                type: "number",
            },
            {
                id: "work_time_prefs",
                image: IMG_PLACEHOLDER,
                description:
                    "Preferred times to work (morning, afternoon, evening, night).",
                type: "chips",
            },
            {
                id: "work_commute_time",
                image: IMG_PLACEHOLDER,
                description: "Average commute time to/from work (minutes).",
                type: "number",
            },
            {
                id: "work_break_frequency",
                image: IMG_PLACEHOLDER,
                description:
                    "How often would you like breaks while working (minutes between breaks)?",
                type: "number",
            },
            {
                id: "work_max_session_length",
                image: IMG_PLACEHOLDER,
                description:
                    "Maximum preferred continuous work session length (minutes).",
                type: "number",
            },
            {
                id: "work_no_go_times",
                image: IMG_PLACEHOLDER,
                description: "Times you absolutely cannot work (weekday intervals).",
                type: "weekday-time-intervals",
            },
            {
                id: "work_note",
                image: IMG_PLACEHOLDER,
                description:
                    "Anything else about your job schedule we should consider?",
                type: "text",
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
                id: "social_priority",
                image: IMG_PLACEHOLDER,
                description:
                    "How important is Social Life in your weekly plan? Set a percentage priority (0–100).",
                type: "priority",
            },
            {
                id: "social_hours_target",
                image: IMG_PLACEHOLDER,
                description: "Target social time per week (hours).",
                type: "number",
            },
            {
                id: "social_time_prefs",
                image: IMG_PLACEHOLDER,
                description:
                    "Preferred times for social activities (morning, afternoon, evening, night).",
                type: "chips",
            },
            {
                id: "social_recurring_events",
                image: IMG_PLACEHOLDER,
                description:
                    "Do you have recurring social events (add weekday intervals)?",
                type: "weekday-time-intervals",
            },
            {
                id: "social_friends_study_overlap",
                image: IMG_PLACEHOLDER,
                description:
                    "Would you like to co-locate social time with group study sessions when possible?",
                type: "boolean",
            },
            {
                id: "social_note",
                image: IMG_PLACEHOLDER,
                description:
                    "Anything else about your social life we should consider?",
                type: "text",
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
                id: "selfcare_priority",
                image: IMG_PLACEHOLDER,
                description:
                    "How important is Self Care? Set a percentage priority (0–100).",
                type: "priority",
            },
            {
                id: "selfcare_hours_target",
                image: IMG_PLACEHOLDER,
                description:
                    "Target self care time per week (hours). Includes hygiene, journaling, mindfulness, etc.",
                type: "number",
            },
            {
                id: "selfcare_time_prefs",
                image: IMG_PLACEHOLDER,
                description:
                    "Preferred times for self care (morning routines, evenings, etc.).",
                type: "chips",
            },
            {
                id: "selfcare_fixed_items",
                image: IMG_PLACEHOLDER,
                description:
                    "Add any fixed self care routines (weekday time intervals).",
                type: "weekday-time-intervals",
            },
            {
                id: "selfcare_note",
                image: IMG_PLACEHOLDER,
                description:
                    "Anything else about your self care we should consider?",
                type: "text",
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
                id: "exercise_priority",
                image: IMG_PLACEHOLDER,
                description:
                    "How important is Exercise? Set a percentage priority (0–100).",
                type: "priority",
            },
            {
                id: "exercise_hours_target",
                image: IMG_PLACEHOLDER,
                description: "Target exercise time per week (hours).",
                type: "number",
            },
            {
                id: "exercise_time_prefs",
                image: IMG_PLACEHOLDER,
                description:
                    "Preferred exercise windows (morning, afternoon, evening, night).",
                type: "chips",
            },
            {
                id: "exercise_workout_type_note",
                image: IMG_PLACEHOLDER,
                description:
                    "Workout types you prefer (strength, cardio, sports) — short note.",
                type: "text",
            },
            {
                id: "exercise_gym_commute",
                image: IMG_PLACEHOLDER,
                description: "Gym/travel time each way (minutes).",
                type: "number",
            },
            {
                id: "exercise_fixed_classes",
                image: IMG_PLACEHOLDER,
                description:
                    "Any fixed exercise classes or team practices (weekday intervals).",
                type: "weekday-time-intervals",
            },
            {
                id: "exercise_note",
                image: IMG_PLACEHOLDER,
                description:
                    "Anything else about exercise we should consider?",
                type: "text",
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
                id: "leisure_priority",
                image: IMG_PLACEHOLDER,
                description:
                    "How important is Leisure in your week? Set a percentage priority (0–100).",
                type: "priority",
            },
            {
                id: "leisure_hours_target",
                image: IMG_PLACEHOLDER,
                description: "Target leisure time per week (hours).",
                type: "number",
            },
            {
                id: "leisure_time_prefs",
                image: IMG_PLACEHOLDER,
                description:
                    "Preferred leisure windows (morning, afternoon, evening, night).",
                type: "chips",
            },
            {
                id: "leisure_screen_free_pref",
                image: IMG_PLACEHOLDER,
                description: "Prefer screen-free leisure in late evenings?",
                type: "boolean",
            },
            {
                id: "leisure_recurring_events",
                image: IMG_PLACEHOLDER,
                description:
                    "Recurring leisure events (movie night, club meets — weekday time intervals).",
                type: "weekday-time-intervals",
            },
            {
                id: "leisure_note",
                image: IMG_PLACEHOLDER,
                description:
                    "Anything else about leisure we should consider?",
                type: "text",
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
                description:
                    "Would you like to add a custom activity or commitment?",
                type: "boolean",
            },
            {
                id: "custom_name",
                image: IMG_PLACEHOLDER,
                description:
                    "Name of your custom activity (e.g., Volunteering, Music Practice).",
                type: "text",
            },
            {
                id: "custom_priority",
                image: IMG_PLACEHOLDER,
                description:
                    "How important is this custom activity? Set a percentage priority (0–100).",
                type: "priority",
            },
            {
                id: "custom_hours_target",
                image: IMG_PLACEHOLDER,
                description: "Target hours per week for this activity.",
                type: "number",
            },
            {
                id: "custom_time_prefs",
                image: IMG_PLACEHOLDER,
                description:
                    "Preferred time windows (morning, afternoon, evening, night).",
                type: "chips",
            },
            {
                id: "custom_fixed_times",
                image: IMG_PLACEHOLDER,
                description:
                    "Any fixed meeting times for this activity (weekday intervals).",
                type: "weekday-time-intervals",
            },
            {
                id: "custom_max_session_length",
                image: IMG_PLACEHOLDER,
                description:
                    "Maximum preferred continuous session length (minutes).",
                type: "number",
            },
            {
                id: "custom_note",
                image: IMG_PLACEHOLDER,
                description:
                    "Anything else about this custom activity we should consider?",
                type: "text",
            },
        ],
    },
};

export default QUESTIONS;
