// 📦 ライブラリ読み込み
const { Client, GatewayIntentBits, Partials, PermissionsBitField } = require("discord.js");
const express = require("express");
require("dotenv").config();
const fs = require("fs");

// 🌐 Render用：スリープ防止用のHTTPサーバー
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

// 💾 ポイント情報の永続保存用ファイル
const POINTS_FILE = "./points.json";
let points = {};

// 🔄 起動時にポイントを読み込む
if (fs.existsSync(POINTS_FILE)) {
  try {
    points = JSON.parse(fs.readFileSync(POINTS_FILE));
  } catch {
    console.error("❌ ポイントファイルの読み込みに失敗しました");
  }
}

// 💽 ポイントを保存する関数
function savePoints() {
  fs.writeFileSync(POINTS_FILE, JSON.stringify(points, null, 2));
}

// ⏱️ VC入室時間管理
const vcJoinTimes = {};

// ✅ Botがオンラインになったとき
client.once("ready", () => {
  console.log(`Bot is ready: ${client.user.tag}`);
});

// 🎧 VC入退室イベント → ポイント加算
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

      const earnedPoints = Math.floor(duration / 1800); // 1800秒ごとに1ポイント
      if (earnedPoints > 0) {
        points[userId] = (points[userId] || 0) + earnedPoints;
        savePoints();
        console.log(`✅ ${userId} に ${earnedPoints}ポイント付与！ 合計: ${points[userId]}`);
      }

      delete vcJoinTimes[userId];
    }
  }
});

// 💬 コマンドハンドラー（すべて統合）
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  const content = message.content;
  const member = message.member;

  // !mypoint
  if (content === "!mypoint") {
    const hasStreamerRole = member.roles.cache.some(role => role.name === "streamer");
    if (!hasStreamerRole) {
      return message.reply("❌ このコマンドは `streamer` ロールを持つメンバーのみ使えます。");
    }

    const point = points[member.id] || 0;

    let rank = "";
    if (point >= 5000) rank = "👑 Master";
    else if (point >= 1501) rank = "🏆 Platinum";
    else if (point >= 1001) rank = "🥇 Gold";
    else if (point >= 501) rank = "🥈 Silver";
    else if (point >= 1) rank = "🥉 Bronze";

    let reply = `🎯 現在のポイント： ${point} pt`;
    if (rank) reply += `\n🪪 ランク： ${rank}`;

    return message.reply(reply);
  }

  // !addpoint @user 数
  if (content.startsWith("!addpoint")) {
    const isAdmin = member.permissions.has(PermissionsBitField.Flags.Administrator);
    if (!isAdmin) return message.reply("❌ このコマンドは管理者のみ使えます。");

    const mention = message.mentions.users.first();
    const args = content.split(" ");
    const value = parseInt(args[2]);

    if (!mention || isNaN(value)) {
      return message.reply("使い方: `!addpoint @ユーザー ポイント数`");
    }

    points[mention.id] = (points[mention.id] || 0) + value;
    savePoints();
    return message.reply(`✅ ${mention.username} に ${value}ポイント追加しました。合計: ${points[mention.id]} pt`);
  }

  // !removepoint @user 数
  if (content.startsWith("!removepoint")) {
    const isAdmin = member.permissions.has(PermissionsBitField.Flags.Administrator);
    if (!isAdmin) return message.reply("❌ このコマンドは管理者のみ使えます。");

    const mention = message.mentions.users.first();
    const args = content.split(" ");
    const value = parseInt(args[2]);

    if (!mention || isNaN(value)) {
      return message.reply("使い方: `!removepoint @ユーザー ポイント数`");
    }

    points[mention.id] = Math.max((points[mention.id] || 0) - value, 0);
    savePoints();
    return message.reply(`❎ ${mention.username} から ${value}ポイント減点しました。合計: ${points[mention.id]} pt`);
  }

  // !showpoint @user
  if (content.startsWith("!showpoint")) {
    const isAdmin = member.permissions.has(PermissionsBitField.Flags.Administrator);
    if (!isAdmin) return message.reply("❌ このコマンドは管理者のみ使えます。");

    const mention = message.mentions.users.first();
    if (!mention) return message.reply("使い方: `!showpoint @ユーザー`");

    const point = points[mention.id] || 0;

    let rank = "";
    if (point >= 5000) rank = "👑 Master";
    else if (point >= 1501) rank = "🏆 Platinum";
    else if (point >= 1001) rank = "🥇 Gold";
    else if (point >= 501) rank = "🥈 Silver";
    else if (point >= 1) rank = "🥉 Bronze";

    let reply = `🎯 ${mention.username} のポイント： ${point} pt`;
    if (rank) reply += `\n🪪 ランク： ${rank}`;

    return message.reply(reply);
  }
});

// 🔑 トークンでログイン
client.login(process.env.DISCORD_TOKEN);
