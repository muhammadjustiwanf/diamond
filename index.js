
const config = require("./config.json");
const utils = require("./utils.js");

var discord = require("./discord.js");

discord.client.on("ready", () => {

    console.log("I am ready!");
    utils.bootstrap();

})

discord.client.on("message", message => {

    utils.parseCommand(message);

});

discord.client.login("NjIwMjMxMjI4OTI2MTk3NzYw.XXUFyg.tTQVh-uK0gDWUwVoaBucyB2Bmt0");
