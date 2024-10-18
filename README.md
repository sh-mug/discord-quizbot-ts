# **Discord Quiz Bot**  

A simple, easy-to-install quiz bot for Discord that allows anyone to add or edit quizzes through Google Spreadsheets. Perfect for engaging your community with fun trivia and challenges!

## **Features**  
- **Easy Installation**: Quick and straightforward setup for your Discord server.
- **Google Spreadsheet Integration**: Quiz questions are managed through Google Spreadsheets, making it easy for anyone to add, edit, or organize quizzes.
- **Multi-Server Support**: Each server can host separate quiz sessions with independent progress tracking.
- **Flexible Quiz Topics**: Start quizzes by specifying different topics or question sets (e.g., `car`, `tree`).
- **Levenshtein Distance Matching**: Ensures user answers are accepted even with minor typos or variations (e.g., "Luxemb**o**urg" and "Luxemburg").

## **Setup and Installation**  

### **Prerequisites**  
- Node.js (v18 or higher)  
- A Discord Bot Token ([Discord Developer Portal](https://discord.com/developers/applications))  
- A Google API Service Account and credentials for Sheets API ([Google Cloud Console](https://console.cloud.google.com))  

### **Installation**  
1. Clone the repository:  
   ```bash
   git clone git@github.com:sh-mug/discord-quizbot-ts.git
   cd discord-quizbot-ts
   ```

2. Install dependencies:  
   ```bash
   npm install
   ```

3. Set up your environment variables:
   Create a `.env` file and fill in the required information:  
   ```
   DISCORD_TOKEN=your-discord-token
   GOOGLE_SERVICE_ACCOUNT_CREDENTIALS=your-google-credentials-json
   DISCORD_CHANNEL_NAME_PREFIX=<optional> # Prefix for quiz channels (default: 'quiz-')
   ```

4. Compile TypeScript files:  
   ```bash
   npx tsc
   ```

5. Start the bot:  
   ```bash
   node dist/discord/bot.js
   ```

## **Commands**  
| Command                        | Description                                           |
|--------------------------------|-------------------------------------------------------|
| `!hint`                        | Reveal a hint for the current question.               |
| `!skip`                        | Skip the current question and show the answer.        |
| `!end`                         | End the quiz and show the final scores.               |
| `!<sheetName> [questionCount]` | Start a quiz with questions from the specified sheet. |

## **Google Spreadsheet Template**

To create your own quiz, follow the template below:
https://docs.google.com/spreadsheets/d/1oKhdRmwiyqqkwKmZPXsTpRU4N2Cmkdcl_BQHA1lLSqc/edit?usp=sharing

## **License**  
This project is licensed under the MIT License. See the `LICENSE` file for details.
