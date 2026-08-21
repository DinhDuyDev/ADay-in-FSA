// minigame_data.js -- ported from minigame_data.py
export const ORDERING_GAMES = {
  id_desk: {
    prompt: "You are preparing a course for the accounting department. In which order will you perform these tasks for the course prep?",
    items: [
      { id: "powerpoint", text: "Open PowerPoint and build slides from policy documents." },
      { id: "ask", text: "Ask the requestee again: what needs to happen?" },
      { id: "results", text: "Determine what difference will the learner get after the course?" },
      { id: "sme", text: "Ask SME for review" },
    ],
    correct_order: ["ask", "results", "sme", "powerpoint"],
  },
};

export const QUIZ_GAMES = {
  teammate1: {
    question: "How would you respond??",
    answers: [
      { text: "I will make you the slide, and send it by the weekend.", correct: false },
      { text: "Before I do, can I ask where is the employee wrong?", correct: true },
      { text: "I'll do it, but we should agree on this: after training, what should the employee be able to do?", correct: true },
    ],
  },
};

export const CHARACTER_TYPES = [
  { id: "oddball", title: "The Teacher", description: "The professional teacher who delivers lessons to the best of their abilities." },
  { id: "professional", title: "The Coworker", description: "Polished look, fluent delivery, confident energy." },
  { id: "shapeshifter", title: "The Professional", description: "The Professional, who is always ready to deliver an amazing class!" },
  { id: "familiar", title: "The Student", description: "The one who sits in class, and listens attentively to the teacher." },
  { id: "antagonist", title: "The Technician", description: "The one who wants to improve the learning platform as much as possible." },
  { id: "mythical", title: "The TA", description: "The one who keeps the class well-oiled, helping the teacher." },
];

export const CHARACTER_GAMES = {
  teammate2_character: {
    types: CHARACTER_TYPES,
    descriptions: [
      "Confident and full of energy",
      "Calm, thoughtful, and precise",
      "Bold, unexpected, a little wild",
      "Warm, approachable, easy to trust",
    ],
    result_sprites: [], // filled in at runtime by main.js
  },
};

export const VIDEO_TRIM_GAMES = {
  teammate2_trim: { prompt: "Trim the intro video down to just the highlight." },
};
