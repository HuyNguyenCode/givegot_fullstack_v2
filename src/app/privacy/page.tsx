// app/privacy/page.tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | GiveGot",
  description: "Learn how GiveGot collects, uses, and protects your information.",
};

const sections = [
  {
    title: "1. Information We Collect",
    content: (
      <>
        <p>We may collect information that you provide directly to us, including:</p>
        <ul>
          <li>Account details, such as your name, email address, and profile information.</li>
          <li>Content you submit, including listings, messages, images, and support requests.</li>
          <li>Transaction-related information necessary to provide the service.</li>
        </ul>
        <p>
          We may also automatically collect technical information such as your IP
          address, browser type, device information, referring pages, and activity
          within GiveGot.
        </p>
      </>
    ),
  },
  {
    title: "2. How We Use Your Information",
    content: (
      <>
        <p>We may use the information we collect to:</p>
        <ul>
          <li>Provide, maintain, and improve GiveGot.</li>
          <li>Create and manage your account.</li>
          <li>Enable communication and interactions between users.</li>
          <li>Respond to support requests and service-related inquiries.</li>
          <li>Protect users, investigate misuse, and maintain platform security.</li>
          <li>Comply with applicable legal obligations.</li>
        </ul>
      </>
    ),
  },
  {
    title: "3. How We Share Information",
    content: (
      <>
        <p>
          We do not sell your personal information. We may share information in
          limited circumstances, including:
        </p>
        <ul>
          <li>
            With service providers that help us operate, secure, and maintain the
            platform.
          </li>
          <li>
            With other users when information is part of your public profile,
            listing, or direct interaction.
          </li>
          <li>
            When required by law, legal process, or a valid request from a public
            authority.
          </li>
          <li>
            When reasonably necessary to prevent fraud, abuse, security threats, or
            harm.
          </li>
          <li>
            In connection with a merger, acquisition, financing, or sale of assets.
          </li>
        </ul>
      </>
    ),
  },
  {
    title: "4. Cookies and Similar Technologies",
    content: (
      <p>
        GiveGot may use cookies and similar technologies to keep you signed in,
        remember preferences, understand how the service is used, and improve
        performance. You can control cookies through your browser settings, although
        disabling certain cookies may affect platform functionality.
      </p>
    ),
  },
  {
    title: "5. Data Retention",
    content: (
      <p>
        We retain personal information for as long as reasonably necessary to
        provide the service, fulfill the purposes described in this policy, resolve
        disputes, enforce agreements, and comply with legal obligations. Retention
        periods may vary depending on the type of information and applicable law.
      </p>
    ),
  },
  {
    title: "6. Data Security",
    content: (
      <p>
        We use reasonable administrative, technical, and organizational safeguards
        designed to protect your information. However, no method of transmission or
        storage is completely secure, and we cannot guarantee absolute security.
      </p>
    ),
  },
  {
    title: "7. Your Choices and Rights",
    content: (
      <>
        <p>
          Depending on where you live, you may have rights concerning your personal
          information, including the right to:
        </p>
        <ul>
          <li>Access, correct, or delete certain personal information.</li>
          <li>Object to or restrict certain processing.</li>
          <li>Request a portable copy of your information.</li>
          <li>Withdraw consent where processing is based on consent.</li>
        </ul>
        <p>
          You may also update certain account information directly through your
          GiveGot account.
        </p>
      </>
    ),
  },
  {
    title: "8. Children’s Privacy",
    content: (
      <p>
        GiveGot is not intended for children under 13, or the minimum age required
        by applicable law. We do not knowingly collect personal information from
        children who are not permitted to use the service. If you believe a child
        has provided us with personal information, please contact us.
      </p>
    ),
  },
  {
    title: "9. International Data Transfers",
    content: (
      <p>
        Your information may be processed in countries other than the country where
        you live. Where required, we use appropriate safeguards intended to protect
        information transferred across borders.
      </p>
    ),
  },
  {
    title: "10. Third-Party Services",
    content: (
      <p>
        GiveGot may contain links to third-party websites or services. Their privacy
        practices are governed by their own policies, and we are not responsible for
        how those third parties collect or use information.
      </p>
    ),
  },
  {
    title: "11. Changes to This Policy",
    content: (
      <p>
        We may update this Privacy Policy periodically. When we make changes, we
        will revise the “Last updated” date and provide additional notice when
        required by law.
      </p>
    ),
  },
  {
    title: "12. Contact Us",
    content: (
      <p>
        If you have questions, concerns, or requests regarding this Privacy Policy
        or your personal information, please contact us through the support channels
        available within GiveGot.
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto w-full max-w-4xl px-6 py-16 sm:px-8 sm:py-20 lg:py-24">
        <header className="border-b border-slate-200 pb-10">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-emerald-600">
            Legal
          </p>
          <h1 className="text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">
            Privacy Policy
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
            This policy explains how GiveGot collects, uses, shares, and protects
            your information when you use our services.
          </p>
          <p className="mt-5 text-sm text-slate-500">
            Last updated: August 13, 2026
          </p>
        </header>

        <article className="mt-12">
          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950">
            <p>
              This Privacy Policy is general boilerplate and does not constitute
              legal advice. It should be reviewed and adapted by qualified legal
              counsel for GiveGot’s specific operations and applicable laws.
            </p>
          </section>

          <section className="mt-10 space-y-5 text-base leading-8 text-slate-700">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
              Overview
            </h2>
            <p>
              GiveGot respects your privacy. By accessing or using GiveGot, you
              acknowledge the practices described in this Privacy Policy. This
              policy applies to information processed through our website,
              applications, and related services.
            </p>
          </section>

          <div className="mt-12 space-y-12">
            {sections.map((section) => (
              <section key={section.title}>
                <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
                  {section.title}
                </h2>
                <div className="mt-4 space-y-4 text-base leading-8 text-slate-700 [&_ul]:ml-6 [&_ul]:list-disc [&_ul]:space-y-2 [&_li]:pl-2">
                  {section.content}
                </div>
              </section>
            ))}
          </div>
        </article>
      </div>
    </main>
  );
}