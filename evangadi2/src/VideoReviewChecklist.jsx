import React, { useState, useMemo, useEffect } from "react";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
} from "docx";
import api from "./api";

/**
 * VideoReviewChecklist — connected to backend
 * - Accepts props: initialTutor, initialStudent, initialDate, studentId
 * - Loads past reviews for this student from /api/reviews/student/:studentId
 * - "Save to server" sends review to MySQL
 * - "Export .docx" still works (download Word doc) — optional folder save
 *
 * Added:
 * - 1-on-1 Coding checklist section (own toggle, separate from Group Coding)
 * - Session score out of 100 with a visible breakdown
 * - Feedback for the Tutor section, draftable from the selected observations
 */

function useMediaQuery(query) {
  const [matches, setMatches] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(query).matches : false,
  );
  useEffect(() => {
    const mq = window.matchMedia(query);
    const handler = (e) => setMatches(e.matches);
    mq.addEventListener("change", handler);
    setMatches(mq.matches);
    return () => mq.removeEventListener("change", handler);
  }, [query]);
  return matches;
}

const SECTIONS = [
  {
    id: "start",
    title: "Starting the Session",
    accent: "#2563eb",
    items: [
      "Joined the session on time",
      "Greeted the student by name",
      "Clearly stated the lesson goal at the beginning of the session",
      "Came prepared with all required materials",
      "Maintained stable audio/video and a quiet, professional background",
      "Confirmed the student could see and hear clearly",
      "Ensured the student had a notebook and pencil ready",
      "Started with a brief warm-up and checked what the student is learning in school",
    ],
  },
  {
    id: "during",
    title: "During the Session",
    accent: "#7c3aed",
    items: [
      "Explained concepts clearly, step by step, using level-appropriate examples",
      "Asked frequent questions to check understanding",
      "Encouraged the student to explain ideas in their own words",
      "Provided gentle corrections and positive, motivating feedback",
      "Adjusted pace or teaching style based on student needs",
      "Used visuals, real-life examples, or short breaks to maintain attention",
      "Monitored progress through quick reviews or mini-checks",
    ],
  },
  {
    id: "end",
    title: "End of the Session",
    accent: "#059669",
    items: [
      "Clearly covered all session objectives",
      "Student demonstrated understanding and learning progress",
      "Invited student questions and clarified responses",
      "Summarized the lesson and reinforced key concepts",
      "Connected the lesson to future learning",
      "Provided clear, constructive feedback and corrected errors",
      "Ended the session positively with encouragement",
      "Shared clear next steps and a brief preview of the next session",
    ],
  },
];

// Extra section shown ONLY when the reviewer marks this as a group / coding session.
// Kept separate from SECTIONS so 1-on-1 review scores aren't affected.
const GROUP_SECTION = {
  id: "group",
  title: "Group & Coding Session",
  accent: "#c026d3",
  items: [
    "ALL students actively participated — each one wrote, ran, or explained code",
    "Tutor called on each student by name, rotating fairly around the group",
    "Quiet or shy students were gently invited in — nobody was a passive spectator",
    "Praise was balanced — when one student was encouraged, others were recognized too",
    "No comparisons between students (avoided things like 'look how fast X finished')",
    "Students worked collaboratively — helping each other before asking the tutor",
    "Turn-taking for screen control / typing was fair and organized",
    "Different kinds of success were celebrated (creativity, persistence, helping) — not just speed",
    "Tutor checked every student's screen/progress, not only the one currently talking",
    "Group moved forward together — no child was left behind on a step",
    "Errors were treated as fun discoveries ('bugs are clues!'), never as failures",
    "Every student got to see their own code run and got a moment of recognition at the end",
  ],
};

// Used for 1-on-1 CODING sessions. This one REPLACES the standard sections —
// a coding review has no notebook, no document camera, no workbook — so it
// carries its own setup and closing items and stands alone.
const CODING_SECTION = {
  id: "code",
  title: "1-on-1 Coding Session",
  accent: "#0d9488",
  items: [
    // Setup & professionalism
    "Joined the session on time",
    "Greeted the student by name",
    "Maintained stable audio/video and a quiet, professional background",
    "Confirmed the student could see the shared screen and editor clearly",
    // Opening
    "Reviewed the previous session's code and checked what the student retained",
    "Stated what the session would build or cover",
    "Confirmed the student's editor and screen share were working before starting",
    // Concept
    "Explained the concept before writing code, not only while typing",
    "Explained each new term when it was introduced (tag, attribute, selector, property, function, variable)",
    "Explained WHY — why this approach, why this structure — not only how",
    "Connected the new concept to code the student had already written",
    // Demonstration
    "Wrote code live rather than pasting finished code",
    "Code was readable on screen — font size large enough, only relevant lines visible",
    "Ran the code and showed the result after each small change",
    // Student practice
    "Student wrote and ran code themselves during the session",
    "Gave the student an exercise immediately after the demonstration",
    "Student typed the code rather than copying a pasted block",
    "Watched the student code live instead of only checking the finished result",
    "Demonstrated one example, then handed the next one to the student",
    // Errors & debugging
    "Let the student find the error before pointing to it",
    "Taught the student to read the error message / use the console or inspector",
    "Explained the cause of the bug, not only the fix",
    "Did not take over the student's keyboard or screen control to fix it",
    // Checking understanding
    "Asked the student to explain in their own words what the code does",
    "Asked open questions instead of 'do you understand?'",
    "Verified understanding with a working exercise, not only verbal confirmation",
    // Closing
    "Asked the student to summarize the session before recapping it himself",
    "Recapped the key points after the student's attempt",
    "Assigned practice work to complete before the next session",
    "Named what the next session will cover",
  ],
};

