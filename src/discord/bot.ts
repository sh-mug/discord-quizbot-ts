import { Client, GatewayIntentBits, TextChannel } from 'discord.js';
import dotenv from 'dotenv';
import { checkAnswer, endQuiz, revealHint, skipQuestion, startQuiz } from './commands';

dotenv.config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions,
    ]
});

client.once('ready', () => {
    console.log(`Logged in as ${client.user?.tag}!`);
});

client.on('messageCreate', async message => {
    if (message.author.bot) return;
    if (!message.guild) return;
    if (!(message.channel instanceof TextChannel)) return;
    if (!message.channel.name.startsWith(process.env.DISCORD_CHANNEL_NAME_PREFIX!)) return;

    const args = message.content.trim().split(/\s+/);

    if (args[0] && args[0].startsWith('!')) {
        if (args[0] === '!hint') {
            await revealHint(message);
        } else if (args[0] === '!skip') {
            await skipQuestion(message);
        } else if (args[0] === '!end') {
            await endQuiz(message);
        } else {
            console.log(args);
            const sheetName = args[0].slice(1);
            const questionCount = parseInt(args[1], 10) || 5;
            await startQuiz(message, sheetName, questionCount);
        }
    } else {
        await checkAnswer(message);
    }
});

client.login(process.env.DISCORD_TOKEN);
