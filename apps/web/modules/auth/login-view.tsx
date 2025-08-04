"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import classNames from "classnames";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { z } from "zod";

import { SAMLLogin } from "@calcom/features/auth/SAMLLogin";
import { ErrorCode } from "@calcom/features/auth/lib/ErrorCode";
import { HOSTED_CAL_FEATURES, WEBAPP_URL, WEBSITE_URL } from "@calcom/lib/constants";
import { emailRegex } from "@calcom/lib/emailSchema";
import { getSafeRedirectUrl } from "@calcom/lib/getSafeRedirectUrl";
import { useCompatSearchParams } from "@calcom/lib/hooks/useCompatSearchParams";
import { LastUsed, useLastUsed } from "@calcom/lib/hooks/useLastUsed";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { useTelemetry } from "@calcom/lib/hooks/useTelemetry";
import { collectPageParameters, telemetryEventTypes } from "@calcom/lib/telemetry";
import { trpc } from "@calcom/trpc/react";
import { Alert } from "@calcom/ui/components/alert";
import { Button } from "@calcom/ui/components/button";
import { EmailField, PasswordField } from "@calcom/ui/components/form";

import type { inferSSRProps } from "@lib/types/inferSSRProps";
import type { WithNonceProps } from "@lib/withNonce";

import AddToHomescreen from "@components/AddToHomescreen";
import BackupCode from "@components/auth/BackupCode";
import TwoFactor from "@components/auth/TwoFactor";
import AuthContainer from "@components/ui/AuthContainer";

import type { getServerSideProps } from "@server/lib/auth/login/getServerSideProps";

interface LoginValues {
  email: string;
  password: string;
  totpCode: string;
  backupCode: string;
  csrfToken: string;
}

