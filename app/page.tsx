"use client";

import { useState } from "react";

const chats = [
  { id: 1, name: "أحمد", message: "أهلًا! كيف حالك؟", time: "18:02", online: true, avatar: "أ" },
  { id: 2, name: "سارة", message: "الصورة وصلت ✅", time: "17:46", online: true, avatar: "س" },
  { id: 3, name: "مجموعة الأصدقاء", message: "محمد: نلتقي الساعة 9؟", time: "16:31", online: false, avatar: "أ" },
  { id: 4, name: "خالد", message: "تمام، شكرًا لك", time: "15:20", online: false, avatar: "خ" },
];

export default function Home() {
  const [activeChat, setActiveChat] = useState(chats[0]);
  const [message, setMessage] = useState("");

  function sendMessage() {
    if (!message.trim()) return;
    setMessage("");
  }

  return (
    <main className="vasta-shell">
      <section className="app-frame">
        <aside className="sidebar">
          <header className="sidebar-head">
            <div>
              <div className="brand">Vasta</div>
              <div className="brand-subtitle">مراسلة سريعة عبر الإنترنت</div>
            </div>
            <button className="icon-button" aria-label="خيارات">⋮</button>
          </header>

          <div className="search-wrap">
            <span>⌕</span>
            <input placeholder="البحث عن محادثة" aria-label="البحث" />
          </div>

          <div className="chat-list">
            {chats.map((chat) => (
              <button
                key={chat.id}
                className={`chat-item ${activeChat.id === chat.id ? "active" : ""}`}
                onClick={() => setActiveChat(chat)}
              >
                <div className="avatar">{chat.avatar}</div>
                <div className="chat-copy">
                  <div className="chat-title-row">
                    <strong>{chat.name}</strong>
                    <time>{chat.time}</time>
                  </div>
                  <div className="chat-message">{chat.message}</div>
                </div>
              </button>
            ))}
          </div>

          <footer className="sidebar-footer">
            <div className="profile-mini">
              <div className="avatar small">م</div>
              <div>
                <strong>حسابي</strong>
                <span>متصل الآن</span>
              </div>
            </div>
            <button className="icon-button" aria-label="الإعدادات">⚙</button>
          </footer>
        </aside>

        <section className="conversation">
          <header className="conversation-head">
            <div className="conversation-user">
              <div className="avatar">{activeChat.avatar}</div>
              <div>
                <strong>{activeChat.name}</strong>
                <span>{activeChat.online ? "متصل الآن" : "آخر ظهور مؤخرًا"}</span>
              </div>
            </div>
            <div className="conversation-actions">
              <button className="icon-button" aria-label="مكالمة">☎</button>
              <button className="icon-button" aria-label="معلومات">ⓘ</button>
            </div>
          </header>

          <div className="messages-area">
            <div className="secure-note">🔒 الرسائل في Vasta مصممة لتكون خاصة وآمنة.</div>
            <div className="message received">أهلًا بك في Vasta 👋</div>
            <div className="message received">هذه الواجهة هي البداية. سنربطها بالإنترنت والرسائل الحقيقية في الخطوة التالية.</div>
            <div className="message sent">ممتاز! لنبدأ 🚀</div>
          </div>

          <div className="composer">
            <button className="attach" aria-label="إرفاق ملف">＋</button>
            <input
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") sendMessage();
              }}
              placeholder="اكتب رسالة..."
              aria-label="الرسالة"
            />
            <button className="send" onClick={sendMessage} aria-label="إرسال">➤</button>
          </div>
        </section>
      </section>
    </main>
  );
}
