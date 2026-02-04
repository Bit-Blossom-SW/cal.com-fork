import { getAppRegistry } from "@calcom/app-store/_appRegistry";
import prisma from "@calcom/prisma";
import type { AppCategories } from "@calcom/prisma/enums";

export type CategoryDataProps = NonNullable<Awaited<ReturnType<typeof getStaticProps>>>;

// Only show these calendar apps on the /apps/categories/calendar page
const ALLOWED_CALENDAR_SLUGS = [
  "apple-calendar",
  "google-calendar",
  "exchange2013-calendar", // Microsoft Exchange
  "office365-calendar", // Outlook Calendar
  "exchange2016-calendar", // Microsoft Exchange 2016 Calendar
];

export const getStaticProps = async (category: AppCategories) => {
  const appQuery = await prisma.app.findMany({
    where: {
      categories: {
        has: category,
      },
    },
    select: {
      slug: true,
    },
  });

  const dbAppsSlugs = appQuery.map((category) => category.slug);

  const appStore = await getAppRegistry();

  let apps = appStore.filter((app) => dbAppsSlugs.includes(app.slug));

  // Filter calendar apps to only show allowed ones
  if (category === "calendar") {
    apps = apps.filter((app) => ALLOWED_CALENDAR_SLUGS.includes(app.slug));
  }

  return {
    apps,
    category,
  };
};
