import fs from 'fs';
import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import path from 'path';

const TOKEN_PATH = path.join(__dirname, '../../token.json');
const CREDENTIALS_PATH = path.join(__dirname, '../../credentials.json');

async function authorize() {
    const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
    const { client_secret, client_id, redirect_uris } = credentials.installed;
    const oAuth2Client = new OAuth2Client(client_id, client_secret, redirect_uris[0]);

    try {
        const token = fs.readFileSync(TOKEN_PATH, 'utf8');
        oAuth2Client.setCredentials(JSON.parse(token));
    } catch (error) {
        await getNewToken(oAuth2Client);
    }

    return oAuth2Client;
}

async function getNewToken(oAuth2Client: OAuth2Client) {
    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    console.log('Authorize this app by visiting this url:', authUrl);

    const code = await new Promise<string>((resolve) => {
        process.stdin.once('data', (data) => resolve(data.toString().trim()));
    });

    const { tokens } = await oAuth2Client.getToken(code);
    oAuth2Client.setCredentials(tokens);

    fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
    console.log('Token stored to', TOKEN_PATH);
}

const quizCache: Record<string, { rows: any, timestamp: number }> = {};
const quizCacheDuration = 60 * 1000;    // 1 minute

export async function getQuizQuestions(sheetName: string, questionCount: number): Promise<any[]> {
    let rows: any[];

    if (quizCache[sheetName] && Date.now() - quizCache[sheetName].timestamp < quizCacheDuration) {
        console.log(`Using cached data for ${sheetName} -- this data is valid since ${new Date(quizCache[sheetName].timestamp).toISOString()}`);
        rows = quizCache[sheetName].rows;
    } else {
        const auth = await authorize();
        const sheets = google.sheets({ version: 'v4', auth });

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: process.env.SHEET_ID!,
            range: `${sheetName}!3:1000`,
        });
        quizCache[sheetName] = { rows: response.data.values, timestamp: Date.now() };
        if (!response.data.values) {
            throw new Error('No data found.');
        }
        rows = response.data.values;
    }

    if (!rows || rows.length === 0) {
        throw new Error('No data found.');
    }

    const selectedQuestions = rows.sort(() => Math.random() - 0.5).slice(0, questionCount);
    return selectedQuestions.map(row => ({
        question: row[0],
        imageUrl: row[1],
        acceptedAnswers: row.slice(2),
        hintIndex: 0,
    }));
}

let quizListCache: { name: string; description: string }[] | null = null;
let quizListCacheTimestamp = 0;
const quizListCacheDuration = 60 * 1000;    // 1 minute

export async function getQuizList(): Promise<{ name: string; description: string }[]> {
    if (quizListCache && Date.now() - quizListCacheTimestamp < quizListCacheDuration) {
        console.log(`Using cached quiz list -- this data is valid since ${new Date(quizListCacheTimestamp).toISOString()}`);
        return quizListCache;
    }

    const auth = await authorize();
    const sheets = google.sheets({ version: 'v4', auth });

    const response = await sheets.spreadsheets.get({
        spreadsheetId: process.env.SHEET_ID!,
    });

    const sheetList = response.data.sheets;
    if (!sheetList) {
        throw new Error('No sheets found.');
    }

    const quizList = await Promise.all(sheetList.map(async sheet => {
        const name = sheet.properties?.title || '';
        let description = '';

        if (sheet.properties) {
            const response = await sheets.spreadsheets.values.get({
                spreadsheetId: process.env.SHEET_ID!,
                range: `${sheet.properties.title}!B1`,
            });
            const rows = response.data.values;
            description = rows && rows.length > 0 ? rows[0][0] : '';
        }

        return { name, description };
    }));

    quizListCache = quizList;
    quizListCacheTimestamp = Date.now();
    return quizList;
}
