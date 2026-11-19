const { makeid, getBuffer } = require('./utils');
const fs = require('fs-extra');
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// قراءة ملفات الإعداد وقاعدة البيانات
const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
const database = JSON.parse(fs.readFileSync('./database.json', 'utf8'));

// إحصائيات لوحة التحكم الحية
let stats = {
    isOnline: false,
    commandsExecuted: 0,
    messagesCount: 0,
    users: new Set(),
    groups: new Set()
};

// تشغيل خادم الويب لعرض الواجهة والإحصائيات
app.use(express.static("."));

app.get("/api/stats", (req, res) => {
    const uptimeSec = Math.floor(process.uptime());
    const mins = Math.floor(uptimeSec / 60);
    const hrs = Math.floor(mins / 60);
    const ramMB = (process.memoryUsage().rss / 1024 / 1024).toFixed(1);

    res.json({
        botName: "KAI-BOT",
        isOnline: stats.isOnline,
        commandsExecuted: stats.commandsExecuted,
        messagesCount: stats.messagesCount,
        usersCount: stats.users.size,
        groupsCount: stats.groups.size,
        uptime: `${hrs}h ${mins % 60}m`,
        ram: ramMB
    });
});

app.listen(PORT, () => {
    console.log(`🌐 لوحة التحكم تعمل على المنفذ ${PORT}`);
});

// منطقة تشغيل البوت الأساسية
console.log("KAI-BOT جاهز للتشغيل ومتصل بلوحة التحكم بنجاح...");
