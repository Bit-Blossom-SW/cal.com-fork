import { useSession } from "next-auth/react";
import { useMemo } from "react";

import { useIsEmbed } from "@calcom/embed-core/embed-iframe";
import UnconfirmedBookingBadge from "@calcom/features/bookings/UnconfirmedBookingBadge";
import {
  useOrgBranding,
  type OrganizationBranding,
} from "@calcom/features/ee/organizations/context/provider";
import classNames from "@calcom/ui/classNames";

// TeamInviteBadge removed - teams nav item hidden
import type { NavigationItemType } from "./NavigationItem";
import { NavigationItem, MobileNavigationItem, MobileNavigationMoreItem } from "./NavigationItem";

export const MORE_SEPARATOR_NAME = "more";

const getNavigationItems = (orgBranding: OrganizationBranding): NavigationItemType[] => [
  {
    name: "bookings",
    href: "/bookings/upcoming",
    icon: "calendar",
    badge: <UnconfirmedBookingBadge />,
    isCurrent: ({ pathname }) => pathname?.startsWith("/bookings") ?? false,
  },
  {
    name: "availability",
    href: "/availability/3",
    icon: "clock",
    isCurrent: ({ pathname }) => pathname?.startsWith("/availability") ?? false,
  },
  ...(orgBranding
    ? [
        {
          name: "members",
          href: `/settings/organizations/${orgBranding.slug}/members`,
          icon: "building",
          moreOnMobile: true,
        } satisfies NavigationItemType,
      ]
    : []),
  {
    name: "apps",
    href: "/apps/categories/calendar",
    icon: "grid-3x3",
    moreOnMobile: true,
    isCurrent: ({ pathname: path }) => path?.startsWith("/apps") ?? false,
  },
  {
    name: MORE_SEPARATOR_NAME,
    href: "/more",
    icon: "ellipsis",
  },
  {
    name: "insights",
    href: "/insights",
    icon: "chart-bar",
    isCurrent: ({ pathname: path, item }) => path?.startsWith(item.href) ?? false,
    moreOnMobile: true,
    child: [
      {
        name: "bookings",
        href: "/insights",
        isCurrent: ({ pathname: path }) => path === "/insights",
      },
      {
        name: "routing",
        href: "/insights/routing",
        isCurrent: ({ pathname: path }) => path?.startsWith("/insights/routing") ?? false,
      },
      {
        name: "router_position",
        href: "/insights/router-position",
        isCurrent: ({ pathname: path }) => path?.startsWith("/insights/router-position") ?? false,
      },
    ],
  },
];

const platformNavigationItems: NavigationItemType[] = [
  {
    name: "Dashboard",
    href: "/settings/platform/",
    icon: "layout-dashboard",
  },
  {
    name: "Documentation",
    href: "https://docs.cal.com/docs/platform",
    icon: "chart-bar",
    target: "_blank",
  },
  {
    name: "API reference",
    href: "https://api.cal.com/v2/docs#/",
    icon: "terminal",
    target: "_blank",
  },
  {
    name: "Atoms",
    href: "https://docs.cal.com/docs/platform#atoms",
    icon: "atom",
    target: "_blank",
  },
  {
    name: MORE_SEPARATOR_NAME,
    href: "https://docs.cal.com/docs/platform/faq",
    icon: "ellipsis",
    target: "_blank",
  },
  {
    name: "Billing",
    href: "/settings/platform/billing",
    icon: "credit-card",
    moreOnMobile: true,
  },
  {
    name: "Members",
    href: "/settings/platform/members",
    icon: "users",
    moreOnMobile: true,
  },
  {
    name: "Managed Users",
    href: "/settings/platform/managed-users",
    icon: "users",
    moreOnMobile: true,
  },
];

const useNavigationItems = (isPlatformNavigation = false) => {
  const orgBranding = useOrgBranding();
  return useMemo(() => {
    const items = !isPlatformNavigation ? getNavigationItems(orgBranding) : platformNavigationItems;

    const desktopNavigationItems = items.filter((item) => item.name !== MORE_SEPARATOR_NAME);
    const mobileNavigationBottomItems = items.filter(
      (item) => (!item.moreOnMobile && !item.onlyDesktop) || item.name === MORE_SEPARATOR_NAME
    );
    const mobileNavigationMoreItems = items.filter(
      (item) => item.moreOnMobile && !item.onlyDesktop && item.name !== MORE_SEPARATOR_NAME
    );

    return { desktopNavigationItems, mobileNavigationBottomItems, mobileNavigationMoreItems };
  }, [isPlatformNavigation, orgBranding]);
};

export const Navigation = ({ isPlatformNavigation = false }: { isPlatformNavigation?: boolean }) => {
  const { desktopNavigationItems } = useNavigationItems(isPlatformNavigation);

  return (
    <nav className="mt-2 flex-1 md:px-2 lg:mt-4 lg:px-0">
      {desktopNavigationItems.map((item) => (
        <NavigationItem key={item.name} item={item} />
      ))}
    </nav>
  );
};

export function MobileNavigationContainer({
  isPlatformNavigation = false,
}: {
  isPlatformNavigation?: boolean;
}) {
  const { status } = useSession();
  if (status !== "authenticated") return null;
  return <MobileNavigation isPlatformNavigation={isPlatformNavigation} />;
}

const MobileNavigation = ({ isPlatformNavigation = false }: { isPlatformNavigation?: boolean }) => {
  const isEmbed = useIsEmbed();
  const { mobileNavigationBottomItems } = useNavigationItems(isPlatformNavigation);

  return (
    <>
      <nav
        className={classNames(
          "pwa:pb-[max(0.25rem,env(safe-area-inset-bottom))] pwa:-mx-2 bg-muted border-subtle fixed bottom-0 left-0 z-30 flex w-full border-t bg-opacity-40 px-1 shadow backdrop-blur-md md:hidden",
          isEmbed && "hidden"
        )}>
        {mobileNavigationBottomItems.map((item) => (
          <MobileNavigationItem key={item.name} item={item} />
        ))}
      </nav>
      {/* add padding to content for mobile navigation*/}
      <div className="block pt-12 md:hidden" />
    </>
  );
};

export const MobileNavigationMoreItems = () => {
  const { mobileNavigationMoreItems } = useNavigationItems();

  return (
    <ul className="border-subtle mt-2 rounded-md border">
      {mobileNavigationMoreItems.map((item) => (
        <MobileNavigationMoreItem key={item.name} item={item} />
      ))}
    </ul>
  );
};
