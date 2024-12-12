// Import Modules
const { Client, GatewayIntentBits, Partials, Collection } = require("discord.js");
const dotenv = require("dotenv");
const { google } = require('googleapis');
const path = require('path');

// Load Environment Variables
dotenv.config();
const TOKEN = process.env.TOKEN; // Bot token stored in .env file
const TEST_GUILD_ID = "1312902747799945327";
const ADMIN_ROLE_ID = "1312904258794029136";
const LOG_CHANNEL_ID = "1316228277290930246";
const CREDENTIALS_PATH = path.join(__dirname, 'credentials.json');
const SPREADSHEET_ID = "1nIQwTSUspxPBEEi4FudTf4ZsGlU5Nok5oJ2jvSnC9rE";


// Create Bot Instance
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
    partials: [Partials.Message],
});

// Data Storage (Temporary)
let logs = {}; // Format: {log_id: {user_id, hours, link, status}}
let userHours = {}; // Format: {user_id: {"approved": 0, "denied": 0, "pending": 0, "claimed": 0}}
let lastLogTime = {}; // Tracks the last time a user used /log
const LOG_COOLDOWN_SECONDS = 0; // Cooldown in seconds

// Helper Functions
function updateUserHours(userId, status, hours) {
    if (!userHours[userId]) {
        userHours[userId] = { approved: 0, denied: 0, pending: 0, claimed: 0 };
    }
    userHours[userId][status] += hours;
    if (userHours[userId][status] < 0) {
        userHours[userId][status] = 0;
    }
}

function generateLogId() {
    let id;
    do {
        id = Math.floor(10000 + Math.random() * 90000).toString();
    } while (logs[id]);
    return id;
}

async function logAction(interaction, action, details) {
    const logChannel = client.channels.cache.get(LOG_CHANNEL_ID);
    const timestamp = new Date().toISOString();
    const logMessage = `**Action:** ${action}\n**Performed by:** <@${interaction.user.id}>\n**Time:** ${timestamp}\n**Details:** ${details}`;
    if (logChannel) {
        await logChannel.send(logMessage);
    }
}

async function listLogs(interaction, status) {
    const filteredLogs = Object.entries(logs).filter(([id, log]) => log.status === status);
    if (filteredLogs.length === 0) {
        await interaction.reply({ content: `No logs found with status: ${status}.`, ephemeral: true });
        return;
    }

    const logList = filteredLogs
        .map(([id, log]) => `Log ID: ${id}, User: <@${log.user}>, Hours: ${log.hours}, Link: ${log.link}`)
        .join("\n");

    await interaction.reply({ content: `Logs with status: ${status}\n${logList}`, ephemeral: true });
}

async function appendLogToSpreadsheet(logId, userId, hours, link) {
    try {
        const auth = new google.auth.GoogleAuth({
            keyFile: CREDENTIALS_PATH,
            scopes: 'https://www.googleapis.com/auth/spreadsheets',
        });

        const sheets = google.sheets({ version: 'v4', auth });

        const request = {
            spreadsheetId: SPREADSHEET_ID,
            range: 'Sheet1!A:E', // Assuming your data is on Sheet1. Adjust if needed.
            valueInputOption: 'USER_ENTERED', // Important for proper number/date handling
            resource: {
                values: [[userId, logId, hours, link, 'pending']], // Data to append
            },
        };

        const response = await sheets.spreadsheets.values.append(request);
        console.log('Spreadsheet updated:', response.data);

    } catch (error) {
        console.error('Error updating spreadsheet:', error);
        // Consider re-throwing the error or handling it in a way that makes sense for your application.
        throw error; // Re-throw to allow the calling function to handle the error if needed.
    }
}

