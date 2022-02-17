const { Client, Intents, Collection, MessageEmbed } = require("discord.js");
const consola = require("consola");
const path = require("path");
const { REST } = require("@discordjs/rest");
const { Routes } = require("discord-api-types/v9");
const fs = require("fs");
const mongoose = require("mongoose");
const Embeds = require("./utilities/embeds");
const developers = ["510866456708382730", "332115664179298305"]


module.exports = class BotClient extends Client {
  constructor(token, dev_guild_id, client_id) {
    super({ intents: [new Intents(32767)] });

    this.token = token;
    this.guild_id = dev_guild_id;
    this.client_id = client_id;
    this.developers = developers;

    this.logger = consola;

    this.slashCommands = new Collection();

    this.normalCommands = new Collection();

    this.embeds = Embeds;

    this.db = mongoose;
  }

  async loadBot() {
    await this.loadModules();
    await this.loadDB();
    await this.login(this.token);
  }

  async loadDB() {
    this.db
      .connect(process.env.MONGO_URI)
      .then((val) => {
        this.logger.log(`[DATABASE] Successfully connected to MongoDB!`);
      })
      .catch((e) =>
        this.logger.error(
          `[DATABASE] There was an error trying to connect to MongoDB: ${e}`
        )
      );
  }

  async loadModules() {
    /* Event Handler */

    const eventFolders = fs.readdirSync(
      path.resolve(__dirname, "..", "events") 
    );

    for (const folder of eventFolders) {
      const eventFiles = fs
        .readdirSync(path.resolve(__dirname, "..", "events", `${folder}`))
        .filter((f) => f.endsWith(".js"));

      for (const file of eventFiles) {
        const event = require(`../events/${folder}/${file}`);
        if (event.config.once) {
          this.once(event.config.name, (...args) => event.run(...args));
        } else {
          this.on(event.config.name, (...args) => event.run(...args));
        }
      }
    }

    /* Slash Command Handler **/

    const commands = [];

    const commandFolders = fs.readdirSync(
      path.resolve(__dirname, "..", "slash-commands")
    );

    for (const folder of commandFolders) {
      const commandFiles = fs
        .readdirSync(
          path.resolve(__dirname, "..", "slash-commands", `${folder}`)
        )
        .filter((file) => file.endsWith(".js"));

      for (const file of commandFiles) {
        const slashCommand = require(`../slash-commands/${folder}/${file}`);
        this.slashCommands.set(slashCommand.data.name, slashCommand);
        commands.push(slashCommand.data.toJSON());
        this.logger.success(
          `[COMMANDS] Successfully loaded the (/) command ${slashCommand.data.name}`
        );
      }
    }

    const rest = new REST({ version: "9" }).setToken(this.token);
    (async () => {
      try {
        await rest.put(
          Routes.applicationGuildCommands(this.client_id, this.guild_id),
          { body: commands }
        );
        this.logger.success("Commands successfully loaded Slash Commands.");
      } catch (err) {
        console.error(err);
      }
    })();

    this.on("interactionCreate", async (interaction) => {
      if (!interaction.isCommand()) return;

      // await interaction.deferReply();

      const command = this.slashCommands.get(interaction.commandName);
      if (!command) return;
      /*
  
        if (!interaction.memeber.permissions.has(command.permissions || [])) {
          return interaction.reply({
            content: "You do not have the permission to execute this command.",
            ephemeral: true,
          });
        }
        */

      try {
        await command.run(interaction, this);
      } catch (err) {
        console.error(err);
        return interaction.reply({
          content: "There was an error whilst executing this command.",
          ephemeral: true,
        });
      }
    });

    /* Normal Command Handler */

    const normalCommandFolders = fs.readdirSync(
      path.resolve(__dirname, "..", "normal-commands")
    );

    for (const folder of normalCommandFolders) {
      const normalCommandsFiles = fs
        .readdirSync(
          path.resolve(__dirname, "..", "normal-commands", `${folder}`)
        )
        .filter((f) => f.endsWith(".js"));
      this.normalCommandCategories = normalCommandFolders;
      for (const file of normalCommandsFiles) {
        const normalCommand = require(`../normal-commands/${folder}/${file}`);

        this.logger.log(
          `Sccessfully loaded normal command ${normalCommand.config.name}`
        );

        normalCommand.config.category = folder;
        this.normalCommands.set(normalCommand.config.name, normalCommand);
      }
    }

    this.on("messageCreate", async (message) => {
      const GuildConfigModel = require("../models/GuildConfigModel");

      let prefix = "?";
      let dbPrefix = await GuildConfigModel.findOne({ guildID: message.guild.id });
      if (dbPrefix) prefix = dbPrefix.prefix;

      if (message.mentions.members.size) {
        if (message.mentions.has(this.user.id)) {
          const args = message.content.trim().split(/ +/g).slice(1);
          if (args.length == 0) return;
          const commandName = args.shift().toLowerCase();

          /*
          if (command) {
            message.args = args;
            command.run(this, message);
          }
          */
          return;
        }
      }

      if (!message.content.startsWith(prefix)) return;
      const args = message.content.slice(prefix.length).trim().split(/ +/g);
      const commandName = args.shift().toLowerCase();

      /*
      let command = this.normalCommands.find(
        (cmd) => cmd.config.name == commandName
      );
      */

      let command = this.normalCommands.find(
        (cmd) => cmd.config.name == commandName ||cmd.config.aliases.includes(commandName));

      if (command.config.category == "developers") if (!developers.includes(message.author.id)) return;

      if (command) {
        message.args = args;
        command.run(this, message);
      }
    });

    /*
      if (
        (command.config.ownerOnly &&
          !message.author.id == "510866456708382730") ||
        !message.author.id == "332115664179298305"
      ) {
        return message.channel.send({
          embeds: [
            this.embeds
              .error()
              .setDescription(
                `You can't run this command, this command can only be used by my developers.`
              ),
          ],
        });
      }
      */

    //let command = this.normalCommands.find(cmd=> cmd.config.name == commandName || cmd.config.aliases.includes(commandName))
    /*let command = this.normalCommands.find(
        (cmd) => cmd.config.name == commandName
      );
      */
  }
};
