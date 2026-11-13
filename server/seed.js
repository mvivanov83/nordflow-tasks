import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import { initSchema, resetData } from "./schema.js";
import { get, insert, run, setSetting } from "./db.js";
import { UPLOADS_ROOT } from "./uploads.js";
import { addDays, dateOnly, nowIso } from "./util.js";

const PASSWORD_ADMIN = "Admin123!";
const PASSWORD_MANAGER = "Manager123!";
const PASSWORD_DEMO = "Demo123!";

const USERS = [
  { key: "anna", email: "admin@nordflow.ru", password: PASSWORD_ADMIN, first_name: "Анна", last_name: "Волкова", position: "Операционный директор", role: "admin" },
  { key: "maxim", email: "manager@nordflow.ru", password: PASSWORD_MANAGER, first_name: "Максим", last_name: "Орлов", position: "Руководитель проекта", role: "manager" },
  { key: "elena", email: "elena@nordflow.ru", password: PASSWORD_DEMO, first_name: "Елена", last_name: "Соколова", position: "Дизайнер", role: "employee" },
  { key: "ilya", email: "ilya@nordflow.ru", password: PASSWORD_DEMO, first_name: "Илья", last_name: "Морозов", position: "Frontend-разработчик", role: "employee" },
  { key: "viktor", email: "viktor@nordflow.ru", password: PASSWORD_DEMO, first_name: "Виктор", last_name: "Лебедев", position: "Backend-разработчик", role: "employee" },
  { key: "olga", email: "olga@nordflow.ru", password: PASSWORD_MANAGER, first_name: "Ольга", last_name: "Крылова", position: "Маркетолог", role: "manager" },
  { key: "dmitry", email: "dmitry@nordflow.ru", password: PASSWORD_DEMO, first_name: "Дмитрий", last_name: "Фролов", position: "Тестировщик", role: "employee" },
  { key: "maria", email: "maria@nordflow.ru", password: PASSWORD_DEMO, first_name: "Мария", last_name: "Белова", position: "Аналитик", role: "employee" },
];

const PROJECTS = [
  {
    key: "greenstone",
    name: "Разработка сайта для клиента «GreenStone»",
    description:
      "Корпоративный сайт с каталогом товаров, корзиной и интеграцией с платёжным провайдером. Работаем по двухнедельным спринтам, демо для клиента — каждый вторник.",
    manager: "maxim",
    status: "active",
    start: -50,
    due: 30,
    members: [
      ["anna", 0], ["elena", 1], ["ilya", 1], ["viktor", 0], ["dmitry", 0], ["maria", 0],
    ],
  },
  {
    key: "campaign",
    name: "Запуск рекламной кампании NordFlow",
    description:
      "Комплексная кампания для продвижения услуг NordFlow: медиаплан, креативы, лендинг, таргетированная реклама и отчётность по первым результатам.",
    manager: "olga",
    status: "active",
    start: -25,
    due: 20,
    members: [
      ["anna", 0], ["elena", 0], ["ilya", 0], ["maria", 1],
    ],
  },
  {
    key: "automation",
    name: "Внутренняя автоматизация отдела продаж",
    description:
      "Проект по наведению порядка в процессах продаж: аудит, настройка CRM, интеграция с телефонией, автоматизация счетов и обучение менеджеров.",
    manager: "maxim",
    status: "planning",
    start: -3,
    due: 60,
    members: [
      ["anna", 0], ["viktor", 0], ["maria", 1], ["dmitry", 0],
    ],
  },
];

