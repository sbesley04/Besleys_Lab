// Single source of truth for the experiments bench at /lab. The hub page maps
// over this list, so adding a demo is a one-line change here plus a folder at
// app/lab/<slug>/.
//
// Mirrors app/games/registry.ts deliberately — same shape, same discipline.
// `topic` groups demos on the hub; `takeaway` is the one-line "what you'll
// learn" shown under the title.
export interface DemoMeta {
  slug: string;
  title: string;
  blurb: string;
  takeaway: string;
  topic: "optimization" | "models" | "networks" | "probability" | "language" | "rl";
}

export const TOPIC_LABELS: Record<DemoMeta["topic"], string> = {
  optimization: "Optimization",
  models: "Classic models",
  networks: "Neural networks",
  probability: "Probability",
  language: "Language",
  rl: "Reinforcement learning",
};

export const demos: DemoMeta[] = [
  {
    slug: "gradient-descent",
    title: "Gradient Descent",
    blurb: "Drop a marble on a loss surface and watch it roll. Race SGD, momentum, and Adam.",
    takeaway: "Why the learning rate is the first knob you touch — and the first one that ruins a run.",
    topic: "optimization",
  },
  {
    slug: "lr-schedules",
    title: "Learning-Rate Schedules",
    blurb: "Constant, step decay, cosine annealing, and warmup — side by side.",
    takeaway: "Big steps early, small steps late: why schedules beat any single learning rate.",
    topic: "optimization",
  },
  {
    slug: "k-means",
    title: "k-Means Clustering",
    blurb: "Scatter your own points, pick k, and step through assign and update by hand.",
    takeaway: "How a good algorithm still lands in a bad answer when it starts in the wrong place.",
    topic: "models",
  },
  {
    slug: "svm",
    title: "SVM & the Kernel Trick",
    blurb: "Drag points around a margin, then lift a tangle into a plane where a line works.",
    takeaway: "Why the widest street between classes generalizes — and how kernels make one exist.",
    topic: "models",
  },
  {
    slug: "regression",
    title: "Linear vs. Logistic",
    blurb: "Place points and watch the fit chase them, residuals drawn in pencil.",
    takeaway: "The same machinery predicting a number versus predicting a probability.",
    topic: "models",
  },
  {
    slug: "xor-net",
    title: "A Net Learns XOR",
    blurb: "Two inputs, two hidden units, one output — training in front of you, weight by weight.",
    takeaway: "The moment a hidden layer invents the feature that makes the problem linear.",
    topic: "networks",
  },
  {
    slug: "bayes",
    title: "Bayes' Theorem",
    blurb: "A rare disease, an accurate test, and a positive result. Now what?",
    takeaway: "Why a 99%-accurate test can still be wrong most of the time it says yes.",
    topic: "probability",
  },
  {
    slug: "markov-blog",
    title: "Markov Blog Machine",
    blurb: "An n-gram chain trained live on this site's own posts. Slide n from noise to me.",
    takeaway: "How much of writing is just conditional probability over the last few words.",
    topic: "language",
  },
  {
    slug: "q-learning",
    title: "Q-Learning Gridworld",
    blurb: "An agent learns to cross a hazardous grid with no idea what the rules are.",
    takeaway: "How a value table turns random flailing into a policy, one reward at a time.",
    topic: "rl",
  },
];
