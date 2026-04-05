import { useRef, useEffect, useState } from 'react';
import { useParams, useLocation } from 'react-router';
import Sidebar from '../components/sidebar/Sidebar';
import Workspace from '../components/Workspace/Workspace';
import { connectSocket } from '../socket';
import toast from 'react-hot-toast';
import { getAuthToken } from '../lib/auth';


function Editor() {
  const socketRef = useRef(null);
  const { roomId } = useParams();
  const { state } = useLocation();
  const enteredUsername = state?.username;
  const enteredRole = state?.role || 'Peer';
  const enteredSessionMode = state?.sessionMode || 'peer_practice';
  const [socketConnected, setSocketConnected] = useState(false);
  const [users, setUsers] = useState([]); // Add this to track users
  const [roomState, setRoomState] = useState(null);
  const [currentSocketId, setCurrentSocketId] = useState('');
  const hasShownConnectionError = useRef(false);
  const username = enteredUsername || 'Anonymous';
  
  useEffect(() => {
    function handleErrors() {
      setSocketConnected(false);

      if (!hasShownConnectionError.current) {
        toast.error('Realtime server is unavailable. Start the backend on port 5000 and we will reconnect automatically.');
        hasShownConnectionError.current = true;
      }
    }

    const initSocket = async () => {
      try {
        socketRef.current = await connectSocket();

        socketRef.current.on('connect_error', handleErrors);
        socketRef.current.on('connect', () => {
          setSocketConnected(true);
          setCurrentSocketId(socketRef.current.id);
          hasShownConnectionError.current = false;

          socketRef.current.emit('join', {
            roomId,
            username,
            role: enteredRole,
            authToken: getAuthToken(),
            sessionMode: enteredSessionMode,
          });
        });
        socketRef.current.on('disconnect', () => {
          setSocketConnected(false);
          setCurrentSocketId('');
        });
        socketRef.current.on('room-state', (nextRoomState) => {
          setRoomState(nextRoomState);
        });
        socketRef.current.on('problem-update', ({ problem }) => {
          setRoomState((prev) => ({
            ...(prev || {}),
            problem,
          }));
        });
        socketRef.current.on('session-update', ({ session }) => {
          setRoomState((prev) => ({
            ...(prev || {}),
            session,
          }));
        });

        // Listen for user events at the top level
        socketRef.current.on('joined', ({ users, username, role }) => {
          setUsers(users);
          if (enteredUsername !== username) {
            toast.success(`${username} joined as ${role}`);
          }
        });
        
        socketRef.current.on('left', ({ socketId, username }) => {
          toast.success(`${username} left the room`);
          setUsers(prev => prev.filter(user => user.socketId !== socketId));
        });
      } catch {
        toast.error('Failed to connect to server');
      }
    };

    initSocket();
    
    return () => {
      if (socketRef.current) {
        socketRef.current.off('connect_error', handleErrors);
        socketRef.current.off('connect');
        socketRef.current.off('disconnect');
        socketRef.current.off('room-state');
        socketRef.current.off('problem-update');
        socketRef.current.off('session-update');
        socketRef.current.off('joined');
        socketRef.current.off('left');
        socketRef.current.disconnect();
      }
    };
  }, [roomId, enteredRole, enteredSessionMode, enteredUsername, username]);

  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.08),_transparent_24%),linear-gradient(180deg,#f8fafc_0%,#f1f5f9_100%)] dark:bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.08),_transparent_22%),linear-gradient(180deg,#020617_0%,#0f172a_52%,#020617_100%)] lg:h-screen lg:overflow-hidden lg:flex-row">
      <aside className="w-full border-b border-gray-200/80 bg-white/75 backdrop-blur-xl dark:border-gray-700/80 dark:bg-slate-950/55 lg:h-screen lg:w-80 lg:min-w-[320px] lg:max-w-[420px] lg:flex-none lg:border-b-0 lg:border-r lg:panel-resize">
        <Sidebar 
          socketRef={socketRef} 
          roomId={roomId} 
          socketConnected={socketConnected} 
          users={users}
          roomState={roomState}
          currentSocketId={currentSocketId}
          currentRole={enteredRole}
        />
      </aside>
      <main className="flex min-h-[60vh] min-w-0 flex-1 flex-col bg-transparent lg:min-h-0 lg:h-screen">
        {socketConnected ? (
          <Workspace
            socketRef={socketRef}
            roomId={roomId}
            roomState={roomState}
            currentSocketId={currentSocketId}
            currentRole={enteredRole}
            currentUsername={username}
            users={users}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center px-6 py-16">
            <div className="w-full max-w-lg rounded-[2rem] border border-white/70 bg-white/88 p-8 text-center shadow-[0_24px_80px_-40px_rgba(15,23,42,0.45)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/72">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 shadow-sm dark:bg-amber-500/10 dark:text-amber-300">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 9V6.75a3.75 3.75 0 117.5 0V9m-8.25 0h8.5A2.25 2.25 0 0118.25 11.25v6.5A2.25 2.25 0 0116 20H8a2.25 2.25 0 01-2.25-2.25v-6.5A2.25 2.25 0 018 9z" />
                </svg>
              </div>
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Connecting to your practice room</h1>
              <p className="mt-3 text-sm leading-7 text-gray-600 dark:text-gray-400">
                The interview workspace will appear as soon as the realtime server on port 5000 responds. Keep `npm run dev:server` running and this page will reconnect automatically.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default Editor;
