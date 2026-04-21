import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { KV_USER_ID } from "./constants"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getUserId(): string {
  try {
    let id = localStorage.getItem(KV_USER_ID)
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem(KV_USER_ID, id)
    }
    return id
  } catch {
    return 'anonymous'
  }
}