const TASKS = [
  {
    code: "NDF-101", project: "greenstone", title: "Дизайн-концепция главной страницы",
    description:
      "Подготовить два варианта концепции главной страницы: акцент на каталоге и акцент на преимуществах компании. Нужны десктоп и мобильная версия, а также состояния hover и focus.",
    status: "in_progress", priority: "high", assignee: "elena", reporter: "maxim",
    due: 3, created: -12, tags: ["дизайн", "клиент"],
  },
  {
    code: "NDF-102", project: "greenstone", title: "Прототип каталога товаров",
    description:
      "Кликабельный прототип каталога: фильтры, сортировка, карточка товара и пагинация. Согласовать сценарий с клиентом и передать в разработку.",
    status: "review", priority: "medium", assignee: "elena", reporter: "maxim",
    due: 1, created: -10, tags: ["дизайн", "UX"],
  },
  {
    code: "NDF-103", project: "greenstone", title: "Вёрстка главной страницы",
    description:
      "Собрать адаптивную главную страницу по макету: hero-блок, преимущества, популярные товары и футер. Проверить кроссбраузерность в Chrome, Safari и Firefox.",
    status: "in_progress", priority: "high", assignee: "ilya", reporter: "maxim",
    due: 7, created: -9, tags: ["frontend", "вёрстка"],
  },
  {
    code: "NDF-104", project: "greenstone", title: "Адаптивная вёрстка карточки товара",
    description:
      "Свёрстать карточку товара для мобильных, планшетов и десктопа. Предусмотреть галерею изображений, выбор размера и блок с рекомендациями.",
    status: "backlog", priority: "medium", assignee: "ilya", reporter: "maxim",
    due: 12, created: -8, tags: ["frontend", "адаптивность"],
  },
  {
    code: "NDF-105", project: "greenstone", title: "API каталога и фильтров",
    description:
      "Реализовать эндпоинты каталога с фильтрацией по категории, цене и наличию. Предусмотреть кеширование и пагинацию. Подготовить OpenAPI-описание.",
    status: "in_progress", priority: "critical", assignee: "viktor", reporter: "maxim",
    due: -2, created: -14, tags: ["backend", "API"],
  },
  {
    code: "NDF-106", project: "greenstone", title: "Корзина и оформление заказа",
    description:
      "Реализовать серверную логику корзины, расчёт доставки и сценарий оформления заказа. Нужны тесты на пересчёт стоимости и промокоды.",
    status: "planned", priority: "high", assignee: "viktor", reporter: "maxim",
    due: 14, created: -7, tags: ["backend", "ecommerce"],
  },
  {
    code: "NDF-107", project: "greenstone", title: "Интеграция с платёжным провайдером",
    description:
      "Подключить платёжный шлюз, обработку вебхуков и возвраты. Согласовать сценарии ошибок и повторных попыток оплаты.",
    status: "backlog", priority: "critical", assignee: "viktor", reporter: "maxim",
    due: 21, created: -6, tags: ["backend", "интеграции"],
  },
  {
    code: "NDF-108", project: "greenstone", title: "Тест-план клиентской части",
    description:
      "Составить тест-план для каталога, корзины и оформления заказа. Определить критичные сценарии, тестовые данные и критерии приёмки.",
    status: "planned", priority: "medium", assignee: "dmitry", reporter: "maxim",
    due: 9, created: -5, tags: ["QA", "тестирование"],
  },
  {
    code: "NDF-109", project: "greenstone", title: "Регрессионное тестирование оформления заказа",
    description:
      "Провести регрессию после интеграции оплаты: промокоды, доставка, ошибки оплаты, повторное оформление. Зафиксировать дефекты в трекере.",
    status: "backlog", priority: "high", assignee: "dmitry", reporter: "maxim",
    due: 18, created: -4, tags: ["QA"],
  },
  {
    code: "NDF-110", project: "greenstone", title: "Контент для страницы «О компании»",
    description:
      "Собрать тексты, фотографии команды и факты о компании. Согласовать tone of voice с клиентом и передать контент-менеджеру.",
    status: "done", priority: "low", assignee: "elena", reporter: "maxim",
    due: -5, created: -20, tags: ["контент"],
  },
  {
    code: "NDF-111", project: "greenstone", title: "Согласование структуры сайта с клиентом",
    description:
      "Провести встречу с клиентом, зафиксировать структуру разделов и навигацию. Подготовить протокол встречи и список правок.",
    status: "done", priority: "medium", assignee: "maxim", reporter: "anna",
    due: -10, created: -25, tags: ["клиент", "согласование"],
  },
  {
    code: "NDF-112", project: "greenstone", title: "Настройка аналитики и целей",
    description:
      "Подключить веб-аналитику, настроить цели на отправку заявки и оформление заказа. Проверить корректность событий на тестовом стенде.",
    status: "backlog", priority: "medium", assignee: "maria", reporter: "maxim",
    due: 16, created: -3, tags: ["аналитика"],
  },
  {
    code: "NDF-113", project: "greenstone", title: "SEO-оптимизация посадочных страниц",
    description:
      "Проверить метатеги, заголовки, alt-тексты и скорость загрузки. Подготовить рекомендации по внутренней перелинковке.",
    status: "backlog", priority: "low", assignee: "ilya", reporter: "maxim",
    due: 25, created: -2, tags: ["SEO"],
  },
  {
    code: "NDF-114", project: "greenstone", title: "Дизайн страницы «Контакты»",
    description:
      "Подготовить макет страницы контактов с картой, формой обратной связи и реквизитами. Предусмотреть мобильную версию.",
    status: "done", priority: "medium", assignee: "elena", reporter: "maxim",
    due: -3, created: -18, tags: ["дизайн"],
  },
  {
    code: "NDF-115", project: "greenstone", title: "Сбор требований к личному кабинету",
    description:
      "Провести интервью с клиентом и собрать требования к личному кабинету: история заказов, избранное, адреса доставки. Оценить объём работ.",
    status: "planned", priority: "low", assignee: "anna", reporter: "maxim",
    due: 20, created: -1, tags: ["аналитика", "клиент"],
  },
  {
    code: "NDF-116", project: "campaign", title: "Разработка медиаплана на квартал",
    description:
      "Определить каналы, бюджеты и KPI на квартал. Согласовать медиаплан с операционным директором и зафиксировать контрольные точки.",
    status: "done", priority: "high", assignee: "olga", reporter: "anna",
    due: -7, created: -22, tags: ["маркетинг", "планирование"],
  },
  {
    code: "NDF-117", project: "campaign", title: "Креативы для социальных сетей",
    description:
      "Подготовить комплект креативов для соцсетей: посты, stories и баннеры для таргетинга. Нужны три цветовые версии и тексты по каждому формату.",
    status: "in_progress", priority: "high", assignee: "elena", reporter: "olga",
    due: 2, created: -11, tags: ["маркетинг", "дизайн"],
  },
  {
    code: "NDF-118", project: "campaign", title: "Настройка рекламного кабинета",
    description:
      "Настроить кампании, аудитории и цели в рекламном кабинете. Подключить пиксель и проверить прохождение конверсий.",
    status: "in_progress", priority: "high", assignee: "olga", reporter: "anna",
    due: -1, created: -9, tags: ["маркетинг", "реклама"],
  },
  {
    code: "NDF-119", project: "campaign", title: "Лендинг рекламной кампании",
    description:
      "Собрать лендинг под трафик: первый экран, преимущества, кейсы, форма заявки. Проверить скорость и мобильную вёрстку.",
    status: "review", priority: "high", assignee: "ilya", reporter: "olga",
    due: 4, created: -8, tags: ["frontend", "лендинг"],
  },
  {
    code: "NDF-120", project: "campaign", title: "A/B тест заголовков",
    description:
      "Подготовить гипотезы для A/B теста заголовков лендинга, настроить разбиение трафика и определить метрику успеха.",
    status: "planned", priority: "medium", assignee: "maria", reporter: "olga",
    due: 8, created: -6, tags: ["аналитика", "маркетинг"],
  },
  {
    code: "NDF-121", project: "campaign", title: "Анализ аудитории и сегментов",
    description:
      "Собрать портрет целевой аудитории, выделить ключевые сегменты и подготовить рекомендации по сообщениям для каждого сегмента.",
    status: "done", priority: "medium", assignee: "maria", reporter: "olga",
    due: -12, created: -24, tags: ["аналитика"],
  },
  {
    code: "NDF-122", project: "campaign", title: "Бюджетирование кампании",
    description:
      "Разложить бюджет по каналам и неделям, предусмотреть резерв на тесты. Подготовить сценарий оптимизации при перерасходе.",
    status: "planned", priority: "high", assignee: "olga", reporter: "anna",
    due: 5, created: -4, tags: ["маркетинг", "бюджет"],
  },
  {
    code: "NDF-123", project: "campaign", title: "Тексты для email-рассылки",
    description:
      "Написать серию писем для прогрева базы: тема, прехедер, основной текст и CTA. Проверить tone of voice и отсутствие спам-триггеров.",
    status: "backlog", priority: "low", assignee: "elena", reporter: "olga",
    due: 11, created: -3, tags: ["контент", "email"],
  },
  {
    code: "NDF-124", project: "campaign", title: "Отчёт по первым результатам",
    description:
      "Собрать данные по трафику, конверсиям и стоимости лида. Подготовить отчёт с выводами и планом корректировок на следующую неделю.",
    status: "backlog", priority: "medium", assignee: "olga", reporter: "anna",
    due: 19, created: -2, tags: ["аналитика", "отчётность"],
  },
  {
    code: "NDF-125", project: "automation", title: "Аудит процессов отдела продаж",
    description:
      "Описать текущий процесс продаж, найти узкие места и точки потери лидов. Подготовить карту процесса и список быстрых улучшений.",
    status: "done", priority: "high", assignee: "maria", reporter: "maxim",
    due: -15, created: -30, tags: ["аналитика", "процессы"],
  },
  {
    code: "NDF-126", project: "automation", title: "Схема интеграции CRM и телефонии",
    description:
      "Спроектировать интеграцию CRM с телефонией: события звонков, запись разговоров, привязка к сделке. Согласовать схему с подрядчиком.",
    status: "review", priority: "critical", assignee: "viktor", reporter: "maxim",
    due: 3, created: -13, tags: ["интеграции", "CRM"],
  },
  {
    code: "NDF-127", project: "automation", title: "Настройка воронки в CRM",
    description:
      "Настроить этапы воронки, обязательные поля и автоматические задачи для менеджеров. Проверить переходы между этапами на тестовых сделках.",
    status: "planned", priority: "high", assignee: "maria", reporter: "maxim",
    due: 10, created: -7, tags: ["CRM", "продажи"],
  },
  {
    code: "NDF-128", project: "automation", title: "Автоматизация выставления счетов",
    description:
      "Автоматизировать формирование и отправку счетов из CRM. Предусмотреть шаблоны, статусы оплаты и уведомления бухгалтерии.",
    status: "backlog", priority: "high", assignee: "viktor", reporter: "maxim",
    due: 24, created: -5, tags: ["backend", "автоматизация"],
  },
  {
    code: "NDF-129", project: "automation", title: "Дашборд руководителя отдела продаж",
    description:
      "Собрать дашборд с ключевыми метриками: воронка, конверсия, средний чек, нагрузка менеджеров. Добавить фильтры по периоду и направлению.",
    status: "in_progress", priority: "medium", assignee: "viktor", reporter: "maxim",
    due: -4, created: -16, tags: ["аналитика", "дашборд"],
  },
  {
    code: "NDF-130", project: "automation", title: "Обучение менеджеров работе с CRM",
    description:
      "Подготовить программу обучения и инструкцию по CRM. Провести два практических занятия и собрать обратную связь.",
    status: "backlog", priority: "low", assignee: "maria", reporter: "maxim",
    due: 30, created: -3, tags: ["обучение"],
  },
  {
    code: "NDF-131", project: "automation", title: "Тестирование интеграции с телефонией",
    description:
      "Проверить сценарии входящих и исходящих звонков, запись и привязку к сделкам. Зафиксировать дефекты и проверить исправления.",
    status: "backlog", priority: "medium", assignee: "dmitry", reporter: "maxim",
    due: 17, created: -2, tags: ["QA", "интеграции"],
  },
  {
    code: "NDF-132", project: "automation", title: "Регламент работы с лидами",
    description:
      "Описать правила обработки лидов, SLA по ответу и порядок эскалации. Согласовать регламент с руководителем отдела продаж.",
    status: "planned", priority: "low", assignee: "maria", reporter: "maxim",
    due: 13, created: -1, tags: ["процессы"],
  },
  {
    code: "NDF-133", project: "automation", title: "Миграция клиентской базы",
    description:
      "Подготовить план миграции клиентской базы в новую CRM: очистка, дедупликация, маппинг полей и контрольный прогон на копии.",
    status: "backlog", priority: "critical", assignee: "viktor", reporter: "maxim",
    due: 35, created: -1, tags: ["CRM", "миграция"],
  },
];

