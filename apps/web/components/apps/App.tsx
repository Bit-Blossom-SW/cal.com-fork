import LicenseRequired from "@calcom/features/ee/common/components/LicenseRequired";
import Shell from "@calcom/features/shell/Shell";
import { useLocale } from "@calcom/lib/hooks/useLocale";

import type { AppPageProps } from "./AppPage";
import { AppPage } from "./AppPage";

const ShellHeading = ({ isCalendarApp }: { isCalendarApp: boolean }) => {
  const { t } = useLocale();
  return <span className="block py-2">{isCalendarApp ? t("calendars") : t("app_store")}</span>;
};

export default function WrappedApp(props: AppPageProps) {
  const isCalendarApp = props.categories?.includes("calendar");
  const backPath = isCalendarApp ? "/apps/categories/calendar" : "/apps";

  return (
    <Shell smallHeading isPublic heading={<ShellHeading isCalendarApp={isCalendarApp} />} backPath={backPath}>
      {props.licenseRequired ? (
        <LicenseRequired>
          <AppPage {...props} />
        </LicenseRequired>
      ) : (
        <AppPage {...props} />
      )}
    </Shell>
  );
}
