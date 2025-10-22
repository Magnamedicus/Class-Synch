// src/utils/qaStorage.ts
export type QAAnswers = Record<string, any>;

export function emailKey(email: string) {
    return encodeURIComponent((email || "").trim().toLowerCase());
}

export function qaAnswersKey(email: string) {
    return `QA::answers::${emailKey(email)}`;
}

export function readAnswers(email: string): QAAnswers {
    try {
        const raw = localStorage.getItem(qaAnswersKey(email));
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
}

export function writeAnswers(email: string, next: QAAnswers) {
    localStorage.setItem(qaAnswersKey(email), JSON.stringify(next));
}
