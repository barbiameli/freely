import Script from "next/script";

/**
 * A hosted analytics tool, off unless somebody turns it on.
 *
 * Renders nothing at all without NEXT_PUBLIC_POSTHOG_KEY, so it cannot ship by
 * accident. That matters more than it sounds: this is the one thing in the app
 * that sends a third party information about the people using it, and a feature
 * like that going live because a default was true is exactly how privacy
 * policies end up describing something nobody decided to do.
 *
 * The events table in this repo is the primary source and is not going away.
 * This is for the questions it cannot answer: where people came from, what they
 * did before giving up, how a session actually went. Those need a client-side
 * tool, and a client-side tool is a third party.
 *
 * Configured deliberately when it does run:
 *
 * No automatic pageviews. The server already records what happened, and a URL
 * with a project id in it is not something to hand over.
 *
 * No session recording, no autocapture. Recording a freelancer's screen means
 * recording their client's names, rates and terms, which are not ours to
 * collect, and autocapture is the same thing one click at a time.
 *
 * Cookieless. Without cookies there is nothing to ask consent for under the
 * cookie rules, though the privacy policy still has to say a processor exists.
 *
 * Before switching this on: say so in the privacy policy, and check the
 * provider's terms cover a European user base.
 */
export function HostedAnalytics() {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://eu.i.posthog.com";
  if (!key) return null;

  return (
    <Script id="hosted-analytics" strategy="afterInteractive">
      {`
        !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.async=!0,p.src=s.api_host+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="capture identify alias people.set people.set_once set_config register register_once unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset isFeatureEnabled onFeatureFlags getFeatureFlag getFeatureFlagPayload reloadFeatureFlags group updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures getActiveMatchingSurveys getSurveys getNextSurveyStep onSessionId".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
        posthog.init(${JSON.stringify(key)}, {
          api_host: ${JSON.stringify(host)},
          // The server records what happened. A URL here would carry ids.
          capture_pageview: false,
          // Recording a freelancer's screen records their client's rates.
          disable_session_recording: true,
          autocapture: false,
          persistence: "memory",
        });
      `}
    </Script>
  );
}
