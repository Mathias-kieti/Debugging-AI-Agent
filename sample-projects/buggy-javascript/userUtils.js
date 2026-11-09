/**
 * User profile utilities
 */
export function formatUserProfile(user) {
  // Bug: user or user.profile might be undefined, causing TypeError: Cannot read properties of undefined
  return user?.profile?.name?.toUpperCase();
}

export function calculateDiscount(price, rate) {
  if (price < 0) return 0;
  return price - (price * rate);
}
