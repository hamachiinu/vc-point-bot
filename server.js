const { Client, GatewayIntentBits, Partials, PermissionsBitField } = require("discord.js");
const express = require("express");
const fs = require("fs");
require("dotenv").config();

const POINT_FILE = "points.json";

// 🌐 Render用 keepalive
const app = express();
app.get("/", (req, res) => res.send("Bot is running!"));
app.listen(3000, () => console.log("Express alive check server is ready"));

// 🤖 Discordクライアント設定
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

// 💾 ポイント読み込み
let points = {};
try {
  if (fs.existsSync(POINT_FILE)) {
    points = JSON.parse(fs.readFileSync(POINT_FILE, "utf8"));
    console.log("✅ ポイントデータを読み込みました");
  } else {
    console.log("ℹ️ ポイントファイルが存在しません。新しく作成します。");
  }
} catch (err) {
  console.error("❌ ポイント読み込みエラー:", err);
  points = {};
}

// 💾 保存関数
function savePoints() {
  fs.writeFileSync(POINT_FILE, JSON.stringify(points, null, 2));
}

// 🕓 VC入室時間記録
const vcJoinTimes = {};

client.on("ready", () => {
  console.log(`Bot is ready: ${client.user.tag}`);
});

// 🎧 VC滞在でポイント付与
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

// 💬 コマンド処理（1か所に集約）
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  // !mypoint（streamerロール限定）
  if (message.content === "!mypoint") {
    const member = message.member;
    const hasStreamerRole = member.roles.cache.some(role => role.name === "streamer");
    if (!hasStreamerRole) {
      return message.reply("❌ このコマンドは `streamer` ロールを持つメンバーのみ使えます。");
    }

    const point = points[member.id] || 0;
    return message.reply(`🎯 現在のポイント： ${point} pt`);
  }

  // !addpoint @user 数（管理者限定）
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
