module.exports.config = {
 name: "antiout",
 eventType: ["log:unsubscribe"],
 version: "1.0.0",
 credits: "SHAHADAT SAHU",
 description: "Listen events"
};

module.exports.run = async({ event, api, Threads, Users }) => {
 let data = (await Threads.getData(event.threadID)).data || {};
 if (data.antiout == false) return;
 if (event.logMessageData.leftParticipantFbId == api.getCurrentUserID()) return;
 const name = global.data.userName.get(event.logMessageData.leftParticipantFbId) || await Users.getNameUser(event.logMessageData.leftParticipantFbId);
 const type = (event.author == event.logMessageData.leftParticipantFbId) ? "self-separation" : "Koi Ase Pichware Mai Lath Marta Hai?";
 if (type == "self-separation") {
  api.addUserToGroup(event.logMessageData.leftParticipantFbId, event.threadID, (error, info) => {
   if (error) {
    api.sendMessage(`সরি বস, ${name} কে আবার এড করতে পারলাম না। 
সম্ভবত উনি বটকে ব্লক করেছে অথবা তার প্রাইভেসি সেটিংসের কারণে এড করা যায় না। 
\n──────꯭─⃝‌‌𝐀𝐫𝐢𝐲𝐚𝐧 𝐂𝐡𝐚𝐭 𝐁𝐨𝐭─────`, event.threadID)
   } else api.sendMessage(`শোন, ${name}, এই গ্রুপ হইলো গ্যাং!
এখান থেকে যাইতে হলে এডমিনের পারমিশন লাগে!
তুই পারমিশন ছাড়া লিভ নিছোস – তোকে আবার মাফিয়া স্টাইলে এড দিলাম।
\n──────꯭─⃝‌‌𝐀𝐫𝐢𝐭𝐚𝐧 𝐂𝐡𝐚𝐭 𝐁𝐨𝐭─────`, event.threadID);
  })
 }
}