const COMMENTS = [
  ["NDF-101", "maxim", 3, "Елена, привет! Клиент просил сделать акцент на каталоге, но не потерять блок с преимуществами. Покажи два варианта, пожалуйста."],
  ["NDF-101", "elena", 2, "Принято. Первый вариант будет с крупной витриной товаров, второй — с акцентом на историю бренда. К вечеру выложу оба."],
  ["NDF-102", "maxim", 1, "Прототип получился понятный. Добавь, пожалуйста, состояние «нет товаров в фильтре» — клиент отдельно про это спрашивал."],
  ["NDF-103", "ilya", 2, "Вёрстка идёт по плану: хедер и hero готовы, сегодня закрою блок преимуществ. По срокам успеваю."],
  ["NDF-105", "viktor", 1, "Нашёл узкое место в фильтрах: при комбинации категории и цены запрос уходит в полный скан. Оптимизирую индексы."],
  ["NDF-105", "maxim", 0.7, "Давай вынесем это в отдельную подзадачу, чтобы не растягивать текущий спринт. Добавь оценку в комментарий."],
  ["NDF-108", "dmitry", 2, "Начал составлять тест-план. Основной риск — оплата и промокоды, предлагаю начать с них."],
  ["NDF-117", "olga", 2, "Добавь, пожалуйста, версию для stories 9:16 и отдельный квадратный баннер для таргета."],
  ["NDF-117", "elena", 1, "Сделала три формата: пост, stories и баннер. Ссылка на папку — во вложениях."],
  ["NDF-118", "olga", 0.15, "Кабинет настроен, но не приходят конверсии по форме. Проверяю пиксель и события, жду доступы от подрядчика."],
  ["NDF-119", "ilya", 1, "Собрал лендинг, отправил на проверку. Скорость на мобильных 92, осталось поправить пару отступов."],
  ["NDF-126", "viktor", 2, "Схема готова. Нужен review от Максима по событиям звонков и полям сделки."],
  ["NDF-127", "maria", 0.2, "Согласовала этапы воронки с отделом продаж. Настраиваю обязательные поля и автозадачи."],
  ["NDF-129", "maria", 1, "Добавила метрики по воронке и среднему чеку. Не хватает данных по нагрузке менеджеров — уточню у Виктора."],
];