const OBSERVATIONS = {
  excellent: {
    label: "Excellent Tutor",
    color: "#15803d",
    items: [
      { text: "Excellent session — well-prepared, clearly explained, and the student stayed engaged throughout" },
      { text: "Strong delivery: concepts broken down step by step, understanding checked before moving on" },
      { text: "Excellent explanation quality — built the concept up from basics with relevant, level-appropriate examples" },
      { text: "Tutor guided the student to the answer instead of giving it — textbook questioning technique" },
      { text: "Excellent engagement — asked open questions, waited for answers, and encouraged the student to explain their reasoning" },
      { text: "Warm rapport and consistent encouragement — the student was confident and comfortable participating" },
      { text: "Started on time, covered the full objective, balanced pacing, and closed with a clear recap" },
      { text: "Excellent use of visuals — annotation on the lesson material, whiteboard, document camera, or paper shown to the camera — to make the concept concrete" },
      { text: "Very strong live coding: typed everything out, narrated the reasoning, and turned errors into learning moments" },
      { text: "Ran the session as a real group discussion — students were actively helping each other" },
      { text: "Every student participated and each one's work was recognised by name" },
      { text: "Excellent — prepared, clear, engaging, well-paced. No issues noted" },
      { text: "This session is a good example to share with other tutors as a model" },
    ],
  },
  strengths: {
    label: "Strengths",
    color: "#059669",
    items: [
      { text: "Good engagement with student" },
      { text: "Tutor brings descriptive video / images" },
      { text: "Tutor takes notes on what the student is studying in school" },
      { text: "Student clearly summarized the lesson" },
      { text: "Tutor is excellent at managing students regardless of mood" },
      { text: "Tutor is trying to change the student's mood from bad to good" },
      { text: "Good class management and excellent demonstration" },
      { text: "Tutor gave the student interesting homework" },
      { text: "Tutor taught a topic that interested the student" },
      { text: "Good encouragement method used by the tutor" },
      { text: "Excellent student engagement" },
      { text: "Good explanation of the topic" },
      { text: "Tutor was good at encouraging the child to answer" },
      { text: "Tutor and student have a close, warm rapport" },
      {
        text: "Tutor reduced homework session time so the student can move forward faster",
      },
      { text: "Good follow-up on the previous session" },
      { text: "Tutor checked if the document camera was ready (good quality)" },
      { text: "Tutor's teaching style is good despite student's difficulty" },
      {
        text: "Tutor noted the student's grade is remarkable — even the school teacher praised her",
      },
      // — added —
      { text: "Tutor opened by asking recall questions from the previous class, then continued from that point" },
      { text: "Tutor annotated directly on the lesson material while explaining" },
      { text: "Tutor had the student work on paper and show it to the camera" },
      { text: "Tutor set a short time limit and told the student their work would be checked" },
      { text: "Tutor moved the rest of the group to a breakout room and gave one-to-one support to the student who was behind" },
      { text: "Tutor checked the group's confidence and gave more practice instead of moving to a new topic" },
      { text: "Tutor guided the student to blend the word in chunks instead of supplying it" },
      { text: "Tutor had the student read the question aloud before attempting it" },
      { text: "Student's graph work was accurate — axes labeled, points plotted, intersection read correctly" },
      { text: "Student attempted the closing summary and completed it with tutor support" },
      { text: "Student improved with support during the session but has not yet reached independent accuracy" },
      { text: "Students continued helping each other after the tutor left the session" },
    ],
  },
  improvements: {
    label: "Areas for Improvement",
    color: "#b91c1c",
    items: [
      { text: "No review of the previous class", unchecks: ["start-7"] },
      { text: "No summary of the class", unchecks: ["end-3"] },
      {
        text: "No document camera (student's writing not visible)",
        unchecks: ["start-3", "start-6"],
      },
      { text: "Student's camera was not visible", unchecks: ["start-5"] },
      { text: "Did not ask about homework" },
      { text: "Class was not properly closed", unchecks: ["end-6", "end-7"] },
      {
        text: "Tutor read notes without checking student understanding — should pause to ask questions, offer simpler explanations, or use relatable examples",
        unchecks: ["during-1", "during-2"],
      },
      { text: "Student sometimes loses focus" },
      { text: "Student lost interest despite tutor's best efforts" },
      {
        text: "When giving assessments, avoid offering hints — encourage students to take it as seriously as a school exam",
      },
      { text: "Assessment was a discussion — it should be a test" },
      {
        text: "Tutor should use the whiteboard to visualize examples instead of only talking",
        unchecks: ["during-5"],
      },
      {
        text: "Tutor gave answers directly — should guide the student to think and explain their reasoning",
        unchecks: ["during-1", "during-2"],
      },
      {
        text: "Student is guessing answers — guide them to think carefully and explain reasoning before answering",
      },
      {
        text: "Student already knows the concept — move forward to the next topic",
      },
      {
        text: "Reading the platform content is not enough — teach in a fun, engaging way to keep the student interested",
        unchecks: ["during-5"],
      },
      { text: "Tutor's camera was off" },
      {
        text: "Tutor should request screen / remote control to navigate more efficiently",
      },
      {
        text: "Ask the student to use paper and pen while working so they understand the problem better",
      },
      {
        text: "Ask the student to explain WHY an answer is correct — not just whether it is",
      },
      { text: "Tutor should add more emotional connection with the student" },
      {
        text: "Document camera should be ready at the START of the session, not at the end",
      },
      {
        text: "Tutor told the student the previous lesson recap instead of asking — asking is better to check retention",
        unchecks: ["start-7"],
      },
      {
        text: "Student became bored — try a different activity instead of only focusing on questions",
      },
      {
        text: "Tutor did not ask if the student was ready with document camera, paper, and pen",
        unchecks: ["start-3", "start-6"],
      },
      {
        text: "Homework session time should be reduced so students can move forward faster",
      },
      {
        text: "Tutor should support the student in completing homework when applicable",
      },
      {
        text: "Child loses focus and isn't learning — reading the concept alone is not effective, must engage actively",
      },
      {
        text: "Don't just repeat what's written on the platform — teach in a fun, engaging way",
      },
      {
        text: "Clearly explain the session objective at the beginning",
        unchecks: ["start-2"],
      },
      {
        text: "Don't answer the question yourself — always encourage the student to answer",
        unchecks: ["during-1", "during-2"],
      },
      // — added —
      {
        text: "Encouragement was generic ('good job') — name the specific action the student did well",
      },
      {
        text: "Tutor raised the student's missed session in front of the group — better done privately",
      },
      {
        text: "Practice stayed at single-word / single-problem level — return to the full sentence or a new problem",
      },
      {
        text: "Student decoded the word correctly in isolation but did not apply the strategy to new words",
      },
      {
        text: "Student omitted the final syllable of a long word — stops tracking letters after recognizing the beginning",
      },
      {
        text: "Session ran as a one-way lecture — long explanation with no hands-on time",
        unchecks: ["during-1"],
      },
      { text: "Tutor ended the session before the scheduled end time", unchecks: ["end-0"] },
      {
        text: "Tutor left partway through the scheduled session once his own material was finished",
        unchecks: ["end-0", "end-6"],
      },
    ],
  },
  parents: {
    label: "Comments for Parents",
    color: "#b45309",
    items: [
      { text: "Minutes were wasted because the student's battery died" },
      { text: "Background noise from family distracted the student" },
      {
        text: "Student is highly distracted due to strong desire to play games",
      },
      {
        text: "Student joined the session using a phone (hard to share screen)",
      },
      { text: "Student had a Zoom setup problem (new PC)" },
      { text: "Parent didn't prepare the login credentials" },
      {
        text: "Prepare the child using easily available materials — like a document camera",
      },
      { text: "Prepare the student for the session before it starts" },
      { text: "Student was in the car using phone for part of the session" },
      { text: "Parent didn't prepare the right laptop — minutes were wasted" },
      {
        text: "A family member may need to sit with the student during sessions to help maintain focus and participation",
      },
      {
        text: "Please fix or replace the computer so the child can participate fully",
      },
      { text: "Prepare a backup device to avoid losing learning time" },
      {
        text: "Please improve lighting so the student's face is clearly visible",
      },
      {
        text: "Please reduce background noise or move the student to a quieter place",
      },
      {
        text: "Do you have a document camera available? It helps monitor the student's progress more easily",
      },
      {
        text: "Child becomes upset/stressed during workbook practice — check if they feel pressure or frustration",
      },
      { text: "Ensure timely attendance to avoid losing learning time" },
      {
        text: "Mobile devices limit interaction — please use a computer whenever possible",
      },
      {
        text: "Child gets bored easily — please support fun, interactive activities at home",
      },
      {
        text: "Please prepare a backup or stable setup — student's computer shut down mid-session",
      },
      {
        text: "Student enjoys fun activities — please encourage playful engagement with material at home",
      },
      {
        text: "Student is too playful and loses focus — help balance fun with structured activities",
      },
      {
        text: "Please ask which chapter the child is currently studying in school so the tutor can match the pace",
      },
      {
        text: "Session time lost to late arrival is not made up — please help the student join at the scheduled time",
      },
    ],
  },
  technical: {
    label: "Technical Issues",
    color: "#475569",
    items: [
      {
        text: "Background sunlight interfered with the student's camera",
        unchecks: ["start-5"],
      },
      { text: "Student's internet connection was interrupted" },
      { text: "Tutor's internet was interrupted" },
      { text: "Student's microphone had problems" },
      { text: "Background disruption on the student's side" },
      { text: "Audio quality was poor", unchecks: ["start-4"] },
      {
        text: "Screen sharing was not working on the student's side — lots of time wasted",
      },
      {
        text: "Student kept disconnecting and rejoining the session multiple times",
      },
      { text: "Student's computer shut down in the middle of the session" },
      { text: "One-time network error on the tutor's side" },
      {
        text: "Student's camera was off (only document camera in use)",
        unchecks: ["start-5"],
      },
      { text: "Student joined via phone — difficult to share screen" },
      { text: "Student's face was hard to see due to poor lighting" },
    ],
  },
  attendance: {
    label: "Attendance & Timing",
    color: "#7c3aed",
    items: [
      {
        text: "Student was approximately 15 minutes late",
        unchecks: ["start-0"],
      },
      {
        text: "Student was approximately 20 minutes late",
        unchecks: ["start-0"],
      },
      {
        text: "Student was approximately 30 minutes late",
        unchecks: ["start-0"],
      },
      { text: "Student was more than 30 minutes late", unchecks: ["start-0"] },
      { text: "Student was absent" },
      { text: "Student did not appear in the class" },
      { text: "Session was shorter than expected (under 30 minutes)" },
      { text: "Student forgot Google account password" },
      { text: "Student left Zoom for a few minutes during the session" },
      {
        text: "More than 20 minutes were lost due to distractions and screen-sharing interruptions",
      },
      // — added — tutor lateness is scored, student lateness is not
      {
        text: "Tutor joined approximately 8 minutes late",
        unchecks: ["start-0"],
        tutorLate: true,
      },
      {
        text: "Tutor joined late and extended the session to recover the full duration",
        unchecks: ["start-0"],
        tutorLate: true,
      },
      { text: "Student joined late; tutor ended at the scheduled time as expected" },
    ],
  },
  coding: {
    label: "Group Coding",
    color: "#c026d3",
    items: [
      // === Participation — every child engaged ===
      {
        text: "All students actively participated — every child wrote or ran code themselves",
      },
      {
        text: "One student dominated the session — others were mostly watching",
        unchecks: ["group-0", "group-2"],
      },
      {
        text: "Some students were passive spectators the whole session",
        unchecks: ["group-0", "group-2"],
      },
      { text: "Tutor rotated turns fairly so each child got hands-on time" },
      {
        text: "Quiet student was gently brought in with an easy, confidence-building task",
      },
      {
        text: "Tutor did not notice a student had stopped participating",
        unchecks: ["group-8"],
      },
      {
        text: "Tutor tracked who hadn't spoken or coded yet and included them",
      },
      // === Balanced motivation — praise one without deflating others ===
      {
        text: "Praise was well balanced — every student received genuine recognition",
      },
      {
        text: "Tutor praised one student but ignored the others' efforts",
        unchecks: ["group-3"],
      },
      {
        text: "Tutor compared students to each other — this discourages slower learners",
        unchecks: ["group-4"],
      },
      {
        text: "When one student was celebrated, the tutor immediately gave the others an encouraging next step",
      },
      {
        text: "Tutor celebrated different strengths — creativity, persistence, helping — not just who finished first",
      },
      {
        text: "A struggling student was encouraged privately without stopping the whole group",
      },
      // === Collaboration — teamwork over competition ===
      {
        text: "Students helped each other before asking the tutor — great collaboration habit",
      },
      {
        text: "Students explained their code to each other in their own words",
      },
      {
        text: "Group solved the problem together instead of the tutor solving it for them",
      },
      {
        text: "Session used a shared team goal so success belonged to everyone",
      },
      {
        text: "Pair-programming style rotation (one types, one guides) worked well",
      },
      {
        text: "Session felt competitive instead of collaborative — kids raced instead of helping",
        unchecks: ["group-5"],
      },
      // === Kid-specific coding observations ===
      {
        text: "Instructions were broken into small steps young kids could follow",
      },
      { text: "Pace accounted for kids' slow typing — no one was rushed" },
      {
        text: "Errors were framed as fun discoveries ('the bug is a clue!') — kids stayed positive",
      },
      {
        text: "A child got frustrated by an error and the tutor turned it into a learning moment",
      },
      { text: "Every child got the joy of seeing their own code run" },
      {
        text: "Group moved on while one child was still stuck — that child was left behind",
        unchecks: ["group-9"],
      },
      {
        text: "Tutor checked each student's screen regularly, not just the active speaker's",
      },
      { text: "Session ended with each student's work recognized by name" },
      {
        text: "Kids' attention was managed well with short breaks or activity changes",
      },
      {
        text: "Tool used was age-appropriate and visual (e.g. Scratch/blocks) for young kids",
      },
      // === HTML & CSS fundamentals — kid-friendly ===
      {
        text: "Tutor explained what a tag or property does before using it (e.g., '<h1> makes a big heading', 'color changes the text color')",
      },
      {
        text: "Tutor used technical terms without explaining what they do — kids nodded along without understanding",
        unchecks: ["group-29"],
      },
      {
        text: "Kids saw their HTML/CSS changes appear instantly in the browser — save-and-refresh kept them engaged",
      },
      {
        text: "Live preview wasn't used, so kids couldn't see the effect of their code right away",
        unchecks: ["group-31"],
      },
      {
        text: "Tutor used simple, everyday comparisons to explain HTML vs CSS (e.g., 'HTML is the skeleton, CSS is the outfit')",
      },
      {
        text: "A missing closing tag or small typo was turned into a fun 'spot the difference' moment, not a scary error",
      },
      {
        text: "Tutor pointed out nesting/indentation so kids could see which tags live inside others",
      },
      {
        text: "Kids personalized their page with their own colors, fonts, or images — no two pages looked the same",
      },
      {
        text: "Session stayed scoped to HTML/CSS basics — no advanced concepts (JavaScript, flexbox/grid) introduced too early",
      },
      {
        text: "Tutor praised attention to detail — like matching a color exactly or lining up spacing",
      },
      {
        text: "Simple attributes (class, id, src, href) were shown in context, not taught as abstract rules",
      },
      {
        text: "Every child left with something visual and personal to show — real ownership over their own page",
      },
      {
        text: "After the tutor explained HTML class naming and CSS selectors, students worked collaboratively and helped each other resolve issues",
      },
      {
        text: "Students continued helping each other after the tutor left the session",
      },
    ],
  },
  coding1: {
    label: "1-on-1 Coding",
    color: "#0d9488",
    items: [
      // — Positives —
      { text: "Explained the concept and the reasoning before writing any code" },
      { text: "Wrote all code live and narrated each line as it was typed" },
      { text: "Ran the code after each small change so the student saw the effect immediately" },
      { text: "Student wrote and ran the code themselves for most of the session" },
      { text: "Demonstrated one example, then handed the next problem to the student" },
      { text: "Let the student find the bug themselves and guided them to the cause" },
      { text: "Taught the student to read the error message instead of fixing it for them" },
      { text: "Asked the student to explain the code back in their own words" },
      { text: "Student summarized the session before the tutor recapped it" },
      { text: "Explained HTML class naming and CSS selectors, then had the student apply them immediately" },
      { text: "Used annotation or a whiteboard to diagram the structure before coding it" },
      { text: "Assigned specific practice work and named the next session's topic" },
      { text: "Adjusted the pace to this student rather than following a fixed plan" },
      { text: "Checked whether the student felt confident and gave extra practice instead of moving to a new topic" },
      // — Needs improvement —
      { text: "Tutor did not review the previous session's code", unchecks: ["code-4"] },
      {
        text: "Technical terms were used without explanation — the student nodded along",
        unchecks: ["code-8"],
      },
      { text: "Tutor pasted finished code instead of typing it out", unchecks: ["code-11"] },
      { text: "Code font was too small to read clearly on screen", unchecks: ["code-12"] },
      {
        text: "Tutor coded for the whole session — the student only watched",
        unchecks: ["code-14", "code-17"],
      },
      { text: "No exercise was given after the demonstration", unchecks: ["code-15"] },
      {
        text: "Session ran as a one-way lecture — long explanation with no hands-on time",
        unchecks: ["code-14", "code-18"],
      },
      {
        text: "Tutor took over the student's screen or keyboard to fix the error",
        unchecks: ["code-22"],
      },
      { text: "Tutor fixed the bug without explaining what caused it", unchecks: ["code-21"] },
      {
        text: "Understanding was checked only verbally ('do you understand?')",
        unchecks: ["code-24", "code-25"],
      },
      {
        text: "Tutor summarized the lesson instead of asking the student to",
        unchecks: ["code-26"],
      },
      { text: "No practice work was assigned before the next session", unchecks: ["code-28"] },
      {
        text: "Tutor joined the coding session late",
        unchecks: ["code-0"],
        tutorLate: true,
      },
    ],
  },
  recommendations: {
    label: "Recommendations",
    color: "#0891b2",
    items: [
      { text: "Begin each session with a brief recap of the previous lesson" },
      {
        text: "Ask the student at the start of the session if their document camera is ready",
      },
      {
        text: "Provide a short summary at the end of every session to reinforce key points",
      },
      {
        text: "Always check prior knowledge by asking what the student already knows",
      },
      {
        text: "Use more fun, interactive activities (games, visuals, real-life examples) — especially when the child gets bored easily",
      },
      {
        text: "Use step-by-step guidance to build confidence on difficult problems",
      },
      {
        text: "Offer more encouragement before and during difficult questions",
      },
      {
        text: "Incorporate more real-life examples and practical demonstrations",
      },
      {
        text: "Avoid just reading notes — ensure the student truly understands by asking questions and using examples",
      },
      {
        text: "If the student struggles, give another similar example — but do NOT give the actual answer",
      },
      {
        text: "Ask the student WHY they chose an answer to check understanding",
      },
      {
        text: "Balance fun with structured activities to help playful students stay attentive",
      },
      {
        text: "Ensure a stable internet connection before sessions; have a backup option (mobile data, hotspot)",
      },
      {
        text: "Test the connection 5–10 minutes before class to reduce interruptions",
      },
      {
        text: "Ensure the tutor's camera is on to maintain visibility and engagement",
      },
      {
        text: "Use a shared visual surface — annotation on the lesson material, whiteboard, document camera, or paper to the camera — with clear, labeled drawing",
      },
      {
        text: "Ask which chapter the student is currently studying in school, so you can match or move faster",
      },
      {
        text: "Maintain a friendly tone, small games, and encouraging responses to build confidence",
      },
      {
        text: "Make workbook practice more fun and less stressful for students who get upset",
      },
      {
        text: "Add fun elements while maintaining good teaching style for struggling students",
      },
      {
        text: "Request remote control / student control when needed to navigate the screen efficiently",
      },
      { text: "The tutor must summarize the topic" },
      // — added —
      {
        text: "Demonstrate one problem, then hand the next to the student, rather than explaining continuously",
      },
      {
        text: "Have the student work on paper and show it to the camera so the method is visible, not only the answer",
      },
      { text: "Hand the annotation tool to the student instead of doing all the drawing" },
      {
        text: "Ask the student to read the question aloud before answering — several errors come from misreading",
      },
      {
        text: "Remain for the full scheduled session and use the remaining time for supported practice",
      },
      {
        text: "Break words at syllable boundaries, not by letter count, so each chunk contains a vowel",
      },
      {
        text: "Use the student's school reading book as the session text, previewing difficult words first",
      },
      { text: "Ask the student to explain WHY the answer works, not only how to find it" },
      {
        text: "Raise a missed session privately rather than in front of the group",
      },
    ],
  },
};

