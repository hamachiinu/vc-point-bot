// 📦 ライブラリ読み込み
const { Client, GatewayIntentBits, Partials, PermissionsBitField } = require("discord.js");
const express = require("express");
require("dotenv").config();

// 🌐 Glitchスリープ防止用
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

// 💾 ユーザーのポイントとVC入室時間を保存する変数
const vcJoinTimes = {};
const points = {};

// ✅ Botがオンラインになったとき
client.on("ready", () => {
  console.log(`Bot is ready: ${client.user.tag}`);
});

// 🎧 VC入退室を監視してポイント加算
client.on("voiceStateUpdate", (oldState, newState) => {
  const userId = newState.id;

  // 入室時
  if (!oldState.channelId && newState.channelId) {
    vcJoinTimes[userId] = Date.now();
  }

  // 退出時
  if (oldState.channelId && !newState.channelId) {
    const joinedAt = vcJoinTimes[userId];
    if (joinedAt) {
      const duration = (Date.now() - joinedAt) / 1000; // 秒数

      if (duration >= 1800) {
        points[userId] = (points[userId] || 0) + 1;
        console.log(`✅ ${userId} に 1ポイント付与！ 合計: ${points[userId]}`);
      }

      delete vcJoinTimes[userId];
    }
  }
});

// 💬 !mypoint コマンド → 自分のポイントを確認
client.on("messageCreate", async (message) => {
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

// 🛡️ !addpoint @user 5 → 管理者が手動でポイントを追加
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
  message.reply(`✅ ${mention.username} に ${value}ポイント追加しました。合計: ${points[mention.id]} pt`);
});

client.login(process.env.DISCORD_TOKEN);
