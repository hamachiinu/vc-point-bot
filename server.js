const { Client, GatewayIntentBits, Partials, PermissionsBitField } = require("discord.js");
const express = require("express");
require("dotenv").config();
const fs = require("fs");

const app = express();
app.get("/", (req, res) => res.send("Bot is running!"));
app.listen(3000, () => console.log("Express alive check server is ready"));

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

const POINTS_FILE = "./points.json";
let points = {};
const NOTIFY_CHANNEL_ID = "1388303943758512178";

if (fs.existsSync(POINTS_FILE)) {
  try {
    points = JSON.parse(fs.readFileSync(POINTS_FILE));
  } catch {
    console.error("❌ ポイントファイルの読み込みに失敗しました");
  }
}

function savePoints() {
  fs.writeFileSync(POINTS_FILE, JSON.stringify(points, null, 2));
}

const vcJoinTimes = {};

client.once("ready", () => {
  console.log(`Bot is ready: ${client.user.tag}`);
});

client.on("voiceStateUpdate", async (oldState, newState) => {
  const userId = newState.id;

  if (!oldState.channelId && newState.channelId) {
    vcJoinTimes[userId] = Date.now();
  }

  if (oldState.channelId && !newState.channelId) {
    const joinedAt = vcJoinTimes[userId];
    if (joinedAt) {
      const duration = (Date.now() - joinedAt) / 1000;
      const earnedPoints = Math.floor(duration / 1800);

      if (earnedPoints > 0) {
        points[userId] = (points[userId] || 0) + earnedPoints;
        savePoints();
        console.log(`✅ ${userId} に ${earnedPoints}ポイント付与！ 合計: ${points[userId]}`);

        const channel = await client.channels.fetch(NOTIFY_CHANNEL_ID).catch(() => null);
        if (channel?.isTextBased()) {
          channel.send(`<@${userId}> に VC参加報酬として ${earnedPoints} ポイント付与されました！🎉`);
        }
      }

      delete vcJoinTimes[userId];
    }
  }
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (message.content === "!mypoint") {
    const member = message.member;
    const hasStreamerRole = member.roles.cache.some(role => role.name === "streamer");

    if (!hasStreamerRole) {
      return message.reply("❌ このコマンドは `streamer` ロールを持つメンバーのみ使えます。");
    }

    const point = points[member.id] || 0;
    message.reply(`🎯 現在のポイント： ${point} pt`);
  }
});

client.on("messageCreate", async (message) => {
  if (!message.content.startsWith("!addpoint") || message.author.bot) return;

  const isAdmin = message.member.permissions.has(PermissionsBitField.Flags.Administrator);
  if (!isAdmin) return message.reply("❌ このコマンドは管理者のみ使えます。");

  const mention = message.mentions.users.first();
  const args = message.content.split(" ");
  const value = parseInt(args[2]);

  if (!mention || isNaN(value)) {
    return message.reply("使い方: `!addpoint @ユーザー ポイント数`");
  }

  points[mention.id] = (points[mention.id] || 0) + value;
  savePoints();
  message.reply(`✅ ${mention.username} に ${value}ポイント追加しました。合計: ${points[mention.id]} pt`);
});

client.on("messageCreate", async (message) => {
  if (!message.content.startsWith("!removepoint") || message.author.bot) return;

  const isAdmin = message.member.permissions.has(PermissionsBitField.Flags.Administrator);
  if (!isAdmin) return message.reply("❌ このコマンドは管理者のみ使えます。");

  const mention = message.mentions.users.first();
  const args = message.content.split(" ");
  const value = parseInt(args[2]);

  if (!mention || isNaN(value)) {
    return message.reply("使い方: `!removepoint @ユーザー ポイント数`");
  }

  points[mention.id] = Math.max((points[mention.id] || 0) - value, 0);
  savePoints();
  message.reply(`❎ ${mention.username} から ${value}ポイント減点しました。合計: ${points[mention.id]} pt`);
});

client.on("messageCreate", async (message) => {
  if (!message.content.startsWith("!showpoint") || message.author.bot) return;

  const isAdmin = message.member.permissions.has(PermissionsBitField.Flags.Administrator);
  if (!isAdmin) return message.reply("❌ このコマンドは管理者のみ使えます。");

  const mention = message.mentions.users.first();
  if (!mention) return message.reply("使い方: `!showpoint @ユーザー`");

  const point = points[mention.id] || 0;
  message.reply(`📊 ${mention.username} の現在のポイント: ${point} pt`);
});

client.login(process.env.DISCORD_TOKEN);