const TEACHING_QUALITY = [
  {
    id: "tq1",
    text: "Is the tutor teaching the subject in a manner that enables the student to understand the subject matter?",
  },
  { id: "tq2", text: "Is the tutor explaining concepts in a simple way?" },
  {
    id: "tq3",
    text: "Does the tutor try to explain one thing in different ways when the student is not able to understand?",
  },
  {
    id: "tq4",
    text: "Do you see feedback from the student that leads you to say the student is understanding the tutor's explanation?",
  },
  { id: "tq5", text: "Is the tutor a good fit for this student?" },
];

/* ---------------- Scoring ----------------
 * Three components, 100 points total, plus a small excellence bonus.
 * Not scored: technical issues, parent comments, student lateness — recorded
 * but not the tutor's fault. Tutor lateness IS scored (conduct).
 */
const SCORE_WEIGHTS = { checklist: 55, quality: 30, conduct: 15 };
const CONDUCT_PENALTY = 3;
const TUTOR_LATE_PENALTY = 5;
const EXCELLENT_BONUS = 1;
const MAX_BONUS = 5;

const SCORE_BANDS = [
  { min: 90, label: "Excellent", color: "#15803d" },
  { min: 80, label: "Strong", color: "#059669" },
  { min: 70, label: "Meets expectations", color: "#0891b2" },
  { min: 60, label: "Needs improvement", color: "#d97706" },
  { min: 0, label: "Requires follow-up", color: "#b91c1c" },
];

function computeScore({ stats, quality, selectedObservations }) {
  const checklistPct = stats.totalItems ? stats.totalDone / stats.totalItems : 0;
  const checklistPoints = checklistPct * SCORE_WEIGHTS.checklist;

  const answered = TEACHING_QUALITY.filter(
    (q) => quality[q.id]?.answer === "yes" || quality[q.id]?.answer === "no",
  );
  const yesCount = answered.filter((q) => quality[q.id].answer === "yes").length;
  const qualityPct = answered.length ? yesCount / answered.length : 0;
  const qualityPoints = qualityPct * SCORE_WEIGHTS.quality;

  const improvements = selectedObservations.filter(
    (o) => o.category === "improvements",
  ).length;
  const tutorLate = selectedObservations.some((o) => o.tutorLate);

  let conductPoints = SCORE_WEIGHTS.conduct - improvements * CONDUCT_PENALTY;
  if (tutorLate) conductPoints -= TUTOR_LATE_PENALTY;
  conductPoints = Math.max(0, conductPoints);

  const excellentCount = selectedObservations.filter(
    (o) => o.category === "excellent",
  ).length;
  const bonus = Math.min(MAX_BONUS, excellentCount * EXCELLENT_BONUS);

  const total = Math.max(
    0,
    Math.min(100, Math.round(checklistPoints + qualityPoints + conductPoints + bonus)),
  );
  const band = SCORE_BANDS.find((b) => total >= b.min);

  return {
    total,
    band,
    unanswered: TEACHING_QUALITY.length - answered.length,
    breakdown: [
      {
        label: "Checklist completion",
        got: Math.round(checklistPoints),
        max: SCORE_WEIGHTS.checklist,
        detail: `${stats.totalDone}/${stats.totalItems} items`,
      },
      {
        label: "Teaching quality",
        got: Math.round(qualityPoints),
        max: SCORE_WEIGHTS.quality,
        detail: answered.length
          ? `${yesCount}/${answered.length} answered yes`
          : "not answered",
      },
      {
        label: "Session conduct",
        got: conductPoints,
        max: SCORE_WEIGHTS.conduct,
        detail:
          improvements || tutorLate
            ? `${improvements} improvement item${improvements === 1 ? "" : "s"}${
                tutorLate ? " + tutor lateness" : ""
              }`
            : "no issues noted",
      },
      {
        label: "Excellence bonus",
        got: bonus,
        max: MAX_BONUS,
        detail: `${excellentCount} excellent item${excellentCount === 1 ? "" : "s"}`,
      },
    ],
  };
}

function buildTutorFeedback({ score, selectedObservations, studentName }) {
  const pick = (cat) =>
    selectedObservations.filter((o) => o.category === cat).map((o) => o.text);

  const wentWell = [
    ...pick("excellent"),
    ...pick("strengths"),
    ...pick("coding1"),
    ...pick("coding"),
  ].filter((t, i, arr) => arr.indexOf(t) === i);
  const toImprove = pick("improvements");
  const nextSteps = pick("recommendations");

  const lines = [];
  lines.push(
    `Session review${studentName ? ` — ${studentName}` : ""} · Score: ${score.total}/100 (${score.band.label})`,
  );
  lines.push("");

  if (wentWell.length) {
    lines.push("What went well");
    wentWell.slice(0, 6).forEach((t) => lines.push(`- ${t}`));
    lines.push("");
  }
  if (toImprove.length) {
    lines.push("What to improve");
    toImprove.slice(0, 5).forEach((t) => lines.push(`- ${t}`));
    lines.push("");
  }
  if (nextSteps.length) {
    lines.push("Focus for the next session");
    nextSteps.slice(0, 4).forEach((t) => lines.push(`- ${t}`));
    lines.push("");
  }
  if (!wentWell.length && !toImprove.length && !nextSteps.length) {
    lines.push("Select observations from the library to draft feedback.");
  }

  return lines.join("\n").trim();
}

const buildInitialQuality = () => {
  const state = {};
  TEACHING_QUALITY.forEach((q) => {
    state[q.id] = { answer: null, comment: "" };
  });
  return state;
};

const buildInitialState = (value = false) => {
  const state = {};
  [...SECTIONS, GROUP_SECTION, CODING_SECTION].forEach((sec) => {
    sec.items.forEach((_, idx) => {
      state[`${sec.id}-${idx}`] = value;
    });
  });
  return state;
};

