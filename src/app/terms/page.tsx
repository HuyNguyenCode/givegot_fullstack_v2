// app/terms/page.tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service | GiveGot",
  description: "Review the terms that govern your use of GiveGot.",
};

const sections = [
  {
    title: "1. Acceptance of These Terms",
    content: (
      <p>
        By accessing or using GiveGot, you agree to these Terms of Service and our
        Privacy Policy. If you do not agree, you must not access or use the service.
        If you use GiveGot on behalf of an organization, you represent that you have
        authority to bind that organization to these terms.
      </p>
    ),
  },
  {
    title: "2. Eligibility",
    content: (
      <p>
        You must be at least 13 years old, or the minimum age required by applicable
        law, to use GiveGot. If you are under the age of legal majority where you
        live, you may use the service only with permission from a parent or legal
        guardian.
      </p>
    ),
  },
  {
    title: "3. Accounts",
    content: (
      <>
        <p>
          You may need an account to access certain features. You agree to provide
          accurate information and keep it current. You are responsible for
          safeguarding your login credentials and for activity occurring through
          your account.
        </p>
        <p>
          You must notify us promptly if you suspect unauthorized access to your
          account. We are not responsible for losses caused by your failure to
          protect your credentials.
        </p>
      </>
    ),
  },
  {
    title: "4. Platform Role",
    content: (
      <p>
        GiveGot provides tools that may allow users to discover, offer, request,
        exchange, give, or receive items and services. Unless expressly stated
        otherwise, GiveGot is not a party to agreements between users and does not
        own, inspect, guarantee, or control user-provided items, services, listings,
        or representations.
      </p>
    ),
  },
  {
    title: "5. User Content",
    content: (
      <>
        <p>
          You retain ownership of content you submit to GiveGot. You grant GiveGot
          a non-exclusive, worldwide, royalty-free license to host, store,
          reproduce, display, and use that content as reasonably necessary to
          operate, improve, and promote the service.
        </p>
        <p>
          You represent that you have all rights necessary to submit your content
          and that it does not violate any law, third-party right, or these terms.
          We may remove or restrict content that we reasonably believe violates
          these terms.
        </p>
      </>
    ),
  },
  {
    title: "6. Acceptable Use",
    content: (
      <>
        <p>You agree not to:</p>
        <ul>
          <li>Use GiveGot for unlawful, fraudulent, or deceptive activity.</li>
          <li>Post false, misleading, harmful, or infringing content.</li>
          <li>Offer prohibited, unsafe, stolen, or unlawfully obtained items.</li>
          <li>Harass, threaten, impersonate, or exploit another person.</li>
          <li>Attempt to access another user’s account or restricted systems.</li>
          <li>Disrupt, overload, scrape, or reverse engineer the service.</li>
          <li>Upload malware or other harmful code.</li>
          <li>Circumvent security, moderation, or access-control measures.</li>
        </ul>
      </>
    ),
  },
  {
    title: "7. User Interactions and Transactions",
    content: (
      <p>
        You are responsible for evaluating other users and deciding whether and how
        to interact with them. Any arrangement, exchange, delivery, payment, or
        dispute between users is solely between those users. Exercise appropriate
        care when meeting someone, exchanging an item, or sharing information.
      </p>
    ),
  },
  {
    title: "8. Fees and Payments",
    content: (
      <p>
        Certain features may require payment. Any applicable price, fee, and payment
        terms will be disclosed before you complete a purchase. Except where
        required by law or expressly stated otherwise, payments are non-refundable.
        Third-party payment providers may apply their own terms and privacy policies.
      </p>
    ),
  },
  {
    title: "9. Intellectual Property",
    content: (
      <p>
        GiveGot and its associated software, branding, designs, text, graphics, and
        other materials are owned by or licensed to GiveGot and are protected by
        intellectual-property laws. Except as permitted by these terms, you may not
        copy, modify, distribute, sell, or create derivative works from them.
      </p>
    ),
  },
  {
    title: "10. Third-Party Services",
    content: (
      <p>
        The service may contain links to or integrations with third-party services.
        GiveGot does not control and is not responsible for their content,
        availability, security, or practices. Your use of a third-party service is
        governed by that provider’s terms.
      </p>
    ),
  },
  {
    title: "11. Suspension and Termination",
    content: (
      <p>
        You may stop using GiveGot at any time. We may suspend or terminate access
        when we reasonably believe you have violated these terms, created risk or
        legal exposure, or misused the service. Provisions that by their nature
        should survive termination will remain in effect.
      </p>
    ),
  },
  {
    title: "12. Disclaimers",
    content: (
      <p>
        To the fullest extent permitted by law, GiveGot is provided “as is” and “as
        available,” without warranties of any kind, whether express or implied. We
        do not warrant that the service will always be available, secure, accurate,
        or error-free, or that user content, listings, items, services, or
        interactions will meet your expectations.
      </p>
    ),
  },
  {
    title: "13. Limitation of Liability",
    content: (
      <p>
        To the fullest extent permitted by law, GiveGot and its affiliates,
        officers, employees, and service providers will not be liable for indirect,
        incidental, special, consequential, exemplary, or punitive damages, or for
        any loss of profits, data, goodwill, or opportunities arising from your use
        of or inability to use the service.
      </p>
    ),
  },
  {
    title: "14. Indemnification",
    content: (
      <p>
        To the extent permitted by law, you agree to defend, indemnify, and hold
        harmless GiveGot and its affiliates from claims, liabilities, damages,
        losses, and expenses arising from your content, your use of the service,
        your interactions with other users, or your violation of these terms or
        applicable law.
      </p>
    ),
  },
  {
    title: "15. Governing Law and Disputes",
    content: (
      <p>
        These terms will be governed by the laws applicable in the jurisdiction
        identified by GiveGot, without regard to conflict-of-law principles. Any
        disputes will be resolved in the courts or other forum having jurisdiction,
        unless applicable law requires otherwise.
      </p>
    ),
  },
  {
    title: "16. Changes to These Terms",
    content: (
      <p>
        We may update these terms periodically. When changes are made, we will
        update the “Last updated” date and provide additional notice when required.
        Your continued use of GiveGot after revised terms take effect constitutes
        acceptance of those terms.
      </p>
    ),
  },
  {
    title: "17. General Provisions",
    content: (
      <p>
        These terms constitute the agreement between you and GiveGot regarding the
        service. If any provision is found unenforceable, the remaining provisions
        will remain effective. Our failure to enforce a provision is not a waiver
        of our right to do so later. You may not transfer these terms without our
        consent.
      </p>
    ),
  },
  {
    title: "18. Contact Us",
    content: (
      <p>
        If you have questions about these Terms of Service, please contact us
        through the support channels available within GiveGot.
      </p>
    ),
  },
];

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto w-full max-w-4xl px-6 py-16 sm:px-8 sm:py-20 lg:py-24">
        <header className="border-b border-slate-200 pb-10">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-emerald-600">
            Legal
          </p>
          <h1 className="text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">
            Terms of Service
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
            These terms govern your access to and use of GiveGot and its related
            services.
          </p>
          <p className="mt-5 text-sm text-slate-500">
            Last updated: August 13, 2026
          </p>
        </header>

        <article className="mt-12">
          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950">
            <p>
              These Terms of Service are general boilerplate and do not constitute
              legal advice. They should be reviewed and adapted by qualified legal
              counsel for GiveGot’s specific operations and jurisdiction.
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