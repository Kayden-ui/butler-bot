require('dotenv').config();

const crypto = require('crypto');
const fs = require('fs');
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

// ================= DATA =================

const games = {};
let playerStats = {};

if (
    fs.existsSync(
        './leaderboard.json'
    )
) {

    playerStats = JSON.parse(

        fs.readFileSync(
            './leaderboard.json',
            'utf8'
        )
    );
}
// ================= LEADERBOARD SAVE =================
function saveLeaderboard() {

    fs.writeFileSync(

        './leaderboard.json',

        JSON.stringify(
            playerStats,
            null,
            2
        )
    );
}
// ================= BUTTONS =================

function createNumberButtons() {

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
                .setStyle(ButtonStyle.Secondary),

            new ButtonBuilder()
                .setCustomId('cancel_game')
                .setLabel('Cancel Match')
                .setStyle(ButtonStyle.Danger)
        )
    ];
}

function createTossButtons() {

    return [

        new ActionRowBuilder().addComponents(

            new ButtonBuilder()
                .setCustomId('heads')
                .setLabel('Heads')
                .setStyle(ButtonStyle.Primary),

            new ButtonBuilder()
                .setCustomId('tails')
                .setLabel('Tails')
                .setStyle(ButtonStyle.Danger)
        )
    ];
}

function createBatBowlButtons() {

    return [

        new ActionRowBuilder().addComponents(

            new ButtonBuilder()
                .setCustomId('bat')
                .setLabel('Bat')
                .setStyle(ButtonStyle.Success),

            new ButtonBuilder()
                .setCustomId('bowl')
                .setLabel('Bowl')
                .setStyle(ButtonStyle.Primary)
        )
    ];
}

// ================= READY =================

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

// ================= INTERACTIONS =================