export default function VideoReviewChecklist({
  initialTutor = "",
  initialStudent = "",
  initialDate = "",
  studentId = "",
}) {
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [checked, setChecked] = useState(() => buildInitialState(false));
  const [quality, setQuality] = useState(() => buildInitialQuality());
  const [tutorName, setTutorName] = useState(initialTutor);
  const [studentName, setStudentName] = useState(initialStudent);
  const [reviewer, setReviewer] = useState("");
  const [reviewDate, setReviewDate] = useState(
    initialDate || new Date().toISOString().slice(0, 10),
  );
  const [notes, setNotes] = useState("");
  const [issuesSeen, setIssuesSeen] = useState("");
  const [recommendation, setRecommendation] = useState("");
  const [tutorFeedback, setTutorFeedback] = useState("");
  const [selectedObservations, setSelectedObservations] = useState([]);
  const [activeCategory, setActiveCategory] = useState("strengths");
  // "standard" = any non-coding subject | "group" = group coding class
  // | "coding1" = 1-on-1 coding (its own checklist, not the standard one)
  const [sessionType, setSessionType] = useState("standard");
  // Which panels are expanded. Everything starts collapsed except the first
  // section, so the page opens short and the reviewer opens one phase at a time.
  const [openSections, setOpenSections] = useState({ start: true });
  const [rootDirHandle, setRootDirHandle] = useState(null);
  const [rootDirName, setRootDirName] = useState("");
  const [exporting, setExporting] = useState(false);
  const [savingToServer, setSavingToServer] = useState(false);
  const [saveResult, setSaveResult] = useState(null); // {type: "success"|"error", message}

  // Past reviews loaded from the backend
  const [pastReviews, setPastReviews] = useState([]);
  const [loadingPast, setLoadingPast] = useState(false);
  const [showPast, setShowPast] = useState(false);

  // Update fields when props change (new student selected)
  useEffect(() => {
    setTutorName(initialTutor);
  }, [initialTutor]);
  useEffect(() => {
    setStudentName(initialStudent);
  }, [initialStudent]);
  useEffect(() => {
    if (initialDate) setReviewDate(initialDate);
  }, [initialDate]);

  // Load past reviews when studentId changes
  useEffect(() => {
    if (!studentId) {
      setPastReviews([]);
      return;
    }
    setLoadingPast(true);
    api
      .getReviewsForStudent(studentId)
      .then((rows) => setPastReviews(rows))
      .catch(() => setPastReviews([]))
      .finally(() => setLoadingPast(false));
  }, [studentId]);

  const toggle = (key) => setChecked((p) => ({ ...p, [key]: !p[key] }));
  const uncheckAll = () => {
    setChecked(buildInitialState(false));
    setQuality(buildInitialQuality());
  };
  const checkAll = () => setChecked(buildInitialState(true));
  const clearObservations = () => {
    setSelectedObservations([]);
    setNotes("");
  };
  // Reset the ENTIRE checklist to empty (checks, ratings, text, names). Confirms first.
  const clearAll = () => {
    if (
      !window.confirm(
        "Clear the entire checklist and empty every field? This cannot be undone.",
      )
    )
      return;
    setChecked(buildInitialState(false));
    setQuality(buildInitialQuality());
    setSelectedObservations([]);
    setNotes("");
    setIssuesSeen("");
    setRecommendation("");
    setTutorFeedback("");
    setTutorName("");
    setStudentName("");
    setReviewer("");
    setReviewDate(new Date().toISOString().slice(0, 10));
    setSessionType("standard");
    setOpenSections({ start: true });
    setSaveResult(null);
  };

  const addObservation = (category, item) => {
    const tag = `[${OBSERVATIONS[category].label}]`;
    const line = `${tag} ${item.text}`;
    if (
      selectedObservations.some(
        (o) => o.text === item.text && o.category === category,
      )
    )
      return;
    setSelectedObservations((p) => [
      ...p,
      {
        category,
        text: item.text,
        unchecks: item.unchecks || [],
        ...(item.tutorLate ? { tutorLate: true } : {}),
      },
    ]);
    setNotes((p) => (p.trim() ? `${p}\n${line}` : line));
    if (item.unchecks && item.unchecks.length) {
      setChecked((p) => {
        const n = { ...p };
        item.unchecks.forEach((k) => {
          n[k] = false;
        });
        return n;
      });
    }
  };

  const removeObservation = (idx) => {
    setSelectedObservations((p) => p.filter((_, i) => i !== idx));
  };

  const exportFolder = useMemo(() => {
    if (!reviewDate) return "";
    const [y, m, d] = reviewDate.split("-").map(Number);
    if (!y || !m || !d) return "";
    const dt = new Date(y, m - 1, d);
    const monthName = dt.toLocaleString("en-US", { month: "long" });
    return `${monthName} ${String(m).padStart(2, "0")}_${String(d).padStart(2, "0")}_${y}`;
  }, [reviewDate]);

  const activeSections = useMemo(() => {
    // A 1-on-1 coding review uses ONLY the coding checklist — the standard
    // items (notebook, document camera, workbook) don't apply to it.
    if (sessionType === "coding1") return [CODING_SECTION];
    if (sessionType === "group") return [...SECTIONS, GROUP_SECTION];
    return SECTIONS;
  }, [sessionType]);

  // Observation tabs that make sense for this session type
  const visibleCategories = useMemo(
    () =>
      Object.keys(OBSERVATIONS).filter((c) => {
        if (c === "coding") return sessionType === "group";
        if (c === "coding1") return sessionType === "coding1";
        return true;
      }),
    [sessionType],
  );

  // If the active tab is hidden by a session-type change, fall back
  useEffect(() => {
    if (!visibleCategories.includes(activeCategory))
      setActiveCategory("strengths");
  }, [visibleCategories, activeCategory]);

  // Open the first section of whichever checklist is active
  useEffect(() => {
    setOpenSections((p) => ({ ...p, [activeSections[0].id]: true }));
  }, [activeSections]);

  const stats = useMemo(() => {
    const perSection = {};
    let totalItems = 0,
      totalDone = 0;
    activeSections.forEach((sec) => {
      const total = sec.items.length;
      const done = sec.items.reduce(
        (acc, _, idx) => acc + (checked[`${sec.id}-${idx}`] ? 1 : 0),
        0,
      );
      perSection[sec.id] = {
        done,
        total,
        pct: Math.round((done / total) * 100),
      };
      totalItems += total;
      totalDone += done;
    });
    return {
      perSection,
      totalItems,
      totalDone,
      overallPct: Math.round((totalDone / totalItems) * 100),
    };
  }, [checked, activeSections]);

  const score = useMemo(
    () => computeScore({ stats, quality, selectedObservations }),
    [stats, quality, selectedObservations],
  );

  const toggleSection = (id) =>
    setOpenSections((p) => ({ ...p, [id]: !p[id] }));
  const expandAll = () => {
    const all = { quality: true, notes: true, issues: true, recommend: true, feedback: true };
    activeSections.forEach((sec) => {
      all[sec.id] = true;
    });
    setOpenSections(all);
  };
  const collapseAll = () => setOpenSections({});

  const draftFeedback = () =>
    setTutorFeedback(buildTutorFeedback({ score, selectedObservations, studentName }));

  const copyFeedback = async () => {
    try {
      await navigator.clipboard.writeText(tutorFeedback);
      setSaveResult({ type: "success", message: "✓ Feedback copied" });
      setTimeout(() => setSaveResult(null), 2000);
    } catch {
      setSaveResult({ type: "error", message: "Copy failed — select and copy manually" });
    }
  };

  /* ---------- Save to server ---------- */
  const saveToServer = async () => {
    if (!studentId) {
      setSaveResult({
        type: "error",
        message: "No student selected. Click a student in the schedule first.",
      });
      return;
    }
    if (!tutorName.trim() || !studentName.trim()) {
      setSaveResult({
        type: "error",
        message: "Tutor and Student names are required.",
      });
      return;
    }

    setSavingToServer(true);
    setSaveResult(null);

    const payload = {
      checked,
      quality,
      observations: selectedObservations,
      notes: notes.trim(),
      issuesSeen: issuesSeen.trim(),
      recommendation: recommendation.trim(),
      tutorFeedback: tutorFeedback.trim(),
      sessionType,
      // kept for older readers of the payload
      isGroupSession: sessionType === "group",
      isCodingSession: sessionType === "coding1",
      score: {
        total: score.total,
        band: score.band.label,
        breakdown: score.breakdown,
      },
      stats: {
        totalDone: stats.totalDone,
        totalItems: stats.totalItems,
        overallPct: stats.overallPct,
        bySection: stats.perSection,
      },
    };

    try {
      await api.saveReview({
        studentId,
        tutorName: tutorName.trim(),
        studentName: studentName.trim(),
        reviewDate,
        reviewer: reviewer.trim() || null,
        payload,
      });
      setSaveResult({ type: "success", message: "✓ Review saved to server" });
      // Refresh past reviews list
      try {
        const rows = await api.getReviewsForStudent(studentId);
        setPastReviews(rows);
      } catch {}
      setTimeout(() => setSaveResult(null), 3500);
    } catch (err) {
      setSaveResult({
        type: "error",
        message: err.message || "Failed to save review",
      });
    } finally {
      setSavingToServer(false);
    }
  };

  /* ---------- Load a past review back into the form ---------- */
  const loadPastReview = (review) => {
    if (!review || !review.payload) return;
    if (!window.confirm("Replace current form with this past review?")) return;
    const p = review.payload;
    setChecked(p.checked || buildInitialState(false));
    setQuality(p.quality || buildInitialQuality());
    setSelectedObservations(p.observations || []);
    setNotes(p.notes || "");
    setIssuesSeen(p.issuesSeen || "");
    setRecommendation(p.recommendation || "");
    setTutorFeedback(p.tutorFeedback || "");
    setSessionType(
      p.sessionType ||
        (p.isCodingSession ? "coding1" : p.isGroupSession ? "group" : "standard"),
    );
    setTutorName(review.tutorName || "");
    setStudentName(review.studentName || "");
    setReviewer(review.reviewer || "");
    setReviewDate(
      review.reviewDate ? String(review.reviewDate).slice(0, 10) : "",
    );
    setShowPast(false);
  };

  /* ---------- Folder picker ---------- */
  const pickRootFolder = async () => {
    if (!window.showDirectoryPicker) {
      alert(
        "Your browser doesn't support folder selection. Please use Chrome, Edge, or Opera.",
      );
      return null;
    }
    try {
      const handle = await window.showDirectoryPicker({
        id: "evangadi-export-root",
        mode: "readwrite",
        startIn: "pictures",
      });
      setRootDirHandle(handle);
      setRootDirName(handle.name);
      return handle;
    } catch (err) {
      if (err && err.name !== "AbortError") console.error(err);
      return null;
    }
  };

  /* ---------- DOCX export ---------- */
  const exportReport = async () => {
    const sanitize = (s) =>
      (s || "")
        .trim()
        .replace(/\s+/g, "_")
        .replace(/[\\/:*?"<>|]/g, "");
    const datePart = reviewDate || new Date().toISOString().slice(0, 10);

    const heading = (text, level = HeadingLevel.HEADING_1) =>
      new Paragraph({
        text,
        heading: level,
        spacing: { before: 200, after: 100 },
      });
    const plainLine = (text, opts = {}) =>
      new Paragraph({
        children: [
          new TextRun({
            text,
            bold: !!opts.bold,
            color: opts.color,
            size: opts.size,
          }),
        ],
        spacing: { after: opts.spaceAfter ?? 60 },
      });
    const labelValue = (label, value) =>
      new Paragraph({
        children: [
          new TextRun({ text: `${label}: `, bold: true }),
          new TextRun({ text: value }),
        ],
        spacing: { after: 60 },
      });
    const checklistLine = (done, text) =>
      new Paragraph({
        children: [
          new TextRun({
            text: done ? "☑  " : "☐  ",
            bold: true,
            color: done ? "15803d" : "94a3b8",
          }),
          new TextRun({ text, color: done ? "15803d" : "0f172a" }),
        ],
        spacing: { after: 40 },
      });
    const bullet = (text) =>
      new Paragraph({ text, bullet: { level: 0 }, spacing: { after: 40 } });

    const children = [];
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "Video Review Checklist",
            bold: true,
            size: 40,
            color: "0f172a",
          }),
        ],
        alignment: AlignmentType.LEFT,
        spacing: { after: 80 },
      }),
    );
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "EVANGADI · TUTOR QUALITY REVIEW",
            color: "64748b",
            size: 18,
            bold: true,
          }),
        ],
        spacing: { after: 200 },
      }),
    );

    if (tutorName) children.push(labelValue("Tutor", tutorName));
    if (studentName) children.push(labelValue("Student", studentName));
    if (reviewer) children.push(labelValue("Reviewer", reviewer));
    children.push(labelValue("Date", datePart));
    children.push(
      labelValue(
        "Overall",
        `${stats.totalDone}/${stats.totalItems} (${stats.overallPct}%)`,
      ),
    );
    children.push(
      labelValue(
        "Session type",
        SESSION_TYPES.find((t) => t.id === sessionType)?.label || sessionType,
      ),
    );

    // Score block
    children.push(heading("Session Score", HeadingLevel.HEADING_1));
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `${score.total}/100`,
            bold: true,
            size: 36,
            color: score.band.color.replace("#", ""),
          }),
          new TextRun({
            text: `  —  ${score.band.label}`,
            bold: true,
            color: score.band.color.replace("#", ""),
          }),
        ],
        spacing: { after: 100 },
      }),
    );
    score.breakdown.forEach((b) =>
      children.push(plainLine(`   ${b.label}: ${b.got}/${b.max}  (${b.detail})`)),
    );
    if (score.unanswered > 0) {
      children.push(
        plainLine(
          `   Note: ${score.unanswered} teaching-quality question(s) unanswered — score is provisional.`,
          { color: "92400e" },
        ),
      );
    }

    // Teaching Quality Assessment block
    const answeredQ = TEACHING_QUALITY.filter((q) => quality[q.id]?.answer);
    if (answeredQ.length) {
      children.push(
        heading("Teaching Quality Assessment", HeadingLevel.HEADING_1),
      );
      TEACHING_QUALITY.forEach((q, idx) => {
        const ans = quality[q.id] || { answer: null, comment: "" };
        if (!ans.answer) return;
        const label =
          ans.answer === "yes" ? "YES" : ans.answer === "no" ? "NO" : "N/A";
        const color =
          ans.answer === "yes"
            ? "15803d"
            : ans.answer === "no"
              ? "b91c1c"
              : "64748b";
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: `${idx + 1}. `, bold: true }),
              new TextRun({ text: q.text }),
            ],
            spacing: { before: 120, after: 40 },
          }),
        );
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: "   Answer: ", bold: true }),
              new TextRun({ text: label, bold: true, color }),
            ],
            spacing: { after: 40 },
          }),
        );
        if (ans.comment.trim()) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({ text: "   Comment: ", bold: true }),
                new TextRun({ text: ans.comment.trim(), italics: true }),
              ],
              spacing: { after: 60 },
            }),
          );
        }
      });
    }

    activeSections.forEach((sec) => {
      const s = stats.perSection[sec.id];
      children.push(
        heading(`${sec.title}  [${s.done}/${s.total}]`, HeadingLevel.HEADING_2),
      );
      sec.items.forEach((item, idx) => {
        children.push(checklistLine(!!checked[`${sec.id}-${idx}`], item));
      });
    });

    if (selectedObservations.length) {
      children.push(heading("Observations", HeadingLevel.HEADING_1));
      const byCategory = {};
      selectedObservations.forEach((o) => {
        (byCategory[o.category] = byCategory[o.category] || []).push(o.text);
      });
      Object.keys(byCategory).forEach((cat) => {
        children.push(heading(OBSERVATIONS[cat].label, HeadingLevel.HEADING_3));
        byCategory[cat].forEach((t) => children.push(bullet(t)));
      });
    }

    if (notes.trim()) {
      children.push(heading("Reviewer Notes", HeadingLevel.HEADING_1));
      notes
        .trim()
        .split("\n")
        .forEach((line) => children.push(plainLine(line)));
    }

    if (issuesSeen.trim()) {
      children.push(
        heading("⚠️ Issues Seen in This Session", HeadingLevel.HEADING_1),
      );
      issuesSeen
        .trim()
        .split("\n")
        .forEach((line) => children.push(plainLine(line)));
    }

    if (recommendation.trim()) {
      children.push(heading("💡 Recommendation", HeadingLevel.HEADING_1));
      recommendation
        .trim()
        .split("\n")
        .forEach((line) => children.push(plainLine(line)));
    }

    if (tutorFeedback.trim()) {
      children.push(heading("📨 Feedback for the Tutor", HeadingLevel.HEADING_1));
      tutorFeedback
        .trim()
        .split("\n")
        .forEach((line) => children.push(plainLine(line)));
    }

    const doc = new Document({
      creator: reviewer || "Evangadi Tutor Review",
      title: `Video Review – ${studentName || "Student"}`,
      sections: [{ properties: {}, children }],
    });

    const blob = await Packer.toBlob(doc);
    const parts = [
      sanitize(studentName) || "Student",
      sanitize(tutorName) || "Tutor",
      datePart,
    ];
    const fileName = `${parts.join("_")}.docx`;
    const subFolder = (exportFolder || "")
      .trim()
      .replace(/[\\/:*?"<>|]/g, "")
      .replace(/^\.+/, "");

    setExporting(true);
    try {
      let dir = rootDirHandle;
      if (!dir) {
        dir = await pickRootFolder();
        if (!dir) {
          setExporting(false);
          return;
        }
      }
      const perm = await dir.queryPermission({ mode: "readwrite" });
      if (perm !== "granted") {
        const req = await dir.requestPermission({ mode: "readwrite" });
        if (req !== "granted") {
          alert("Permission denied.");
          setExporting(false);
          return;
        }
      }
      let targetDir = dir;
      if (subFolder)
        targetDir = await dir.getDirectoryHandle(subFolder, { create: true });
      const fileHandle = await targetDir.getFileHandle(fileName, {
        create: true,
      });
      const writable = await fileHandle.createWritable();
      await writable.write(blob);
      await writable.close();
      alert(`Saved to ${dir.name}/${subFolder}/${fileName}`);
    } catch (err) {
      console.error(err);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = subFolder ? `${subFolder}_${fileName}` : fileName;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const activeObs = OBSERVATIONS[activeCategory];

  const SESSION_TYPES = [
    {
      id: "standard",
      icon: "📘",
      label: "Standard subject",
      hint: "Math, reading, science — the standard three-phase checklist",
      color: "#2563eb",
      bg: "#eff6ff",
    },
    {
      id: "group",
      icon: "👩‍💻",
      label: "Group coding",
      hint: "Standard checklist plus participation, balanced praise & collaboration",
      color: "#c026d3",
      bg: "#fdf4ff",
    },
    {
      id: "coding1",
      icon: "💻",
      label: "1-on-1 coding",
      hint: "Its own checklist — concept, live coding, practice, debugging, close",
      color: "#0d9488",
      bg: "#f0fdfa",
    },
  ];

  const sessionTypePicker = () => {
    const active = SESSION_TYPES.find((t) => t.id === sessionType);
    return (
      <div style={{ marginTop: 14 }}>
        <div style={styles.metaLabelText}>Session type</div>
        <div
          style={{
            display: "flex",
            gap: 8,
            marginTop: 8,
            flexWrap: "wrap",
          }}
        >
          {SESSION_TYPES.map((t) => {
            const on = sessionType === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setSessionType(t.id)}
                style={{
                  ...styles.typeBtn,
                  background: on ? t.bg : "#ffffff",
                  borderColor: on ? t.color : "#e2e8f0",
                  color: on ? t.color : "#475569",
                  fontWeight: on ? 800 : 600,
                }}
              >
                <span style={{ fontSize: 16 }}>{t.icon}</span>
                {t.label}
              </button>
            );
          })}
        </div>
        <div style={styles.typeHint}>{active.hint}</div>
      </div>
    );
  };

  // Collapsible wrapper for the long free-text panels at the bottom.
  const panel = ({ id, title, color, borderTop, hint, filled, children }) => (
    <section style={{ ...styles.notesSection, borderTop }}>
      <button
        type="button"
        onClick={() => toggleSection(id)}
        aria-expanded={!!openSections[id]}
        style={styles.panelHeaderBtn}
      >
        <span style={{ ...styles.notesTitle, margin: 0, color }}>{title}</span>
        {filled > 0 && <span style={styles.panelFilled}>{filled} chars</span>}
        <span
          style={{
            ...styles.chevron,
            marginLeft: filled > 0 ? 0 : "auto",
            transform: openSections[id] ? "rotate(90deg)" : "rotate(0deg)",
          }}
        >
          ›
        </span>
      </button>
      {openSections[id] && (
        <div style={{ marginTop: 12 }}>
          {hint && (
            <p style={{ margin: "0 0 10px", fontSize: 12.5, color: "#64748b" }}>
              {hint}
            </p>
          )}
          {children}
        </div>
      )}
    </section>
  );

  return (
    <div
      style={{
        ...styles.page,
        padding: isMobile ? "16px 10px 60px" : styles.page.padding,
      }}
    >
      <div
        style={{
          ...styles.container,
          gridTemplateColumns: isMobile
            ? "1fr"
            : styles.container.gridTemplateColumns,
          gap: isMobile ? 14 : styles.container.gap,
        }}
      >
        {/* LEFT: Observation Library */}
        <aside
          style={{
            ...styles.sidebar,
            position: isMobile ? "static" : "sticky",
          }}
        >
          <div
            style={{
              ...styles.sidebarInner,
              maxHeight: isMobile ? "70vh" : styles.sidebarInner.maxHeight,
            }}
          >
            <div style={styles.sidebarHeader}>
              <span style={styles.libraryIcon}>📋</span>
              <div>
                <h2 style={styles.libraryTitle}>Observation Library</h2>
                <p style={styles.librarySubtitle}>
                  Click an item to add it to notes
                </p>
              </div>
            </div>
            <div style={styles.tabs}>
              {visibleCategories.map((catId) => {
                const cat = OBSERVATIONS[catId];
                const isActive = activeCategory === catId;
                return (
                  <button
                    key={catId}
                    type="button"
                    onClick={() => setActiveCategory(catId)}
                    style={{
                      ...styles.tab,
                      background: isActive ? cat.color : "#f1f5f9",
                      color: isActive ? "#ffffff" : "#475569",
                      borderColor: isActive ? cat.color : "#e2e8f0",
                    }}
                  >
                    {cat.label}
                    <span
                      style={{
                        ...styles.tabCount,
                        background: isActive
                          ? "rgba(255,255,255,0.25)"
                          : "#e2e8f0",
                        color: isActive ? "#ffffff" : "#64748b",
                      }}
                    >
                      {cat.items.length}
                    </span>
                  </button>
                );
              })}
            </div>
            <div style={styles.obsList}>
              {activeObs.items.map((item, idx) => {
                const isSelected = selectedObservations.some(
                  (o) => o.text === item.text && o.category === activeCategory,
                );
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => addObservation(activeCategory, item)}
                    disabled={isSelected}
                    style={{
                      ...styles.obsCard,
                      borderColor: isSelected ? activeObs.color : "#e2e8f0",
                      background: isSelected ? "#f0fdf4" : "#ffffff",
                      cursor: isSelected ? "default" : "pointer",
                      opacity: isSelected ? 0.65 : 1,
                    }}
                  >
                    <span
                      style={{
                        ...styles.obsBadge,
                        background: activeObs.color,
                      }}
                    >
                      {isSelected ? "✓" : "+"}
                    </span>
                    <span style={styles.obsText}>{item.text}</span>
                    {item.unchecks && item.unchecks.length > 0 && (
                      <span style={styles.obsHint}>
                        auto-unchecks {item.unchecks.length}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        {/* RIGHT: main content */}
        <div style={styles.main}>
          {/* Past reviews panel */}
          {studentId && (
            <div style={styles.pastBox}>
              <div style={styles.pastHead}>
                <strong>
                  📜 Past reviews for {studentName || "this student"}
                </strong>
                <span style={styles.pastCount}>
                  {loadingPast
                    ? "loading…"
                    : `${pastReviews.length} review${pastReviews.length === 1 ? "" : "s"}`}
                </span>
                {pastReviews.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowPast(!showPast)}
                    style={styles.pastToggle}
                  >
                    {showPast ? "Hide" : "Show"}
                  </button>
                )}
              </div>
              {showPast && pastReviews.length > 0 && (
                <div style={styles.pastList}>
                  {pastReviews.map((r) => (
                    <div
                      key={r.id}
                      style={{
                        ...styles.pastItem,
                        flexWrap: isMobile ? "wrap" : "nowrap",
                      }}
                    >
                      <div
                        style={{
                          ...styles.pastDate,
                          minWidth: isMobile
                            ? "auto"
                            : styles.pastDate.minWidth,
                        }}
                      >
                        {String(r.reviewDate).slice(0, 10)} · by{" "}
                        {r.reviewer || "—"}
                      </div>
                      <div style={styles.pastInfo}>
                        Tutor: <strong>{r.tutorName}</strong>
                        {r.payload?.score?.total != null && (
                          <span style={styles.pastScore}>
                            {" "}
                            · {r.payload.score.total}/100
                          </span>
                        )}
                        {r.payload?.stats?.overallPct != null && (
                          <span style={styles.pastScore}>
                            · {r.payload.stats.totalDone}/
                            {r.payload.stats.totalItems} (
                            {r.payload.stats.overallPct}%)
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => loadPastReview(r)}
                        style={styles.pastLoad}
                      >
                        Load this review
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Header */}
          <header
            style={{
              ...styles.header,
              padding: isMobile ? "18px 16px 16px" : styles.header.padding,
            }}
          >
            <div style={styles.eyebrow}>EVANGADI · TUTOR QUALITY REVIEW</div>
            <h1
              style={{
                ...styles.title,
                fontSize: isMobile ? 22 : styles.title.fontSize,
              }}
            >
              Video Review Checklist
            </h1>
            <p style={styles.subtitle}>
              Evaluate a recorded tutoring session across three phases.
            </p>

            <div
              style={{
                ...styles.metaRow,
                gridTemplateColumns: isMobile
                  ? "1fr"
                  : styles.metaRow.gridTemplateColumns,
              }}
            >
              <label style={styles.metaLabel}>
                <span style={styles.metaLabelText}>Tutor</span>
                <input
                  type="text"
                  value={tutorName}
                  onChange={(e) => setTutorName(e.target.value)}
                  placeholder="Tutor name"
                  style={styles.metaInput}
                />
              </label>
              <label style={styles.metaLabel}>
                <span style={styles.metaLabelText}>Student</span>
                <input
                  type="text"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  placeholder="Student name"
                  style={styles.metaInput}
                />
              </label>
              <label style={styles.metaLabel}>
                <span style={styles.metaLabelText}>Reviewer</span>
                <input
                  type="text"
                  value={reviewer}
                  onChange={(e) => setReviewer(e.target.value)}
                  placeholder="Your name"
                  style={styles.metaInput}
                />
              </label>
              <label style={styles.metaLabel}>
                <span style={styles.metaLabelText}>Date</span>
                <input
                  type="date"
                  value={reviewDate}
                  onChange={(e) => setReviewDate(e.target.value)}
                  style={styles.metaInput}
                />
              </label>
            </div>

            {sessionTypePicker()}

            <div
              style={{
                ...styles.folderHint,
                flexWrap: isMobile ? "wrap" : "nowrap",
              }}
            >
              <span style={styles.folderHintIcon}>📁</span>
              <span style={styles.folderHintText}>
                {rootDirHandle ? (
                  <>
                    Will save to:{" "}
                    <strong style={styles.folderHintPath}>
                      {rootDirName} / {exportFolder || "(set date)"}
                    </strong>
                  </>
                ) : (
                  <>
                    <strong>No folder chosen yet.</strong> Pick once — subfolder{" "}
                    <code style={styles.folderHintPath}>{exportFolder}</code>{" "}
                    auto-created.
                  </>
                )}
              </span>
              <button
                type="button"
                onClick={pickRootFolder}
                style={{
                  ...styles.folderHintBtn,
                  marginLeft: isMobile ? 0 : "auto",
                }}
              >
                {rootDirHandle ? "Change folder" : "Choose folder"}
              </button>
            </div>

            <div style={styles.overallBox}>
              <div style={styles.overallTop}>
                <span style={styles.overallLabel}>Overall progress</span>
                <span style={styles.overallValue}>
                  {stats.totalDone} / {stats.totalItems} ·{" "}
                  <strong>{stats.overallPct}%</strong>
                </span>
              </div>
              <div style={styles.progressTrack}>
                <div
                  style={{
                    ...styles.progressFill,
                    width: `${stats.overallPct}%`,
                    background:
                      "linear-gradient(90deg, #2563eb, #7c3aed 50%, #059669)",
                  }}
                />
              </div>
              <div style={styles.actions}>
                <button style={styles.btn} onClick={checkAll}>
                  Check all
                </button>
                <button style={styles.btn} onClick={uncheckAll}>
                  Uncheck all
                </button>
                <button style={styles.btn} onClick={clearObservations}>
                  Clear observations
                </button>
                <button style={styles.btn} onClick={expandAll}>
                  ⬇ Expand all
                </button>
                <button style={styles.btn} onClick={collapseAll}>
                  ⬆ Collapse all
                </button>
                <button
                  style={{ ...styles.btn, color: "#dc2626", borderColor: "#fca5a5" }}
                  onClick={clearAll}
                  title="Reset the whole checklist and empty every field"
                >
                  🗑️ Clear all
                </button>
                <button
                  style={{
                    ...styles.btnSave,
                    ...(savingToServer ? { opacity: 0.6, cursor: "wait" } : {}),
                  }}
                  onClick={saveToServer}
                  disabled={savingToServer || !studentId}
                  title={
                    !studentId
                      ? "No student selected"
                      : "Save review to MySQL server"
                  }
                >
                  {savingToServer ? "Saving…" : "💾 Save to server"}
                </button>
                <button
                  style={styles.btnPrimary}
                  onClick={exportReport}
                  disabled={exporting}
                >
                  {exporting ? "Exporting…" : "📄 Export .docx"}
                </button>
              </div>

              {saveResult && (
                <div
                  style={{
                    ...styles.saveResult,
                    ...(saveResult.type === "success"
                      ? styles.saveSuccess
                      : styles.saveError),
                  }}
                >
                  {saveResult.message}
                </div>
              )}
            </div>

            {/* Session score */}
            <div style={styles.scoreBox}>
              <div style={styles.scoreTop}>
                <div>
                  <div style={styles.scoreLabel}>Session score</div>
                  <div style={{ ...styles.scoreBand, color: score.band.color }}>
                    {score.band.label}
                  </div>
                </div>
                <div style={{ ...styles.scoreNumber, color: score.band.color }}>
                  {score.total}
                  <span style={styles.scoreOutOf}>/100</span>
                </div>
              </div>
              <div style={styles.scoreRows}>
                {score.breakdown.map((b) => (
                  <div
                    key={b.label}
                    style={{
                      ...styles.scoreRow,
                      flexWrap: isMobile ? "wrap" : "nowrap",
                    }}
                  >
                    <span
                      style={{
                        ...styles.scoreRowLabel,
                        minWidth: isMobile ? "auto" : styles.scoreRowLabel.minWidth,
                      }}
                    >
                      {b.label}
                    </span>
                    <span style={styles.scoreRowDetail}>{b.detail}</span>
                    <span style={styles.scoreRowPoints}>
                      {b.got}/{b.max}
                    </span>
                  </div>
                ))}
              </div>
              {score.unanswered > 0 && (
                <div style={styles.scoreWarn}>
                  {score.unanswered} teaching-quality question
                  {score.unanswered === 1 ? "" : "s"} not answered — the score is
                  provisional until all are marked.
                </div>
              )}
            </div>
          </header>

          {/* Feedback for the Tutor — sits directly under the score */}
          {panel({
            id: "feedback",
            title: "📨 Feedback for the Tutor",
            color: "#15803d",
            borderTop: "2px solid #bbf7d0",
            filled: tutorFeedback.length,
            hint: "This is what the tutor receives. Draft it from your selected observations, then edit the wording before sending.",
            children: (
              <>
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    marginBottom: 10,
                    flexWrap: "wrap",
                  }}
                >
                  <button
                    type="button"
                    onClick={draftFeedback}
                    style={styles.btn}
                  >
                    ✍️ Draft from observations
                  </button>
                  <button
                    type="button"
                    onClick={copyFeedback}
                    style={styles.btn}
                    disabled={!tutorFeedback.trim()}
                  >
                    📋 Copy
                  </button>
                </div>
                <textarea
                  value={tutorFeedback}
                  onChange={(e) => setTutorFeedback(e.target.value)}
                  placeholder={`What went well\n- ...\n\nWhat to improve\n- ...\n\nFocus for the next session\n- ...`}
                  style={{
                    ...styles.textarea,
                    borderColor: "#bbf7d0",
                    minHeight: 220,
                    lineHeight: 1.7,
                  }}
                />
              </>
            ),
          })}

          {selectedObservations.length > 0 && (
            <section style={styles.selectedSection}>
              <div style={styles.selectedHeader}>
                Selected Observations ({selectedObservations.length})
              </div>
              <div style={styles.chipRow}>
                {selectedObservations.map((o, i) => (
                  <div
                    key={i}
                    style={{
                      ...styles.chip,
                      borderColor: OBSERVATIONS[o.category].color,
                    }}
                  >
                    <span
                      style={{
                        ...styles.chipDot,
                        background: OBSERVATIONS[o.category].color,
                      }}
                    />
                    <div style={styles.chipText}>
                      <div
                        style={{
                          ...styles.chipCategoryLabel,
                          color: OBSERVATIONS[o.category].color,
                        }}
                      >
                        {OBSERVATIONS[o.category].label}
                      </div>
                      <div>{o.text}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeObservation(i)}
                      style={styles.chipRemove}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          <main style={styles.sections}>
            {/* Teaching Quality Assessment — 5 yes/no/N/A questions */}
            <section style={styles.qualitySection}>
              <button
                type="button"
                onClick={() => toggleSection("quality")}
                aria-expanded={!!openSections.quality}
                style={{
                  ...styles.qualityHeaderBtn,
                  marginBottom: openSections.quality ? 14 : 0,
                  paddingBottom: openSections.quality ? 12 : 0,
                  borderBottom: openSections.quality
                    ? "1px solid rgba(217,119,6,0.25)"
                    : "none",
                }}
              >
                <span style={styles.qualityIcon}>🎯</span>
                <span style={{ textAlign: "left", flex: 1, minWidth: 0 }}>
                  <span style={styles.qualityTitle}>
                    Teaching Quality Assessment
                  </span>
                  <span style={styles.qualitySubtitle}>
                    Answer these 5 questions about the tutor's teaching
                    effectiveness
                  </span>
                </span>
                <span style={styles.qualityCount}>
                  {Object.values(quality).filter((q) => q.answer).length} /{" "}
                  {TEACHING_QUALITY.length}
                </span>
                <span
                  style={{
                    ...styles.chevron,
                    color: "#92400e",
                    transform: openSections.quality
                      ? "rotate(90deg)"
                      : "rotate(0deg)",
                  }}
                >
                  ›
                </span>
              </button>

              {openSections.quality && (
              <ol style={styles.qualityList}>
                {TEACHING_QUALITY.map((q, idx) => {
                  const ans = quality[q.id] || { answer: null, comment: "" };
                  return (
                    <li key={q.id} style={styles.qualityItem}>
                      <div style={styles.qualityQuestionRow}>
                        <span style={styles.qualityNum}>{idx + 1}</span>
                        <span style={styles.qualityText}>{q.text}</span>
                      </div>
                      <div
                        style={{
                          ...styles.qualityChoices,
                          marginLeft: isMobile
                            ? 0
                            : styles.qualityChoices.marginLeft,
                          flexWrap: "wrap",
                        }}
                      >
                        {[
                          {
                            val: "yes",
                            label: "✓ Yes",
                            bg: "#059669",
                            border: "#059669",
                          },
                          {
                            val: "no",
                            label: "✗ No",
                            bg: "#dc2626",
                            border: "#dc2626",
                          },
                          {
                            val: "na",
                            label: "— N/A",
                            bg: "#94a3b8",
                            border: "#94a3b8",
                          },
                        ].map((choice) => {
                          const selected = ans.answer === choice.val;
                          return (
                            <button
                              key={choice.val}
                              type="button"
                              onClick={() =>
                                setQuality((p) => ({
                                  ...p,
                                  [q.id]: {
                                    ...p[q.id],
                                    answer: selected ? null : choice.val,
                                  },
                                }))
                              }
                              style={{
                                ...styles.qualityChoice,
                                background: selected ? choice.bg : "#ffffff",
                                color: selected ? "#ffffff" : choice.bg,
                                borderColor: choice.border,
                              }}
                            >
                              {choice.label}
                            </button>
                          );
                        })}
                      </div>
                      <textarea
                        value={ans.comment}
                        onChange={(e) =>
                          setQuality((p) => ({
                            ...p,
                            [q.id]: { ...p[q.id], comment: e.target.value },
                          }))
                        }
                        placeholder="Optional: explain your answer..."
                        style={styles.qualityComment}
                      />
                    </li>
                  );
                })}
              </ol>
              )}
            </section>

            {activeSections.map((sec) => {
              const s = stats.perSection[sec.id];
              return (
                <section key={sec.id} style={styles.section}>
                  <button
                    type="button"
                    onClick={() => toggleSection(sec.id)}
                    aria-expanded={!!openSections[sec.id]}
                    style={styles.sectionHeaderBtn}
                  >
                    <span style={styles.sectionTitleWrap}>
                      <span
                        style={{ ...styles.sectionDot, background: sec.accent }}
                      />
                      <span style={styles.sectionTitle}>{sec.title}</span>
                    </span>
                    <span
                      style={{
                        ...styles.sectionCount,
                        background: s.done === s.total ? "#dcfce7" : "#f1f5f9",
                        color: s.done === s.total ? "#15803d" : "#64748b",
                      }}
                    >
                      {s.done}/{s.total}
                    </span>
                    <span
                      style={{
                        ...styles.chevron,
                        transform: openSections[sec.id]
                          ? "rotate(90deg)"
                          : "rotate(0deg)",
                      }}
                    >
                      ›
                    </span>
                  </button>
                  <div style={styles.sectionTrack}>
                    <div
                      style={{
                        ...styles.sectionFill,
                        width: `${s.pct}%`,
                        background: sec.accent,
                      }}
                    />
                  </div>
                  {openSections[sec.id] && (
                  <ul style={styles.list}>
                    {sec.items.map((item, idx) => {
                      const key = `${sec.id}-${idx}`;
                      const isChecked = !!checked[key];
                      return (
                        <li key={key} style={styles.listItem}>
                          <button
                            type="button"
                            onClick={() => toggle(key)}
                            style={{
                              ...styles.checkRow,
                              background: isChecked ? "#f0fdf4" : "#ffffff",
                              borderColor: isChecked ? "#86efac" : "#e2e8f0",
                            }}
                          >
                            <span
                              style={{
                                ...styles.checkbox,
                                background: isChecked ? sec.accent : "#ffffff",
                                borderColor: isChecked ? sec.accent : "#cbd5e1",
                              }}
                            >
                              {isChecked && (
                                <svg
                                  viewBox="0 0 16 16"
                                  width="12"
                                  height="12"
                                  fill="none"
                                  stroke="white"
                                  strokeWidth="3"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <polyline points="3 8.5 6.5 12 13 4.5" />
                                </svg>
                              )}
                            </span>
                            <span
                              style={{
                                ...styles.itemText,
                                color: isChecked ? "#15803d" : "#0f172a",
                              }}
                            >
                              {item}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  )}
                </section>
              );
            })}
          </main>

          {panel({
            id: "notes",
            title: "Reviewer Notes",
            filled: notes.length,
            children: (
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Strengths, areas for improvement, specific timestamps, suggested next steps..."
                style={styles.textarea}
              />
            ),
          })}

          {/* Issues Seen */}
          {panel({
            id: "issues",
            title: "⚠️ Issues Seen in This Session",
            color: "#b91c1c",
            borderTop: "2px solid #fee2e2",
            filled: issuesSeen.length,
            hint: "Describe specific issues observed — connection problems, lateness, energy level, behaviour, etc.",
            children: (
              <textarea
                value={issuesSeen}
                onChange={(e) => setIssuesSeen(e.target.value)}
                placeholder={`e.g.\n1. Internet Connection Issue\nAn audio/internet issue was observed in one of the sessions from the tutor's side.\n\n2. Lateness\nTutor was late on two sessions — approximately 3 min 7 sec late in one session and 5 min 54 sec late in another.\n\n3. Sleepiness / Low Energy\nThis was a recurring pattern across most sessions reviewed...`}
                style={{
                  ...styles.textarea,
                  borderColor: "#fecaca",
                  minHeight: 200,
                  lineHeight: 1.7,
                }}
              />
            ),
          })}

          {/* Recommendation */}
          {panel({
            id: "recommend",
            title: "💡 Recommendation",
            color: "#1d4ed8",
            borderTop: "2px solid #bfdbfe",
            filled: recommendation.length,
            hint: "Specific recommendation for this tutor/student going forward.",
            children: (
              <textarea
                value={recommendation}
                onChange={(e) => setRecommendation(e.target.value)}
                placeholder={`e.g.\nThe current teaching approach appears effective. To further support progress:\n- Additional practice with fraction concepts\n- More step-by-step guidance on challenging problems\n- Encourage tutor to maintain higher energy levels throughout sessions`}
                style={{
                  ...styles.textarea,
                  borderColor: "#bfdbfe",
                  minHeight: 160,
                  lineHeight: 1.7,
                }}
              />
            ),
          })}

          <footer style={styles.footer}>
            <span>Evangadi Tutor Review · {new Date().getFullYear()}</span>
          </footer>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(1200px 600px at 10% -10%, #eef2ff 0%, transparent 60%), radial-gradient(900px 500px at 110% 10%, #ecfdf5 0%, transparent 55%), #f8fafc",
    padding: "32px 16px 80px",
    fontFamily:
      "'Inter', system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
    color: "#0f172a",
  },
  container: {
    maxWidth: 1680,
    margin: "0 auto",
    display: "grid",
    gridTemplateColumns: "minmax(380px, 460px) 1fr",
    gap: 24,
    alignItems: "flex-start",
  },

  sidebar: { position: "sticky", top: 24, alignSelf: "flex-start" },
  sidebarInner: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 16,
    boxShadow: "0 10px 30px -12px rgba(15,23,42,0.08)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    maxHeight: "calc(100vh - 48px)",
  },
  sidebarHeader: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "16px 18px",
    background: "linear-gradient(90deg, #fef3c7 0%, #fde68a 100%)",
    borderBottom: "1px solid #fcd34d",
  },
  libraryIcon: { fontSize: 22 },
  libraryTitle: { margin: 0, fontSize: 15, fontWeight: 700, color: "#78350f" },
  librarySubtitle: { margin: "2px 0 0", fontSize: 11.5, color: "#92400e" },
  tabs: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
    padding: "12px 14px",
    borderBottom: "1px solid #f1f5f9",
  },
  tab: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "5px 10px",
    borderRadius: 999,
    border: "1px solid",
    fontSize: 11.5,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  tabCount: {
    fontSize: 10,
    fontWeight: 700,
    padding: "1px 6px",
    borderRadius: 999,
    minWidth: 18,
    textAlign: "center",
  },
  obsList: {
    flex: 1,
    overflowY: "auto",
    padding: "12px 14px",
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  obsCard: {
    display: "flex",
    alignItems: "flex-start",
    gap: 9,
    padding: "10px 12px",
    border: "1px solid #e2e8f0",
    borderRadius: 10,
    fontFamily: "inherit",
    textAlign: "left",
    position: "relative",
    width: "100%",
  },
  obsBadge: {
    flexShrink: 0,
    width: 20,
    height: 20,
    borderRadius: 999,
    color: "#ffffff",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    fontWeight: 700,
    marginTop: 1,
  },
  obsText: { fontSize: 12.5, lineHeight: 1.45, color: "#0f172a", flex: 1 },
  obsHint: {
    position: "absolute",
    bottom: 3,
    right: 8,
    fontSize: 9.5,
    color: "#94a3b8",
    fontStyle: "italic",
  },

  main: { minWidth: 0 },

  pastBox: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    marginBottom: 14,
    boxShadow: "0 6px 20px -14px rgba(15,23,42,0.08)",
  },
  pastHead: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 14px",
    fontSize: 13,
    color: "#475569",
  },
  pastCount: {
    fontSize: 11.5,
    color: "#64748b",
    background: "#f1f5f9",
    padding: "3px 8px",
    borderRadius: 999,
    fontWeight: 600,
  },
  pastToggle: {
    marginLeft: "auto",
    padding: "5px 12px",
    borderRadius: 8,
    border: "1px solid #e2e8f0",
    background: "#ffffff",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 600,
    fontFamily: "inherit",
  },
  pastList: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    padding: "0 14px 12px",
  },
  pastItem: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 12px",
    background: "#f8fafc",
    borderRadius: 8,
    border: "1px solid #e2e8f0",
  },
  pastDate: { fontSize: 12, fontWeight: 700, color: "#0f172a", minWidth: 150 },
  pastInfo: { fontSize: 12, color: "#475569", flex: 1 },
  pastScore: { color: "#0f172a", fontWeight: 700 },
  pastLoad: {
    padding: "5px 12px",
    borderRadius: 8,
    border: "1px solid #2563eb",
    background: "#eff6ff",
    color: "#1e40af",
    cursor: "pointer",
    fontSize: 11.5,
    fontWeight: 600,
    fontFamily: "inherit",
  },

  header: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 18,
    padding: "32px 32px 24px",
    boxShadow: "0 10px 30px -12px rgba(15,23,42,0.08)",
    marginBottom: 20,
  },
  eyebrow: {
    fontSize: 11,
    letterSpacing: "0.18em",
    color: "#64748b",
    fontWeight: 600,
    marginBottom: 8,
  },
  title: {
    fontSize: 34,
    margin: "0 0 8px",
    fontWeight: 800,
    letterSpacing: "-0.02em",
    color: "#0f172a",
  },
  subtitle: {
    margin: 0,
    color: "#475569",
    fontSize: 15,
    lineHeight: 1.55,
    maxWidth: 820,
  },
  metaRow: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: 12,
    marginTop: 22,
  },
  metaLabel: { display: "flex", flexDirection: "column", gap: 6 },
  metaLabelText: {
    fontSize: 11,
    fontWeight: 700,
    color: "#64748b",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  metaInput: {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #e2e8f0",
    fontSize: 14,
    outline: "none",
    fontFamily: "inherit",
    color: "#0f172a",
    background: "#ffffff",
  },

  typeBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 14px",
    borderRadius: 10,
    border: "1.5px solid",
    fontSize: 13,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  typeHint: { marginTop: 8, fontSize: 11.5, color: "#64748b" },

  folderHint: {
    marginTop: 16,
    padding: "10px 14px",
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    borderRadius: 10,
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontSize: 13,
    color: "#1e40af",
  },
  folderHintIcon: { fontSize: 16 },
  folderHintText: { flex: 1 },
  folderHintPath: {
    color: "#1e3a8a",
    fontFamily: "ui-monospace, monospace",
    fontSize: 12.5,
  },
  folderHintBtn: {
    padding: "6px 12px",
    borderRadius: 8,
    border: "1px solid #bfdbfe",
    background: "#ffffff",
    color: "#1e40af",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
  },

  overallBox: {
    marginTop: 24,
    padding: 18,
    borderRadius: 14,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
  },
  overallTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
    fontSize: 14,
  },
  overallLabel: { color: "#475569", fontWeight: 600 },
  overallValue: { color: "#0f172a" },
  progressTrack: {
    height: 10,
    background: "#e2e8f0",
    borderRadius: 999,
    overflow: "hidden",
  },
  progressFill: { height: "100%", borderRadius: 999 },
  actions: { display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" },
  btn: {
    padding: "8px 14px",
    borderRadius: 10,
    border: "1px solid #e2e8f0",
    background: "#ffffff",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
    color: "#0f172a",
    fontFamily: "inherit",
  },
  btnSave: {
    padding: "8px 14px",
    borderRadius: 10,
    border: "1px solid #059669",
    background: "#059669",
    color: "#ffffff",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 700,
    fontFamily: "inherit",
    marginLeft: "auto",
  },
  btnPrimary: {
    padding: "8px 14px",
    borderRadius: 10,
    border: "1px solid #0f172a",
    background: "#0f172a",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
    color: "#ffffff",
    fontFamily: "inherit",
  },

  saveResult: {
    marginTop: 12,
    padding: "10px 14px",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
  },
  saveSuccess: {
    background: "#dcfce7",
    color: "#15803d",
    border: "1px solid #86efac",
  },
  saveError: {
    background: "#fef2f2",
    color: "#b91c1c",
    border: "1px solid #fecaca",
  },

  // Session score
  scoreBox: {
    marginTop: 16,
    padding: 18,
    borderRadius: 14,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
  },
  scoreTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14,
  },
  scoreLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: "#64748b",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  scoreBand: { fontSize: 15, fontWeight: 800, marginTop: 4 },
  scoreNumber: {
    fontSize: 44,
    fontWeight: 800,
    lineHeight: 1,
    letterSpacing: "-0.03em",
  },
  scoreOutOf: {
    fontSize: 16,
    fontWeight: 600,
    color: "#94a3b8",
    marginLeft: 2,
  },
  scoreRows: { display: "flex", flexDirection: "column", gap: 6 },
  scoreRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "7px 10px",
    background: "#f8fafc",
    borderRadius: 8,
    fontSize: 12.5,
  },
  scoreRowLabel: { fontWeight: 700, color: "#0f172a", minWidth: 150 },
  scoreRowDetail: { color: "#64748b", flex: 1 },
  scoreRowPoints: { fontWeight: 800, color: "#0f172a" },
  scoreWarn: {
    marginTop: 10,
    padding: "8px 12px",
    borderRadius: 8,
    background: "#fffbeb",
    border: "1px solid #fde68a",
    color: "#92400e",
    fontSize: 12,
  },

  selectedSection: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
  },
  selectedHeader: {
    fontSize: 12,
    fontWeight: 700,
    color: "#475569",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: 12,
  },
  chipRow: { display: "flex", flexDirection: "column", gap: 8 },
  chip: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    padding: "10px 12px",
    background: "#ffffff",
    border: "1px solid",
    borderLeftWidth: 4,
    borderRadius: 10,
    fontSize: 13,
    width: "100%",
    boxSizing: "border-box",
  },
  chipDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    flexShrink: 0,
    marginTop: 6,
  },
  chipText: {
    color: "#0f172a",
    flex: 1,
    lineHeight: 1.5,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
  chipCategoryLabel: {
    fontSize: 10.5,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: 4,
  },
  chipRemove: {
    background: "transparent",
    border: "none",
    color: "#94a3b8",
    fontSize: 18,
    cursor: "pointer",
    lineHeight: 1,
    padding: "0 4px",
    fontFamily: "inherit",
  },

  sections: { display: "flex", flexDirection: "column", gap: 18 },

  // Teaching Quality Assessment
  qualitySection: {
    background: "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)",
    border: "2px solid #fcd34d",
    borderRadius: 16,
    padding: 18,
    boxShadow: "0 6px 20px -14px rgba(217,119,6,0.25)",
  },
  qualityHeader: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
    paddingBottom: 12,
    borderBottom: "1px solid rgba(217,119,6,0.25)",
  },
  qualityIcon: { fontSize: 22 },
  qualityTitle: {
    display: "block",
    margin: 0,
    fontSize: 16,
    fontWeight: 800,
    color: "#78350f",
    letterSpacing: "-0.01em",
  },
  qualitySubtitle: {
    display: "block",
    margin: "2px 0 0",
    fontSize: 12,
    color: "#92400e",
  },
  qualityCount: {
    marginLeft: "auto",
    fontSize: 12,
    fontWeight: 800,
    color: "#78350f",
    background: "rgba(255,255,255,0.6)",
    padding: "5px 10px",
    borderRadius: 999,
  },
  qualityList: {
    listStyle: "none",
    margin: 0,
    padding: 0,
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },
  qualityItem: {
    background: "#ffffff",
    padding: "12px 14px",
    borderRadius: 10,
    border: "1px solid #fde68a",
  },
  qualityQuestionRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 10,
  },
  qualityNum: {
    flexShrink: 0,
    width: 22,
    height: 22,
    borderRadius: 999,
    background: "#d97706",
    color: "#ffffff",
    fontSize: 12,
    fontWeight: 800,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },
  qualityText: {
    fontSize: 13.5,
    color: "#0f172a",
    fontWeight: 600,
    lineHeight: 1.45,
    flex: 1,
  },
  qualityChoices: { display: "flex", gap: 8, marginBottom: 8, marginLeft: 32 },
  qualityChoice: {
    flex: 1,
    padding: "8px 10px",
    borderRadius: 8,
    border: "2px solid",
    fontSize: 12.5,
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "inherit",
    transition: "all 140ms ease",
    maxWidth: 110,
  },
  qualityComment: {
    width: "100%",
    marginLeft: 32,
    marginTop: 4,
    maxWidth: "calc(100% - 32px)",
    boxSizing: "border-box",
    padding: "8px 10px",
    borderRadius: 8,
    border: "1px solid #fde68a",
    fontFamily: "inherit",
    fontSize: 12.5,
    resize: "vertical",
    outline: "none",
    minHeight: 38,
    background: "#fffbeb",
    color: "#0f172a",
  },

  section: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 16,
    padding: "22px 22px 18px",
    boxShadow: "0 6px 20px -14px rgba(15,23,42,0.08)",
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  sectionHeaderBtn: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
    padding: 0,
    background: "transparent",
    border: "none",
    cursor: "pointer",
    fontFamily: "inherit",
    textAlign: "left",
  },
  qualityHeaderBtn: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: 0,
    background: "transparent",
    border: "none",
    cursor: "pointer",
    fontFamily: "inherit",
  },
  panelHeaderBtn: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: 0,
    background: "transparent",
    border: "none",
    cursor: "pointer",
    fontFamily: "inherit",
    textAlign: "left",
  },
  panelFilled: {
    marginLeft: "auto",
    fontSize: 11,
    fontWeight: 700,
    color: "#64748b",
    background: "#f1f5f9",
    padding: "3px 8px",
    borderRadius: 999,
  },
  chevron: {
    fontSize: 22,
    lineHeight: 1,
    color: "#94a3b8",
    fontWeight: 700,
    transition: "transform 160ms ease",
    display: "inline-block",
    flexShrink: 0,
  },
  sectionTitleWrap: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  sectionDot: { width: 10, height: 10, borderRadius: 999 },
  sectionTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 700,
    letterSpacing: "-0.01em",
  },
  sectionCount: {
    fontSize: 13,
    color: "#64748b",
    fontWeight: 600,
    background: "#f1f5f9",
    padding: "4px 10px",
    borderRadius: 999,
  },
  sectionTrack: {
    height: 6,
    background: "#f1f5f9",
    borderRadius: 999,
    overflow: "hidden",
    marginBottom: 16,
  },
  sectionFill: { height: "100%", borderRadius: 999 },
  list: {
    listStyle: "none",
    margin: 0,
    padding: 0,
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  listItem: { margin: 0 },
  checkRow: {
    width: "100%",
    display: "flex",
    alignItems: "flex-start",
    gap: 12,
    padding: "12px 14px",
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    cursor: "pointer",
    textAlign: "left",
    fontFamily: "inherit",
  },
  checkbox: {
    flexShrink: 0,
    width: 20,
    height: 20,
    borderRadius: 6,
    border: "2px solid #cbd5e1",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  itemText: { fontSize: 14.5, lineHeight: 1.5, fontWeight: 500 },

  notesSection: {
    marginTop: 20,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 16,
    padding: 22,
  },
  notesTitle: { margin: "0 0 10px", fontSize: 16, fontWeight: 700 },
  textarea: {
    width: "100%",
    minHeight: 110,
    padding: 12,
    borderRadius: 10,
    border: "1px solid #e2e8f0",
    fontFamily: "inherit",
    fontSize: 14,
    resize: "vertical",
    outline: "none",
    color: "#0f172a",
    background: "#f8fafc",
    boxSizing: "border-box",
  },
  footer: {
    marginTop: 28,
    textAlign: "center",
    fontSize: 12,
    color: "#94a3b8",
  },
};