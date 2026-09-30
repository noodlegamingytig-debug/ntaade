export const ASHESI_DOMAIN = '@ashesi.edu.gh'

/** UI-side check only — the database trigger on auth.users is the real gate. */
export function isAshesiEmail(email: string): boolean {
  return /^[^\s@]+@ashesi\.edu\.gh$/i.test(email.trim())
}
