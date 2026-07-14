const volunteerSessionKey = (eventId: string) => `turnout_volunteer_session_${eventId}`;

export function getOrCreateVolunteerSessionId(eventId: string): string {
  const key = volunteerSessionKey(eventId);
  let id = sessionStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(key, id);
  }
  return id;
}

export function clearVolunteerSessionId(eventId: string): void {
  sessionStorage.removeItem(volunteerSessionKey(eventId));
}
