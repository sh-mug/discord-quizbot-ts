import { APIEmbed, Message, MessageReaction, TextChannel, User } from 'discord.js';
// @ts-expect-error: not typed
import levenshtein from 'fast-levenshtein';
// @ts-expect-error: not typed
import { hiraganize } from 'japanese';
import { getQuizList, getQuizQuestions } from '../google/sheetsApi';
import { QuizState, createQuizState, updateScore } from '../state/quizState';

const activeQuizzes: Map<string, QuizState> = new Map();

function generateQuizKey(serverId: string, channelId: string): string {
    return `${serverId}-${channelId}`;
}

// This function is based on code from https://github.com/tsg-ut/slackbot, under the MIT license.
// Copyright (c) Theoretical Science Group. Licensed under the MIT License.
function normalize(str: string): string {
    return hiraganize(
        str.toLowerCase()
            .replace(/[^\p{Letter}\p{Number}]/gu, '')
            .replace(/[\uFF01-\uFF5E]/gu, (char) => {
                const codePoint = char.codePointAt(0);
                return codePoint !== undefined ? String.fromCodePoint(codePoint - 0xFF00 + 0x20) : char;
            })
    );
}

function isCorrectAnswer(answerText: string, userAnswerText: string): boolean {
    const answer = normalize(answerText);
    const userAnswer = normalize(userAnswerText);
    console.log(`Comparing "${answer} (${answerText})" and "${userAnswer} (${userAnswerText})"`);
    const distance = levenshtein.get(answer, userAnswer);
    return distance <= answer.length / 4;
};

function showCommandCandidate(command: string): Promise<string[]> {
    return getQuizList().then(list => {
        const candidates = list.map(sheet => sheet.name).filter(name => {
            return levenshtein.get(command, name) <= name.length / 4;
        });
        return candidates;
    });
};

function showHelp(message: Message) {
    const embed = {
        title: 'Quiz Bot Commands',
        description: 'Use these commands to interact with the quiz bot.',
        fields: [
            { name: '!hint', value: 'Reveal a hint for the current question.' },
            { name: '!skip', value: 'Skip the current question and show the answer.' },
            { name: '!end', value: 'End the quiz and show the final scores.' },
            { name: '!<sheetName> [questionCount]', value: 'Start a quiz with questions from the specified sheet.' },
        ],
    };
    if (message.channel instanceof TextChannel) {
        message.channel.send({ embeds: [embed] });
    }

    getQuizList().then(list => {
        const fieldsPerPage = 10;
        const pages: APIEmbed[] = [];

        for (let i = 0; i < list.length; i += fieldsPerPage) {
            const fields = list.slice(i, i + fieldsPerPage).map(sheet => ({
                name: sheet.name,
                value: sheet.description,
            }));

            pages.push({
                title: `Available Quiz Sheets (${i / fieldsPerPage + 1}/${Math.ceil(list.length / fieldsPerPage)})`,
                description: 'Use these commands to start a quiz with questions from the specified sheet.',
                fields: fields,
            });
        }

        let currentPage = 0;
        let sentMessage: Message;

        const sendPage = async (pageIndex: number) => {
            if (sentMessage) {
                await sentMessage.edit({ embeds: [pages[pageIndex]] });
            } else if (message.channel instanceof TextChannel) {
                sentMessage = await message.channel.send({ embeds: [pages[pageIndex]] });
                await sentMessage.react('⬅️');
                await sentMessage.react('➡️');

                const filter = (reaction: MessageReaction, user: User) =>
                    reaction.emoji.name !== null && !user.bot;

                const collector = sentMessage.createReactionCollector({ filter, time: 60000 });

                collector.on('collect', (reaction, user) => {
                    console.log(`Collected ${reaction.emoji.name} from ${user.tag}`);
                    if (reaction.emoji.name === '⬅️' && currentPage > 0) {
                        currentPage--;
                    } else if (reaction.emoji.name === '➡️' && currentPage < pages.length - 1) {
                        currentPage++;
                    }
                    sendPage(currentPage);
                    reaction.users.remove(user.id);
                });

                collector.on('end', () => {
                    sentMessage.reactions.removeAll().catch(console.error);
                });
            }
        };
        sendPage(currentPage);
    });
}

