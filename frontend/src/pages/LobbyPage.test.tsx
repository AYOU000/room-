import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderRoute } from '../test/render';
import { setAuthSession } from '../lib/auth-session';
const snapshot = {room:{id:'room-id',creatorId:'creator',title:'Real topic',description:null,durationSeconds:600},session:{id:'session-id',state:'waiting',evaluationStatus:'pending'},participants:[{participantId:'guest',slot:2,ready:false,connection:'disconnected'}]};
describe('live lobby',()=>{
 beforeEach(()=>{setAuthSession(null);vi.stubGlobal('fetch',vi.fn().mockImplementation(()=>Promise.resolve(new Response(JSON.stringify(snapshot)))));});
 it('requires an authenticated session',()=>{renderRoute('/lobby');expect(screen.getByText('Sign in to create or join a room.')).toBeInTheDocument();expect(screen.queryByRole('button',{name:'Create room'})).toBeNull();});
 it('sends a bearer-authenticated create request and displays the returned invitation',async()=>{
  setAuthSession({userId:'creator',accessToken:'test-token'});
  vi.stubGlobal('fetch',vi.fn().mockImplementation(()=>Promise.resolve(new Response(JSON.stringify({...snapshot,inviteCode:'A'.repeat(43)})))));
  const user=userEvent.setup();renderRoute('/lobby');
  await user.type(screen.getByLabelText('Topic'),'Real topic');await user.click(screen.getByRole('button',{name:'Create room'}));
  expect(await screen.findByText('A'.repeat(43))).toBeInTheDocument();
  expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/rooms'),expect.objectContaining({method:'POST',headers:expect.objectContaining({Authorization:'Bearer test-token'}),body:JSON.stringify({title:'Real topic',description:'',durationSeconds:600})}));
 });
 it('hides creator edits from guests and requires consent before readiness',async()=>{
  setAuthSession({userId:'guest',accessToken:'test-token'});
  const user=userEvent.setup();renderRoute('/lobby?room=room-id');
  expect(await screen.findByRole('heading',{name:'Real topic'})).toBeInTheDocument();
  expect(screen.queryByText('Save changes')).toBeNull();
  expect(screen.getByRole('button',{name:'Ready'})).toBeDisabled();
  await user.click(screen.getByRole('checkbox'));
  await user.click(screen.getByRole('button',{name:'Ready'}));
  expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/ready'),expect.objectContaining({method:'POST',body:JSON.stringify({ready:true,consentVersion:'privacy-v1'})}));
 });
});