client.on('interactionCreate', async interaction => {

    // ================= SLASH COMMANDS =================

    if (interaction.isChatInputCommand()) {

        // HELP

        if (interaction.commandName === 'help') {

            const embed = new EmbedBuilder()

                .setTitle('🏏 Hand Cricket Help')

                .setDescription(

                    '`/challenge @user` → Start match\n' +
                    '`/leaderboard` → Show rankings\n' +
                    '`/help` → Show help\n\n' +

                    '🏏 RULES:\n' +
                    '• Same number = OUT\n' +
                    '• Different number = Runs\n' +
                    '• Toss decides batting\n' +
                    '• Highest score wins'
                )

                .setColor('Blue');

            return interaction.reply({

                embeds: [embed],
                flags: 64
            });
        }

        // LEADERBOARD

        if (interaction.commandName === 'leaderboard') {

            const entries =
                Object.entries(playerStats);

            if (entries.length === 0) {

                return interaction.reply({

                    content:
                        'No leaderboard data yet!',

                    flags: 64
                });
            }

            const sorted =
                entries.sort((a, b) =>
                    b[1].wins - a[1].wins
                );

            let text = '';

            sorted.forEach((player, index) => {

                const userId = player[0];
                const stats = player[1];

                text +=

                    `${index + 1}. <@${userId}>\n` +

                    `🏆 Wins: ${stats.wins} | ` +

                    `❌ Losses: ${stats.losses} | ` +

                    `🤝 Draws: ${stats.draws}\n\n`;
            });

            const embed = new EmbedBuilder()

                .setTitle('🏆 Leaderboard')

                .setDescription(text)

                .setColor('Gold');

            return interaction.reply({

                embeds: [embed]
            });
        }

        // CHALLENGE

        if (interaction.commandName === 'challenge') {

            const opponent =
                interaction.options.getUser('player');

            if (!opponent) {

                return interaction.reply({

                    content:
                        'Mention a valid player!',

                    flags: 64
                });
            }

            if (opponent.bot) {

                return interaction.reply({

                    content:
                        'You cannot challenge bots!',

                    flags: 64
                });
            }

            const channelId =
                interaction.channel.id;

            if (games[channelId]) {

                return interaction.reply({

                    content:
                        'A game is already active here!',

                    flags: 64
                });
            }

            games[channelId] = {

                player1: interaction.user.id,
                player2: opponent.id,

                scores: {
                    player1: 0,
                    player2: 0
                },

                innings: 1,

                target: null,

                tossWinner: null,

                batting: null,
                bowling: null,

                gameStarted: false,
                tossDone: false,

                currentPlays: {},

                lastMove: Date.now()
            };

            const embed = new EmbedBuilder()

                .setTitle('🪙 Toss Time!')

                .setDescription(
                    `${interaction.user} choose Heads or Tails!`
                )

                .setColor('Gold');

            return interaction.reply({

                embeds: [embed],

                components:
                    createTossButtons()
            });
        }
    }

    // ================= BUTTONS =================

    if (interaction.isButton()) {

        await interaction.deferUpdate();

        const channelId =
            interaction.channel.id;

        const game =
            games[channelId];

        if (!game) {
            return interaction.followUp({

                content:
                    '⚠ This game session has ended!\nStart a new one using `/challenge`.',

                flags: 64
            });
        }

        game.lastMove = Date.now();

        const userId =
            interaction.user.id;

        // ================= TOSS =================

        if (
            interaction.customId === 'heads' ||
            interaction.customId === 'tails'
        ) {

        if (game.tossDone) {

            return interaction.followUp({

                content:
                    '⚠ Toss already completed!',

                flags: 64
            });
        }

        if (userId !== game.player1) {

            return interaction.followUp({

                content:
                    '⚠ Only challenger can do toss!',

                flags: 64
            });
        }

        game.tossDone = true;

        const tossResult =

        crypto.randomInt(0, 2) === 0
            ? 'heads'
            : 'tails';

        console.log(

            `Toss Result: ${tossResult} | ` +

            `Player Guess: ${interaction.customId}`
        );
        // PLAYER 1 WINS

        if (
            interaction.customId === tossResult
        ) {

            game.tossWinner =
                game.player1;

            return interaction.message.edit({

                embeds: [

                    new EmbedBuilder()

                        .setTitle(
                            '🪙 Toss Won!'
                        )

                        .setDescription(

                            `🪙 Toss Result: ${tossResult}\n\n` +

                            `<@${game.player1}> guessed correctly and won the toss!\n\n` +

                            `Choose Bat or Bowl`
                        )

                        .setColor('Green')
                ],

                components:
                    createBatBowlButtons()
            });
        }

        // PLAYER 2 WINS

                game.tossWinner =
                    game.player2;

                game.tossWinner =
            game.player2;

        return interaction.message.edit({

            embeds: [

                new EmbedBuilder()

                    .setTitle(
                        '🪙 Toss Won!'
                    )

                    .setDescription(

                        `🪙 Toss Result: ${tossResult}\n\n` +

                        `<@${game.player2}> won the toss!\n\n` +

                        `Choose Bat or Bowl`
                    )

                    .setColor('Green')
            ],

            components:
                createBatBowlButtons()
        });
    }

        // ================= BAT/BOWL =================

if (
    interaction.customId === 'bat' ||
    interaction.customId === 'bowl'
) {

    // ONLY TOSS WINNER CAN CHOOSE

    if (userId !== game.tossWinner) {

        return interaction.followUp({

            content:
                '⚠ Only toss winner can choose Bat or Bowl!',

            flags: 64
        });
    }

    // PREVENT DOUBLE START

    if (game.gameStarted) {

        return interaction.followUp({

            content:
                '⚠ Match already started!',

            flags: 64
        });
    }

    // BAT CHOSEN

    if (interaction.customId === 'bat') {

        game.batting =
            game.tossWinner;

        game.bowling =

            game.tossWinner ===
            game.player1

                ? game.player2
                : game.player1;
    }

    // BOWL CHOSEN

    else {

        game.bowling =
            game.tossWinner;

        game.batting =

            game.tossWinner ===
            game.player1

                ? game.player2
                : game.player1;
    }

    game.gameStarted = true;

    return interaction.message.edit({

        embeds: [

            new EmbedBuilder()

                .setTitle(
                    '🏏 Match Started'
                )

                .setDescription(

                    `🏏 Batter: <@${game.batting}>\n\n` +

                    `🎯 Bowler: <@${game.bowling}>`
                )

                .setColor('Blue')
        ],

        components:
            createNumberButtons()
    });
}
        // ================= CANCEL MATCH =================

if (
    interaction.customId === 'cancel_game'
) {

    // ONLY PLAYERS CAN CANCEL

    if (
        userId !== game.player1 &&
        userId !== game.player2
    ) {

        return interaction.followUp({

            content:
                '⚠ You are not part of this match!',

            flags: 64
        });
    }

    delete games[channelId];

    return interaction.message.edit({

        embeds: [

            new EmbedBuilder()

                .setTitle(
                    '❌ Match Cancelled'
                )

                .setDescription(

                    `<@${userId}> cancelled the match.`
                )

                .setColor('Red')
        ],

        components: []
    });
}
        // ================= GAMEPLAY =================

        if (
            ![
                '1',
                '2',
                '3',
                '4',
                '5',
                '6'
            ].includes(interaction.customId)
        ) {
            return;
        }

        if (!game.gameStarted) {
            return;
        }

        if (
            userId !== game.player1 &&
            userId !== game.player2
        ) {
            return;
        }

        if (game.currentPlays[userId]) {
            return interaction.followUp({

                content:
                    '⚠ You already selected your number for this turn!',

                flags: 64
            });
        }

        const selectedNumber =
            parseInt(interaction.customId);

        game.currentPlays[userId] =
            selectedNumber;

            interaction.channel.send({

                content:
                    `✅ <@${userId}> locked in their number!`
            });

        // WAIT BOTH PLAYERS

        if (
            !game.currentPlays[game.player1] ||
            !game.currentPlays[game.player2]
        ) {
            interaction.channel.send({
                content:
                    '⏳ Waiting for opponent selection...'
            });
            return;
        }

        const battingNumber =
            game.currentPlays[
                game.batting
            ];

        const bowlingNumber =
            game.currentPlays[
                game.bowling
            ];

        let result = '';

        // OUT

        if (
            battingNumber === bowlingNumber
        ) {

            result +=

                `🏏 Batter chose: ${battingNumber}\n` +

                `🎯 Bowler chose: ${bowlingNumber}\n\n` +

                `❌ OUT!\n`;

            // SECOND INNINGS

            if (game.innings === 1) {

                game.innings = 2;

                game.target =

                    game.batting ===
                    game.player1

                        ? game.scores.player1 + 1
                        : game.scores.player2 + 1;

                const oldBatter =
                    game.batting;

                game.batting =
                    game.bowling;

                game.bowling =
                    oldBatter;

                result +=

                    `\n🏏 Second Innings Begins!\n` +

                    `🎯 Target: ${game.target}`;
            }

            // MATCH END

            else {

                const p1 =
                    game.scores.player1;

                const p2 =
                    game.scores.player2;

                if (!playerStats[game.player1]) {

                    playerStats[
                        game.player1
                    ] = {

                        wins: 0,
                        losses: 0,
                        draws: 0
                    };
                }

                if (!playerStats[game.player2]) {

                    playerStats[
                        game.player2
                    ] = {

                        wins: 0,
                        losses: 0,
                        draws: 0
                    };
                }

                result +=
                    '\n🏆 MATCH OVER!\n';

                if (p1 > p2) {

                    playerStats[
                        game.player1
                    ].wins++;

                    playerStats[
                        game.player2
                    ].losses++;
                    saveLeaderboard();

                    result +=
                        `<@${game.player1}> wins!`;
                }

                else if (p2 > p1) {

                    playerStats[
                        game.player2
                    ].wins++;

                    playerStats[
                        game.player1
                    ].losses++;
                    saveLeaderboard();

                    result +=
                        `<@${game.player2}> wins!`;
                }

                else {

                    playerStats[
                        game.player1
                    ].draws++;

                    playerStats[
                        game.player2
                    ].draws++;
                    saveLeaderboard();

                    result +=
                        '🤝 Match Draw!';
                }

                delete games[channelId];

                return interaction.channel.send({

                    embeds: [

                        new EmbedBuilder()

                            .setTitle(
                                '🏆 Match Finished'
                            )

                            .setDescription(result)

                            .setColor('Gold')
                    ]
                });
            }
        }

        // RUNS

        else {

            if (
                game.batting ===
                game.player1
            ) {

                game.scores.player1 +=
                    battingNumber;
            }

            else {

                game.scores.player2 +=
                    battingNumber;
            }

            result +=

                `🏏 Batter: ${battingNumber}\n` +

                `🎯 Bowler: ${bowlingNumber}\n\n` +

                `✅ ${battingNumber} runs added!\n\n` +

                `📊 SCORE:\n` +

                `<@${game.player1}> : ${game.scores.player1}\n` +

                `<@${game.player2}> : ${game.scores.player2}\n\n` +

                `🏏 Batter: <@${game.batting}>\n` +

                `🎯 Bowler: <@${game.bowling}>`;

            // CHASE WIN

            if (game.innings === 2) {

                const chaseScore =

                    game.batting ===
                    game.player1

                        ? game.scores.player1
                        : game.scores.player2;

                if ( chaseScore >= game.target)
                {

                    result +=

                        `\n\n🏆 <@${game.batting}> wins by chase!`;

                    // CREATE STATS

                if (!playerStats[game.player1]) {

                    playerStats[
                        game.player1
                    ] = {

                        wins: 0,
                        losses: 0,
                        draws: 0
                    };
                }

                if (!playerStats[game.player2]) {

                    playerStats[
                        game.player2
                    ] = {

                        wins: 0,
                        losses: 0,
                        draws: 0
                    };
                }

                // WINNER

                playerStats[
                    game.batting
                ].wins++;

                // LOSER

                const loser =

                    game.batting ===
                    game.player1

                        ? game.player2
                        : game.player1;

                playerStats[
                    loser
                ].losses++;
                saveLeaderboard();
                    
                    delete games[channelId];

                    return interaction.channel.send({

                        embeds: [

                            new EmbedBuilder()

                                .setTitle(
                                    '🏆 Match Finished'
                                )

                                .setDescription(result)

                                .setColor('Green')
                        ]
                    });
                }
            }
        }

        // RESET ROUND

        game.currentPlays = {};

        return interaction.channel.send({

            embeds: [

                new EmbedBuilder()

                    .setTitle(
                        '🏏 Hand Cricket'
                    )

                    .setDescription(result)

                    .setColor('Blue')
            ],

            components:
                createNumberButtons()
        });
    }
});

// ================= TIMEOUT =================

setInterval(() => {

    const now = Date.now();

    for (const channelId in games) {

        const game =
            games[channelId];

        if (
            now - game.lastMove >
            3 * 60 * 1000
        ) {

            delete games[channelId];
        }
    }

}, 30000);

// ================= LOGIN =================

client.login(process.env.TOKEN);