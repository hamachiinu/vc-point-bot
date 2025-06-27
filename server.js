const { Client, GatewayIntentBits, Partials, PermissionsBitField } = require("discord.js");
const express = require("express");
require("dotenv").config();

// Express (Renderでスリープ回避用)
const app = express();
app.get("/", (req, res) => res.send("Bot is running!"));
app.listen(3000, () => console.log("Express alive check server is ready"));

// Discordクライアント初期化
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

// 一時メモリにポイント保存
const vcJoinTimes = {};
const points = {};

client.on("ready", () => {
  console.log(`Bot is ready: ${client.user.tag}`);
});

// VC参加時間の記録とポイント加算
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
        console.log(`✅ ${userId} に 1ポイント付与！ 合計: ${points[userId]}`);
      }
      delete vcJoinTimes[userId];
    }
  }
});

// メッセージコマンド処理
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  // !mypoint：streamerロール持ちのみ実行可
  if (message.content === "!mypoint") {
    const member = message.member;
    const hasStreamerRole = member.roles.cache.some(role => role.name === "streamer");

    if (!hasStreamerRole) {
      return message.reply("❌ このコマンドは `streamer` ロールを持つメンバーのみ使えます。");
    }

    const point = points[member.id] || 0;
    return message.reply(`🎯 現在のポイント： ${point} pt`);
  }

  // !addpoint @user 数値：管理者のみ
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
    return message.reply(`✅ ${mention.username} に ${value}ポイント追加しました。合計: ${points[mention.id]} pt`);
  }
});

client.login(process.env.DISCORD_TOKEN);
