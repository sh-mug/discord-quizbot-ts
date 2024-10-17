export interface QuizQuestion {
    question: string;
    acceptedAnswers: string[];
    hintIndex: number;
    imageUrl?: string;
}

export interface QuizState {
    questions: QuizQuestion[];
    currentIndex: number;
    scores: Record<string, { correct: number; wrong: number }>;
}

export function createQuizState(questions: QuizQuestion[]): QuizState {
    return {
        questions,
        currentIndex: 0,
        scores: {},
    };
}

export function updateScore(state: QuizState, userId: string, isCorrect: boolean) {
    if (!state.scores[userId]) {
        state.scores[userId] = { correct: 0, wrong: 0 };
    }
    state.scores[userId][isCorrect ? 'correct' : 'wrong']++;
}
