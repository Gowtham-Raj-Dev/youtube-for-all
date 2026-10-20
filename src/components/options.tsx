import { Globe, Link2, Lock } from "lucide-react";
import { YT_CATEGORIES, type Privacy } from "../lib/settings";
import type { DropdownOption } from "./ui";

export const PRIVACY_OPTIONS: DropdownOption<Privacy>[] = [
  { value: "public", label: "Public", hint: "Everyone can find and watch it", icon: <Globe className="size-4" /> },
  { value: "unlisted", label: "Unlisted", hint: "Only people with the link", icon: <Link2 className="size-4" /> },
  { value: "private", label: "Private", hint: "Only you", icon: <Lock className="size-4" /> },
];

export const CATEGORY_OPTIONS: DropdownOption<string>[] = YT_CATEGORIES.map(([value, label]) => ({ value, label }));
