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

const LoginSidebar = () => (
  <div className="text-emphasis">
    <div className="mb-6 flex justify-center">
      <img src="/bear_mm.png" alt="Mommates" className="h-24 w-24 rounded-full" />
    </div>
    <h3 className="font-cal mb-4 text-xl font-semibold">Welcome to Mommates</h3>
    <p className="text-default mb-6 text-sm leading-relaxed">
      The Mommates app connects likeminded moms using calendar synchronization and other community tools. Join
      thousands of moms building a new way to support each other by transforming the way childcare works for
      families.
    </p>
    <h4 className="font-cal mb-3 text-lg font-medium">How it works</h4>
    <ol className="text-default mb-6 list-decimal space-y-2 pl-5 text-sm">
      <li>Connect and sync your calendar.</li>
      <li>Ask your village for some help.</li>
      <li>Choose a mom with availability.</li>
      <li>Meet the family.</li>
      <li>Schedule a swap using our calendar integration.</li>
      <li>Exchange points.</li>
    </ol>
    <div className="border-subtle border-t pt-4">
      <div className="text-subtle flex justify-center space-x-4 text-xs">
        <Link href="/privacy" className="hover:text-emphasis hover:underline">
          Privacy Policy
        </Link>
        <span>|</span>
        <Link href="/terms" className="hover:text-emphasis hover:underline">
          Terms of Service
        </Link>
      </div>
    </div>
  </div>
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

      // Create and show loading overlay
      function showLoader() {
        // Check if loader already exists
        if (document.getElementById("mommates-autofill-loader")) {
          return;
        }

        const loaderHTML = `
            <div id="mommates-autofill-loader" style="
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(255, 255, 255, 0.95);
                backdrop-filter: blur(3px);
                z-index: 9999;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            ">
                <div style="
                    text-align: center;
                    padding: 40px;
                    background: white;
                    border-radius: 16px;
                    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
                    max-width: 400px;
                    margin: 20px;
                ">
                    <div style="
                        width: 60px;
                        height: 60px;
                        border: 4px solid #f3f4f6;
                        border-top: 4px solid #10b981;
                        border-radius: 50%;
                        animation: spin 1s linear infinite;
                        margin: 0 auto 24px;
                    "></div>
                    
                    <h3 style="
                        margin: 0 0 12px 0;
                        font-size: 20px;
                        font-weight: 600;
                        color: #1f2937;
                    ">Logging you in...</h3>
                    
                    <p style="
                        margin: 0 0 20px 0;
                        font-size: 14px;
                        color: #6b7280;
                        line-height: 1.5;
                    ">Please wait while we automatically fill in your credentials and log you into your calendar.</p>
                    
                    <div id="loader-status" style="
                        font-size: 12px;
                        color: #10b981;
                        font-weight: 500;
                        margin-top: 16px;
                    ">Preparing login...</div>
                </div>
                
                <style>
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                </style>
            </div>
        `;

        document.body.insertAdjacentHTML("beforeend", loaderHTML);
        console.log("[Mommates AutoLogin] Loader displayed");
      }

      // Update loader status message
      function updateLoaderStatus(message) {
        const statusElement = document.getElementById("loader-status");
        if (statusElement) {
          statusElement.textContent = message;
        }
      }

      // Hide and remove loading overlay
      function hideLoader() {
        const loader = document.getElementById("mommates-autofill-loader");
        if (loader) {
          loader.style.opacity = "0";
          loader.style.transition = "opacity 0.3s ease";
          setTimeout(() => {
            loader.remove();
            console.log("[Mommates AutoLogin] Loader removed");
          }, 300);
        }
      }

      // Check for auto-fill credentials in URL parameters
      function checkForAutoFillCredentials() {
        const urlParams = new URLSearchParams(window.location.search);
        const autofillParam = urlParams.get("autofill");

        if (!autofillParam) {
          console.log("[Mommates AutoLogin] No autofill parameter found in URL");
          return;
        }

        // Show loader immediately when autofill is detected
        showLoader();
        updateLoaderStatus("Decoding credentials...");

        try {
          // Decode base64 credentials
          const credentialsJson = atob(autofillParam);
          const credentials = JSON.parse(credentialsJson);

          console.log("[Mommates AutoLogin] Found autofill credentials");
          console.log("[Mommates AutoLogin] Email:", credentials.email);
          console.log("[Mommates AutoLogin] Source:", credentials.source);
          console.log("[Mommates AutoLogin] Timestamp:", new Date(credentials.timestamp));

          updateLoaderStatus("Validating credentials...");

          // Verify the credentials are recent (within 5 minutes)
          const maxAge = 5 * 60 * 1000; // 5 minutes
          if (Date.now() - credentials.timestamp > maxAge) {
            console.warn("[Mommates AutoLogin] Credentials are too old, ignoring");
            updateLoaderStatus("Credentials expired");
            setTimeout(hideLoader, 2000);
            return;
          }

          // Verify source
          if (credentials.source !== "calendar-widget") {
            console.warn("[Mommates AutoLogin] Invalid source:", credentials.source);
            updateLoaderStatus("Invalid source");
            setTimeout(hideLoader, 2000);
            return;
          }

          // Extract credentials
          const { email, password } = credentials;

          if (!email || !password) {
            console.error("[Mommates AutoLogin] Missing email or password in credentials");
            updateLoaderStatus("Invalid credentials");
            setTimeout(hideLoader, 2000);
            return;
          }

          updateLoaderStatus("Looking for login form...");

          // Fill the login form
          fillLoginForm(email, password);
        } catch (error) {
          console.error("[Mommates AutoLogin] Error decoding credentials:", error);
          updateLoaderStatus("Error processing credentials");
          setTimeout(hideLoader, 2000);
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
          console.log("[Mommates AutoLogin] Filling form fields with React state update...");
          updateLoaderStatus("Found login form, filling fields...");

          // Function to properly set React input value
          function setReactInputValue(element, value) {
            // Get React's internal input setter
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
              window.HTMLInputElement.prototype,
              "value"
            ).set;

            // Set the value using React's setter
            nativeInputValueSetter.call(element, value);

            // Create and dispatch the input event that React listens for
            const inputEvent = new Event("input", { bubbles: true });

            // For React 16+, we need to set the simulated flag
            inputEvent.simulated = true;

            // Dispatch the event to trigger React's onChange
            element.dispatchEvent(inputEvent);

            // Also trigger other events that might be needed
            element.dispatchEvent(new Event("change", { bubbles: true }));
            element.dispatchEvent(new Event("blur", { bubbles: true }));
          }

          // Function to simulate user typing (more reliable for React)
          function simulateTyping(element, value) {
            // Focus the element first
            element.focus();

            // Clear existing value
            element.value = "";
            element.dispatchEvent(new Event("input", { bubbles: true }));

            // Type each character with a small delay
            let i = 0;
            const typeChar = () => {
              if (i < value.length) {
                element.value = value.substring(0, i + 1);

                // Trigger input event for each character
                const inputEvent = new Event("input", { bubbles: true });
                inputEvent.simulated = true;
                element.dispatchEvent(inputEvent);

                i++;
                setTimeout(typeChar, 10); // 10ms delay between characters
              } else {
                // Finished typing, trigger final events
                element.dispatchEvent(new Event("change", { bubbles: true }));
                element.dispatchEvent(new Event("blur", { bubbles: true }));
              }
            };

            setTimeout(typeChar, 100); // Start typing after 100ms
          }

          // Try the React-specific approach first
          try {
            console.log("[Mommates AutoLogin] Attempting React state update method...");
            updateLoaderStatus("Updating form state...");

            // Method 1: Direct React fiber manipulation (most reliable)
            function updateReactState(element, value) {
              const reactProps = Object.keys(element).find((key) => key.startsWith("__reactProps"));
              const reactInternalInstance =
                element._reactInternalFiber ||
                element._reactInternalInstance ||
                Object.keys(element).find((key) => key.startsWith("__reactInternalInstance"));

              if (reactProps && element[reactProps]) {
                // Update React props directly
                if (element[reactProps].onChange) {
                  element.value = value;
                  element[reactProps].onChange({ target: element, currentTarget: element });
                }
              }
            }

            // Set values using multiple methods
            setReactInputValue(emailField, email);
            setReactInputValue(passwordField, password);

            // Also try direct React state update
            updateReactState(emailField, email);
            updateReactState(passwordField, password);

            console.log("[Mommates AutoLogin] ✅ React state update method completed");
          } catch (reactError) {
            console.warn("[Mommates AutoLogin] React method failed, trying typing simulation:", reactError);
            updateLoaderStatus("Simulating user typing...");

            // Fallback: Simulate actual typing
            simulateTyping(emailField, email);
            setTimeout(() => simulateTyping(passwordField, password), 500);
          }

          // Additional validation check
          setTimeout(() => {
            const emailValue = emailField.value;
            const passwordValue = passwordField.value;

            console.log("[Mommates AutoLogin] Validation check:");
            console.log("Email field value:", emailValue);
            console.log("Password field value length:", passwordValue.length);
            console.log("Email field valid:", emailField.checkValidity?.() || "unknown");
            console.log("Password field valid:", passwordField.checkValidity?.() || "unknown");

            // If values didn't stick, try the typing simulation
            if (emailValue !== email || passwordValue !== password) {
              console.warn("[Mommates AutoLogin] Values did not stick, retrying with typing simulation...");
              updateLoaderStatus("Retrying with typing simulation...");
              simulateTyping(emailField, email);
              setTimeout(() => simulateTyping(passwordField, password), 500);
            } else {
              updateLoaderStatus("Form fields populated successfully!");
            }
          }, 1000);

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

          // Optional: Try to find and click the submit button (wait longer for typing simulation)
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
              // Final validation check before submitting
              const emailValid = emailField.value === email;
              const passwordValid = passwordField.value === password;

              console.log("[Mommates AutoLogin] Pre-submit validation:");
              console.log("Email correct:", emailValid);
              console.log("Password correct:", passwordValid);

              if (emailValid && passwordValid) {
                console.log("[Mommates AutoLogin] Validation passed, auto-submitting in 1 second...");
                updateLoaderStatus("Logging you in...");
                setTimeout(() => {
                  submitButton.click();
                  console.log("[Mommates AutoLogin] Form auto-submitted");
                  updateLoaderStatus("Redirecting to your calendar...");
                  // Hide loader after successful submit
                  setTimeout(hideLoader, 2000);
                }, 1000);
              } else {
                console.warn(
                  "[Mommates AutoLogin] Validation failed, not auto-submitting. User must submit manually."
                );
                updateLoaderStatus("Please complete login manually");
                setTimeout(hideLoader, 3000);
              }
            } else {
              console.log("[Mommates AutoLogin] No submit button found or button is disabled");
              updateLoaderStatus("Please click login button to continue");
              setTimeout(hideLoader, 3000);
            }
          }, 3000); // Wait 3 seconds for typing simulation to complete
        } else {
          console.warn("[Mommates AutoLogin] Could not find login form fields");
          console.log("Email field found:", !!emailField);
          console.log("Password field found:", !!passwordField);

          updateLoaderStatus("Login form not ready, retrying...");

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
        sidebar={!twoFactorRequired ? <LoginSidebar /> : undefined}
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