const HISTORY = [
  ["NDF-101", "maxim", "updated", "status", "Бэклог", "В работе", 6],
  ["NDF-101", "maxim", "updated", "priority", "Средний", "Высокий", 6],
  ["NDF-102", "elena", "updated", "status", "В работе", "На проверке", 1],
  ["NDF-103", "maxim", "updated", "status", "Запланировано", "В работе", 4],
  ["NDF-105", "viktor", "updated", "status", "Запланировано", "В работе", 8],
  ["NDF-105", "maxim", "updated", "priority", "Высокий", "Критический", 3],
  ["NDF-110", "elena", "updated", "status", "На проверке", "Выполнено", 5],
  ["NDF-118", "olga", "updated", "due_date", "2026-11-09", "2026-11-12", 2],
  ["NDF-119", "ilya", "updated", "status", "В работе", "На проверке", 1],
  ["NDF-125", "maria", "updated", "status", "На проверке", "Выполнено", 8],
  ["NDF-129", "maxim", "updated", "assignee", "Мария Белова", "Виктор Лебедев", 5],
  ["NDF-129", "maria", "comment_added", null, null, "Добавила метрики по воронке и среднему чеку.", 1],
  ["NDF-126", "viktor", "comment_added", null, null, "Схема готова. Нужен review от Максима по событиям звонков и полям сделки.", 2],
];

