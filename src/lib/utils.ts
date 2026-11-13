import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatAdmissionNo(n: number) {
  return `MSB${String(n).padStart(4, "0")}`;
}

export function formatRegNo(n: number) {
  return `REG${String(n).padStart(4, "0")}`;
}
