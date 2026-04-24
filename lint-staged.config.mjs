export default {
  "*.{ts,tsx}": [
    "eslint --fix",
    // tsc -b must not receive individual file paths; wrap in a fn to drop them
    () => "tsc -b --noCheck",
  ],
};
