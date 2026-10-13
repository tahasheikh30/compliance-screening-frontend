// The text of the legal pages. Plain data so the wording can be reviewed and changed without touching layout.
// Written to describe how this application actually works. Have Packages Group / IGI legal and compliance
// review it before it is relied on.

import { ROUTES } from '../lib/nav'

export const UPDATED = '7 October 2026'

export const LEGAL_PAGES = {
  [ROUTES.privacy]: {
    title: 'Privacy policy',
    lead:
      'How Sentinel collects, uses and protects personal information. This tool is used by authorised staff for AML/KYC screening of applicants.',
    sections: [
      {
        h: 'Who this applies to',
        p: [
          'This policy covers two groups of people: staff who hold an account on Sentinel, and applicants whose details a member of staff enters in order to screen them.',
          'Sentinel is an internal tool of the Compliance department at IGI General Takaful, part of Packages Group. It is not offered to the public.',
        ],
      },
      {
        h: 'What we collect',
        ul: [
          'Staff accounts: your email address, your password (held by our authentication provider as a salted hash, never in readable form), your approval status and your role.',
          'Applicant details entered for screening: full name and, optionally, date of birth, nationality, CNIC, father’s or husband’s name and province. Nothing else about an applicant is collected.',
          'Screening records: the result of each screening, the evidence PDF, and the time it was run and by whom, so a compliance officer can review the finding later.',
          'Basic usage measurements: anonymous page view counts, collected without cookies and without identifying you.',
        ],
      },
      {
        h: 'Why we use it',
        p: [
          'Applicant details are compared against the UN Security Council list, the OFAC SDN and Consolidated lists, the UK Sanctions List, the FIA Red Books, the NACTA Proscribed Persons list and a list of politically exposed persons (national and provincial office holders), and used for an adverse media search. This is done solely for account-opening AML/KYC screening and to meet our legal and regulatory duties.',
          'Staff details are used to sign you in, to approve accounts, to show each person their own screening history and to keep the service secure.',
        ],
      },
      {
        h: 'Who we share it with',
        p: [
          'We do not sell personal information. The adverse media check sends the applicant’s name, with a set of risk keywords, as a search to Google News. Apart from that search, applicant details are not sent to any other third party.',
          'We rely on infrastructure providers to run the service: Supabase (sign in and database), Render (the screening service), Vercel (hosting and anonymous page view counts) and Cloudflare (bot protection on the sign in form). They process data on our behalf and only for that purpose.',
          'We may disclose information where the law or a regulator, such as the State Bank of Pakistan or the SECP, requires it.',
        ],
      },
      {
        h: 'How long we keep it',
        p: [
          'Screening records are kept for as long as the Compliance department needs them for review, audit and its regulatory record keeping duties, then deleted. Staff accounts are kept while the person needs access. Retention periods follow Packages Group and IGI policy and applicable law.',
        ],
      },
      {
        h: 'Security',
        p: [
          'Access needs an approved account. Sessions end after a period of inactivity, traffic is encrypted in transit, and each person sees only their own screening history unless an administrator role says otherwise. No system is perfectly secure, so please report anything suspicious straight away.',
        ],
      },
      {
        h: 'Your choices and rights',
        p: [
          'You can ask to see, correct or delete the personal information we hold about you, subject to our legal and regulatory duties, some of which require us to keep screening records. Applicants should raise requests through the organisation that is opening their account.',
          'Pakistan does not yet have a comprehensive enacted data protection law. The Prevention of Electronic Crimes Act 2016 and SBP and SECP regulations currently apply, and we will follow any new law once it takes effect.',
        ],
      },
      {
        h: 'Contact',
        p: ['For privacy questions or requests, use the contact page on the Packages Group website, linked in the footer.'],
      },
    ],
  },

  [ROUTES.terms]: {
    title: 'Terms of use',
    lead:
      'The rules for using Sentinel. By signing in you agree to them.',
    sections: [
      {
        h: 'Who may use Sentinel',
        p: [
          'Sentinel is for authorised employees and contractors of Packages Group companies who have been given an approved account. Do not share your account or password, and sign out when you finish on a shared computer.',
        ],
      },
      {
        h: 'Acceptable use',
        ul: [
          'Use Sentinel only for account-opening AML/KYC screening and related compliance work.',
          'Enter details only for applicants who have been told about, and have agreed to, screening as part of the normal account-opening process.',
          'Do not search for yourself, friends, family or anyone else without a business reason.',
          'Do not copy, export or share screening results outside the people who need them for compliance.',
          'Do not try to bypass security, probe the service for weaknesses, overload it or use automated tools against it.',
        ],
      },
      {
        h: 'Screening results are decision support',
        p: [
          'A result shows what was checked, what was found and what could not be checked. A source that could not be read is shown as Not screened and must never be treated as clear. A match, or a lack of one, is not a final determination. A compliance officer must review every result and make the decision.',
          'The lists we check are published by third parties and can be incomplete, delayed or changed without notice. We do not guarantee that they are accurate or complete.',
        ],
      },
      {
        h: 'Confidentiality',
        p: [
          'Applicant details and screening results are confidential. Handle them in line with Packages Group and IGI information security and confidentiality policies, and your own duties as an employee.',
        ],
      },
      {
        h: 'Accounts',
        p: [
          'New accounts need approval from an administrator. We may suspend or remove an account at any time, for example if it is not being used properly, if the person leaves, or to protect the service.',
        ],
      },
      {
        h: 'Availability and changes',
        p: [
          'We aim to keep Sentinel running but do not promise it will always be available or free of errors. We may change or withdraw features, and may update these terms. The date at the top of this page shows when they last changed, and continued use means you accept the update.',
        ],
      },
      {
        h: 'Ownership',
        p: [
          'Sentinel, its design and its content belong to Packages Group or its licensors. You may use it as these terms allow, and no other rights are given.',
        ],
      },
      {
        h: 'Liability',
        p: [
          'To the extent the law allows, Packages Group is not liable for loss that comes from relying on a screening result without proper review, or from the service being unavailable. Nothing here limits liability that cannot be limited by law.',
        ],
      },
      {
        h: 'Governing law',
        p: ['These terms are governed by the laws of Pakistan, and the courts of Pakistan have jurisdiction over any dispute about them.'],
      },
    ],
  },

  [ROUTES.cookies]: {
    title: 'Cookie notice',
    lead:
      'What this site stores in your browser. It is very little, and none of it is used for advertising.',
    sections: [
      {
        h: 'Strictly necessary storage',
        p: [
          'When you sign in, our authentication provider keeps a session token in your browser’s local storage so you stay signed in as you move around and refresh the page. It is removed when you sign out or the session ends. Sentinel also keeps a few small settings in your browser, such as your last activity time for the inactivity timeout.',
          'This storage is needed for the service to work, so it does not ask for consent.',
        ],
      },
      {
        h: 'Bot protection',
        p: [
          'The sign in and request access forms use Cloudflare Turnstile to tell people from automated programs. Turnstile runs a short check in your browser and may set its own cookies or similar storage while it does. It is used only for security.',
        ],
      },
      {
        h: 'Analytics',
        p: [
          'We use Vercel Web Analytics to count page views. It does not use cookies and does not track you across sites or build a profile of you.',
        ],
      },
      {
        h: 'No advertising or tracking cookies',
        p: ['We do not use advertising, social media tracking or marketing cookies.'],
      },
      {
        h: 'Your control',
        p: [
          'You can clear site data in your browser settings at any time. Doing so signs you out. If you block storage entirely, you will not be able to sign in.',
        ],
      },
    ],
  },

  [ROUTES.accessibility]: {
    title: 'Accessibility',
    lead:
      'We want Sentinel to be usable by everyone who needs it for their work.',
    sections: [
      {
        h: 'What we do',
        ul: [
          'You can use the whole site with a keyboard. A “Skip to content” link is available on the landing page.',
          'Text and controls are designed for strong contrast against their background.',
          'Links that open a new tab say so to screen readers.',
          'Animation is reduced or turned off if your device asks for less motion.',
          'Form fields have labels, and errors are announced in words rather than colour alone.',
        ],
      },
      {
        h: 'Known limits',
        p: [
          'We test regularly but may not have caught everything. Some parts, such as evidence PDFs generated from screening results, may not be fully accessible to screen readers.',
        ],
      },
      {
        h: 'Tell us about a problem',
        p: [
          'If something is hard to use, or you need information in another format, please tell us through the contact page on the Packages Group website, linked in the footer. Say which page and which device or assistive technology you were using, and we will work on it and reply.',
        ],
      },
    ],
  },
}
