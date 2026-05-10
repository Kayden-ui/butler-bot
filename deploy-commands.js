require('dotenv').config();

const {
    REST,
    Routes,
    SlashCommandBuilder
} = require('discord.js');

const commands = [

    new SlashCommandBuilder()
        .setName('challenge')
        .setDescription('Challenge a player')
        .addUserOption(option =>
            option
                .setName('player')
                .setDescription('Player to challenge')
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName('help')
        .setDescription('Show help menu'),

    new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('Show player leaderboard')

].map(command => command.toJSON());

const rest =
    new REST({ version: '10' })
        .setToken(process.env.TOKEN);

(async () => {

    try {

        console.log(
            'Registering slash commands...'
        );

        await rest.put(
            Routes.applicationCommands(
                process.env.CLIENT_ID
            ),
            { body: commands }
        );

        console.log(
            'Slash commands registered successfully!'
        );

    }
    catch (error) {

        console.error(error);
    }

})();