const fs = require("fs");
const login = require("fca-unofficial");

// قراءة ملفات الإعدادات وقاعدة البيانات
let config = JSON.parse(fs.readFileSync("./config.json", "utf8"));
let db = JSON.parse(fs.readFileSync("./database.json", "utf8"));

// دالة لحفظ التغييرات في قاعدة البيانات
function saveDatabase() {
    fs.writeFileSync("./database.json", JSON.stringify(db, null, 2));
}

login({ appState: require("./appstate.json") }, (err, api) => {
    if (err) return console.error("خطأ في تسجيل الدخول:", err);

    console.log("تم تسجيل الدخول بنجاح! KAI-BOT يعمل الآن.");
    api.setOptions({ listenEvents: true, forceLogin: true });

    api.listenMqtt((err, event) => {
        if (err) return console.error(err);

        // التعامل مع الأحداث والرسائل في المجموعات
        if (event.type === "message" && event.body && event.isGroup) {
            const senderID = event.senderID;
            const threadID = event.threadID;
            const messageBody = event.body;
            const prefix = config.prefix || "/";

            // فحص الصلاحيات: هل المستخدم مالك أساسي، مالك إضافي، أو مشرف مسجل؟
            const isSuperOwner = senderID === config.superOwner;
            const isOwner = db.owners.includes(senderID) || isSuperOwner;
            const isAdmin = db.admins.includes(senderID) || isOwner;

            // إذا لم يكن المرسل مالكاً أو مشرفاً، يتجاهل البوت الرسالة تماماً (لا يرد على الأعضاء العاديين)
            if (!isAdmin) return;

            // التحقق من البادئة
            if (messageBody.startsWith(prefix)) {
                const args = messageBody.slice(prefix.length).trim().split(/ +/);
                const command = args.shift().toLowerCase();

                switch (command) {
                    // --- أولاً: أوامر المالك ---
                    case "owner":
                        api.sendMessage(`👑 مالك البوت الأساسي:\nID: ${config.superOwner}`, threadID);
                        break;

                    case "addowner":
                        if (!isSuperOwner) return api.sendMessage("❌ هذا الأمر خاص بالمالك الأساسي فقط.", threadID);
                        const newOwnerID = args[0] || (event.messageReply ? event.messageReply.senderID : null);
                        if (!newOwnerID) return api.sendMessage("⚠️ يرجى تحديد أيدي المستخدم أو الرد على رسالته.", threadID);
                        if (!db.owners.includes(newOwnerID)) {
                            db.owners.push(newOwnerID);
                            saveDatabase();
                            api.sendMessage(`✅ تم إضافة المستخدم (${newOwnerID}) كمالك بنجاح.`, threadID);
                        } else {
                            api.sendMessage("⚠️ هذا المستخدم مالك بالفعل.", threadID);
                        }
                        break;

                    case "delowner":
                        if (!isSuperOwner) return api.sendMessage("❌ هذا الأمر خاص بالمالك الأساسي فقط.", threadID);
                        const delOwnerID = args[0];
                        db.owners = db.owners.filter(id => id !== delOwnerID);
                        saveDatabase();
                        api.sendMessage(`✅ تم إزالة المالك (${delOwnerID}).`, threadID);
                        break;

                    case "addadmin":
                        if (!isOwner) return api.sendMessage("❌ هذا الأمر للمالكين فقط.", threadID);
                        const newAdminID = args[0] || (event.messageReply ? event.messageReply.senderID : null);
                        if (!newAdminID) return api.sendMessage("⚠️ يرجى تحديد الأيدي أو الرد على رسالة الشخص.", threadID);
                        if (!db.admins.includes(newAdminID)) {
                            db.admins.push(newAdminID);
                            saveDatabase();
                            api.sendMessage(`✅ تم ترقية المستخدم (${newAdminID}) إلى مشرف (Admin).`, threadID);
                        } else {
                            api.sendMessage("⚠️ المستخدم مشرف بالفعل.", threadID);
                        }
                        break;

                    case "deladmin":
                        if (!isOwner) return api.sendMessage("❌ هذا الأمر للمالكين فقط.", threadID);
                        const delAdminID = args[0];
                        db.admins = db.admins.filter(id => id !== delAdminID);
                        saveDatabase();
                        api.sendMessage(`✅ تم إزالة المشرف (${delAdminID}).`, threadID);
                        break;

                    case "admins":
                        let adminList = `📋 قائمة المشرفين:\n- المالك الأساسي: ${config.superOwner}\n`;
                        if (db.owners.length > 0) adminList += `- الملاك الإضافيون: ${db.owners.join(", ")}\n`;
                        if (db.admins.length > 0) adminList += `- المشرفون: ${db.admins.join(", ")}`;
                        api.sendMessage(adminList, threadID);
                        break;

                    case "setprefix":
                        if (!isOwner) return api.sendMessage("❌ هذا الأمر للمالكين فقط.", threadID);
                        if (!args[0]) return api.sendMessage("⚠️ يرجى كتابة الرمز الجديد، مثال: /setprefix !", threadID);
                        config.prefix = args[0];
                        fs.writeFileSync("./config.json", JSON.stringify(config, null, 2));
                        api.sendMessage(`✅ تم تغيير البادئة إلى: ${args[0]}`, threadID);
                        break;

                    // --- ثانياً: أوامر التفاعل والمساعدة ---
                    case "help":
                        const helpText = `📜 قائمة أوامر KAI-BOT (للأدمنز فقط):\n\n` +
                            `👑 المالك والأدمنز:\n` +
                            `${prefix}owner, ${prefix}addowner, ${prefix}delowner\n` +
                            `${prefix}addadmin, ${prefix}deladmin, ${prefix}admins, ${prefix}setprefix\n\n` +
                            `🤖 الإدارة التلقائية:\n` +
                            `${prefix}nm [نص] / off\n` +
                            `${prefix}nick [نص] / off\n` +
                            `${prefix}angel [نص] [min] [max] / off\n` +
                            `${prefix}autoreply on/off\n` +
                            `${prefix}setavatar, ${prefix}out\n\n` +
                            `💬 التفاعل ومعلومات:\n` +
                            `${prefix}ping, ${prefix}info, ${prefix}id, ${prefix}profile\n` +
                            `${prefix}say [نص], ${prefix}time, ${prefix}uptime\n\n` +
                            `📋 المحادثات وإعدادات:\n` +
                            `${prefix}chats, ${prefix}chatinfo, ${prefix}send, ${prefix}status`;
                        api.sendMessage(helpText, threadID);
                        break;

                    case "ping":
                        const timeStart = Date.now();
                        api.sendMessage("Pinging...", threadID, (err, info) => {
                            if (!err) {
                                const pingTime = Date.now() - timeStart;
                                api.sendMessage(`🏓 Pong! سرعة الاستجابة: ${pingTime}ms`, threadID);
                            }
                        });
                        break;

                    case "time":
                        api.sendMessage(`⏰ الوقت الحالي: ${new Date().toLocaleString()}`, threadID);
                        break;

                    case "uptime":
                        const uptimeSec = process.uptime();
                        const hours = Math.floor(uptimeSec / 3600);
                        const minutes = Math.floor((uptimeSec % 3600) / 60);
                        const seconds = Math.floor(uptimeSec % 60);
                        api.sendMessage(`⏱️ مدة تشغيل البوت: ${hours}ساعة ${minutes}دقيقة ${seconds}ثانية`, threadID);
                        break;

                    case "say":
                        const textToSay = args.join(" ");
                        if (!textToSay) return api.sendMessage("⚠️ اكتب النص الذي تريد إرساله.", threadID);
                        api.sendMessage(textToSay, threadID);
                        break;

                    case "out":
                        api.sendMessage("👋 إلى اللقاء!", threadID, () => {
                            api.removeUserFromGroup(api.getCurrentUserID(), threadID);
                        });
                        break;

                    // --- ثالثاً: الإدارة التلقائية والتثبيت (nm و nick) ---
                    case "nm":
                        const titleText = args.join(" ");
                        if (titleText === "off") {
                            delete db.autoName[threadID];
                            saveDatabase();
                            return api.sendMessage("🛑 تم إيقاف التثبيت التلقائي لاسم المجموعة.", threadID);
                        }
                        if (!titleText) return api.sendMessage("⚠️ يرجى إدخال اسم المجموعة أو كلمة off للإيقاف.", threadID);
                        db.autoName[threadID] = titleText;
                        saveDatabase();
                        api.setTitle(titleText, threadID, (err) => {
                            if (!err) api.sendMessage(`✅ تم تثبيت اسم المجموعة إلى: ${titleText}`, threadID);
                        });
                        break;

                    case "nick":
                        const nickText = args.join(" ");
                        if (nickText === "off") {
                            delete db.autoNick[threadID];
                            saveDatabase();
                            return api.sendMessage("🛑 تم إيقاف تثبيت الكنيات.", threadID);
                        }
                        if (!nickText) return api.sendMessage("⚠️ يرجى إدخال الكنية أو كلمة off للإيقاف.", threadID);
                        db.autoNick[threadID] = nickText;
                        saveDatabase();
                        api.sendMessage(`✅ تم تفعيل تثبيت الكنيات للأعضاء إلى: ${nickText}`, threadID);
                        api.getThreadInfo(threadID, (err, info) => {
                            if (!err && info.participantIDs) {
                                info.participantIDs.forEach(uid => {
                                    api.changeNickname(nickText, threadID, uid);
                                });
                            }
                        });
                        break;

                    // --- رابعاً: أمر الإرسال العشوائي /angel ---
                    case "angel":
                        if (args[0] === "off") {
                            if (db.autoDev[threadID]) {
                                clearTimeout(db.autoDev[threadID]);
                                delete db.autoDev[threadID];
                                saveDatabase();
                                return api.sendMessage("🛑 تم إيقاف نظام /angel التلقائي.", threadID);
                            }
                            return api.sendMessage("⚠️ نظام /angel ليس مفعلًا أصلاً.", threadID);
                        }
                        let minSec = parseInt(args[args.length - 2]);
                        let maxSec = parseInt(args[args.length - 1]);
                        
                        if (isNaN(minSec) || isNaN(maxSec)) {
                            return api.sendMessage("⚠️ الخطأ في الصيغة. استخدم:\n/angel [النص] [الحد الأقل بالثواني] [الحد الأعلى بالثواني]\nمثال: /angel السلام عليكم 50 60", threadID);
                        }

                        let msgContent = args.slice(0, args.length - 2).join(" ");
                        if (!msgContent) return api.sendMessage("⚠️ يرجى كتابة النص المراد إرساله.", threadID);

                        api.sendMessage(`✅ تم تفعيل /angel لإرسال رسائل عشوائية بين ${minSec} و ${maxSec} ثانية.`, threadID);

                        function sendRandomMsg() {
                            api.sendMessage(msgContent, threadID);
                            let randomTime = (Math.floor(Math.random() * (maxSec - minSec + 1)) + minSec) * 1000;
                            db.autoDevInterval[threadID] = setTimeout(sendRandomMsg, randomTime);
                        }
                        
                        let initialTime = (Math.floor(Math.random() * (maxSec - minSec + 1)) + minSec) * 1000;
                        db.autoDev[threadID] = setTimeout(sendRandomMsg, initialTime);
                        saveDatabase();
                        break;

                    default:
                        break;
                }
            }
        }

        // --- المراقبة التلقائية ---
        if (event.type === "event" && event.isGroup) {
            const threadID = event.threadID;

            if (event.logMessageType === "log:thread-name" && db.autoName && db.autoName[threadID]) {
                const targetName = db.autoName[threadID];
                api.setTitle(targetName, threadID);
            }

            if (event.logMessageType === "log:subscribe" && db.autoNick && db.autoNick[threadID]) {
                const targetNick = db.autoNick[threadID];
                const addedParticipants = event.logMessageData.addedParticipants || [];
                addedParticipants.forEach(p => {
                    api.changeNickname(targetNick, threadID, p.userAccountId);
                });
            }
        }
    });
});
