// The words Safari itself uses for its settings, so what is read here is what is found there.
const WORDS = {
    en: { title: "Two steps in Safari", one: "Turn Nordlys on", extensions: "Open Extensions", on: "On", two: "Press ⌘, in Safari. Under General, choose Nordlys for new tabs.", general: "General", label: "New tabs open with:", before: "Homepage", safari: "Open Safari" },
    ru: { title: "Два шага в Safari", one: "Включите Nordlys", extensions: "Открыть Расширения", on: "Включено", two: "В Safari нажмите ⌘, и в разделе «Основные» выберите Nordlys для новых вкладок.", general: "Основные", label: "В новых вкладках открывать:", before: "Домашнюю страницу", safari: "Открыть Safari" },
    de: { title: "Zwei Schritte in Safari", one: "Nordlys einschalten", extensions: "Erweiterungen öffnen", on: "Ein", two: "In Safari ⌘, drücken und unter „Allgemein“ Nordlys für neue Tabs wählen.", general: "Allgemein", label: "Neue Tabs öffnen mit:", before: "Homepage", safari: "Safari öffnen" },
    fr: { title: "Deux étapes dans Safari", one: "Activez Nordlys", extensions: "Ouvrir Extensions", on: "Activé", two: "Dans Safari, appuyez sur ⌘, puis choisissez Nordlys pour les nouveaux onglets sous Général.", general: "Général", label: "Les nouveaux onglets ouvrent :", before: "la page d’accueil", safari: "Ouvrir Safari" },
    es: { title: "Dos pasos en Safari", one: "Activa Nordlys", extensions: "Abrir Extensiones", on: "Activado", two: "En Safari pulsa ⌘, y en General elige Nordlys para las pestañas nuevas.", general: "General", label: "Abrir pestañas nuevas con:", before: "Página de inicio", safari: "Abrir Safari" },
    tr: { title: "Safari’de iki adım", one: "Nordlys’i aç", extensions: "Uzantıları Aç", on: "Açık", two: "Safari’de ⌘, tuşlarına bas ve Genel bölümünde yeni sekmeler için Nordlys’i seç.", general: "Genel", label: "Yeni sekmelerde şunu aç:", before: "Ana Sayfa", safari: "Safari’yi Aç" },
    ja: { title: "Safariで2ステップ", one: "Nordlysをオンにする", extensions: "機能拡張を開く", on: "オン", two: "Safariで ⌘, を押し、「一般」で新規タブにNordlysを選びます。", general: "一般", label: "新規タブを開く場合:", before: "ホームページ", safari: "Safariを開く" },
    zh: { title: "在 Safari 中完成两步", one: "打开 Nordlys", extensions: "打开扩展", on: "已打开", two: "在 Safari 中按 ⌘, 然后在“通用”中为新标签页选择 Nordlys。", general: "通用", label: "新建标签页时打开：", before: "主页", safari: "打开 Safari" }
};

function start(language) {
    const code = String(language || "en").slice(0, 2).toLowerCase();
    const words = WORDS[code] || WORDS.en;
    document.documentElement.lang = WORDS[code] ? code : "en";
    for (const node of document.querySelectorAll("[data-t]")) node.textContent = words[node.dataset.t];
    document.body.classList.add("ready");
}

function show(enabled) {
    document.body.classList.toggle("is-on", enabled === true);
}

for (const button of document.querySelectorAll("[data-do]")) {
    button.addEventListener("click", () => webkit.messageHandlers.controller.postMessage(button.dataset.do));
}
