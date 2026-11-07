import {clsx, type ClassValue} from "clsx";
import {twMerge} from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function reorder<T>(list: T[], startIndex: number, endIndex: number) {
  let result = [...list];
  let [removed] = result.splice(startIndex, 1);
  result.splice(endIndex, 0, removed);
  return result;
}
