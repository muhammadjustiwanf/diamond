
const _ = require("lodash");
var discord = require("./discord");
const fs = require("fs");

var db = [];
const commandRegex = /^r!([a-zA-Z]*) ?(.*)$/;
const detailsRegex = /^["'](.*?)["'] ([a-zA-Z]*) ([0-9]*) ([a-zA-Z]*)$/;

var embedTemplate = {
    embed: {
        author: {
            name: "Reminder!",
            icon_url: ""
        },
        color: 0x009900,
        title: "",
        url: "https://github.com/amarriner/reminder-bot",
        description: "",
        timestamp: new Date(),
        footer: {
            text: "",
            icon_url: ""
        }
    }
};

//
// Do startup stuff...
//
const bootstrap = function() {

    //
    // Make sure the user save directory is created
    //
    if (!fs.existsSync("saves")) {
        fs.mkdirSync("saves");
    }

    //
    // Load saved reminders
    //
    loadDb();

    //
    // Set fields in the embedTemplate that have to wait for the 
    // discord.client.user object to be instantiated
    //
    embedTemplate.embed.author.name = "Reminder from " + discord.client.user.username + "!";
    embedTemplate.embed.author.icon_url = discord.client.user.avatarURL;
    embedTemplate.embed.title = discord.client.user.username + " on Github";
    embedTemplate.embed.footer.text = discord.client.user.username;
    embedTemplate.embed.footer.icon_url = discord.client.user.avatarURL;

}

//
// Load JSON reminders into memory
//
const loadDb = function() {

    fs.readdir("saves", function(err, files) {

        if (err) {

            console.log("Error loading saved reminders!");
            console.log(err);
            return;

        }

        files.forEach(function(file, index) {

            fs.readFile("saves/" + file, "utf8", function(err, data) {

                if (err) {
                    console.log("Error reading file " + file + "!");
                    console.log(err);
                }
                else {

                    //
                    // Put the array of reminders for this author into the db variable
                    //
                    author = file.replace(".json", "");
                    db[author] = JSON.parse(data);

                    //
                    // Initiate the interval for each reminder
                    //
                    for (i in db[author]) {
                        db[author][i].intervalId = doInterval(author, db[author][i]);
                    }

                }

            });

        });

    });   

}

//
// Parse a command from the user
//
const parseCommand = function(message) {

    //
    // Make sure the command matches the allowed regex
    //
    var match = commandRegex.exec(message.content);
    if (match && match.length > 0) {

        //
        // Store the user ID and the rest of the command for later use
        //
        var author = message.author.id;
        var details = detailsRegex.exec(match[2].replace(/@([a-zA-Z0-9]*#[0-9]*)/, "$1"));
        
        //
        // Determine which command it was, and attempt to execute it
        //
        switch (match[1].toLowerCase()) {

            //
            // Set creates a new reminder
            //
            case "set":
                sendMessageToAuthorId(author, "[SET]", doSet(author, details));
                break;

            //
            // List displays all of a user's current reminders
            //
            case "list":
                sendMessageToAuthorId(author, "[LIST]", doList(author));
                break;

            //
            // Stop will either clear all a user's reminders or a single one
            //
            case "stop":
                sendMessageToAuthorId(author, "[STOP]", doStop(author, match[2]));
                break;

            //
            // Display help information
            //
            case "help":
                fs.readFile("help.json", "utf8", function(err, data) {
                    if (err) {
                        console.log("Error reading help file!");
                        console.log(err);
                        return;
                    }

                    var e = _.cloneDeep(embedTemplate);
                    e.embed.fields = JSON.parse(data);
                    sendMessageToAuthorId(author, "[HELP]", e);

                });
                break;

            //
            // Default just displays a simple error message
            //
            default:
                sendMessageToAuthorId(author, "[ERROR]", "Invalid command! Try r!help");
        }

        //
        // Save the user's current data to disk
        //
        saveReminders(author);

    }

};

const sendMessageToAuthorId = function(authorId, title, message) {
    
    //
    // Look up the user via the fetchUser command, and send the message
    // to them once the promise resolves
    //
    var user = discord.client.fetchUser(authorId).then(function(value) {
        if (message.embed) {
            message.embed.author.name = "Reminder from " + discord.client.user.username + "! " + title;
            message.embed.timestamp = new Date();
        }
        value.send(message);
    }).catch(function(err) {
        console.log("Error fetching user! (" + authorId + ")");
        console.log(err);
    });
   
};

const doSet = function(author, details) {

    //
    // Set up reminder object
    //
    var reminder = {
        "author": author,
        "message": details[1],
        "type": details[2].toLowerCase(),
        "time": details[3],
        "units": details[4].toLowerCase()
    };

    //
    // Do some error checking
    //
    if (!reminder.message) {
        return "Missing message!";
    }

    if (!["every", "each"].includes(reminder.type)) {
        return "Invalid type (every/each)";
    }

    if (!["seconds", "minutes", "hours", "days"].includes(reminder.units)) {
        return "Invalid unit (seconds/minutes/hours/days)";
    }

    reminder.intervalId = doInterval(author, reminder);

    if (!db[author]) { db[author] = []; }
    db[author].push(reminder);

    return "Reminder set!";

}

const doInterval = function (author, reminder) {

    //
    // Get milliseconds for interval
    //
    reminder.milliseconds = getMilliseconds(reminder);
    
    //
    // Set up message
    //
    var e = _.cloneDeep(embedTemplate);
    e.embed.description = reminder.message;

    //
    // Return the id for later clearing by the user
    //
    return setInterval(
        function() { 
            sendMessageToAuthorId(reminder.author, "", e); 
        }, reminder.milliseconds);

};

//
// Determine the number of milliseconds left to remind
//
const getMilliseconds = function(reminder) {

    var millis = reminder.time * 1000;
    if (reminder.units === "minutes") { millis *= 60; }
    if (reminder.units === "hours")   { millis *= (60 * 60); }
    if (reminder.units === "days")    { millis *= (60 * 60 * 24); }

    return millis;

};

//
// Function to send a message with a list of current reminders to a user
//
const doList = function(author) {

    if (!db[author]) {
        return "You have no reminders currently!";
    }

    if (!db[author].length) {
        return "You have no reminders currently!";
    }

    //
    // Create a field entry for each reminder in the author's list
    //
    var fields = [];
    for (i in db[author]) {
        fields.push({
            name: "[" + i + "] " + db[author][i].message,
            value: db[author][i].type + " "
                   + db[author][i].time + " "
                   + db[author][i].units
        });
    }
    
    //
    // Build the embed for discord
    //
    var e = _.cloneDeep(embedTemplate);
    e.embed.fields = fields;
    
    return e;

};

//
// Function to stop a reminder
//
const doStop = function(author, reminderIndex) {

    if (!db[author]) {
        return "You have no reminders currently!";
    }

    if (reminderIndex < 0 || reminderIndex >= db[author].length || !reminderIndex) {
        return "Invalid reminder! (try r!list)";
    }

    //
    // Check to see if the author wants to remove all reminders
    //
    if (reminderIndex.toLowerCase() === "all") {

        for(i in db[author]) {
            clearInterval(db[author][i].intervalId);
        }

        db[author] = [];

        return "Cleared all reminders!";

    }

    //
    // Stop the setInterval
    //
    clearInterval(db[author][reminderIndex].intervalId);

    //
    // Remove the reminder from the author's list
    //
    db[author].splice(reminderIndex, 1);

    return "Reminder stopped successfully!";

}

//
// Store a user's reminder to disk as JSON
//
const saveReminders = function(author) {

    fs.writeFile("saves/" + author + ".json", JSON.stringify(db[author], function(key, value) {

        if (key === "intervalId") {
            return undefined;
        }
        else {
            return value;
        }

    }), "utf8", function(err) {
        if (err) {
            console.log("Error writing to file for user " + author);
            console.log(err);
        }
    });

};

module.exports = {
    bootstrap: bootstrap,
    loadDb: loadDb,
    parseCommand: parseCommand
};
