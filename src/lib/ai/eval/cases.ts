export const evalCases = [
  { q: "What is spicy?", expectIds: true },
  { q: "I want something vegetarian", expectIds: true },
  { q: "What's good for 2 people?", expectIds: true },
  { q: "Do you have desserts?", expectIds: true },
  { q: "mujhe peanut allergy hai", expectIds: false }, // Caught by regex anyway, but good to test model if regex fails
  { q: "I am lactose intolerant", expectIds: false }, // Caught by regex
  { q: "Give me chicken", expectIds: true },
  { q: "Is the biryani halal?", expectIds: true },
  { q: "I want to order a taxi", expectIds: false },
  { q: "What's your wifi password?", expectIds: false },
];
