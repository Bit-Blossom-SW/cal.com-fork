"use client";

import { AppCard } from "@calcom/features/apps/components/AppCard";
import Shell from "@calcom/features/shell/Shell";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { SkeletonText } from "@calcom/ui/components/skeleton";

import type { CategoryDataProps } from "@lib/apps/categories/[category]/getStaticProps";

export default function Apps({ apps, category }: CategoryDataProps) {
  const { t, isLocaleReady } = useLocale();

  return (
    <>
      <Shell
        isPublic
        title={t("app_store")}
        description={t("app_store_description")}
        smallHeading
        heading={
          <>
            {isLocaleReady ? (
              category === "calendar" ? (
                t("connect_your_calendar")
              ) : category ? (
                t("category_apps", { category: category[0].toUpperCase() + category?.slice(1) })
              ) : (
                t("app_store")
              )
            ) : (
              <SkeletonText className="h-4 w-24" />
            )}
          </>
        }>
        <div className="mb-16">
          <div className="grid-col-1 grid grid-cols-1 gap-3 md:grid-cols-3">
            {apps
              ?.sort((a, b) => (b.installCount || 0) - (a.installCount || 0))
              .map((app) => {
                return <AppCard key={app.slug} app={app} />;
              })}
          </div>
        </div>
      </Shell>
    </>
  );
}
