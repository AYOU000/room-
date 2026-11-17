import { API_URL } from './config';
export type RoomSnapshot = {
 room: { id: string; creatorId: string; title: string; description: string | null; durationSeconds: number };
 session: { id: string; state: 'waiting'|'active'|'finishing'|'ended'|'cancelled'; evaluationStatus: string };
 participants: { participantId: string; slot: number; ready: boolean; connection: string }[];
 inviteCode?: string;
};
export class RoomApiError extends Error {
 constructor(public code: string, public status: number) {
  super(({ROOM_FULL:'This room is full.',INVITE_INVALID:'This invitation is invalid, expired, or closed.',STATE_CONFLICT:'The room changed. Refresh and try again.',UNAUTHENTICATED:'Sign in again to continue.',FORBIDDEN:'You cannot perform this action.',NOT_FOUND:'This room is unavailable.',SERVICE_UNAVAILABLE:'The service is unavailable. Try again later.'} as Record<string,string>)[code] ?? 'The request failed. Check your input and try again.');
 }
}
export async function roomRequest<T>(token: string, path: string, method = 'GET', body?: unknown, signal?: AbortSignal): Promise<T> {
 const response = await fetch(`${API_URL}/api${path}`, {method, signal, headers: {Authorization:`Bearer ${token}`, ...(body !== undefined ? {'Content-Type':'application/json'} : {})}, ...(body !== undefined ? {body:JSON.stringify(body)} : {})});
 if (!response.ok) { const error = await response.json().catch(() => ({})); throw new RoomApiError(error.error?.code ?? 'REQUEST_FAILED',response.status); }
 return response.status === 204 ? undefined as T : response.json();
}
