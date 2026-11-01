export interface BuiltinTemplate {
  id: string;
  title: string;
  category: string;
  description: string;
  accent: string;
  html: string;
}

const p = (text: string) => `<p>${text}</p>`;
const h1 = (text: string) => `<h1>${text}</h1>`;
const h2 = (text: string) => `<h2>${text}</h2>`;
const h3 = (text: string) => `<h3>${text}</h3>`;
const blockquote = (text: string) => `<blockquote><p>${text}</p></blockquote>`;
const placeholder = (text: string) => `<p><span style="color:#8b8798">${text}</span></p>`;

export const BUILTIN_TEMPLATES: BuiltinTemplate[] = [
  {
    id: 'builtin-report',
    title: 'Project report',
    category: 'Reports',
    description: 'A clear status report with summary, milestones, risks, and next steps.',
    accent: '#8B7CF6',
    html: `${h1('Project report')}
      ${p('<span style="color:#8b8798">Prepared by · Date · Project name</span>')}
      <hr>
      ${h2('Executive summary')}
      ${placeholder('In two or three sentences, describe what this project set out to do, where it stands, and what decision the reader needs to make.')}
      ${h2('At a glance')}
      <table><tbody>
        <tr><th><p>Status</p></th><td><p>On track</p></td></tr>
        <tr><th><p>Owner</p></th><td><p>—</p></td></tr>
        <tr><th><p>Timeline</p></th><td><p>—</p></td></tr>
        <tr><th><p>Budget</p></th><td><p>—</p></td></tr>
      </tbody></table>
      ${h2('What we set out to do')}
      ${placeholder('Describe the original goal and why it matters now.')}
      ${h2('Progress')}
      ${h3('Completed')}
      <ul><li><p>—</p></li><li><p>—</p></li></ul>
      ${h3('In progress')}
      <ul><li><p>—</p></li><li><p>—</p></li></ul>
      ${h2('Risks and decisions')}
      ${placeholder('Name the real risks. For each one, say what would reduce it and who owns the response.')}
      ${h2('Next steps')}
      <ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>Confirm the next milestone</p></li><li data-type="taskItem" data-checked="false"><p>Share this report with the team</p></li></ul>`
  },
  {
    id: 'builtin-research',
    title: 'Research paper',
    category: 'Research',
    description: 'An academic structure with abstract, methodology, findings, and references.',
    accent: '#5AA7F7',
    html: `${h1('Title of the paper')}
      ${p('<em>AUTHOR NAME · AFFILIATION · DATE</em>')}
      ${h2('Abstract')}
      ${placeholder('Summarize the question, method, principal finding, and significance in roughly 150 words.')}
      ${h2('Introduction')}
      ${placeholder('Establish the problem, what is already known, and the specific gap this paper addresses.')}
      ${h2('Related work')}
      ${placeholder('Situate the work in the existing literature. Be generous and precise.')}
      ${h2('Method')}
      ${h3('Participants or materials')}
      ${placeholder('Describe what was studied and how it was selected.')}
      ${h3('Procedure')}
      ${placeholder('Describe the procedure in enough detail that another researcher could repeat it.')}
      ${h2('Results')}
      ${placeholder('Report what you observed. Let the evidence speak before interpreting it.')}
      ${h2('Discussion')}
      ${placeholder('Interpret the findings, acknowledge limitations, and suggest what should be studied next.')}
      ${h2('References')}
      ${p('Author, A. (Year). <em>Title of work</em>. Publisher.')}
      ${p('Author, B. (Year). Title of article. <em>Journal Name</em>, Volume(Issue), pages.')}`
  },
  {
    id: 'builtin-essay',
    title: 'Personal essay',
    category: 'Essays',
    description: 'A quiet frame for a narrative essay with a strong opening and reflective close.',
    accent: '#48C6A2',
    html: `${h1('An essay about something that matters')}
      ${p('<em>by Your Name</em>')}
      ${placeholder('Open with a scene, a question, or a small concrete detail that carries the whole essay inside it.')}
      ${p('Let the first paragraph do one thing well. Resist the urge to explain everything at once.')}
      ${h2('The turn')}
      ${placeholder('Here, something changes. A belief is tested, a memory reopens, or a familiar place looks different.')}
      ${blockquote('A line worth remembering.')}
      ${p('Continue the thought. Give the reader room to arrive at the meaning with you rather than before you.')}
      ${h2('What remains')}
      ${placeholder('Close with an image or an honest question. Do not tie a neat bow unless the essay has earned it.')}`
  },
  {
    id: 'builtin-letter',
    title: 'Cover letter',
    category: 'Letters',
    description: 'A confident, human cover letter that connects your work to the role.',
    accent: '#E6A556',
    html: `${p('Your Name<br>Your City · your@email.com · +00 000 000 000')}
      ${p('Month Day, Year')}
      ${p('Hiring Manager<br>Company Name<br>Company Address')}
      ${p('Dear Hiring Manager,')}
      ${p('I am writing to apply for <strong>the role</strong> at <strong>Company</strong>. The work your team is doing with <span style="color:#8b8798">[specific detail]</span> is exactly the kind of problem I want to spend my days on.')}
      ${p('In my current role at <strong>Organization</strong>, I <span style="color:#8b8798">[one concrete achievement with a number or outcome]</span>. That experience taught me how to <span style="color:#8b8798">[relevant capability]</span>, and it is why I can contribute quickly to your team.')}
      ${p('What draws me to this position is <span style="color:#8b8798">[specific reason tied to the company, not the job description]</span>. I would welcome the chance to bring <span style="color:#8b8798">[your distinctive strength]</span> to the work.')}
      ${p('Thank you for your time and consideration. I would be glad to talk further.')}
      ${p('Sincerely,<br><br>Your Name')}`
  },
  {
    id: 'builtin-resume',
    title: 'Résumé',
    category: 'Résumés',
    description: 'A restrained, readable résumé layout with experience and selected work.',
    accent: '#E8788A',
    html: `${h1('YOUR NAME')}
      ${p('Your City · your@email.com · yourwebsite.com · linkedin.com/in/you')}
      <hr>
      ${h2('Profile')}
      ${placeholder('Two lines on what you do, the problems you solve, and the kind of team you do it with.')}
      ${h2('Experience')}
      ${h3('Role — Company')}
      ${p('<span style="color:#8b8798">Month Year – Present · Location</span>')}
      <ul><li><p>Describe an outcome, not a duty. Include a number where it is honest.</p></li><li><p>Name the skill the reader should remember.</p></li><li><p>Keep each bullet to one or two lines.</p></li></ul>
      ${h3('Role — Company')}
      ${p('<span style="color:#8b8798">Month Year – Month Year · Location</span>')}
      <ul><li><p>—</p></li><li><p>—</p></li></ul>
      ${h2('Selected work')}
      ${placeholder('One project, one sentence on the problem, one on what you did, one on the result.')}
      ${h2('Education')}
      ${p('<strong>Degree, Field</strong> — Institution · Year')}
      ${h2('Skills')}
      ${p('Skill · Skill · Skill · Skill')}`
  },
  {
    id: 'builtin-proposal',
    title: 'Business proposal',
    category: 'Business',
    description: 'A persuasive proposal with context, scope, timeline, and investment.',
    accent: '#B7B2C9',
    html: `${h1('Proposal for Client')}
      ${p('<span style="color:#8b8798">Prepared by Your Name · Date · Valid until Date</span>')}
      ${h2('The opportunity')}
      ${placeholder('Describe the client’s situation in their language. Show that you have listened before you prescribe.')}
      ${h2('What we propose')}
      ${placeholder('A short, concrete description of the engagement. Avoid jargon. Name the outcome.')}
      ${h2('Scope of work')}
      <table><tbody>
        <tr><th><p>Phase</p></th><th><p>What happens</p></th><th><p>Timing</p></th></tr>
        <tr><td><p>Discover</p></td><td><p>—</p></td><td><p>Week 1</p></td></tr>
        <tr><td><p>Build</p></td><td><p>—</p></td><td><p>Weeks 2–5</p></td></tr>
        <tr><td><p>Launch</p></td><td><p>—</p></td><td><p>Week 6</p></td></tr>
      </tbody></table>
      ${h2('Investment')}
      ${placeholder('State the fee clearly. Describe what is included and what is not.')}
      ${h2('Why us')}
      ${placeholder('Three specific reasons, each backed by evidence.')}
      ${h2('Next step')}
      ${p('If this looks right, reply to confirm and we will send a short agreement and invoice.')}`
  },
  {
    id: 'builtin-meeting',
    title: 'Meeting notes',
    category: 'Meeting notes',
    description: 'Capture decisions and owners without losing the thread.',
    accent: '#8B7CF6',
    html: `${h1('Meeting notes')}
      ${p('<span style="color:#8b8798">Date · Time · Location</span>')}
      ${p('<strong>Attendees:</strong> —')}
      ${h2('Purpose')}
      ${placeholder('One sentence: why did we meet?')}
      ${h2('Decisions')}
      <ul><li><p>—</p></li></ul>
      ${h2('Discussion')}
      ${placeholder('Capture the shape of the conversation, not a transcript. Note the reasoning behind decisions.')}
      ${h2('Actions')}
      <ul data-type="taskList">
        <li data-type="taskItem" data-checked="false"><p>Owner — action — due date</p></li>
        <li data-type="taskItem" data-checked="false"><p>Owner — action — due date</p></li>
        <li data-type="taskItem" data-checked="false"><p>Owner — action — due date</p></li>
      </ul>
      ${h2('Open questions')}
      ${placeholder('What remains unresolved, and who will answer it?')}`
  },
  {
    id: 'builtin-case-study',
    title: 'Case study',
    category: 'Business',
    description: 'Tell a client story with tension, evidence, and a measurable result.',
    accent: '#5AA7F7',
    html: `${h1('How Client achieved Result')}
      ${p('<em>A case study with Your Company</em>')}
      ${h2('The challenge')}
      ${placeholder('Set the scene. What was at stake, and what had already been tried?')}
      ${h2('The approach')}
      ${placeholder('Describe the work in three moves. Keep the client the hero.')}
      ${blockquote('A short quotation from the client, if you have permission to use one.')}
      ${h2('The result')}
      <table><tbody>
        <tr><th><p>Measure</p></th><th><p>Before</p></th><th><p>After</p></th></tr>
        <tr><td><p>—</p></td><td><p>—</p></td><td><p>—</p></td></tr>
        <tr><td><p>—</p></td><td><p>—</p></td><td><p>—</p></td></tr>
      </tbody></table>
      ${h2('What we learned')}
      ${placeholder('One honest insight that would help another team facing the same problem.')}`
  },
  {
    id: 'builtin-press',
    title: 'Press release',
    category: 'Business',
    description: 'A clean announcement with quotes, context, and boilerplate.',
    accent: '#E6A556',
    html: `${p('<strong>FOR IMMEDIATE RELEASE</strong>')}
      ${h1('Company announces news that matters')}
      ${p('<span style="color:#8b8798">CITY, Month Day, Year</span>')}
      ${p('Lead paragraph: who, what, when, where, and why it matters — in plain language.')}
      ${p('Second paragraph: the context behind the announcement and the problem it solves.')}
      ${p('“A quotation that sounds like a person, not a brochure,” said Name, Title at Company. “A second sentence on why this matters.”')}
      ${p('Additional details, availability, pricing, or how to learn more.')}
      ${h2('About Company')}
      ${p('One paragraph describing the company, its work, and where to find it online.')}
      ${p('<strong>Media contact:</strong> Name · email · phone')}
      ${p('###')}`
  },
  {
    id: 'builtin-journal',
    title: 'Daily journal',
    category: 'Personal',
    description: 'A gentle daily page for noticing, thinking, and beginning again.',
    accent: '#48C6A2',
    html: `${h1('Today')}
      ${p('<span style="color:#8b8798">Date · Place · Weather</span>')}
      ${h2('What I noticed')}
      ${placeholder('Start with the smallest true thing.')}
      ${h2('What I am thinking about')}
      ${placeholder('Let the thought wander without asking it to become useful.')}
      ${h2('One thing worth keeping')}
      ${blockquote('—')}
      ${h2('Tomorrow')}
      <ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>One small thing to begin with</p></li></ul>`
  },
  {
    id: 'builtin-planner',
    title: 'Weekly planner',
    category: 'Personal',
    description: 'A calm weekly overview with priorities, schedule, and a reflection.',
    accent: '#B7B2C9',
    html: `${h1('Week of Month Day')}
      ${p('<span style="color:#8b8798">A plan is a direction, not a promise.</span>')}
      ${h2('Three priorities')}
      <ol><li><p>—</p></li><li><p>—</p></li><li><p>—</p></li></ol>
      ${h2('Schedule')}
      <table><tbody>
        <tr><th><p>Day</p></th><th><p>Focus</p></th><th><p>Notes</p></th></tr>
        <tr><td><p>Monday</p></td><td><p>—</p></td><td><p>—</p></td></tr>
        <tr><td><p>Tuesday</p></td><td><p>—</p></td><td><p>—</p></td></tr>
        <tr><td><p>Wednesday</p></td><td><p>—</p></td><td><p>—</p></td></tr>
        <tr><td><p>Thursday</p></td><td><p>—</p></td><td><p>—</p></td></tr>
        <tr><td><p>Friday</p></td><td><p>—</p></td><td><p>—</p></td></tr>
      </tbody></table>
      ${h2('To do')}
      <ul data-type="taskList">
        <li data-type="taskItem" data-checked="false"><p>—</p></li>
        <li data-type="taskItem" data-checked="false"><p>—</p></li>
        <li data-type="taskItem" data-checked="false"><p>—</p></li>
      </ul>
      ${h2('Friday reflection')}
      ${placeholder('What moved? What did not? What will you carry into next week?')}`
  },
  {
    id: 'builtin-manuscript',
    title: 'Book manuscript',
    category: 'Essays',
    description: 'A simple manuscript with title page, chapter opener, and scene breaks.',
    accent: '#E8788A',
    html: `${h1('The title of your book')}
      ${p('<em>by Your Name</em>')}
      <div data-page-break="true"></div>
      ${h2('Chapter one')}
      ${p('The first line can be simple. It only has to make the reader want the second.')}
      ${p('Write the scene as it happens. Let the room, the weather, and the objects around your characters carry some of the meaning.')}
      ${p('<span style="color:#8b8798">— scene break —</span>')}
      ${p('When you begin again, change something. A new place, a new time, a new pressure.')}
      ${h2('Chapter two')}
      ${placeholder('What does the character want now that they did not want before?')}`
  }
];
