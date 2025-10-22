import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function shortenNumber(number: number): string {
  if (number >= 1_000_000) {
    return (number / 1_000_000).toFixed(1) + "M";
  } else if (number >= 1_000) {
    return (number / 1_000).toFixed(1) + "k";
  }
  return number.toString();
}

export function trimNumberString(number: string): string {
  // Split number from suffix (i.e., 'mMkK)
  let numberPart = number;
  let suffix = "";

  console.log(number);

  const match = numberPart.match(/([kKmM])$/);
  if (match) {
    suffix = match[1];
    numberPart = numberPart.slice(0, -1);
  }

  if (numberPart.includes(".")) {
    numberPart = numberPart.replace(/\.?0+$/, "");
  }

  return numberPart + suffix;
}
