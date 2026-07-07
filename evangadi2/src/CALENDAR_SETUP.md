# Calendar Integration — Setup Guide

You now have two files working together:

```
src/evangadi2/
├── VideoReviewChecklist.jsx   ← (your existing file, needs 1 small edit)
├── SessionCalendar.jsx        ← NEW – calendar with Mon–Fri sessions
└── App.jsx                    ← updated – now renders the calendar
```

## How it works

1. **Calendar view** (default): Mon–Fri grid for the current month.
2. Each weekday can hold **1 to 3 sessions** (configurable via
   `MAX_SESSIONS_PER_DAY` at the top of `SessionCalendar.jsx`).
3. Click **+ Add session** to add a session — enter student, tutor, time slot.
4. Click an existing **session chip** → opens your existing `VideoReviewChecklist`
   with student / tutor / date already pre-filled.
5. When you click **← Back to calendar**, the session is automatically marked
   as **✓ Reviewed** (turns green).
6. Sessions persist in `localStorage` (key: `evangadi:sessions`), so they
   survive page reloads.

## REQUIRED EDIT to VideoReviewChecklist.jsx

The calendar passes 3 props to the checklist: `initialTutor`, `initialStudent`,
`initialDate`. You need to accept and use them.

### Find this line near the top of the component:

```jsx
export default function VideoReviewChecklist() {
  const [checked, setChecked] = useState(() => buildInitialState(false));
  const [tutorName, setTutorName] = useState("");
  const [studentName, setStudentName] = useState("");
  const [reviewer, setReviewer] = useState("");
  const [reviewDate, setReviewDate] = useState(() => new Date().toISOString().slice(0, 10));
```

### Replace with:

```jsx
export default function VideoReviewChecklist({
  initialTutor = "",
  initialStudent = "",
  initialDate = "",
} = {}) {
  const [checked, setChecked] = useState(() => buildInitialState(false));
  const [tutorName, setTutorName] = useState(initialTutor);
  const [studentName, setStudentName] = useState(initialStudent);
  const [reviewer, setReviewer] = useState("");
  const [reviewDate, setReviewDate] = useState(
    () => initialDate || new Date().toISOString().slice(0, 10)
  );
```

That's it — three small changes:
1. Accept props in function signature
2. Use `initialTutor` as the default tutor name
3. Use `initialStudent` and `initialDate` as defaults

The component still works exactly the same when used standalone (no props).

## Adjust max sessions per day

In `SessionCalendar.jsx`, line near the top:

```jsx
const MAX_SESSIONS_PER_DAY = 3;
```

Change to `1`, `2`, `3`, or any number you want.

## Clear all saved sessions (during testing)

Open the browser DevTools console and run:

```js
localStorage.removeItem("evangadi:sessions");
location.reload();
```
