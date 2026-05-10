require('dotenv').config();

const {
    Client,
    GatewayIntentBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder
} = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const games = {};
const playerStats = {};

function createButtons() {

    return [

        new ActionRowBuilder().addComponents(

            new ButtonBuilder()
                .setCustomId('1')
                .setLabel('1')
                .setStyle(ButtonStyle.Primary),

            new ButtonBuilder()
                .setCustomId('2')
                .setLabel('2')
                .setStyle(ButtonStyle.Primary),

            new ButtonBuilder()
                .setCustomId('3')
                .setLabel('3')
                .setStyle(ButtonStyle.Primary),

            new ButtonBuilder()
                .setCustomId('4')
                .setLabel('4')
                .setStyle(ButtonStyle.Success),

            new ButtonBuilder()
                .setCustomId('5')
                .setLabel('5')
                .setStyle(ButtonStyle.Danger)
        ),

        new ActionRowBuilder().addComponents(

            new ButtonBuilder()
                .setCustomId('6')
                .setLabel('6')
                .setStyle(ButtonStyle.Secondary)
        )
    ];
}

client.once('clientReady', async () => {

    console.log(`${client.user.tag} is online!`);

    await client.user.setPresence({
        status: 'online',
        activities: [
            {
                name: 'Hand Cricket 🏏'
            }
        ]
    });
});

client.on('interactionCreate', async interaction => {

    // HELP COMMAND
    if (interaction.isChatInputCommand()) {

        if (interaction.commandName === 'help') {

            const helpEmbed = new EmbedBuilder()
                .setTitle('🏏 Hand Cricket Bot Help')
                .setDescription(
                    '🎮 COMMANDS:\n\n' +
                    '`/challenge @user` → Start a match\n' +
                    '`/help` → Show this menu\n\n' +

                    '🏏 HOW TO PLAY:\n\n' +
                    '• Choose numbers from 1-6\n' +
                    '• Same number = OUT\n' +
                    '• Different number = runs added\n' +
                    '• Highest score wins'
                )
                .setColor('Blue');

            return interaction.reply({
                embeds: [helpEmbed],
                ephemeral: true
            });
        }

        // CHALLENGE COMMAND
        if (interaction.commandName === 'challenge') {

            const opponent = interaction.options.getUser('player');

            if (opponent.bot) {
                return interaction.reply({
                    content: 'You cannot challenge bots!',
                    ephemeral: true
                });
            }

            const channelId = interaction.channel.id;

            if (games[channelId]) {
                return interaction.reply({
                    content: 'A game already exists in this channel!',
                    ephemeral: true
                });
            }

            games[channelId] = {
                player1: interaction.user.id,
                player2: opponent.id,

                scores: {
                    player1: 0,
                    player2: 0
                },

                currentPlays: {},

                batting: interaction.user.id,

                innings: 1
            };

            const embed = new EmbedBuilder()
                .setTitle('🏏 Hand Cricket Match Started')
                .setDescription(
                    `${interaction.user} vs ${opponent}\n\n` +
                    `First innings started!\n` +
                    `<@${games[channelId].batting}> is batting.`
                )
                .setColor('Green');

            return interaction.reply({
                embeds: [embed],
                components: createButtons()
            });
        }
    }

    // BUTTON SYSTEM
    if (interaction.isButton()) {

        const channelId = interaction.channel.id;

        const game = games[channelId];

        if (!game) {
            return interaction.reply({
                content: 'No active game!',
                ephemeral: true
            });
        }

        const userId = interaction.user.id;

        if (
            userId !== game.player1 &&
            userId !== game.player2
        ) {
            return interaction.reply({
                content: 'You are not part of this match!',
                ephemeral: true
            });
        }

        const selectedNumber = parseInt(interaction.customId);

        game.currentPlays[userId] = selectedNumber;

        await interaction.reply({
            content: `You selected ${selectedNumber}`,
            ephemeral: true
        });

        // WAIT FOR BOTH PLAYERS
        if (
            !game.currentPlays[game.player1] ||
            !game.currentPlays[game.player2]
        ) {
            return;
        }

        let battingPlayer;
        let bowlingPlayer;

        if (game.batting === game.player1) {
            battingPlayer = game.player1;
            bowlingPlayer = game.player2;
        }
        else {
            battingPlayer = game.player2;
            bowlingPlayer = game.player1;
        }

        const battingNumber = game.currentPlays[battingPlayer];
        const bowlingNumber = game.currentPlays[bowlingPlayer];

        let result = '';

        // OUT CONDITION
        if (battingNumber === bowlingNumber) {

            result +=
                `🏏 Batter chose: ${battingNumber}\n` +
                `🎯 Bowler chose: ${bowlingNumber}\n\n` +
                `❌ OUT!\n`;

            // SECOND INNINGS
            if (game.innings === 1) {

                game.innings = 2;

                game.target =
                    battingPlayer === game.player1
                        ? game.scores.player1 + 1
                        : game.scores.player2 + 1;

                game.batting = bowlingPlayer;

                result +=
                    `\n🏏 Second innings begins!\n` +
                    `🎯 Target: ${game.target}`;
            }
            else {

                // MATCH OVER
                const p1Score = game.scores.player1;
                const p2Score = game.scores.player2;

                result += '\n\n🏆 MATCH OVER!\n';

                if (p1Score > p2Score) {
                    result += `<@${game.player1}> wins!`;
                }
                else if (p2Score > p1Score) {
                    result += `<@${game.player2}> wins!`;
                }
                else {
                    result += `It's a draw!`;
                }

                delete games[channelId];

                return interaction.channel.send({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle('🏏 Match Finished')
                            .setDescription(result)
                            .setColor('Gold')
                    ]
                });
            }
        }
        else {

            // ADD RUNS
            if (battingPlayer === game.player1) {
                game.scores.player1 += battingNumber;
            }
            else {
                game.scores.player2 += battingNumber;
            }

            result +=
                `🏏 Batter chose: ${battingNumber}\n` +
                `🎯 Bowler chose: ${bowlingNumber}\n\n` +
                `✅ ${battingNumber} runs added!\n\n` +

                `📊 SCORE:\n` +
                `<@${game.player1}> : ${game.scores.player1}\n` +
                `<@${game.player2}> : ${game.scores.player2}`;

            // TARGET CHASE
            if (game.innings === 2) {

                const chasingScore =
                    battingPlayer === game.player1
                        ? game.scores.player1
                        : game.scores.player2;

                if (chasingScore >= game.target) {

                    result +=
                        `\n\n🏆 <@${battingPlayer}> wins by chase!`;

                    delete games[channelId];

                    return interaction.channel.send({
                        embeds: [
                            new EmbedBuilder()
                                .setTitle('🏏 Match Finished')
                                .setDescription(result)
                                .setColor('Green')
                        ]
                    });
                }
            }
        }

        // RESET ROUND
        game.currentPlays = {};

        const embed = new EmbedBuilder()
            .setTitle('🏏 Hand Cricket')
            .setDescription(result)
            .setColor('Blue');

        interaction.channel.send({
            embeds: [embed],
            components: createButtons()
        });
    }
});

client.login(process.env.TOKEN);