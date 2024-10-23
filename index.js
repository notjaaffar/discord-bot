// Load environment variables from the savecode.env file
require('dotenv').config({ path: './savecode.env' });
const express = require('express');
const axios = require('axios');
const querystring = require('querystring');
const { Client, GatewayIntentBits, EmbedBuilder, Events, ButtonBuilder, ActionRowBuilder } = require('discord.js');

const app = express();
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

// Initialize an object to store user warnings and logs channel
const userWarnings = {};
let logChannel;

// Helper function to send embed messages
const sendEmbedMessage = async (channel, title, description, color, fields = []) => {
    const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(title)
        .setDescription(description)
        .addFields(fields)
        .setFooter({ text: 'Avatar: The Last Airbender - Maintain Balance!' })
        .setTimestamp();
    await channel.send({ embeds: [embed] });
};

// Log punishment actions
const logPunishment = async (action, user, reason, channel) => {
    if (!logChannel) return; // If no log channel is set, do nothing
    const logEmbed = new EmbedBuilder()
        .setColor(0x8B0000) // Dark Red
        .setTitle(`📜 Punishment Log`)
        .setDescription(`Action: **${action}**`)
        .addFields([
            { name: 'User:', value: `${user.username} (${user.id})`, inline: true },
            { name: 'Reason:', value: reason, inline: true },
            { name: 'Timestamp:', value: new Date().toLocaleString(), inline: true }
        ])
        .setFooter({ text: 'Logged by The Avatar Bot' })
        .setTimestamp();

    await logChannel.send({ embeds: [logEmbed] });
};