async function updateLogStatusInSpreadsheet(logId, status) {
    try {
        const auth = new google.auth.GoogleAuth({
            keyFile: CREDENTIALS_PATH,
            scopes: 'https://www.googleapis.com/auth/spreadsheets',
        });

        const sheets = google.sheets({ version: 'v4', auth });

        // 1. Find the row with the matching log ID
        const findRequest = {
            spreadsheetId: SPREADSHEET_ID,
            range: 'Sheet1!B:B', // Search the "Submission ID" column (B)
            valueRenderOption: 'UNFORMATTED_VALUE', // Important for accurate comparison
        };

        const findResponse = await sheets.spreadsheets.values.get(findRequest);
        const logIdIndex = findResponse.data.values.findIndex(row => row[0] == logId);

        if (logIdIndex === -1) {
            console.error("Log ID not found in spreadsheet.");
            throw new Error("Log ID not found in spreadsheet."); // Throw error to be caught by the calling function
        }

        const rowNumber = logIdIndex + 1; // Row numbers are 1-indexed in Google Sheets

        // 2. Update the status in the corresponding row
        const updateRequest = {
            spreadsheetId: SPREADSHEET_ID,
            range: `Sheet1!E${rowNumber}`, // Update "Status" column (E) in the found row
            valueInputOption: 'USER_ENTERED',
            resource: {
                values: [[status]],
            },
        };

        const updateResponse = await sheets.spreadsheets.values.update(updateRequest);
        console.log('Spreadsheet updated:', updateResponse.data);


    } catch (error) {
        console.error('Error updating spreadsheet:', error);
        throw error;  // Re-throw the error for consistent error handling
    }
}

// Slash Commands Registration
client.once("ready", async () => {
    const guild = client.guilds.cache.get(TEST_GUILD_ID);
    if (guild) {
        // Register Commands
        await guild.commands.set([
            {
                name: "log",
                description: "Log your time with a link.",
                options: [
                    { name: "hours", type: 4, description: "Hours to log", required: true },
                    { name: "link", type: 3, description: "Log link", required: true },
                ],
            },
            {
                name: "time",
                description: "View your logged time.",
            },
            {
                name: "time-admin",
                description: "View another user's logged time.",
                options: [{ name: "user_id", type: 3, description: "User ID", required: true }],
            },
            {
                name: "approve",
                description: "Approve a log.",
                options: [{ name: "log_id", type: 3, description: "Log ID", required: true }],
            },
            {
                name: "deny",
                description: "Deny a log.",
                options: [{ name: "log_id", type: 3, description: "Log ID", required: true }],
            },
            {
                name: "remove",
                description: "Remove hours from a user.",
                options: [
                    { name: "hours", type: 4, description: "Hours to remove", required: true },
                    { name: "user_id", type: 3, description: "User ID", required: true },
                ],
            },
            {
                name: "viewpending",
                description: "View all pending logs.",
            },
            {
                name: "viewaccepted",
                description: "View all approved logs.",
            },
            {
                name: "viewdenied",
                description: "View all denied logs.",
            },
            {
                name: "view",
                description: "View details of a specific log.",
                options: [{ name: "log_id", type: 3, description: "Log ID", required: true }],
            },
            {
                name: "shutdown",
                description: "Shut down the bot (admin only).",
            },
        ]);
        console.log("Commands registered successfully.");
    }
    console.log(`Bot is ready! Logged in as ${client.user.tag}`);
});