const ATTACHMENTS = [
  ["NDF-101", "elena", "link", "Макеты в Figma", "https://www.figma.com/file/demo-greenstone-home", 3],
  ["NDF-103", "ilya", "link", "Дизайн-макет главной", "https://www.figma.com/file/demo-greenstone-design", 4],
  ["NDF-105", "viktor", "link", "Спецификация API каталога", "https://docs.google.com/document/d/demo-api-spec", 5],
  ["NDF-108", "dmitry", "link", "Черновик тест-плана", "https://docs.google.com/document/d/demo-test-plan", 2],
  ["NDF-117", "elena", "link", "Креативы кампании", "https://drive.google.com/drive/folders/demo-creatives", 1],
  ["NDF-119", "ilya", "link", "Превью лендинга", "https://nordflow.example.com/landing-preview", 1],
  ["NDF-126", "viktor", "link", "Схема интеграции в Miro", "https://miro.com/app/board/demo-crm-telephony", 2],
  ["NDF-126", "viktor", "file", "integration-schema.txt", "/uploads/attachments/demo-integration-schema.txt", 2],
];

const DEMO_NOTIFICATIONS = [
  ["elena", "assigned", "Вам назначена задача NDF-102", "«Прототип каталога товаров» · проект «GreenStone»", "NDF-102", 3, 1],
  ["elena", "comment", "Новый комментарий к NDF-101", "Максим: «Клиент просил сделать акцент на каталоге...»", "NDF-101", 2, 0],
  ["elena", "status_changed", "Статус задачи NDF-102 изменён", "Новый статус: На проверке.", "NDF-102", 1, 0],
  ["ilya", "assigned", "Вам назначена задача NDF-119", "«Лендинг рекламной кампании» · проект «Запуск рекламной кампании NordFlow»", "NDF-119", 4, 1],
  ["ilya", "comment", "Новый комментарий к NDF-103", "Илья: «Вёрстка идёт по плану...»", "NDF-103", 2, 0],
  ["viktor", "assigned", "Вам назначена задача NDF-105", "«API каталога и фильтров» · проект «GreenStone»", "NDF-105", 5, 1],
  ["viktor", "comment", "Новый комментарий к NDF-105", "Максим: «Давай вынесем это в отдельную подзадачу...»", "NDF-105", 0.7, 0],
  ["olga", "comment", "Новый комментарий к NDF-117", "Елена: «Сделала три формата: пост, stories и баннер...»", "NDF-117", 1, 0],
  ["olga", "assigned", "Вам назначена задача NDF-118", "«Настройка рекламного кабинета» · проект «Запуск рекламной кампании NordFlow»", "NDF-118", 6, 1],
  ["dmitry", "assigned", "Вам назначена задача NDF-108", "«Тест-план клиентской части» · проект «GreenStone»", "NDF-108", 2, 0],
  ["maria", "assigned", "Вам назначена задача NDF-127", "«Настройка воронки в CRM» · проект «Внутренняя автоматизация отдела продаж»", "NDF-127", 2, 0],
  ["maxim", "comment", "Новый комментарий к NDF-101", "Елена: «Принято. Первый вариант будет с крупной витриной товаров...»", "NDF-101", 2, 0],
  ["maxim", "status_changed", "Статус задачи NDF-102 изменён", "Новый статус: На проверке.", "NDF-102", 1, 0],
  ["anna", "project_added", "Вы добавлены в проект", "Проект «Разработка сайта для клиента «GreenStone»».", null, 20, 1],
  ["anna", "assigned", "Вам назначена задача NDF-115", "«Сбор требований к личному кабинету» · проект «GreenStone»", "NDF-115", 1, 0],
];