// Handle messages
client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return; // Ignore bot messages

    const args = message.content.split(" ");
    const command = args.shift().toLowerCase();

    // Set log channel command
    if (command === '!set-log-channel') {
        logChannel = message.channel; // Set the current channel as the log channel
        await sendEmbedMessage(message.channel, "📝 Log Channel Set", `All punishments will now be logged in **${logChannel}**.`, 0x00FF00); // GREEN
        return;
    }

    // Warn command
    if (command === '!warn') {
        const userToWarn = message.mentions.users.first();
        const reason = args.join(" ") || 'No reason provided';

        if (!userToWarn) {
            await sendEmbedMessage(message.channel, "⚠️ Warning Error", "Please mention a user to warn.", 0xFF0000); // RED
            return;
        }

        if (!userWarnings[userToWarn.id]) {
            userWarnings[userToWarn.id] = [];
        }

        userWarnings[userToWarn.id].push(reason);
        await sendEmbedMessage(message.channel, "🔥 User Warned", `**${userToWarn.username}** has been warned! \n*Reason:* ${reason}`, 0xFFA500, [
            { name: "Warnings Count", value: `${userWarnings[userToWarn.id].length}`, inline: true },
            { name: "Avatar", value: userToWarn.displayAvatarURL(), inline: true }
        ]);

        // Log the punishment
        await logPunishment("Warn", userToWarn, reason, logChannel);

        // DM the user
        await userToWarn.send({ embeds: [new EmbedBuilder().setTitle("🔔 You've been warned!").setDescription(`Reason: *${reason}*`).setColor(0xFF0000).setFooter({ text: 'May the elements guide you!' })] });
    }

    // Punishments command
    else if (command === '!punishments') {
        const userToCheck = message.mentions.users.first();

        if (!userToCheck || !userWarnings[userToCheck.id]) {
            await sendEmbedMessage(message.channel, "🚫 No Warnings", `**${userToCheck ? userToCheck.username : 'User'}** has no recorded punishments.`, 0x00FF00); // GREEN
            return;
        }

        const warnings = userWarnings[userToCheck.id];
        const punishmentsEmbed = new EmbedBuilder()
            .setColor(0x008B8B) // Dark Cyan
            .setTitle(`📜 Punishments for ${userToCheck.username}`)
            .setDescription(`**Total Warnings:** ${warnings.length}`)
            .addFields(warnings.map((warn, index) => ({ name: `Warning ${index + 1}`, value: warn })))
            .setFooter({ text: 'Let balance prevail!' })
            .setTimestamp();

        await message.channel.send({ embeds: [punishmentsEmbed] });
    }

    // Remove Warning command
    else if (command === '!remove-warning') {
        const userToRemoveFrom = message.mentions.users.first();
        const warningIndex = parseInt(args[0], 10) - 1;

        if (!userToRemoveFrom || !userWarnings[userToRemoveFrom.id] || userWarnings[userToRemoveFrom.id].length <= warningIndex) {
            await sendEmbedMessage(message.channel, "❌ Invalid Warning", `Invalid warning index for **${userToRemoveFrom ? userToRemoveFrom.username : 'User'}**.`, 0xFF0000); // RED
            return;
        }

        userWarnings[userToRemoveFrom.id].splice(warningIndex, 1);
        await sendEmbedMessage(message.channel, "✅ Warning Removed", `🗑️ Removed warning ${warningIndex + 1} from **${userToRemoveFrom.username}**.`, 0x00FF00); // GREEN
    }

    // Kick command
    else if (command === '!kick') {
        const userToKick = message.mentions.users.first();
        const reason = args.slice(1).join(" ") || 'No reason provided';

        if (!userToKick) {
            await sendEmbedMessage(message.channel, "🚪 Kick Error", "Please mention a user to kick.", 0xFF0000); // RED
            return;
        }

        const member = await message.guild.members.fetch(userToKick.id);
        await member.kick(reason);
        await sendEmbedMessage(message.channel, "🚫 User Kicked", `👢 Kicked **${userToKick.username}** from the server! \n*Reason:* ${reason}`, 0xFFFF00, [
            { name: "Avatar", value: userToKick.displayAvatarURL() }
        ]);

        // Log the punishment
        await logPunishment("Kick", userToKick, reason, logChannel);

        // DM the user
        await userToKick.send({ embeds: [new EmbedBuilder().setTitle("🔔 You have been kicked!").setDescription(`Reason: *${reason}*`).setColor(0xFF0000).setFooter({ text: 'May the elements guide you!' })] });
    }

    // Ban command
    else if (command === '!ban') {
        const userToBan = message.mentions.users.first();
        const reason = args.slice(1).join(" ") || 'No reason provided';

        if (!userToBan) {
            await sendEmbedMessage(message.channel, "🚫 Ban Error", "Please mention a user to ban.", 0xFF0000); // RED
            return;
        }

        const member = await message.guild.members.fetch(userToBan.id);
        await member.ban({ reason });
        await sendEmbedMessage(message.channel, "🚫 User Banned", `❌ Banned **${userToBan.username}** from the server! \n*Reason:* ${reason}`, 0xFFFF00, [
            { name: "Avatar", value: userToBan.displayAvatarURL() }
        ]);

        // Log the punishment
        await logPunishment("Ban", userToBan, reason, logChannel);

        // DM the user
        await userToBan.send({ embeds: [new EmbedBuilder().setTitle("🔔 You have been banned!").setDescription(`Reason: *${reason}*`).setColor(0xFF0000).setFooter({ text: 'May the elements guide you!' })] });
    }

    // Timeout command
    else if (command === '!timeout') {
        const userToTimeout = message.mentions.users.first();
        const duration = parseInt(args[1], 10);
        const reason = args.slice(2).join(" ") || 'No reason provided';

        if (!userToTimeout || isNaN(duration)) {
            await sendEmbedMessage(message.channel, "⏳ Timeout Error", "Please mention a user and provide a valid duration.", 0xFF0000); // RED
            return;
        }

        const member = await message.guild.members.fetch(userToTimeout.id);
        await member.timeout(duration * 1000, reason);
        await sendEmbedMessage(message.channel, "⏳ User Timed Out", `⏳ Timed out **${userToTimeout.username}** for ${duration} seconds! \n*Reason:* ${reason}`, 0xFFFF00, [
            { name: "Avatar", value: userToTimeout.displayAvatarURL() }
        ]);

        // Log the punishment
        await logPunishment("Timeout", userToTimeout, reason, logChannel);

        // DM the user
        await userToTimeout.send({ embeds: [new EmbedBuilder().setTitle("🔔 You've been timed out!").setDescription(`Reason: *${reason}*`).setColor(0xFF0000).setFooter({ text: 'May the elements guide you!' })] });
    }

    // Reaction Roles command
    else if (command === '!reaction-roles') {
        const roleId = args[0];
        const emoji = args[1];

        if (!roleId || !emoji) {
            await sendEmbedMessage(message.channel, "🔄 Reaction Roles Error", "Please provide a role ID and an emoji.", 0xFF0000); // RED
            return;
        }

        const role = message.guild.roles.cache.get(roleId);
        if (!role) {
            await sendEmbedMessage(message.channel, "🚫 Role Error", "Invalid role ID provided.", 0xFF0000); // RED
            return;
        }

        const button = new ButtonBuilder()
            .setCustomId(`reaction_role_${role.id}`)
            .setLabel(`Claim ${role.name}`)
            .setStyle('PRIMARY');

        const row = new ActionRowBuilder().addComponents(button);
        await message.channel.send({ content: `React with ${emoji} to claim the role **${role.name}**!`, components: [row] });

        await sendEmbedMessage(message.channel, "✅ Reaction Role Set", `Users can now react with ${emoji} to claim the **${role.name}** role.`, 0x00FF00); // GREEN
    }
});

// Handle button interactions for reaction roles
client.on(Events.InteractionCreate, async (interaction) => {
    if (interaction.isButton()) {
        const roleId = interaction.customId.split('_')[2];
        const role = interaction.guild.roles.cache.get(roleId);

        if (interaction.member.roles.cache.has(role.id)) {
            await interaction.member.roles.remove(role);
            await interaction.reply({ content: `Removed role **${role.name}**`, ephemeral: true });
        } else {
            await interaction.member.roles.add(role);
            await interaction.reply({ content: `Added role **${role.name}**`, ephemeral: true });
        }
    }
});

// Start the server
app.listen(process.env.PORT || 3000, () => {
    console.log(`Server is running on port ${process.env.PORT || 3000}`);
});

// Login to Discord
client.login(process.env.TOKEN);

