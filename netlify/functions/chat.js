/* Tuteur IA par matière — fonction Netlify.
   La clé API reste côté serveur : ajoute ANTHROPIC_API_KEY dans
   Netlify > Site configuration > Environment variables.
   Variable optionnelle : CHAT_MODEL (par défaut claude-haiku-5-5). */
"use strict";

const BASE = [
  "Tu es un tuteur patient et encourageant pour un élève de niveau secondaire ou collégial au Québec.",
  "Réponds en français, avec des phrases courtes et un ton simple.",
  "Explique la démarche étape par étape et vérifie la compréhension avec une petite question quand c'est utile.",
  "Si on te demande directement la réponse à un exercice, donne la démarche complète et la réponse, avec l'explication, pour que l'élève comprenne.",
  "N'utilise pas LaTeX : écris les formules en texte simple (x², √(x), a/b, π, ∫).",
  "Garde tes réponses courtes (une dizaine de lignes au plus) sauf si l'élève demande plus de détails.",
  "Si la question n'a aucun rapport avec la matière, ramène poliment la discussion vers l'étude.",
].join(" ");

const SUBJECTS = {
  maths: "Matière : mathématiques (arithmétique, algèbre, fonctions, géométrie, trigonométrie, probabilités, calcul différentiel et intégral).",
  francais: "Matière : français (grammaire, orthographe, conjugaison, analyse de texte, rédaction, dissertation). Corrige les erreurs en expliquant la règle.",
  anglais: "Matière : anglais langue seconde. Aide à pratiquer : écris les exemples en anglais, explique les règles en français, corrige les phrases de l'élève et propose une version améliorée.",
  physique: "Matière : physique (mécanique, électricité, ondes, optique, énergie). Rappelle les unités et vérifie-les dans les calculs.",
  chimie: "Matière : chimie (matière, tableau périodique, réactions, stœchiométrie, solutions, acides et bases). Montre les unités et les bilans de masse.",
  biologie: "Matière : biologie (cellule, génétique, corps humain, écologie, évolution).",
  histoire: "Matière : histoire et éducation à la citoyenneté (Québec, Canada, monde). Donne des repères chronologiques et distingue les faits des interprétations.",
  philo: "Matière : philosophie et éthique. Présente plusieurs points de vue, aide à structurer une argumentation et pose des questions qui font réfléchir.",
  informatique: "Matière : informatique et programmation (Python, JavaScript, HTML/CSS, logique, algorithmes). Montre de petits exemples de code commentés et explique les erreurs.",
  libre: "Matière : méthode de travail (planifier ses études, résumer, mémoriser, préparer un examen, organiser un travail). Donne des conseils concrets et réalistes.",
};

const MAX_MESSAGES = 20;
const MAX_CHARS = 2000;
const RATE_PER_MINUTE = 12;
const hits = new Map();

function limited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 60000);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > RATE_PER_MINUTE;
}

function reply(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
    body: JSON.stringify(body),
  };
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return reply(405, { error: "method", message: "Méthode non permise." });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return reply(503, { error: "no_key", message: "Le tuteur IA n'est pas encore configuré." });

  const headers = event.headers || {};
  const ip = headers["x-nf-client-connection-ip"] || (headers["x-forwarded-for"] || "").split(",")[0].trim() || "inconnu";
  if (limited(ip)) return reply(429, { error: "rate", message: "Doucement ! Attends une minute avant de reposer une question." });

  let data;
  try { data = JSON.parse(event.body || "{}"); } catch (e) { return reply(400, { error: "json", message: "Requête invalide." }); }

  const subject = data && data.subject;
  if (typeof subject !== "string" || !Object.prototype.hasOwnProperty.call(SUBJECTS, subject)) {
    return reply(400, { error: "subject", message: "Matière inconnue." });
  }

  const msgs = data.messages;
  if (!Array.isArray(msgs) || msgs.length < 1 || msgs.length > MAX_MESSAGES) {
    return reply(400, { error: "messages", message: "Conversation invalide." });
  }
  const clean = [];
  for (const m of msgs) {
    if (!m || (m.role !== "user" && m.role !== "assistant") || typeof m.content !== "string") {
      return reply(400, { error: "messages", message: "Conversation invalide." });
    }
    const content = m.content.trim();
    if (!content || content.length > MAX_CHARS) {
      return reply(400, { error: "length", message: "Message vide ou trop long (max " + MAX_CHARS + " caractères)." });
    }
    clean.push({ role: m.role, content });
  }
  if (clean[0].role !== "user" || clean[clean.length - 1].role !== "user") {
    return reply(400, { error: "messages", message: "Conversation invalide." });
  }

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: process.env.CHAT_MODEL || "claude-haiku-5-5",
        max_tokens: 800,
        system: BASE + " " + SUBJECTS[subject],
        messages: clean,
      }),
    });
    if (!res.ok) {
      console.error("Anthropic API", res.status);
      return reply(502, { error: "upstream", message: "Le tuteur IA est indisponible pour le moment. Réessaie plus tard." });
    }
    const out = await res.json();
    const text = (out.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
    if (!text) return reply(502, { error: "empty", message: "Réponse vide. Reformule ta question." });
    return reply(200, { reply: text });
  } catch (e) {
    console.error("chat error", e && e.message);
    return reply(502, { error: "upstream", message: "Le tuteur IA est indisponible pour le moment. Réessaie plus tard." });
  }
};

exports.SUBJECT_IDS = Object.keys(SUBJECTS);