function ago(days = 0, hours = 0) {
  return new Date(Date.now() - days * 86400000 - hours * 3600000).toISOString();
}

function dueDate(offsetDays) {
  return dateOnly(addDays(new Date(), offsetDays));
}

export async function seedDemoData({ force = false } = {}) {
  await initSchema();

  if (force) {
    await resetData();
  } else {
    const existing = await get("SELECT COUNT(*) AS c FROM users");
    if (Number(existing?.c || 0) > 0) {
      return { seeded: false };
    }
  }

  const userIds = {};
  for (const user of USERS) {
    const hash = await bcrypt.hash(user.password, 10);
    const id = await insert(
      `INSERT INTO users
        (email, password_hash, first_name, last_name, position, role, avatar_url, theme, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, NULL, 'light', 1, ?)`,
      [user.email, hash, user.first_name, user.last_name, user.position, user.role, ago(90)],
    );
    userIds[user.key] = id;
  }

  const projectIds = {};
  for (const project of PROJECTS) {
    const timestamp = ago(30);
    const id = await insert(
      `INSERT INTO projects
        (name, description, manager_id, start_date, due_date, status, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        project.name,
        project.description,
        userIds[project.manager],
        dueDate(project.start),
        dueDate(project.due),
        project.status,
        userIds.anna,
        timestamp,
        timestamp,
      ],
    );
    projectIds[project.key] = id;

    await run(
      "INSERT INTO project_members (project_id, user_id, can_create_tasks, added_at) VALUES (?, ?, 1, ?)",
      [id, userIds[project.manager], timestamp],
    );
    for (const [memberKey, canCreate] of project.members) {
      await run(
        "INSERT INTO project_members (project_id, user_id, can_create_tasks, added_at) VALUES (?, ?, ?, ?)",
        [id, userIds[memberKey], canCreate ? 1 : 0, timestamp],
      );
    }
  }

  const taskIds = {};
  for (const task of TASKS) {
    const createdAt = ago(-task.created, 2);
    const completedAt = task.status === "done" ? ago(1) : null;
    const id = await insert(
      `INSERT INTO tasks
        (code, project_id, title, description, status, priority, assignee_id, reporter_id,
         due_date, tags, created_at, updated_at, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        task.code,
        projectIds[task.project],
        task.title,
        task.description,
        task.status,
        task.priority,
        userIds[task.assignee],
        userIds[task.reporter],
        dueDate(task.due),
        JSON.stringify(task.tags),
        createdAt,
        ago(0.5),
        completedAt,
      ],
    );
    taskIds[task.code] = id;

    await run(
      `INSERT INTO task_history (task_id, user_id, action, field, old_value, new_value, created_at)
       VALUES (?, ?, 'created', NULL, NULL, ?, ?)`,
      [id, userIds[task.reporter], task.title, createdAt],
    );
  }

  for (const [code, authorKey, daysAgo, body] of COMMENTS) {
    const createdAt = ago(daysAgo, 3);
    await insert(
      "INSERT INTO comments (task_id, user_id, body, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
      [taskIds[code], userIds[authorKey], body, createdAt, createdAt],
    );
  }

  for (const [code, actorKey, action, field, oldValue, newValue, daysAgo] of HISTORY) {
    await run(
      `INSERT INTO task_history (task_id, user_id, action, field, old_value, new_value, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [taskIds[code], userIds[actorKey], action, field, oldValue, newValue, ago(daysAgo, 2)],
    );
  }

  const demoFilePath = path.join(
    UPLOADS_ROOT,
    "attachments",
    "demo-integration-schema.txt",
  );
  fs.mkdirSync(path.dirname(demoFilePath), { recursive: true });
  fs.writeFileSync(
    demoFilePath,
    [
      "Схема интеграции CRM и телефонии (демо-файл)",
      "",
      "1. Входящий звонок → событие telephony.incoming",
      "2. CRM создаёт карточку звонка и привязывает её к сделке",
      "3. Запись разговора сохраняется в карточке",
      "4. После завершения звонка менеджеру ставится задача на follow-up",
      "",
      "Ответственный: Виктор Лебедев",
      "Проект: Внутренняя автоматизация отдела продаж",
    ].join("\n"),
    "utf8",
  );

  for (const [code, authorKey, kind, name, url, daysAgo] of ATTACHMENTS) {
    await insert(
      `INSERT INTO attachments (task_id, user_id, kind, name, url, mime, size, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        taskIds[code],
        userIds[authorKey],
        kind,
        name,
        url,
        kind === "file" ? "text/plain" : null,
        kind === "file" ? 512 : null,
        ago(daysAgo, 1),
      ],
    );
  }

  for (const [userKey, type, title, body, code, daysAgo, isRead] of DEMO_NOTIFICATIONS) {
    await insert(
      `INSERT INTO notifications
        (user_id, type, title, body, task_id, project_id, is_read, dedupe_key, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
      [
        userIds[userKey],
        type,
        title,
        body,
        code ? taskIds[code] : null,
        code ? (await get("SELECT project_id FROM tasks WHERE id = ?", [taskIds[code]]))?.project_id : projectIds.greenstone,
        isRead,
        ago(daysAgo, 1),
      ],
    );
  }

  await setSetting("task_seq", "133");
  await setSetting("seeded_at", nowIso());

  console.log(
    `[seed] демо-данные созданы: ${USERS.length} пользователей, ${PROJECTS.length} проекта, ${TASKS.length} задач`,
  );
  return { seeded: true };
}

if (process.argv[1] && process.argv[1].endsWith("seed.js")) {
  const force = process.argv.includes("--force");
  seedDemoData({ force })
    .then(async (result) => {
      if (!result.seeded) console.log("[seed] данные уже существуют, пропускаю. Используйте --force.");
      const { closeDb } = await import("./db.js");
      await closeDb();
      process.exit(0);
    })
    .catch((error) => {
      console.error("[seed] ошибка:", error);
      process.exit(1);
    });
}
