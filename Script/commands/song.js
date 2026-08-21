const axios = require("axios");
const fs = require("fs");
const path = require("path");

let cachedBaseApi = null;

async function baseApiUrl() {
  if (cachedBaseApi) return cachedBaseApi;

  const { data } = await axios.get(
    "https://raw.githubusercontent.com/Mostakim0978/D1PT0/refs/heads/main/baseApiUrl.json",
    { timeout: 15000 }
  );

  if (!data || !data.api) {
    throw new Error("API URL পাওয়া যায়নি");
  }

  cachedBaseApi = data.api.replace(/\/$/, "");
  return cachedBaseApi;
}

module.exports.config = {
  name: "song",
  version: "2.2.0",
  aliases: ["music", "play"],
  credits: "Ariyan",
  countDown: 5,
  hasPermssion: 0,
  description: "Download audio from YouTube",
  category: "media",
  commandCategory: "media",
  usePrefix: true,
  prefix: true,
  usages: "{pn} [song name | YouTube link]\nExample: {pn} chipi chipi chapa chapa"
};

module.exports.run = async ({ api, args, event }) => {
  if (!args || args.length === 0) {
    return api.sendMessage(
      "❌ একটি গানের নাম অথবা YouTube link দিন।\n\nExample: song chipi chipi chapa chapa",
      event.threadID,
      event.messageID
    );
  }

  const youtubeRegex =
    /^(?:https?:\/\/)?(?:m\.|www\.)?(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))((\w|-){11})(?:\S+)?$/;

  const input = args.join(" ").trim();
  const isYouTubeUrl = youtubeRegex.test(input);

  try {
    // Direct YouTube link
    if (isYouTubeUrl) {
      const match = input.match(youtubeRegex);
      const videoID = match ? match[1] : null;

      if (!videoID) {
        return api.sendMessage(
          "❌ YouTube video ID পাওয়া যায়নি।",
          event.threadID,
          event.messageID
        );
      }

      const apiUrl = await baseApiUrl();

      const { data } = await axios.get(
        `${apiUrl}/ytDl3?link=${encodeURIComponent(videoID)}&format=mp3`,
        { timeout: 60000 }
      );

      if (!data || !data.downloadLink) {
        throw new Error("Download link পাওয়া যায়নি");
      }

      const fileName = `song_${Date.now()}_${event.senderID}.mp3`;

      try {
        const audio = await downloadAudio(data.downloadLink, fileName);

        await api.sendMessage(
          {
            body: `🎵 ${data.title || "Song"}\n\n🎧 Audio`,
            attachment: audio
          },
          event.threadID,
          event.messageID
        );
      } finally {
        safeDelete(fileName);
      }

      return;
    }

    // Search YouTube
    const keyWord = input
      .replace("?feature=share", "")
      .trim();

    const apiUrl = await baseApiUrl();

    const { data } = await axios.get(
      `${apiUrl}/ytFullSearch?songName=${encodeURIComponent(keyWord)}`,
      { timeout: 60000 }
    );

    const result = Array.isArray(data) ? data.slice(0, 6) : [];

    if (result.length === 0) {
      return api.sendMessage(
        `⭕ "${keyWord}" এর কোনো search result পাওয়া যায়নি।`,
        event.threadID,
        event.messageID
      );
    }

    let msg = "🎵 YouTube Search Results\n\n";

    for (let i = 0; i < result.length; i++) {
      const info = result[i];

      msg += `${i + 1}. ${info.title || "Unknown"}\n`;
      msg += `⏱ Time: ${info.time || "Unknown"}\n`;
      msg += `📺 Channel: ${
        info.channel?.name || "Unknown"
      }\n\n`;
    }

    msg += "👉 Reply করে 1-6 এর মধ্যে একটি number দিন।";

    return api.sendMessage(
      msg,
      event.threadID,
      (err, info) => {
        if (err || !info) return;

        global.client.handleReply.push({
          name: module.exports.config.name,
          messageID: info.messageID,
          author: event.senderID,
          result
        });
      },
      event.messageID
    );
  } catch (error) {
    console.error("SONG RUN ERROR:", error);

    return api.sendMessage(
      `❌ Song command-এ সমস্যা হয়েছে।\n\n${error.message || "Unknown error"}`,
      event.threadID,
      event.messageID
    );
  }
};

module.exports.handleReply = async ({
  event,
  api,
  handleReply
}) => {
  try {
    if (!handleReply || !handleReply.result) {
      return api.sendMessage(
        "❌ এই request আর active নেই। আবার song search করুন।",
        event.threadID,
        event.messageID
      );
    }

    // Only the original user can select
    if (
      handleReply.author &&
      event.senderID !== handleReply.author
    ) {
      return;
    }

    const choice = parseInt(event.body.trim());

    if (
      isNaN(choice) ||
      choice < 1 ||
      choice > handleReply.result.length
    ) {
      return api.sendMessage(
        `❌ Invalid choice.\n1 থেকে ${handleReply.result.length} এর মধ্যে একটি number দিন।`,
        event.threadID,
        event.messageID
      );
    }

    const infoChoice = handleReply.result[choice - 1];

    if (!infoChoice || !infoChoice.id) {
      return api.sendMessage(
        "❌ এই song-এর তথ্য পাওয়া যাচ্ছে না।",
        event.threadID,
        event.messageID
      );
    }

    const apiUrl = await baseApiUrl();

    const { data } = await axios.get(
      `${apiUrl}/ytDl3?link=${encodeURIComponent(
        infoChoice.id
      )}&format=mp3`,
      { timeout: 60000 }
    );

    if (!data || !data.downloadLink) {
      throw new Error("Audio download link পাওয়া যায়নি");
    }

    // Remove search result message
    try {
      await api.unsendMessage(handleReply.messageID);
    } catch (e) {
      console.log("Unsend error:", e.message);
    }

    const fileName = `song_${Date.now()}_${event.senderID}.mp3`;

    try {
      const audio = await downloadAudio(
        data.downloadLink,
        fileName
      );

      await api.sendMessage(
        {
          body:
            `🎵 Title: ${data.title || infoChoice.title || "Unknown"}\n` +
            `🎧 Quality: ${data.quality || "MP3"}`,
          attachment: audio
        },
        event.threadID,
        event.messageID
      );
    } finally {
      safeDelete(fileName);
    }
  } catch (error) {
    console.error("SONG REPLY ERROR:", error);

    let message = "❌ Sorry, song download করতে সমস্যা হয়েছে।";

    if (
      error.message &&
      /size|26mb|large|too large/i.test(error.message)
    ) {
      message =
        "⭕ Audio size 26MB-এর বেশি হতে পারে, তাই Messenger-এ পাঠানো সম্ভব হয়নি।";
    }

    return api.sendMessage(
      message,
      event.threadID,
      event.messageID
    );
  }
};

// Download audio
async function downloadAudio(url, fileName) {
  const response = await axios.get(url, {
    responseType: "arraybuffer",
    timeout: 120000,
    maxContentLength: 30 * 1024 * 1024,
    maxBodyLength: 30 * 1024 * 1024
  });

  if (!response.data || response.data.length === 0) {
    throw new Error("Empty audio file");
  }

  fs.writeFileSync(
    path.resolve(fileName),
    Buffer.from(response.data)
  );

  return fs.createReadStream(path.resolve(fileName));
}

// Safe delete
function safeDelete(fileName) {
  try {
    const filePath = path.resolve(fileName);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.log("File cleanup error:", error.message);
  }
            }
