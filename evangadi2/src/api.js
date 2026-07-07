// api.js — Frontend API client
//
// Set VITE_API_BASE or REACT_APP_API_BASE to override the default.

const API_BASE =
  (typeof import.meta !== "undefined" &&
    import.meta.env &&
    import.meta.env.VITE_API_BASE) ||
  (typeof process !== "undefined" &&
    process.env &&
    process.env.REACT_APP_API_BASE) ||
  "http://localhost:4000";

const TOKEN_KEY = "evangadi:token";

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}
export function setToken(t) {
  try {
    t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY);
  } catch {}
}
export function clearToken() {
  setToken(null);
}

async function request(path, options = {}, auth = true) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  if (auth) {
    const t = getToken();
    if (t) headers.Authorization = `Bearer ${t}`;
  }
  // no-store: never serve API responses from the HTTP cache, so reads always
  // reflect the latest writes (some hosts/CDNs cache GET responses otherwise).
  const res = await fetch(`${API_BASE}${path}`, {
    cache: "no-store",
    ...options,
    headers,
  });
  if (res.status === 401) {
    clearToken();
    throw new Error("Session expired — please log in again");
  }
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const b = await res.json();
      msg = b.error || msg;
    } catch {}
    throw new Error(msg);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  // Auth
  register: (name, email, password) =>
    request(
      "/api/auth/register",
      { method: "POST", body: JSON.stringify({ name, email, password }) },
      false,
    ),
  login: (email, password) =>
    request(
      "/api/auth/login",
      { method: "POST", body: JSON.stringify({ email, password }) },
      false,
    ),
  me: () => request("/api/auth/me"),

  // Schedule (per week)
  getWeek: (weekKey) => request(`/api/schedule/${weekKey}`),
  copyWeekFrom: (target, source) =>
    request(`/api/schedule/${target}/copy-from/${source}`, { method: "POST" }),
  clearWeek: (weekKey) =>
    request(`/api/schedule/${weekKey}/clear`, { method: "DELETE" }),

  // Tutors
  addTutor: (weekKey, dayId, tutor) =>
    request(`/api/schedule/${weekKey}/tutors`, {
      method: "POST",
      body: JSON.stringify({ dayId, tutor }),
    }),
  duplicateTutor: (weekKey, tutorId, targetDayId) =>
    request(`/api/schedule/${weekKey}/tutors/${tutorId}/duplicate`, {
      method: "POST",
      body: JSON.stringify({ targetDayId }),
    }),
  patchTutor: (tutorId, patch) =>
    request(`/api/schedule/tutors/${tutorId}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
  removeTutor: (tutorId) =>
    request(`/api/schedule/tutors/${tutorId}`, { method: "DELETE" }),

  // Students
  addStudent: (tutorId, name, priority, focusNote) =>
    request("/api/schedule/students", {
      method: "POST",
      body: JSON.stringify({ tutorId, name, priority, focusNote }),
    }),
  patchStudent: (studentId, patch) =>
    request(`/api/schedule/students/${studentId}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
  removeStudent: (studentId) =>
    request(`/api/schedule/students/${studentId}`, { method: "DELETE" }),

  // Status
  getStatus: (weekKey) => request(`/api/status/${weekKey}`),
  setStatus: (weekKey, studentId, status) =>
    request(`/api/status/${weekKey}/${studentId}`, {
      method: "PUT",
      body: JSON.stringify({ status }),
    }),

  // Reviews
  saveReview: (data) =>
    request("/api/reviews", { method: "POST", body: JSON.stringify(data) }),
  getReviewsForStudent: (studentId) =>
    request(`/api/reviews/student/${studentId}`),
  getAllReviews: () => request("/api/reviews"),

  // Day notes (used by Audio Report — record why a tutor missed audio on a day)
  getDayNotes: (weekKey) => request(`/api/day-notes/${weekKey}`),
  setDayNote: (weekKey, tutorName, dayId, note) =>
    request(`/api/day-notes/${weekKey}`, {
      method: "PUT",
      body: JSON.stringify({ tutorName, dayId, note }),
    }),

  // Tutor WhatsApp groups
  getTutorGroups: () => request("/api/tutor-groups"),
  createTutorGroup: (name) =>
    request("/api/tutor-groups", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
  deleteTutorGroup: (id) =>
    request(`/api/tutor-groups/${id}`, { method: "DELETE" }),
  assignTutorToGroup: (groupId, tutorName) =>
    request(`/api/tutor-groups/${groupId}/members`, {
      method: "PUT",
      body: JSON.stringify({ tutorName }),
    }),
  removeTutorFromGroup: (tutorName) =>
    request(`/api/tutor-groups/members/${encodeURIComponent(tutorName)}`, {
      method: "DELETE",
    }),

  // Tutor expectations
  getExpectations: () => request("/api/expectations"),
  setExpectation: (tutorName, minSessions, minDays) =>
    request(`/api/expectations/${encodeURIComponent(tutorName)}`, {
      method: "PUT",
      body: JSON.stringify({ minSessions, minDays }),
    }),
  deleteExpectation: (tutorName) =>
    request(`/api/expectations/${encodeURIComponent(tutorName)}`, {
      method: "DELETE",
    }),
  getWeekExpectations: (weekKey) =>
    request(`/api/expectations/week/${weekKey}`),
  setWeekExpectation: (weekKey, tutorName, minSessions, minDays) =>
    request(
      `/api/expectations/week/${weekKey}/${encodeURIComponent(tutorName)}`,
      {
        method: "PUT",
        body: JSON.stringify({ minSessions, minDays }),
      },
    ),
  deleteWeekExpectation: (weekKey, tutorName) =>
    request(
      `/api/expectations/week/${weekKey}/${encodeURIComponent(tutorName)}`,
      { method: "DELETE" },
    ),

  // Manual audio received — mark a tutor's day as received outside the app
  getAudioReceived: (weekKey) => request(`/api/audio-received/${weekKey}`),
  setAudioReceived: (weekKey, tutorName, dayId, received) =>
    request(`/api/audio-received/${weekKey}`, {
      method: "PUT",
      body: JSON.stringify({ tutorName, dayId, received }),
    }),

  // Manual report entries — add tutor/student manually in the Audio Report
  getManualEntries: (weekKey) => request(`/api/manual-entries/${weekKey}`),
  addManualEntry: (
    weekKey,
    tutorName,
    studentName,
    dayId,
    status,
    audioFilename,
    sessionTime,
    materialStatus,
  ) =>
    request(`/api/manual-entries/${weekKey}`, {
      method: "POST",
      body: JSON.stringify({
        tutorName,
        studentName,
        dayId,
        status,
        audioFilename,
        sessionTime,
        materialStatus,
      }),
    }),
  patchManualEntry: (id, fields) =>
    request(`/api/manual-entries/${id}`, {
      method: "PATCH",
      body: JSON.stringify(fields),
    }),
  deleteManualEntry: (id) =>
    request(`/api/manual-entries/${id}`, { method: "DELETE" }),
  // Delete ALL manual entries across every week (destructive).
  clearAllManualEntries: () =>
    request(`/api/manual-entries`, { method: "DELETE" }),

  // Admin — user account management (admin role only)
  getUsers: () => request(`/api/admin/users`),
  createUser: (name, email, password, role) =>
    request(`/api/admin/users`, {
      method: "POST",
      body: JSON.stringify({ name, email, password, role }),
    }),
  updateUserRole: (id, fields) =>
    request(`/api/admin/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify(fields),
    }),
  deleteUser: (id) => request(`/api/admin/users/${id}`, { method: "DELETE" }),

  // Roster — master tutor/student profiles (admin + coordinator)
  getTutorRoster: () => request(`/api/roster/tutors`),
  createTutorProfile: (fields) =>
    request(`/api/roster/tutors`, {
      method: "POST",
      body: JSON.stringify(fields),
    }),
  updateTutorProfile: (id, fields) =>
    request(`/api/roster/tutors/${id}`, {
      method: "PATCH",
      body: JSON.stringify(fields),
    }),
  deleteTutorProfile: (id) =>
    request(`/api/roster/tutors/${id}`, { method: "DELETE" }),

  getStudentRoster: () => request(`/api/roster/students`),
  createStudentProfile: (fields) =>
    request(`/api/roster/students`, {
      method: "POST",
      body: JSON.stringify(fields),
    }),
  updateStudentProfile: (id, fields) =>
    request(`/api/roster/students/${id}`, {
      method: "PATCH",
      body: JSON.stringify(fields),
    }),
  deleteStudentProfile: (id) =>
    request(`/api/roster/students/${id}`, { method: "DELETE" }),

  getRosterDashboard: () => request(`/api/roster/dashboard`),

  // Admin — status breakdown for a given week (schedule + audio)
  getWeekStatus: (weekKey) => request(`/api/admin/week-status/${weekKey}`),

  // Admin — review activity across video + audio (who reviewed what)
  getReviewActivity: (from, to) => {
    const qs = new URLSearchParams();
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);
    const q = qs.toString();
    return request(`/api/admin/review-activity${q ? "?" + q : ""}`);
  },
};

export default api;