export async function startQuiz(message: Message, sheetName: string, questionCount: number = 5) {
    const key = generateQuizKey(message.guild!.id, message.channel.id);

    if (activeQuizzes.has(key)) {
        message.react('🚫');
        message.reply('A quiz is already in progress in this channel.');
        return;
    }

    try {
        const questions = await getQuizQuestions(sheetName, questionCount);
        const newState = createQuizState(questions);
        activeQuizzes.set(key, newState);
        askNextQuestion(message, key);
    } catch (error) {
        // if any candidate is found, suggest it to the user
        showCommandCandidate(sheetName).then(candidates => {
            if (candidates.length > 0) {
                message.reply(`Did you mean ${candidates.map(c => `\`!${c}\``).join(', ')}? 🤔`);
            } else {
                showHelp(message);
            }
        });
    }
}

function askNextQuestion(message: Message, key: string) {
    const state = activeQuizzes.get(key);
    if (!state) return;
    if (state.currentIndex >= state.questions.length) {
        endQuiz(message);
        return;
    }

    const question = state.questions[state.currentIndex];
    const embed = {
        title: `Question ${state.currentIndex + 1}/${state.questions.length}`,
        description: question.question,
        image: question.imageUrl ? { url: question.imageUrl } : undefined,
    };

    if (message.channel instanceof TextChannel) {
        message.channel.send({ embeds: [embed] })
            .catch(error => {
                console.error('Failed to send message:', error);
                state.currentIndex++;
                if (state.currentIndex < state.questions.length) {
                    askNextQuestion(message, key);
                } else {
                    endQuiz(message);
                }
            });
    }
}

export function checkAnswer(message: Message) {
    const key = generateQuizKey(message.guild!.id, message.channel.id);
    const state = activeQuizzes.get(key);
    if (!state) return;

    const userAnswer = message.content.trim().toLowerCase();
    const currentQuestion = state.questions[state.currentIndex];
    const isCorrect = currentQuestion.acceptedAnswers.some(ans => isCorrectAnswer(ans, userAnswer));

    updateScore(state, message.author.id, isCorrect);
    if (isCorrect) {
        const answer = state.questions[state.currentIndex].acceptedAnswers.join(', ');
        message.react('✅');
        message.reply(`Correct! The answer was ${answer}.`);
        state.currentIndex++;
        askNextQuestion(message, key);
    } else {
        message.react('❌');
    }
}

export function revealHint(message: Message) {
    const key = generateQuizKey(message.guild!.id, message.channel.id);
    const state = activeQuizzes.get(key);
    if (!state) return;

    const question = state.questions[state.currentIndex];
    const hintIndex = question.hintIndex;
    const answer = question.acceptedAnswers[0];
    const hint = answer.slice(0, hintIndex + 1) + '❓'.repeat(answer.length - hintIndex - 1);
    state.questions[state.currentIndex].hintIndex++;

    console.log(`answer: ${answer}, hint: ${hint}, hintIndex: ${hintIndex}`);

    if (hintIndex >= answer.length - 1) {
        skipQuestion(message);
        return;
    }

    const embed = {
        title: 'Hint',
        description: `The answer is ${hint}.`,
    };
    if (message.channel instanceof TextChannel) {
        message.channel.send({ embeds: [embed] });
    }
}

export function skipQuestion(message: Message) {
    const key = generateQuizKey(message.guild!.id, message.channel.id);
    const state = activeQuizzes.get(key);
    if (!state) return;

    const answer = state.questions[state.currentIndex].acceptedAnswers.join(', ');
    const embed = {
        title: 'Question Skipped.',
        description: `The correct answer was ${answer}.`,
    };
    if (message.channel instanceof TextChannel) {
        message.channel.send({ embeds: [embed] });
    }

    state.currentIndex++;
    askNextQuestion(message, key);
}

export function endQuiz(message: Message) {
    const key = generateQuizKey(message.guild!.id, message.channel.id);
    const state = activeQuizzes.get(key);
    if (!state) return;

    const results = Object.entries(state.scores)
        .map(([userId, score]) => `${score.correct} ✅\t${score.wrong} ❌\t<@${userId}>`)
        .join('\n');

    if (message.channel instanceof TextChannel) {
        const embed = {
            title: 'Quiz Ended.',
            description: results,
        };
        message.channel.send({ embeds: [embed] });
        activeQuizzes.delete(key);
    }
}
