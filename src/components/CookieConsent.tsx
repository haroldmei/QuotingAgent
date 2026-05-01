"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { initPostHog, optInAnalytics, optOutAnalytics } from "@/lib/analytics/client";

interface ConsentPreference {
  necessary: boolean;
  analytics: boolean;
  marketing: boolean;
}

export default function CookieConsent() {
  const [showBanner, setShowBanner] = useState(false);
  const [showCustomize, setShowCustomize] = useState(false);
  const [consent, setConsent] = useState<ConsentPreference>({
    necessary: true,
    analytics: false,
    marketing: false,
  });

  // Check if user has already provided consent
  useEffect(() => {
    const savedConsent = localStorage.getItem("cookie_consent");
    if (!savedConsent) {
      setShowBanner(true);
    } else {
      try {
        const parsed = JSON.parse(savedConsent);
        setConsent(parsed);
        // Load analytics if previously consented
        if (parsed.analytics) {
          loadAnalytics();
        }
      } catch {
        setShowBanner(true);
      }
    }
  }, []);

  const loadAnalytics = () => {
    // Initialise PostHog and opt in via the analytics module.
    initPostHog();
    optInAnalytics();
  };

  const handleAcceptAll = () => {
    const newConsent: ConsentPreference = {
      necessary: true,
      analytics: true,
      marketing: false, // Not used yet
    };
    saveConsent(newConsent);
  };

  const handleRejectNonEssential = () => {
    const newConsent: ConsentPreference = {
      necessary: true,
      analytics: false,
      marketing: false,
    };
    saveConsent(newConsent);
  };

  const handleCustomizeSubmit = () => {
    saveConsent(consent);
  };

  const saveConsent = (newConsent: ConsentPreference) => {
    localStorage.setItem("cookie_consent", JSON.stringify(newConsent));
    setConsent(newConsent);
    setShowBanner(false);
    setShowCustomize(false);

    // Apply consent choices via the analytics module.
    if (newConsent.analytics) {
      loadAnalytics();
    } else {
      optOutAnalytics();
    }

    // Reload page to apply CSP changes if necessary
    window.location.reload();
  };

  if (!showBanner) return null;

  return (
    <>
      {/* Main Banner */}
      {!showCustomize && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50 animate-in slide-in-from-bottom-4 duration-300">
          <div className="max-w-4xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-2">Cookie Preferences</h3>
                <p className="text-sm text-gray-600">
                  We use cookies to enhance your experience, analyse usage, and deliver personalised
                  content. By using QuotingAgent, you consent to our{" "}
                  <Link href="/cookies" className="text-orange-600 hover:underline">
                    Cookie Policy
                  </Link>
                  .
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 sm:whitespace-nowrap">
                <button
                  onClick={handleRejectNonEssential}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Reject Non-Essential
                </button>
                <button
                  onClick={() => setShowCustomize(true)}
                  className="px-4 py-2 text-sm font-medium text-orange-600 border border-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                >
                  Customize
                </button>
                <button
                  onClick={handleAcceptAll}
                  className="px-4 py-2 text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors"
                >
                  Accept All
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Customize Modal */}
      {showCustomize && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50 animate-in slide-in-from-bottom-4 duration-300 max-h-[90vh] overflow-y-auto">
          <div className="max-w-2xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Customize Cookie Settings</h3>

            {/* Necessary Cookies */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-gray-900">Necessary Cookies</h4>
                  <p className="text-sm text-gray-600 mt-1">
                    Required for authentication, session management, and security. Always enabled.
                  </p>
                </div>
                <input type="checkbox" checked disabled className="w-5 h-5 text-orange-600" />
              </div>
            </div>

            {/* Analytics Cookies */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-gray-900">Analytics Cookies</h4>
                  <p className="text-sm text-gray-600 mt-1">
                    Help us understand how you use QuotingAgent (via PostHog and Sentry). Your data is
                    never sold.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={consent.analytics}
                  onChange={(e) => setConsent({ ...consent, analytics: e.target.checked })}
                  className="w-5 h-5 text-orange-600"
                />
              </div>
            </div>

            {/* Marketing Cookies (disabled for now) */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200 opacity-50">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-gray-900">Marketing Cookies</h4>
                  <p className="text-sm text-gray-600 mt-1">
                    Currently not used. Disabled for your privacy.
                  </p>
                </div>
                <input type="checkbox" disabled className="w-5 h-5 text-gray-300" />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 mt-8">
              <button
                onClick={() => setShowCustomize(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleCustomizeSubmit}
                className="px-4 py-2 text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors"
              >
                Save Preferences
              </button>
            </div>

            <p className="text-xs text-gray-500 mt-4">
              For more information, see our{" "}
              <Link href="/privacy" className="text-orange-600 hover:underline">
                Privacy Policy
              </Link>
              {" "}and{" "}
              <Link href="/cookies" className="text-orange-600 hover:underline">
                Cookie Policy
              </Link>
              .
            </p>
          </div>
        </div>
      )}
    </>
  );
}
