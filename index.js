
const config = require("./config.json");
const discord = require("discord.js");
const client = new discord.Client();

client.on("ready", () => {
    console.log("I am ready!");
})

client.on("message", message => {

});

client.login(config.botToken);
