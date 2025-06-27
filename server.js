const { Client, GatewayIntentBits, Partials, PermissionsBitField } = require("discord.js");
const express = require("express");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

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

const vcJoinTimes = {};
const pointsFile = path.join(__dirname, "points.json");
let points = {};

// 🔄 JSON読み込み関数
function loadPoints() {
  try {
    if (fs.existsSync(pointsFile)) {
      const raw = fs.readFileSync(pointsFile, "utf8");
      points = JSON.parse(raw);
    } else {
      points = {};
    }
  } catch (err) {
    console.error("ポイント読み込み失敗:", err);
    points = {};
  }
}

// 💾 JSON保存関数
function savePoints() {
  try {
    fs.writeFileSync(pointsFile, JSON.stringify(points, null, 2));
  } catch (err) {
    console.error("ポイント保存失敗:", err);
  }
}

client.on("ready", () => {
  console.log(`Bot is ready: ${client.user.tag}`);
  loadPoints();
});

client.on("voiceStateUpdate", (oldState, newState) => {
  const userId = newState.id;

  if (!oldState.channelId && newState.channelId) {
    vcJoinTimes[userId] = Date.now();
  }

  if (oldState.channelId && !newState.channelId) {
    const joinedAt = vcJoinTimes[userId];
    if (joinedAt) {
      const duration = (Date.now() - joinedAt) / 1000;
      if (duration >= 1800) {
        points[userId] = (points[userId] || 0) + 1;
        savePoints();
        console.log(`✅ ${userId} に 1ポイント付与！ 合計: ${points[userId]}`);
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
    return message.reply(`🎯 現在のポイント： ${point} pt`);
  }

  if (message.content.startsWith("!addpoint")) {
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
    return message.reply(`✅ ${mention.username} に ${value}ポイント追加しました。合計: ${points[mention.id]} pt`);
  }
});

client.login(process.env.DISCORD_TOKEN);
