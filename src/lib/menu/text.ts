import { getTranslations } from "next-intl/server";
import type { MenuText } from "@/components/menu/MenuText";
import { buttonVariants } from "@/components/ui/button";

export async function getMenuText(): Promise<MenuText> {
  const t = await getTranslations("menu");
  return {
    title: t("title"), search: t("search"), categories: t("categories"), loading: t("loading"),
    loadError: t("loadError"), retry: t("retry"), all: t("all"), vegOnly: t("vegOnly"),
    vegetarian: t("vegetarian"), nonVegetarian: t("nonVegetarian"), soldOut: t("soldOut"),
    noResults: t("noResults"), empty: t("empty"), BESTSELLER: t("BESTSELLER"),
    CHEFS_SPECIAL: t("CHEFS_SPECIAL"), NEW: t("NEW"),
    spiceLevels: [0, 1, 2, 3].map((level) => t("spice", { level })),
    retryButtonClass: buttonVariants(),
  };
}
