import { cva } from "class-variance-authority";

import dayjs from "@calcom/dayjs";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import classNames from "@calcom/ui/classNames";
import { Tooltip } from "@calcom/ui/components/tooltip";

import type { CalendarEvent } from "../../types/events";

type EventProps = {
  event: CalendarEvent;
  currentlySelectedEventId?: number;
  eventDuration: number;
  onEventClick?: (event: CalendarEvent) => void;
  disabled?: boolean;
};

const eventClasses = cva(
  "group flex h-full w-full overflow-y-auto rounded-b-[6px] px-[6px] text-xs font-semibold leading-5 opacity-80",
  {
    variants: {
      status: {
        ACCEPTED: "bg-subtle hover:bg-emphasis text-emphasis border-[1px] border-t-0 border-gray-900",
        PENDING: "bg-default text-emphasis border-[1px] border-t-0 border-dashed border-gray-900",
        REJECTED: "",
        CANCELLED: "",
        AWAITING_HOST: "",
      },
      disabled: {
        true: "hover:cursor-default",
        false: "hover:cursor-pointer",
      },
      selected: {
        true: "bg-inverted text-inverted border-[1px] border-t-0 border-transparent",
        false: "",
      },
      borderColor: {
        ACCEPTED: "border-gray-900",
        PENDING: "border-gray-900",
        REJECTED: "border-gray-900",
        CANCELLED: "border-gray-900",
        AWAITING_HOST: "",
        custom: "",
      },
    },
  }
);

export function Event({
  event,
  currentlySelectedEventId,
  eventDuration,
  disabled,
  onEventClick,
}: EventProps) {
  const { t } = useLocale();
  const selected = currentlySelectedEventId === event.id;
  const { options } = event;

  const borderColor = options?.borderColor ? "custom" : options?.status;

  // Determine the badge background color (same as border)
  const badgeBgColor = options?.borderColor || "#111827"; // gray-900 as default

  const styles = options?.borderColor
    ? {
        borderColor: options?.borderColor,
      }
    : {};

  const badgeStyles = {
    backgroundColor: badgeBgColor,
  };

  const Component = onEventClick ? "button" : "div";
  const roleLabel = event.isOrganizer ? t("organizer") || "Organizer" : t("attendee") || "Attendee";

  return (
    <Tooltip content={event.title}>
      <div className="flex h-full flex-col">
        {/* Role Badge */}
        <div className="flex w-full items-center rounded-t-[6px] px-[6px] py-[2px]" style={badgeStyles}>
          <span className="text-[9px] font-medium uppercase tracking-wide text-white">{roleLabel}</span>
        </div>
        {/* Event Content */}
        <Component
          onClick={() => onEventClick?.(event)} // Note this is not the button event. It is the calendar event.
          className={classNames(
            eventClasses({
              status: options?.status,
              disabled,
              selected,
              borderColor,
            }),
            eventDuration > 30 && "flex-col py-1",
            options?.className,
            "flex-1"
          )}
          style={styles}>
          <div
            className={classNames(
              "flex w-full gap-2 overflow-hidden overflow-ellipsis whitespace-nowrap text-left leading-4",
              eventDuration <= 30 && "items-center"
            )}>
            <span>{event.title}</span>
            {eventDuration <= 30 && !event.options?.hideTime && (
              <p className="text-subtle w-full whitespace-nowrap text-left text-[10px] leading-none">
                {dayjs(event.start).format("HH:mm")} - {dayjs(event.end).format("HH:mm")}
              </p>
            )}
          </div>
          {eventDuration > 30 && !event.options?.hideTime && (
            <p className="text-subtle text-left text-[10px] leading-none">
              {dayjs(event.start).format("HH:mm")} - {dayjs(event.end).format("HH:mm")}
            </p>
          )}
          {eventDuration > 45 && event.description && (
            <p className="text-subtle text-left text-[10px] leading-none">{event.description}</p>
          )}
        </Component>
      </div>
    </Tooltip>
  );
}