// Command Interaction Handling
client.on("interactionCreate", async (interaction) => {
    if (!interaction.isCommand()) return;

    const { commandName, options } = interaction;

    if (commandName === "log") {
        const hours = options.getInteger("hours");
        const link = options.getString("link");
        const now = Date.now();
        const lastUsed = lastLogTime[interaction.user.id] || 0;

        if (now - lastUsed < LOG_COOLDOWN_SECONDS * 1000) {
            const remaining = Math.ceil((LOG_COOLDOWN_SECONDS * 1000 - (now - lastUsed)) / 1000);
            await interaction.reply({ content: `Cooldown active! Wait ${remaining} seconds.`, ephemeral: true });
            return;
        }


        if (hours < 0) {
            await interaction.reply({ content: "Hours cannot be negative.", ephemeral: true });
            return;
        }



        const logId = generateLogId();
        logs[logId] = { user: interaction.user.id, hours, link, status: "pending" };
        updateUserHours(interaction.user.id, "pending", hours);
        lastLogTime[interaction.user.id] = now;


        try {
            await appendLogToSpreadsheet(logId, interaction.user.id, hours, link);
            console.log("Log successfully added to spreadsheet.");
            await interaction.reply({ content: `Log submitted! Log ID: ${logId}`, ephemeral: true });

            const logChannel = client.channels.cache.get(LOG_CHANNEL_ID);
            if (logChannel) {
                logChannel.send(`New log submitted!\nID: ${logId}\nUser: <@${interaction.user.id}>\nHours: ${hours}\nLink: ${link}`);
            }

        } catch (error) {
            console.error("Error adding log to spreadsheet:", error);
            await interaction.reply({ content: "Spreadsheet error. Try again later.", ephemeral: true });
        }


    } else if (commandName === "time") {
        const userData = userHours[interaction.user.id] || { approved: 0, denied: 0, pending: 0, claimed: 0 };
        await interaction.reply({
            content: `Approved: ${userData.approved} hours\nDenied: ${userData.denied} hours\nPending: ${userData.pending} hours\nClaimed: ${userData.claimed} hours`,
            ephemeral: true,
        });


    } else if (commandName === "time-admin") {
          const userId = options.getString("user_id");
        const userData = userHours[userId] || { approved: 0, denied: 0, pending: 0, claimed: 0 };
        await interaction.reply({
            content: `User: <@${userId}>\nApproved: ${userData.approved} hours\nDenied: ${userData.denied} hours\nPending: ${userData.pending} hours\nClaimed: ${userData.claimed} hours`,
            ephemeral: true,
        });



    } else if (commandName === "approve") {
        const logId = options.getString("log_id");
        const log = logs[logId];

        if (!log || log.status !== "pending") {
            await interaction.reply({ content: "Invalid or already processed log ID.", ephemeral: true });
            return;
        }

        log.status = "approved";
        updateUserHours(log.user, "approved", log.hours);
        updateUserHours(log.user, "pending", -log.hours);


        try {
            await updateLogStatusInSpreadsheet(logId, log.status);
            await interaction.reply({ content: `Log ID: ${logId} approved successfully.`, ephemeral: true });
            await logAction(interaction, "Approve Log", `Log ID: ${logId}, Hours: ${log.hours}`);


        } catch (error) {
            console.error("Error updating log status (approve):", error);
            await interaction.reply({ content: "Spreadsheet error. Please try again later.", ephemeral: true });
        }

    } else if (commandName === "deny") {
        const logId = options.getString("log_id");
        const log = logs[logId];

        if (!log || log.status !== "pending") {
            await interaction.reply({ content: "Invalid or already processed log ID.", ephemeral: true });
            return;
        }

        log.status = "denied";
        updateUserHours(log.user, "pending", -log.hours); // Deduct pending hours
        updateUserHours(log.user, "denied", log.hours); // Add to denied hours
        await interaction.reply({ content: `Log ID: ${logId} denied successfully.`, ephemeral: true });
        await logAction(interaction, "Deny Log", `Log ID: ${logId}, Hours: ${log.hours}`);

    } else if (commandName === "remove") {
         const hours = options.getInteger("hours");
        const userId = options.getString("user_id");

        if (!userHours[userId]) {
            await interaction.reply({ content: "User has no recorded hours.", ephemeral: true });
            return;
        }

        updateUserHours(userId, "approved", -hours);
        if (userHours[userId].approved < 0) userHours[userId].approved = 0;
        await interaction.reply({ content: `Removed ${hours} approved hours from <@${userId}>.`, ephemeral: true });
        await logAction(interaction, "Remove Hours", `User: <@${userId}>, Hours: ${hours}`);



    } else if (commandName === "viewpending") {
         await listLogs(interaction, "pending");



    } else if (commandName === "viewaccepted") {
         await listLogs(interaction, "approved");



    } else if (commandName === "viewdenied") {
         await listLogs(interaction, "denied");


    } else if (commandName === "view") {
        const logId = options.getString("log_id");
        const log = logs[logId];

        if (!log) {
            await interaction.reply({ content: "Log not found.", ephemeral: true });
            return;
        }

        const logDetails = `**Log ID:** ${logId}\n**User:** <@${log.user}>\n**Hours:** ${log.hours}\n**Link:** ${log.link}\n**Status:** ${log.status}`;
        await interaction.reply({ content: logDetails, ephemeral: true });


    } else if (commandName === "shutdown") {
       if (interaction.member.roles.cache.has(ADMIN_ROLE_ID)) { 
            await interaction.reply({ content: "Shutting down the bot...", ephemeral: true });
            console.log("Bot is shutting down...");
            await client.destroy(); 
            process.exit(0); 
        } else {
            await interaction.reply({ content: "You do not have permission to use this command.", ephemeral: true });
        }


    } else {    
        await interaction.reply({ content: "Unknown command.", ephemeral: true });
    }
});

client.on("error", (error) => {
    console.error("An error occurred:", error);
});

// Login Bot
client.login(TOKEN);
