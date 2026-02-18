import React, { createContext, useContext } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';

export type Language = 'uz' | 'ru' | 'en';

const translations = {
  // Settings
  settings: { uz: "Sozlamalar", ru: "Настройки", en: "Settings" },
  account: { uz: "Akkount", ru: "Аккаунт", en: "Account" },
  email: { uz: "Email", ru: "Эл. почта", en: "Email" },
  appearance: { uz: "Ko'rinish", ru: "Оформление", en: "Appearance" },
  darkMode: { uz: "Qorong'u rejim", ru: "Тёмная тема", en: "Dark mode" },
  security: { uz: "Xavfsizlik", ru: "Безопасность", en: "Security" },
  securityDesc: { uz: "Akkount email orqali himoyalangan", ru: "Аккаунт защищён по эл. почте", en: "Account protected via email" },
  logout: { uz: "Chiqish", ru: "Выйти", en: "Log out" },
  loggedOut: { uz: "Chiqildi", ru: "Вы вышли", en: "Logged out" },
  loggedOutDesc: { uz: "Muvaffaqiyatli chiqdingiz", ru: "Вы успешно вышли", en: "Successfully logged out" },
  language: { uz: "Til", ru: "Язык", en: "Language" },

  // Bottom nav
  home: { uz: "Bosh sahifa", ru: "Главная", en: "Home" },
  create: { uz: "Yaratish", ru: "Создать", en: "Create" },
  messages: { uz: "Xabarlar", ru: "Сообщения", en: "Messages" },
  notifications: { uz: "Bildirishnomalar", ru: "Уведомления", en: "Notifications" },
  profile: { uz: "Profil", ru: "Профиль", en: "Profile" },

  // Messages
  chats: { uz: "Chatlar", ru: "Чаты", en: "Chats" },
  groups: { uz: "Guruhlar", ru: "Группы", en: "Groups" },
  ai: { uz: "AI", ru: "AI", en: "AI" },
  searchChats: { uz: "Chatlarni qidirish...", ru: "Поиск чатов...", en: "Search chats..." },
  noChats: { uz: "Hozircha chatlar yo'q", ru: "Пока нет чатов", en: "No chats yet" },
  online: { uz: "Online", ru: "В сети", en: "Online" },
  typing: { uz: "yozmoqda...", ru: "печатает...", en: "typing..." },
  writeMessage: { uz: "Xabar yozing...", ru: "Напишите...", en: "Type a message..." },

  // Profile
  posts: { uz: "Postlar", ru: "Посты", en: "Posts" },
  followers: { uz: "Obunachilar", ru: "Подписчики", en: "Followers" },
  following: { uz: "Obunalar", ru: "Подписки", en: "Following" },
  editProfile: { uz: "Profilni tahrirlash", ru: "Редактировать", en: "Edit profile" },
  saved: { uz: "Saqlangan", ru: "Сохранённые", en: "Saved" },
  relatives: { uz: "Qarindoshlar", ru: "Родственники", en: "Relatives" },
  noPosts: { uz: "Hozircha postlar yo'q", ru: "Пока нет постов", en: "No posts yet" },

  // General
  cancel: { uz: "Bekor qilish", ru: "Отмена", en: "Cancel" },
  save: { uz: "Saqlash", ru: "Сохранить", en: "Save" },
  delete: { uz: "O'chirish", ru: "Удалить", en: "Delete" },
  send: { uz: "Yuborish", ru: "Отправить", en: "Send" },
  back: { uz: "Orqaga", ru: "Назад", en: "Back" },
  today: { uz: "bugun", ru: "сегодня", en: "today" },
  yesterday: { uz: "kecha", ru: "вчера", en: "yesterday" },
  lastSeen: { uz: "oxirgi faollik", ru: "был(а)", en: "last seen" },
  noMessages: { uz: "Hozircha xabarlar yo'q", ru: "Пока нет сообщений", en: "No messages yet" },

  // Feed
  noMorePosts: { uz: "Boshqa postlar yo'q", ru: "Больше нет постов", en: "No more posts" },
  likes: { uz: "yoqtirishlar", ru: "нравится", en: "likes" },
  comments: { uz: "izohlar", ru: "комментарии", en: "comments" },
  share: { uz: "Ulashish", ru: "Поделиться", en: "Share" },

  // Notifications
  notifLike: { uz: "postingizni yoqtirdi", ru: "понравился ваш пост", en: "liked your post" },
  notifComment: { uz: "izoh qoldirdi", ru: "оставил комментарий", en: "commented" },
  notifFollow: { uz: "sizga obuna bo'ldi", ru: "подписался на вас", en: "followed you" },
} as const;

type TranslationKey = keyof typeof translations;

interface LanguageContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLang] = useLocalStorage<Language>('app-language', 'uz');

  const t = (key: TranslationKey): string => {
    return translations[key]?.[lang] || translations[key]?.['uz'] || key;
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within LanguageProvider');
  return context;
};
