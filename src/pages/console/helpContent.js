import { MIN_PASSWORD_LENGTH } from '../../auth/AuthContext'
import { DEFAULT_THRESHOLD } from '../../lib/preferences'
import { IDLE_CHOICES } from '../../lib/idle'

/**
 * The user manual, as data so the Help page can search it and hide what a person cannot use.
 *
 * A section is { id, title, summary, admin?, blocks }. `admin` hides the whole section from people who are not
 * administrators, and a block can carry `admin: true` to do the same for one part of a section. Text may mark
 * words in bold with **double stars**. Blocks:
 *
 *   { t: 'p', text }                       a paragraph
 *   { t: 'h', text }                       a sub heading
 *   { t: 'steps', items: [{ title, text }] }   numbered steps
 *   { t: 'list', items: [text] }           bullets
 *   { t: 'defs', items: [{ term, text }] } a term and its meaning
 *   { t: 'table', head: [..], rows: [[..]] }
 *   { t: 'note', tone: 'tip' | 'warn' | 'info', title, text }
 *   { t: 'tabs' }                          the list of tabs, each with a button that opens it
 *
 * Keep it in step with the screens: when a button, label or rule changes, change it here too. No dashes as
 * punctuation (like the rest of the app's text): commas, colons and full stops.
 */

/** The tabs, with what each is for. Also used by the "open this tab" buttons in the manual. */
export const TAB_GUIDE = [
  { id: 'screen', label: 'Screening', text: 'Check one person, or a whole file of people, against every list.' },
  { id: 'history', label: 'History', text: 'Every screening you have run, searchable, with its full result and evidence.' },
  { id: 'monitoring', label: 'Monitoring', text: 'People you keep watching, and the alerts when a list change brings up a new match.' },
  { id: 'lists', label: 'Lists', text: 'Which watch lists are loaded, how many records they hold and whether they can be read.' },
  { id: 'people', label: 'People', text: 'Approve new accounts and manage who can use Sentinel.', admin: true },
]

