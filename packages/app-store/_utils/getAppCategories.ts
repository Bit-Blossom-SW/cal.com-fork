import { WEBAPP_URL } from "@calcom/lib/constants";
import type { AppCategories } from "@calcom/prisma/enums";
import type { IconName } from "@calcom/ui/components/icon";

function getHref(baseURL: string, category: string, useQueryParam: boolean) {
  const baseUrlParsed = new URL(baseURL, WEBAPP_URL);
  baseUrlParsed.searchParams.set("category", category);
  return useQueryParam ? `${baseUrlParsed.toString()}` : `${baseURL}/${category}`;
}

type AppCategoryEntry = {
  name: AppCategories;
  href: string;
  icon: IconName;
  "data-testid": string;
};

const getAppCategories = (baseURL: string, useQueryParam: boolean): AppCategoryEntry[] => {
  // Manually sorted alphabetically, but leaving "Other" at the end
  // TODO: Refactor and type with Record<AppCategories, AppCategoryEntry> to enforce consistency
  return [
    {
      name: "calendar",
      href: getHref(baseURL, "calendar", useQueryParam),
      icon: "calendar",
      "data-testid": "calendar",
    },
  ];
};

export default getAppCategories;