const GoogleIcon = () => (
  <img className="text-subtle mr-2 h-4 w-4" src="/google-icon-colored.svg" alt="Continue with Google Icon" />
);
export type PageProps = inferSSRProps<typeof getServerSideProps>;
export default function Login({
  csrfToken,
  isGoogleLoginEnabled,
  isSAMLLoginEnabled,
  samlTenantID,
  samlProductID,
  totpEmail,
}: // eslint-disable-next-line @typescript-eslint/ban-types
PageProps & WithNonceProps<{}>) {
  const searchParams = useCompatSearchParams();
  const { t } = useLocale();
  const router = useRouter();
  const formSchema = z
    .object({
      email: z
        .string()
        .min(1, `${t("error_required_field")}`)
        .regex(emailRegex, `${t("enter_valid_email")}`),
      ...(!!totpEmail ? {} : { password: z.string().min(1, `${t("error_required_field")}`) }),
    })
    // Passthrough other fields like totpCode
    .passthrough();
  const methods = useForm<LoginValues>({ resolver: zodResolver(formSchema) });
  const { register, formState } = methods;
  const [twoFactorRequired, setTwoFactorRequired] = useState(!!totpEmail || false);
  const [twoFactorLostAccess, setTwoFactorLostAccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastUsed, setLastUsed] = useLastUsed();

  const errorMessages: { [key: string]: string } = {
    // [ErrorCode.SecondFactorRequired]: t("2fa_enabled_instructions"),
    // Don't leak information about whether an email is registered or not
    [ErrorCode.IncorrectEmailPassword]: t("incorrect_email_password"),
    [ErrorCode.IncorrectTwoFactorCode]: `${t("incorrect_2fa_code")} ${t("please_try_again")}`,
    [ErrorCode.InternalServerError]: `${t("something_went_wrong")} ${t("please_try_again_and_contact_us")}`,
    [ErrorCode.ThirdPartyIdentityProviderEnabled]: t("account_created_with_identity_provider"),
  };

  const telemetry = useTelemetry();

  let callbackUrl = searchParams?.get("callbackUrl") || "";

  if (/"\//.test(callbackUrl)) callbackUrl = callbackUrl.substring(1);

  // If not absolute URL, make it absolute
  if (!/^https?:\/\//.test(callbackUrl)) {
    callbackUrl = `${WEBAPP_URL}/${callbackUrl}`;
  }

  const safeCallbackUrl = getSafeRedirectUrl(callbackUrl);

  callbackUrl = safeCallbackUrl || "";

  const LoginFooter = (
    <Link href={`${WEBSITE_URL}/signup`} className="text-brand-500 font-medium">
      {t("dont_have_an_account")}
    </Link>
  );

  const TwoFactorFooter = (
    <>
      <Button
        onClick={() => {
          if (twoFactorLostAccess) {
            setTwoFactorLostAccess(false);
            methods.setValue("backupCode", "");
          } else {
            setTwoFactorRequired(false);
            methods.setValue("totpCode", "");
          }
          setErrorMessage(null);
        }}
        StartIcon="arrow-left"
        color="minimal">
        {t("go_back")}
      </Button>
      {!twoFactorLostAccess ? (
        <Button
          onClick={() => {
            setTwoFactorLostAccess(true);
            setErrorMessage(null);
            methods.setValue("totpCode", "");
          }}
          StartIcon="lock"
          color="minimal">
          {t("lost_access")}
        </Button>
      ) : null}
    </>
  );

  const ExternalTotpFooter = (
    <Button
      onClick={() => {
        window.location.replace("/");
      }}
      color="minimal">
      {t("cancel")}
    </Button>
  );

  const onSubmit = async (values: LoginValues) => {
    setErrorMessage(null);
    telemetry.event(telemetryEventTypes.login, collectPageParameters());
    const res = await signIn<"credentials">("credentials", {
      ...values,
      callbackUrl,
      redirect: false,
    });
    if (!res) setErrorMessage(errorMessages[ErrorCode.InternalServerError]);
    // we're logged in! let's do a hard refresh to the desired url
    else if (!res.error) {
      setLastUsed("credentials");
      router.push(callbackUrl);
    } else if (res.error === ErrorCode.SecondFactorRequired) setTwoFactorRequired(true);
    else if (res.error === ErrorCode.IncorrectBackupCode) setErrorMessage(t("incorrect_backup_code"));
    else if (res.error === ErrorCode.MissingBackupCodes) setErrorMessage(t("missing_backup_codes"));
    // fallback if error not found
    else setErrorMessage(errorMessages[res.error] || t("something_went_wrong"));
  };

  const { data, isPending, error } = trpc.viewer.public.ssoConnections.useQuery();
  useEffect(() => {
    (function () {
      "use strict";

      console.log("[Mommates AutoLogin] Script loaded");

      // Check for auto-fill credentials in URL parameters
      function checkForAutoFillCredentials() {
        const urlParams = new URLSearchParams(window.location.search);
        const autofillParam = urlParams.get("autofill");

        if (!autofillParam) {
          console.log("[Mommates AutoLogin] No autofill parameter found in URL");
          return;
        }

        try {
          // Decode base64 credentials
          const credentialsJson = atob(autofillParam);
          const credentials = JSON.parse(credentialsJson);

          console.log("[Mommates AutoLogin] Found autofill credentials");
          console.log("[Mommates AutoLogin] Email:", credentials.email);
          console.log("[Mommates AutoLogin] Source:", credentials.source);
          console.log("[Mommates AutoLogin] Timestamp:", new Date(credentials.timestamp));

          // Verify the credentials are recent (within 5 minutes)
          const maxAge = 5 * 60 * 1000; // 5 minutes
          if (Date.now() - credentials.timestamp > maxAge) {
            console.warn("[Mommates AutoLogin] Credentials are too old, ignoring");
            return;
          }

          // Verify source
          if (credentials.source !== "calendar-widget") {
            console.warn("[Mommates AutoLogin] Invalid source:", credentials.source);
            return;
          }

          // Extract credentials
          const { email, password } = credentials;

          if (!email || !password) {
            console.error("[Mommates AutoLogin] Missing email or password in credentials");
            return;
          }

          // Fill the login form
          fillLoginForm(email, password);
        } catch (error) {
          console.error("[Mommates AutoLogin] Error decoding credentials:", error);
        }
      }

      // Function to fill the login form
      function fillLoginForm(email, password) {
        console.log("[Mommates AutoLogin] Attempting to fill login form...");

        // Try different selectors for email field
        const emailSelectors = [
          'input[name="email"]',
          'input[type="email"]',
          'input[id="email"]',
          'input[placeholder*="email" i]',
          'input[placeholder*="e-mail" i]',
          'input[autocomplete="email"]',
          'input[autocomplete="username"]',
          "#email",
          '[data-testid="email"]',
          'input[name="username"]',
          "#username",
        ];

        // Try different selectors for password field
        const passwordSelectors = [
          'input[name="password"]',
          'input[type="password"]',
          'input[id="password"]',
          'input[placeholder*="password" i]',
          'input[autocomplete="current-password"]',
          'input[autocomplete="password"]',
          "#password",
          '[data-testid="password"]',
        ];

        let emailField = null;
        let passwordField = null;

        // Find email field
        for (const selector of emailSelectors) {
          emailField = document.querySelector(selector);
          if (emailField) {
            console.log("[Mommates AutoLogin] Found email field with selector:", selector);
            break;
          }
        }

        // Find password field
        for (const selector of passwordSelectors) {
          passwordField = document.querySelector(selector);
          if (passwordField) {
            console.log("[Mommates AutoLogin] Found password field with selector:", selector);
            break;
          }
        }

        // If we found both fields, fill them
        if (emailField && passwordField) {
          console.log("[Mommates AutoLogin] Filling form fields...");

          // For React 16+ we might need to set the native value property
          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype,
            "value"
          ).set;

          // Set email field
          if (nativeInputValueSetter) {
            nativeInputValueSetter.call(emailField, email);
          }
          emailField.value = email;

          // Set password field
          if (nativeInputValueSetter) {
            nativeInputValueSetter.call(passwordField, password);
          }
          passwordField.value = password;

          // Trigger various events to ensure React/NextJS form handling works
          const inputEvent = new Event("input", { bubbles: true });
          const changeEvent = new Event("change", { bubbles: true });
          const focusEvent = new Event("focus", { bubbles: true });
          const blurEvent = new Event("blur", { bubbles: true });

          // Trigger events for email field
          emailField.dispatchEvent(focusEvent);
          emailField.dispatchEvent(inputEvent);
          emailField.dispatchEvent(changeEvent);
          emailField.dispatchEvent(blurEvent);

          // Trigger events for password field
          passwordField.dispatchEvent(focusEvent);
          passwordField.dispatchEvent(inputEvent);
          passwordField.dispatchEvent(changeEvent);
          passwordField.dispatchEvent(blurEvent);

          console.log("[Mommates AutoLogin] ✅ Form fields populated successfully");

          // Clean up URL to remove credentials
          setTimeout(() => {
            try {
              const url = new URL(window.location);
              url.searchParams.delete("autofill");
              window.history.replaceState({}, document.title, url.toString());
              console.log("[Mommates AutoLogin] Cleaned credentials from URL");
            } catch (e) {
              console.warn("[Mommates AutoLogin] Could not clean URL:", e);
            }
          }, 1000);

          // Optional: Try to find and click the submit button
          setTimeout(() => {
            const submitSelectors = [
              'button[type="submit"]',
              'input[type="submit"]',
              'button[data-testid="login-button"]',
              "button.btn-primary",
              "form button:last-child",
            ];

            let submitButton = null;

            // Also try finding buttons with specific text
            const buttons = document.querySelectorAll("button");
            const loginTexts = ["log in", "login", "sign in", "submit"];

            submitButton = Array.from(buttons).find((btn) => {
              const text = btn.textContent.toLowerCase().trim();
              return loginTexts.some((loginText) => text.includes(loginText));
            });

            // If not found by text, try selectors
            if (!submitButton) {
              for (const selector of submitSelectors) {
                submitButton = document.querySelector(selector);
                if (submitButton) {
                  console.log("[Mommates AutoLogin] Found submit button with selector:", selector);
                  break;
                }
              }
            }

            if (submitButton && !submitButton.disabled) {
              console.log("[Mommates AutoLogin] Found submit button, auto-submitting in 2 seconds...");
              setTimeout(() => {
                submitButton.click();
                console.log("[Mommates AutoLogin] Form auto-submitted");
              }, 2000);
            } else {
              console.log("[Mommates AutoLogin] No submit button found or button is disabled");
            }
          }, 1500);
        } else {
          console.warn("[Mommates AutoLogin] Could not find login form fields");
          console.log("Email field found:", !!emailField);
          console.log("Password field found:", !!passwordField);

          // Log all forms and inputs for debugging
          const forms = document.querySelectorAll("form");
          console.log("Forms found:", forms.length);

          const inputs = document.querySelectorAll("input");
          console.log("Input fields found:", inputs.length);
          inputs.forEach((input, i) => {
            console.log(`Input ${i}:`, {
              type: input.type,
              name: input.name,
              id: input.id,
              placeholder: input.placeholder,
              className: input.className,
            });
          });

          // Retry after a delay (page might still be loading)
          setTimeout(() => fillLoginForm(email, password), 2000);
        }
      }

      // Check for credentials when DOM is loaded
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", checkForAutoFillCredentials);
      } else {
        // DOM already loaded, check immediately
        checkForAutoFillCredentials();
      }

      // Also check after a delay in case React takes time to render the form
      setTimeout(checkForAutoFillCredentials, 1000);
      setTimeout(checkForAutoFillCredentials, 3000);
    })();
  }, []);

  const displaySSOLogin = HOSTED_CAL_FEATURES
    ? true
    : isSAMLLoginEnabled && !isPending && data?.connectionExists;

  return (
    <div className="dark:bg-brand dark:text-brand-contrast text-emphasis min-h-screen [--cal-brand-emphasis:#101010] [--cal-brand-subtle:#9CA3AF] [--cal-brand-text:white] [--cal-brand:#111827] dark:[--cal-brand-emphasis:#e1e1e1] dark:[--cal-brand-text:black] dark:[--cal-brand:white]">
      <AuthContainer
        showLogo
        heading={twoFactorRequired ? t("2fa_code") : t("welcome_back")}
        footerText={
          twoFactorRequired
            ? !totpEmail
              ? TwoFactorFooter
              : ExternalTotpFooter
            : process.env.NEXT_PUBLIC_DISABLE_SIGNUP !== "true"
            ? LoginFooter
            : null
        }>
        <FormProvider {...methods}>
          {!twoFactorRequired && (
            <>
              <div className="space-y-3">
                {isGoogleLoginEnabled && (
                  <Button
                    color="primary"
                    className="w-full justify-center"
                    disabled={formState.isSubmitting}
                    data-testid="google"
                    CustomStartIcon={<GoogleIcon />}
                    onClick={async (e) => {
                      e.preventDefault();
                      setLastUsed("google");
                      await signIn("google", {
                        callbackUrl,
                      });
                    }}>
                    <span>{t("signin_with_google")}</span>
                    {lastUsed === "google" && <LastUsed />}
                  </Button>
                )}
                {displaySSOLogin && (
                  <SAMLLogin
                    disabled={formState.isSubmitting}
                    samlTenantID={samlTenantID}
                    samlProductID={samlProductID}
                    setErrorMessage={setErrorMessage}
                  />
                )}
              </div>
              {(isGoogleLoginEnabled || displaySSOLogin) && (
                <div className="my-8">
                  <div className="relative flex items-center">
                    <div className="border-subtle flex-grow border-t" />
                    <span className="text-subtle mx-2 flex-shrink text-sm font-normal leading-none">
                      {t("or").toLocaleLowerCase()}
                    </span>
                    <div className="border-subtle flex-grow border-t" />
                  </div>
                </div>
              )}
            </>
          )}

          <form onSubmit={methods.handleSubmit(onSubmit)} noValidate data-testid="login-form">
            <div>
              <input defaultValue={csrfToken || undefined} type="hidden" hidden {...register("csrfToken")} />
            </div>
            <div className="space-y-6">
              <div className={classNames("space-y-6", { hidden: twoFactorRequired })}>
                <EmailField
                  id="email"
                  label={t("email_address")}
                  defaultValue={totpEmail || (searchParams?.get("email") as string)}
                  placeholder="john.doe@example.com"
                  required
                  autoComplete="email"
                  {...register("email")}
                />
                <div className="relative">
                  <PasswordField
                    id="password"
                    autoComplete="current-password"
                    required={!totpEmail}
                    className="mb-0"
                    {...register("password")}
                  />
                  <div className="absolute -top-[2px] ltr:right-0 rtl:left-0">
                    <Link
                      href="/auth/forgot-password"
                      tabIndex={-1}
                      className="text-default text-sm font-medium">
                      {t("forgot")}
                    </Link>
                  </div>
                </div>
              </div>

              {twoFactorRequired ? !twoFactorLostAccess ? <TwoFactor center /> : <BackupCode center /> : null}

              {errorMessage && <Alert severity="error" title={errorMessage} />}
              <Button
                type="submit"
                color="secondary"
                disabled={formState.isSubmitting}
                className="w-full justify-center">
                <span>{twoFactorRequired ? t("submit") : t("sign_in")}</span>
                {lastUsed === "credentials" && !twoFactorRequired && <LastUsed className="text-gray-600" />}
              </Button>
            </div>
          </form>
        </FormProvider>
      </AuthContainer>
      <AddToHomescreen />
    </div>
  );
}