export const SECTIONS = [
  {
    id: 'start',
    title: 'Welcome to Sentinel',
    summary: 'What Sentinel does, the parts of the screen, and how to run your first screening.',
    blocks: [
      {
        t: 'p',
        text: 'Sentinel checks an applicant against the UN Security Council, OFAC (US Treasury), UK, FIA Red Book and NACTA lists, against a list of politically exposed persons (PEPs), and against an open news search. You get one clear verdict with the evidence attached, and a record of what was checked.',
      },
      { t: 'h', text: 'The parts of the screen' },
      { t: 'tabs' },
      {
        t: 'p',
        text: 'The round button at the top right is your **profile menu**. It holds **Settings**, **Notifications**, **Help** (this manual) and **Sign out**. A red dot on it means you have unread notifications.',
      },
      { t: 'h', text: 'Your first screening' },
      {
        t: 'steps',
        items: [
          { title: 'Open the Screening tab.', text: 'It opens on **Individual**, for one person.' },
          { title: 'Type the full name.', text: 'The name is the only thing you must enter. Add a CNIC, date of birth, father or husband name, nationality and province whenever you have them, because they make the result more precise.' },
          { title: 'Press Run screening.', text: 'It usually takes 20 to 40 seconds, because the lists are read at that moment.' },
          { title: 'Read the verdict.', text: '**Escalate**, **Review** or **Clear**, with the next step to take and one card for every source.' },
          { title: 'Record your decision.', text: 'Under the result, choose Cleared, Confirmed match or Escalated, add a note and save it, so the next person knows what you concluded.' },
        ],
      },
      {
        t: 'note', tone: 'warn', title: 'Before you screen anyone',
        text: 'Only screen applicants who have already agreed to KYC and AML screening. The name is also sent to a news search. The data handling notice in the page footer explains what is kept and why.',
      },
    ],
  },
  {
    id: 'account',
    title: 'Signing in and your account',
    summary: 'Requesting an account, approval, signing in and how sessions end.',
    blocks: [
      { t: 'h', text: 'Getting an account' },
      {
        t: 'steps',
        items: [
          { title: 'Request an account.', text: 'On the landing page choose **Request an account**, enter your work email and a password of at least ' + MIN_PASSWORD_LENGTH + ' characters, and send the request.' },
          { title: 'Confirm your email if asked.', text: 'If the page says to check your email, open the link in that message first.' },
          { title: 'Wait for approval.', text: 'An administrator approves every account. Until then you can sign in to see where your request stands, and **Check again** refreshes it.' },
          { title: 'Sign in.', text: 'Once approved, sign in with your email and password and the console opens.' },
        ],
      },
      {
        t: 'defs',
        items: [
          { term: 'Waiting', text: 'Your request has not been decided yet.' },
          { term: 'Declined', text: 'An administrator declined it. Contact the compliance team if you think that is a mistake.' },
          { term: 'Disabled', text: 'Your account was switched off. Only an administrator can switch it back on.' },
        ],
      },
      {
        t: 'note', tone: 'tip', title: 'The security check',
        text: 'On some screens a short security check appears above the button. Wait for it to finish before you press the button. It protects the sign in from automated attacks.',
      },
      { t: 'h', text: 'When you are signed out' },
      {
        t: 'list',
        items: [
          'After a period with no activity you are signed out automatically. It is 30 minutes unless you choose less in **Settings, Security** (' + IDLE_CHOICES.join(', ') + ' minutes).',
          'Choose **Sign out** in the profile menu when you leave a shared computer. It also clears the screenings kept in memory.',
          'If you forgot to sign out somewhere else, use **Settings, Security, Sign out other devices**.',
        ],
      },
    ],
  },
  {
    id: 'screening',
    title: 'Screening one person',
    summary: 'The Individual form, what each field does and how a result is decided.',
    blocks: [
      { t: 'p', text: 'Open the **Screening** tab and keep **Individual** selected. Fill in the form on the left, press **Run screening**, and the result appears on the right. **Clear** empties the form.' },
      {
        t: 'table',
        head: ['Field', 'What to enter', 'Required'],
        rows: [
          ['Full name', 'As written on the ID. Word order and titles such as Dr or Haji do not matter. Use Latin letters.', 'Yes'],
          ['Father or husband', 'The name of the applicant\'s father or husband.', 'No'],
          ['Date of birth', 'Pick the date. It is shown next to each match as evidence.', 'No'],
          ['Nationality', 'For example Pakistan.', 'No'],
          ['CNIC', '13 digits. Dashes and spaces are fine.', 'No'],
          ['Province', 'Choose from the list, or leave it as Not known.', 'No'],
        ],
      },
      {
        t: 'note', tone: 'info', title: 'How the extra details are used',
        text: 'A CNIC that equals a CNIC on the NACTA, FIA Red Book or PEP lists is reported as a match whatever the name looks like, so enter it whenever you have it. The other details, including the province, are shown beside each match as supporting evidence and never remove one.',
      },
      { t: 'h', text: 'Match threshold' },
      {
        t: 'p',
        text: 'The slider sets how similar a listed name must be to the applicant\'s name to be reported, from 50 to 100 percent. **' + DEFAULT_THRESHOLD + '** is the standard setting. Lower it to catch more spelling variants, at the price of many more false matches to review. Your own starting value can be set in **Settings, Screening**.',
      },
      { t: 'h', text: 'Keep monitoring this person' },
      {
        t: 'p',
        text: 'Tick this box to screen the person again automatically whenever a watch list changes, and be told about any new match. Only you see the alerts. See **Continuous monitoring** below.',
      },
      { t: 'h', text: 'What gets checked' },
      {
        t: 'list',
        items: [
          '**UN Security Council** Consolidated List',
          '**OFAC** SDN and Consolidated (non-SDN) lists',
          '**UK Sanctions List** (FCDO)',
          '**FIA Red Books** (Pakistan, most wanted)',
          '**NACTA** Proscribed Persons, the Fourth Schedule (Pakistan)',
          '**Politically exposed persons**, national and provincial (Pakistan)',
          '**Adverse media**, an open news search for the name next to risk words',
        ],
      },
      {
        t: 'p',
        text: 'Every list is read live from its publisher, so a result reflects the lists as they are today. A list that cannot be read is reported as **Not screened**. It never counts as clear.',
      },
    ],
  },
  {
    id: 'batch',
    title: 'Screening a file of people',
    summary: 'Upload an Excel, CSV or Word file and screen every row in one go.',
    blocks: [
      { t: 'p', text: 'On the Screening tab choose **Batch** (the arrow keys move between Individual and Batch). Each row of the file is screened exactly like an individual screening, against the same lists and with the same rules.' },
      {
        t: 'steps',
        items: [
          { title: 'Prepare the file.', text: 'One applicant per row, with the column names in the first row. Use Excel (.xlsx or .xls), CSV, or a Word (.docx) file where the first table holds the applicants. The limit is 10 MB and 500 rows.' },
          { title: 'Upload it.', text: 'Drop the file on the box or browse for it. **Replace** and **Remove** change your choice before you run.' },
          { title: 'Set the threshold and monitoring.', text: 'The same threshold applies to every row. Tick **Keep monitoring everyone in this file** if you want them all watched.' },
          { title: 'Run batch screening.', text: 'A progress bar shows the row being screened. **Cancel** stops after the row in progress.' },
          { title: 'Review the results.', text: 'Filter by outcome, open any row with **View case**, and download the results.' },
        ],
      },
      {
        t: 'table',
        head: ['Column', 'Notes', 'Required'],
        rows: [
          ['Full name', 'As written on the ID', 'Yes'],
          ['Date of birth', 'YYYY-MM-DD', 'No'],
          ['Nationality', 'For example Pakistan', 'No'],
          ['CNIC', '13 digits, dashes optional', 'No'],
          ['Father or husband', 'Name', 'No'],
          ['Province', 'For example Punjab', 'No'],
        ],
      },
      { t: 'p', text: '**Download a template** gives you a CSV with these columns, ready to fill in.' },
      { t: 'h', text: 'The results' },
      {
        t: 'list',
        items: [
          'The totals show how many rows need escalating, need review, are clear, and were not screened.',
          '**Download results (.xlsx)** gives one line per row of your file, including rows that were not screened.',
          '**Evidence (.zip)** holds every evidence PDF the batch produced. It is only available when a row had a match or a news lead.',
          '**Screen another file** starts again.',
        ],
      },
      {
        t: 'note', tone: 'warn', title: 'A row that was not screened is never clear',
        text: 'A row can be not screened because it has no usable name, failed, or was not reached after a cancel. The reason is shown on the row. Fix it in the file and upload again.',
      },
      {
        t: 'note', tone: 'info', title: 'Good to know',
        text: 'You can run one batch at a time. A batch keeps running on the server if you switch tabs, and every screened row is saved in History.',
      },
    ],
  },
  {
    id: 'results',
    title: 'Reading a result',
    summary: 'The verdict, the source cards, the match details and the evidence PDF.',
    blocks: [
      { t: 'h', text: 'The verdict' },
      {
        t: 'defs',
        items: [
          { term: 'Escalate', text: 'A potential watch list match. Escalate to compliance. A match is not a confirmed identity, so check the date of birth and identifiers against the source record before any decision.' },
          { term: 'Review', text: 'Something needs a person to look at it: a possible politically exposed person, an adverse news lead, or a list that could not be screened. This is not a clearance.' },
          { term: 'Clear', text: 'Every list was screened and nothing was found at this threshold. It is automated name matching only and does not replace your normal checks.' },
        ],
      },
      {
        t: 'p',
        text: 'Under the verdict you see the number of watch list matches, PEP matches (when there are any), news leads, records screened and the threshold used, then a plain **next step** that names what triggered it.',
      },
      { t: 'h', text: 'One card for every source' },
      {
        t: 'defs',
        items: [
          { term: 'Match', text: 'The list holds a person whose name is close enough to be reported.' },
          { term: 'Review', text: 'Something to look at, such as a possible PEP or a news lead.' },
          { term: 'Incomplete', text: 'Part of the source could not be read or is out of date. Not a clearance.' },
          { term: 'Clear', text: 'The source was read and nothing was found.' },
          { term: 'Not screened', text: 'The source could not be read at all. The card says why. Screen again once it is fixed.' },
          { term: 'Switched off', text: 'You turned this list off in Settings, so it was not checked.' },
        ],
      },
      { t: 'h', text: 'Inside a match' },
      {
        t: 'list',
        items: [
          'The **similarity meter** shows how close the names are, from 0 to 100. **Matched on CNIC** means the identity number is the same, the strongest signal Sentinel gives.',
          'Green and amber tags compare the listed person with your applicant: **Birth year matches or differs** (only when you entered a date of birth), **Father\'s name**, **Province** and **CNIC**.',
          '**Matched on the alias** shows when the applicant\'s name resembled another name the listed person uses. **Other names**, **Programme**, **Listed on** and **Source remarks** give the publisher\'s details.',
          'PEP matches show the **level** (National or Provincial) and the **office held**.',
          'News articles open in a new tab. They are unverified leads, because the person in an article may be someone else with the same name.',
        ],
      },
      { t: 'h', text: 'The evidence PDF' },
      {
        t: 'p',
        text: 'When a screening finds a match or a news lead, **Download evidence PDF** appears under the verdict. The report has the result, the applicant, what was checked, one card per match and a block for the reviewer\'s decision, so it can go straight into a compliance file.',
      },
      {
        t: 'note', tone: 'warn', title: 'A result is a lead, not a ruling',
        text: 'Sentinel does automated fuzzy name matching. No adverse action should be taken without a compliance officer confirming identity against the source record.',
      },
    ],
  },
  {
    id: 'decisions',
    title: 'Recording your decision',
    summary: 'The Your decision panel under every result, in Screening and in History.',
    blocks: [
      { t: 'p', text: 'Under every result, in Screening and in History, there is a **Your decision** panel. It records what a person concluded, so the next person does not have to work it out again. It never changes the screening result itself.' },
      {
        t: 'defs',
        items: [
          { term: 'Cleared', text: 'A false alarm: not the listed person.' },
          { term: 'Confirmed match', text: 'The same person as the listed one.' },
          { term: 'Escalated', text: 'Passed to compliance or a senior reviewer.' },
        ],
      },
      {
        t: 'steps',
        items: [
          { title: 'Choose a decision.', text: 'Press one of the three buttons.' },
          { title: 'Add a note if useful.', text: 'Up to 1000 characters, for example "Different date of birth and father\'s name".' },
          { title: 'Press Save decision.', text: 'It is stored with your name and the time. **Remove decision** takes it back.' },
        ],
      },
      {
        t: 'list',
        items: [
          'The decision shows on the History row ("Decision: Cleared") and in the CSV you download.',
          'Administrators can record a decision on anyone\'s screening, from the People tab. Every change is written to the audit log.',
        ],
      },
    ],
  },
  {
    id: 'history',
    title: 'History',
    summary: 'Find, reopen and export every screening you have run.',
    blocks: [
      { t: 'p', text: 'Every screening is saved automatically. The **History** tab lists your own, newest first, each with its date, a case number such as #00012, its outcome, your decision and whether the person is under monitoring.' },
      {
        t: 'list',
        items: [
          '**Search by name** narrows the list as you type.',
          'The filters show **All**, **Escalated**, **Needs review** or **Clear**.',
          'Long histories show 100 at a time. **Show more** adds the next 100.',
          '**Select a name** to open the full case: the report, the evidence PDF, your decision and the monitoring switch.',
          '**Download as CSV** saves your history as a spreadsheet: case reference, name, date, outcome, your decision and note, and whether the person is monitored.',
        ],
      },
      {
        t: 'note', tone: 'info', title: 'History is private',
        text: 'You see only your own screenings, administrators included. An administrator reads another person\'s history from the People tab, in read only form.',
      },
    ],
  },
  {
    id: 'monitoring',
    title: 'Continuous monitoring',
    summary: 'Keep watching people after the day you screened them.',
    blocks: [
      { t: 'p', text: 'A screening is a photograph of one day. Someone who is clear today can be listed next week. A person under continuous monitoring is screened again automatically, and a new potential match becomes an alert for you.' },
      { t: 'h', text: 'Putting someone under monitoring' },
      {
        t: 'list',
        items: [
          'Tick **Keep monitoring this person** on the screening form, or **Keep monitoring everyone in this file** on a batch.',
          'Or open a case and press **Start monitoring**. It checks the person against today\'s lists straight away, so someone screened weeks ago is not left unchecked.',
          'To make it your habit, turn on **Monitor new screenings by default** in **Settings, Screening**.',
        ],
      },
      { t: 'h', text: 'How the checking works' },
      {
        t: 'list',
        items: [
          'Every list is checked **once a day**. Each list is compared with the copy stored last time.',
          'When a list has changed, every monitored person is screened against that list again, with the threshold, CNIC, father\'s name and province of the original screening.',
          'Only a **new** match raises an alert: not one the person already had when first screened, and not one already alerted. A match is raised once, however often a list changes.',
          'The original screening is never rewritten. It stays as a record of that day.',
          'Adverse media is not part of monitoring. Screen the person again by hand for a fresh news check.',
        ],
      },
      { t: 'h', text: 'The Monitoring tab' },
      {
        t: 'list',
        items: [
          'The summary shows how many people you watch and how many alerts need review. **When each list was last checked** is under it.',
          '**People being monitored** lists everyone you watch, when they were last checked, and a **Stop monitoring** button for each.',
          'Alerts are filtered **Open**, **Confirmed** and **Dismissed**. Open an alert to see the listed person\'s details.',
          'Add an optional note, then press **Confirm: this is the same person** or **Dismiss: someone else**. **Reopen** undoes it.',
        ],
      },
      {
        t: 'note', tone: 'tip', title: 'You will be told',
        text: 'While the console is open it looks for new alerts every minute. A message pops up, the Monitoring tab shows a count, and the alert is added to your Notifications.',
      },
      {
        t: 'note', tone: 'info', title: 'Private and kept on purpose',
        text: 'Alerts are visible only to the person who ran the screening, administrators included. Screenings under monitoring are kept when you clear your history, so monitoring never stops silently. Stop monitoring first if you want to delete them.',
      },
    ],
  },
  {
    id: 'lists',
    title: 'Watch lists',
    summary: 'See which lists are loaded and healthy, and how administrators manage them.',
    blocks: [
      { t: 'p', text: 'The **Lists** tab shows every list Sentinel checks, with its **status**, number of **records** and how long ago it was **loaded**. You normally never need to touch it: lists are read live when a screening runs and kept in memory for about an hour so repeated screenings are quick.' },
      {
        t: 'defs',
        items: [
          { term: 'Ready', text: 'The list was read and holds records.' },
          { term: 'Problem', text: 'The list could not be read. The reason is shown under its name, with **Show the full error** for the detail.' },
          { term: 'Not loaded yet', text: 'It has not been read since the server started. It loads on the next screening.' },
        ],
      },
      { t: 'h', text: 'NACTA and PEP' },
      {
        t: 'list',
        items: [
          '**NACTA** publishes the Fourth Schedule through a web portal, not a download address, so the list is loaded from a file or refreshed on a schedule. If it is missing, or older than the allowed age (30 days by default), screenings report it as not screened or incomplete and go to manual review.',
          '**PEPs**: Pakistan publishes no official list. Sentinel uses national and provincial office holders from Wikidata, refreshed in the background, together with any list an administrator uploads. A PEP match is not a sanctions hit: it sends the applicant to manual review for enhanced due diligence.',
        ],
      },
      { t: 'h', text: 'Switching a list off for yourself' },
      {
        t: 'p',
        text: 'In **Settings, Lists** you can switch off any list for your own screenings. A switched off list is not read, every case says it was switched off, and it never counts as clear. Other people and monitoring are not affected.',
      },
      { t: 'h', text: 'Administrator tools', admin: true },
      {
        t: 'list', admin: true,
        items: [
          '**Reload all lists now** drops the memory copy and reads every list again. It takes up to 40 seconds and is limited to 5 reloads an hour.',
          '**Upload NACTA list** loads a CSV or JSON export. On the NACTA portal choose the JSON button to save the list. A CNIC, father\'s name and province column make matching far more precise.',
          '**Upload PEP list** loads your own CSV, JSON or XML. Columns: Name (required), Position, Level (National, Provincial or Local), Province, CNIC, Father Name, Date of Birth, Aliases, Party. A new upload replaces your previous one. **Remove my list** deletes it, and **Fetch from Wikidata now** starts a fresh fetch.',
          '**Check that names are on the lists** takes one name per line (up to 200) and shows which are found and where. Nothing is saved to anyone\'s history. It is the way to confirm the lists cover the people you expect.',
        ],
      },
    ],
  },
  {
    id: 'notifications',
    title: 'Notifications',
    summary: 'Messages about screenings, monitoring, lists and your account.',
    blocks: [
      { t: 'p', text: 'Open **Notifications** from the profile menu. It lists the messages from this session, newest first. A red dot on the profile button and a count on the menu show how many are unread, and opening the page marks them all read.' },
      {
        t: 'list',
        items: [
          'Some messages have an **Open** button that takes you to the right tab, for example Open Monitoring.',
          '**Clear all** empties the list.',
          'Messages are kept in this browser tab only. They are gone when you reload or sign out.',
          'A message about something that needs your attention, such as a screening that failed, is always shown.',
        ],
      },
      {
        t: 'p',
        text: 'Choose what you hear about in **Settings, Notifications**: turn all messages or only the pop-ups off, and switch the kinds on or off one by one (screenings and batches, monitoring, lists, your account' + ', and people waiting for approval for administrators).',
      },
    ],
  },
  {
    id: 'settings',
    title: 'Settings',
    summary: 'Your account, notifications, lists, screening defaults, security and display.',
    blocks: [
      { t: 'p', text: 'Open **Settings** from the profile menu. Choose a section on the left. Changes save by themselves a moment after you make them. **Escape** or a click outside closes the window.' },
      {
        t: 'table',
        head: ['Section', 'What you can do'],
        rows: [
          ['Account', 'See your email, role and status. Change your password (at least ' + MIN_PASSWORD_LENGTH + ' characters, and it must differ from the current one). Download your history as CSV. Clear your search history. Disable or delete your account.'],
          ['Notifications', 'Switch all messages, pop-ups and each kind of message on or off.'],
          ['Lists', 'Switch lists off for your own screenings.'],
          ['Screening', 'Set the match threshold a new screening starts from, and whether new screenings are monitored by default.'],
          ['Security', 'Choose how soon an idle session ends, sign out of your other devices, or sign out of this one.'],
          ['Display', 'Choose the tab Sentinel opens on after you sign in, and Comfortable or Compact spacing.'],
        ],
      },
      { t: 'h', text: 'Your data' },
      {
        t: 'list',
        items: [
          '**Download CSV** saves the screenings you have run.',
          '**Clear search history** deletes your screenings, with their results and evidence, after you confirm. Screenings under monitoring are kept. It cannot be undone, and it is recorded in the audit log by count only.',
        ],
      },
      { t: 'h', text: 'Disable or delete your account' },
      {
        t: 'defs',
        items: [
          { term: 'Disable', text: 'Locks the account at once. Everything is kept, and only an administrator can switch it back on.' },
          { term: 'Delete', text: 'Removes your sign in for good. You must type your email address to confirm. Your past screenings stay in the compliance record with no name on them, visible to administrators only.' },
        ],
      },
      {
        t: 'note', tone: 'warn', title: 'The last administrator',
        text: 'The only administrator cannot disable or delete their own account. Make someone else an administrator first.',
      },
    ],
  },
  {
    id: 'people',
    title: 'People',
    admin: true,
    summary: 'Administrators approve new accounts and manage who can use Sentinel.',
    blocks: [
      { t: 'p', text: 'The **People** tab is for administrators. A number on the tab shows how many accounts are waiting, and a message tells you when new ones arrive.' },
      {
        t: 'list',
        items: [
          'The filters show **Waiting**, **Everyone**, **Declined** and **Disabled**.',
          '**Approve** lets a waiting person in. **Decline** refuses the request.',
          '**Make administrator** and **Make a regular user** change someone\'s role. An administrator approves people, manages the lists and can read each person\'s history.',
          '**Disable** locks someone out at once and stops any batch they are running. Nothing is deleted, and **Enable** switches them back on.',
          '**Delete** removes the account for good. Their past screenings stay in the history, without their name on them. To stop someone for now, disable them instead.',
          '**Select a person\'s email** to read their screening history. It is read only, and **Back to People** returns you to the list.',
        ],
      },
      {
        t: 'note', tone: 'info', title: 'Safeguards',
        text: 'Actions that remove access, delete someone or grant administrator rights ask you to confirm first. You cannot change your own account here, and the last administrator can never be removed.',
      },
    ],
  },
  {
    id: 'glossary',
    title: 'Glossary',
    summary: 'The terms used in results and lists.',
    blocks: [
      {
        t: 'defs',
        items: [
          { term: 'Case reference', text: 'The unique number of a screening, such as CS-20261014-00012. Quote it when you talk about a result.' },
          { term: 'CNIC', text: 'The 13 digit national identity card number. A CNIC match is the strongest signal Sentinel gives.' },
          { term: 'Match threshold', text: 'The minimum name similarity, from 50 to 100 percent, for a listed name to be reported.' },
          { term: 'Name similarity', text: 'A score from 0 to 100 for how close two names are, allowing for spelling variants, word order and titles.' },
          { term: 'Alias', text: 'Another name a listed person is known by. A match on an alias is labelled as such.' },
          { term: 'PEP', text: 'A politically exposed person: someone who holds, or recently held, a prominent public office. Not a sanctions hit, but a reason for enhanced due diligence.' },
          { term: 'Adverse media', text: 'News that mentions the name next to words such as fraud, terror or corruption. Unverified, and possibly about someone else.' },
          { term: 'NACTA', text: 'Pakistan\'s National Counter Terrorism Authority. Its Fourth Schedule lists proscribed persons.' },
          { term: 'FIA Red Book', text: 'The Federal Investigation Agency\'s list of most wanted people.' },
          { term: 'OFAC', text: 'The US Treasury\'s Office of Foreign Assets Control, which publishes the SDN and Consolidated sanctions lists.' },
          { term: 'Evidence PDF', text: 'The report made when a screening finds a match or a news lead, for the compliance file.' },
          { term: 'Continuous monitoring', text: 'Screening a person again automatically when a watch list changes, so a later listing is not missed.' },
          { term: 'Alert', text: 'A new potential match found by monitoring, waiting for you to confirm or dismiss it.' },
        ],
      },
    ],
  },
  {
    id: 'faq',
    title: 'Questions and troubleshooting',
    summary: 'Quick answers to the things people ask most.',
    blocks: [
      {
        t: 'defs',
        items: [
          { term: 'A card says Not screened.', text: 'That list could not be read at the time. The card says why. It is never a clearance. Check the Lists tab, then screen again once it shows Ready.' },
          { term: 'Why Review when no name matched?', text: 'Review also means a possible PEP, a news lead, or a list that was incomplete. The next step under the verdict names which.' },
          { term: 'A screening is slow.', text: 'It usually takes 20 to 40 seconds because the lists are read live. The first request after a quiet period can take longer while the server wakes up.' },
          { term: 'I was signed out.', text: 'Sessions end after a period with no activity. Sign in again. You can lengthen or shorten it in Settings, Security.' },
          { term: 'I cannot see a colleague\'s screening.', text: 'History is private to the person who ran it. An administrator can read it from the People tab.' },
          { term: 'A list shows as Switched off.', text: 'You turned it off in Settings, Lists. Turn it back on there and screen again.' },
          { term: 'It says I made too many requests.', text: 'Screenings are limited to 10 a minute, and batches to 20 an hour. Wait a moment and try again.' },
          { term: 'It says a batch is already running.', text: 'You can run one batch at a time. Wait for it to finish, or cancel it.' },
          { term: 'How do I delete a screening?', text: 'Use Settings, Account, Clear search history. Screenings under monitoring are kept: stop monitoring them first.' },
          { term: 'Can I rely on a Clear result?', text: 'Treat it as one input. It is automated name matching and does not replace your normal checks.' },
        ],
      },
    ],
  },
]
