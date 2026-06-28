import { StatusBar } from 'expo-status-bar';
import * as DocumentPicker from 'expo-document-picker';
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import {
  AudioLines,
  BriefcaseBusiness,
  Bell,
  Check,
  ChevronLeft,
  Download,
  Eye,
  EyeOff,
  FileText,
  KeyRound,
  LogOut,
  Mail,
  MessageCircle,
  Mic,
  Paperclip,
  Pause,
  Pencil,
  Play,
  Phone,
  RefreshCw,
  Send,
  ShieldCheck,
  Square,
  UserCheck,
  UserPlus,
  Users,
  UserX,
  Video,
  X,
} from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import CallRoom from './src/CallRoom';
import { ApiError, changeUserPassword, createUser, downloadConversationAttachment, endCall, getCall, getCallSession, getConversationAttachmentAudioSource, getConversationMessages, getConversations, getCurrentCompany, getCurrentUser, getDepartments, getDirectoryUsers, getIncomingCall, getOrCreateDirectConversation, getUsers, login, markConversationRead, respondToCall, sendConversationMessage, startCall, updateUser, updateUserStatus, uploadConversationAttachment, uploadConversationAttachmentFromUri } from './src/api';
import { registerNativePushToken, unregisterNativePushToken } from './src/push-notifications';
import { connectRealtime } from './src/realtime';
import { sessionStorage } from './src/session-storage';
import type { Call, CallSession, CallType, ChatMessage, Company, ConversationSummary, Department, DirectoryUser, LoginInput, User, UserEditForm, UserForm } from './src/types';

const SESSION_KEY = 'bizchat_admin_token';
const DEVELOPMENT_COMPANY_SLUG = 'icon';

function companyInitials(name?: string) {
  if (!name) return 'BC';
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatAudioTime(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds || 0));
  return `${Math.floor(safeSeconds / 60)}:${String(safeSeconds % 60).padStart(2, '0')}`;
}

const emptyForm: UserForm = {
  firstName: '',
  lastName: '',
  employeeCode: '',
  jobTitle: '',
  mobileNumber: '',
  countryCode: '',
  timezone: '',
  email: '',
  password: '',
  role: 'user',
  departmentIds: [],
};

type FieldName = keyof Pick<
  UserForm,
  'firstName' | 'lastName' | 'employeeCode' | 'jobTitle' | 'mobileNumber' | 'countryCode' | 'timezone' | 'email' | 'password'
>;

export default function App() {
  const [token, setToken] = useState<string | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    async function restoreSession() {
      const savedToken = await sessionStorage.getItem(SESSION_KEY);
      if (savedToken) {
        try {
          await getCurrentUser(savedToken);
          setToken(savedToken);
        } catch {
          await sessionStorage.removeItem(SESSION_KEY);
        }
      }
      setCheckingSession(false);
    }
    restoreSession();
  }, []);

  async function handleAuthenticated(accessToken: string) {
    await sessionStorage.setItem(SESSION_KEY, accessToken);
    setToken(accessToken);
  }

  async function handleLogout() {
    if (token) await unregisterNativePushToken(token).catch(() => {});
    await sessionStorage.removeItem(SESSION_KEY);
    setToken(null);
  }

  useEffect(() => {
    if (!token) return;
    registerNativePushToken(token).catch(() => {});
  }, [token]);

  if (checkingSession) return <LoadingScreen />;

  return (
    <SafeAreaProvider style={styles.safeArea}>
      <StatusBar style={token ? 'light' : 'dark'} />
      {token ? (
        <AdminApp token={token} onLogout={handleLogout} />
      ) : (
        <LoginScreen onAuthenticated={handleAuthenticated} />
      )}
    </SafeAreaProvider>
  );
}

function AdminApp({ token, onLogout }: { token: string; onLogout: () => Promise<void> }) {
  const [screen, setScreen] = useState<'users' | 'people' | 'create' | 'edit' | 'password'>('users');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [checkingRole, setCheckingRole] = useState(true);

  useEffect(() => {
    getCurrentUser(token)
      .then(setCurrentUser)
      .catch(async (error) => {
        if (error instanceof ApiError && error.status === 401) await onLogout();
      })
      .finally(() => setCheckingRole(false));
  }, [token, onLogout]);

  if (checkingRole || !currentUser) return <LoadingScreen />;

  if (currentUser.role === 'user') {
    return <PeopleDirectoryScreen token={token} onLogout={onLogout} />;
  }

  if (screen === 'create') {
    return <CreateUserScreen token={token} onCreated={() => setScreen('users')} onBack={() => setScreen('users')} onLogout={onLogout} />;
  }
  if (screen === 'people') {
    return <PeopleDirectoryScreen token={token} onBack={() => setScreen('users')} onLogout={onLogout} />;
  }
  if (screen === 'edit' && selectedUser) {
    return <EditUserScreen token={token} user={selectedUser} onSaved={(user) => { setSelectedUser(user); setScreen('users'); }} onPassword={() => setScreen('password')} onBack={() => setScreen('users')} onLogout={onLogout} />;
  }
  if (screen === 'password' && selectedUser) {
    return <ChangePasswordScreen token={token} user={selectedUser} onBack={() => setScreen('edit')} onDone={() => setScreen('edit')} onLogout={onLogout} />;
  }
  return (
    <UserListScreen
      token={token}
      onCreate={() => setScreen('create')}
      onPeople={() => setScreen('people')}
      onEdit={(user) => { setSelectedUser(user); setScreen('edit'); }}
      onLogout={onLogout}
    />
  );
}

function LoadingScreen() {
  return (
    <SafeAreaView style={[styles.safeArea, styles.centered]}>
      <View style={styles.brandMark}>
        <Text style={styles.brandMarkText}>BC</Text>
      </View>
      <ActivityIndicator color="#13795b" style={styles.loadingSpinner} />
    </SafeAreaView>
  );
}

function LoginScreen({ onAuthenticated }: { onAuthenticated: (token: string) => Promise<void> }) {
  const [values, setValues] = useState<LoginInput>({
    companySlug: DEVELOPMENT_COMPANY_SLUG,
    mobileNumber: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin() {
    if (!values.mobileNumber.trim() || values.password.length < 8) {
      setError('Enter your mobile number and password.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const session = await login(values);
      await onAuthenticated(session.token);
    } catch (loginError) {
      setError(loginError instanceof ApiError ? loginError.message : 'Unable to connect to BizChat.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.loginPage} keyboardShouldPersistTaps="handled">
        <View style={styles.loginInner}>
          <View style={styles.loginBrandRow}>
            <View style={styles.brandMark}>
              <Text style={styles.brandMarkText}>BC</Text>
            </View>
            <View style={styles.flex}>
              <Text style={styles.companyName}>BizChat</Text>
              <Text style={styles.productLabel}>BizChat Administration</Text>
            </View>
          </View>

          <View style={styles.loginHeading}>
            <Text style={styles.screenTitle}>Admin sign in</Text>
            <Text style={styles.screenSubtitle}>Use your administrator account to manage employees.</Text>
          </View>

          <Field
            label="Mobile number"
            value={values.mobileNumber}
            onChangeText={(mobileNumber) => setValues({ ...values, mobileNumber })}
            keyboardType="phone-pad"
            autoCapitalize="none"
            icon={<Phone size={18} color="#69737d" />}
          />
          <Field
            label="Password"
            value={values.password}
            onChangeText={(password) => setValues({ ...values, password })}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            rightAction={
              <IconButton
                label={showPassword ? 'Hide password' : 'Show password'}
                onPress={() => setShowPassword(!showPassword)}
                icon={showPassword ? <EyeOff size={19} color="#4d5964" /> : <Eye size={19} color="#4d5964" />}
              />
            }
          />

          {error ? <FeedbackMessage type="error" message={error} /> : null}

          <PrimaryButton label="Sign in" loading={submitting} onPress={handleLogin} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function PeopleDirectoryScreen({ token, onBack, onLogout }: { token: string; onBack?: () => void; onLogout: () => Promise<void> }) {
  const [selectedPerson, setSelectedPerson] = useState<DirectoryUser | null>(null);
  const [showInbox, setShowInbox] = useState(false);
  const [company, setCompany] = useState<Company | null>(null);
  const [people, setPeople] = useState<DirectoryUser[]>([]);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [incomingCall, setIncomingCall] = useState<Call | null>(null);
  const [callSession, setCallSession] = useState<CallSession | null>(null);
  const [callBusy, setCallBusy] = useState(false);
  const notificationSnapshot = useRef<Map<string, string | null>>(new Map());
  const notifiedMessageIds = useRef<Set<string>>(new Set());
  const notificationInitialized = useRef(false);

  const unreadTotal = conversations.reduce((total, item) => total + Number(item.unread_count || 0), 0);
  const sortedPeople = useMemo(() => {
    const recentChatRank = new Map(
      conversations
        .filter((conversation) => conversation.last_message_at)
        .map((conversation, index) => [conversation.participant_id, index]),
    );

    return people
      .map((person, originalIndex) => ({ person, originalIndex }))
      .sort((left, right) => {
        const leftRank = recentChatRank.get(left.person.id);
        const rightRank = recentChatRank.get(right.person.id);
        if (leftRank !== undefined && rightRank !== undefined) return leftRank - rightRank;
        if (leftRank !== undefined) return -1;
        if (rightRank !== undefined) return 1;
        return left.originalIndex - right.originalIndex;
      })
      .map(({ person }) => person);
  }, [people, conversations]);

  async function loadNotifications() {
    try {
      const items = await getConversations(token);
      if (notificationInitialized.current && Platform.OS === 'web' && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        items.forEach((item) => {
          const lastMessageId = item.last_message_id;
          const previousMessageId = notificationSnapshot.current.get(item.id);
          const isNewUnreadMessage = item.unread_count > 0
            && lastMessageId
            && previousMessageId !== item.last_message_id
            && !notifiedMessageIds.current.has(lastMessageId)
            && selectedPerson?.id !== item.participant_id;
          if (isNewUnreadMessage) {
            const senderName = [item.participant_first_name, item.participant_last_name].filter(Boolean).join(' ');
            const body = item.last_message_type === 'text'
              ? item.last_message_content || 'New message'
              : item.last_message_type === 'audio' ? 'Sent a voice message' : 'Sent an attachment';
            new Notification(senderName, { body, tag: `bizchat-${item.id}` });
            notifiedMessageIds.current.add(lastMessageId);
          }
        });
      }
      items.forEach((item) => notificationSnapshot.current.set(item.id, item.last_message_id));
      notificationInitialized.current = true;
      setConversations(items);
    } catch (notificationError) {
      if (notificationError instanceof ApiError && notificationError.status === 401) await onLogout();
    }
  }

  async function loadPeople(showRefresh = false) {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const [companyResult, peopleResult] = await Promise.all([
        getCurrentCompany(token),
        getDirectoryUsers(token),
      ]);
      setCompany(companyResult);
      setPeople(peopleResult);
    } catch (loadError) {
      if (loadError instanceof ApiError && loadError.status === 401) await onLogout();
      else setError(loadError instanceof ApiError ? loadError.message : 'People could not be loaded.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadPeople();
  }, [token]);

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 5000);
    return () => clearInterval(interval);
  }, [token, selectedPerson?.id]);

  async function refreshIncomingCall() {
    try {
      const call = await getIncomingCall(token);
      if (!callSession) setIncomingCall(call);
    } catch (callError) {
      if (callError instanceof ApiError && callError.status === 401) await onLogout();
    }
  }

  useEffect(() => {
    refreshIncomingCall();
    const interval = setInterval(refreshIncomingCall, 3000);
    const socket = connectRealtime(token);
    socket.on('call:incoming', () => refreshIncomingCall());
    socket.on('call:updated', (call) => {
      if (incomingCall?.id === call.id && call.status !== 'ringing') setIncomingCall(null);
      if (callSession?.call.id === call.id && !['ringing', 'ongoing'].includes(call.status)) setCallSession(null);
    });
    return () => { clearInterval(interval); socket.disconnect(); };
  }, [token, incomingCall?.id, callSession?.call.id]);

  useEffect(() => {
    if (!callSession) return undefined;
    const interval = setInterval(async () => {
      try {
        const call = await getCall(token, callSession.call.id);
        if (!['ringing', 'ongoing'].includes(call.status)) setCallSession(null);
      } catch { /* LiveKit handles transient media reconnects independently. */ }
    }, 2500);
    return () => clearInterval(interval);
  }, [callSession?.call.id, token]);

  async function beginCall(callType: CallType, conversationId: string, person: DirectoryUser) {
    setCallBusy(true);
    setError('');
    let createdCallId: string | null = null;
    try {
      const call = await startCall(token, conversationId, person.id, callType);
      createdCallId = call.id;
      const displayName = [person.first_name, person.last_name].filter(Boolean).join(' ');
      setCallSession(await getCallSession(token, call.id, displayName));
      setSelectedPerson(null);
    } catch (callError) {
      if (createdCallId) await endCall(token, createdCallId, 'failed').catch(() => {});
      setError(callError instanceof ApiError ? callError.message : 'The call could not be started.');
    } finally {
      setCallBusy(false);
    }
  }

  async function answerIncomingCall() {
    if (!incomingCall) return;
    setCallBusy(true);
    const callId = incomingCall.id;
    try {
      const call = await respondToCall(token, callId, 'accept');
      const displayName = [incomingCall.caller_first_name, incomingCall.caller_last_name].filter(Boolean).join(' ');
      setCallSession(await getCallSession(token, call.id, displayName));
      setIncomingCall(null);
      setSelectedPerson(null);
    } catch (callError) {
      await endCall(token, callId, 'failed').catch(() => {});
      setIncomingCall(null);
      setError(callError instanceof ApiError ? callError.message : 'The call could not be answered.');
    } finally {
      setCallBusy(false);
    }
  }

  async function declineIncomingCall() {
    if (!incomingCall) return;
    setCallBusy(true);
    try { await respondToCall(token, incomingCall.id, 'decline'); } finally {
      setIncomingCall(null);
      setCallBusy(false);
    }
  }

  async function leaveCall() {
    if (!callSession) return;
    const callId = callSession.call.id;
    setCallSession(null);
    await endCall(token, callId, 'completed').catch(() => {});
  }

  if (callSession) return <CallRoom session={callSession} onEnd={leaveCall} />;

  if (incomingCall) {
    return <IncomingCallScreen call={incomingCall} busy={callBusy} onAnswer={answerIncomingCall} onDecline={declineIncomingCall} />;
  }

  if (selectedPerson) {
    return <DirectChatScreen token={token} person={selectedPerson} callBusy={callBusy} onStartCall={(callType, conversationId) => beginCall(callType, conversationId, selectedPerson)} onBack={() => { setSelectedPerson(null); loadNotifications(); }} onLogout={onLogout} />;
  }

  if (showInbox) {
    return <ConversationInboxScreen conversations={conversations} onSelect={(person) => { setShowInbox(false); setSelectedPerson(person); }} onBack={() => setShowInbox(false)} onEnableNotifications={async () => {
      if (Platform.OS !== 'web' || typeof Notification === 'undefined') return;
      await Notification.requestPermission();
    }} onTestNotification={async () => {
      if (Platform.OS !== 'web' || typeof Notification === 'undefined') return false;
      if (Notification.permission === 'default') await Notification.requestPermission();
      if (Notification.permission !== 'granted') return false;
      new Notification('BizChat test alert', {
        body: 'Chrome notifications are working for this browser.',
        tag: `bizchat-test-${Date.now()}`,
      });
      return true;
    }} onLogout={onLogout} />;
  }

  return (
    <View style={styles.flex}>
      <ScreenHeader>
        <View style={styles.headerIdentity}>
          <View style={styles.smallBrandMark}>
            <Text style={styles.smallBrandMarkText}>{companyInitials(company?.name)}</Text>
          </View>
          <View>
            <Text style={styles.headerCompany}>{company?.name ?? 'BizChat'}</Text>
            <Text style={styles.headerSection}>People directory</Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          <View style={styles.notificationButtonWrap}>
            <IconButton label="Open notifications" onPress={() => setShowInbox(true)} icon={<Bell size={20} color="#ffffff" />} dark />
            {unreadTotal > 0 ? <View style={styles.notificationBadge}><Text style={styles.notificationBadgeText}>{unreadTotal > 99 ? '99+' : unreadTotal}</Text></View> : null}
          </View>
          {onBack ? <IconButton label="Back to user administration" onPress={onBack} icon={<ChevronLeft size={21} color="#ffffff" />} dark /> : null}
          <IconButton label="Sign out" onPress={onLogout} icon={<LogOut size={20} color="#ffffff" />} dark />
        </View>
      </ScreenHeader>
      <ScrollView contentContainerStyle={styles.listPage}>
        <View style={styles.listInner}>
          <View style={styles.listTitleRow}>
            <View style={styles.flex}>
              <Text style={styles.screenTitle}>People</Text>
              <Text style={styles.screenSubtitle}>{people.length} active colleague{people.length === 1 ? '' : 's'}</Text>
            </View>
          </View>

          {error ? <FeedbackMessage type="error" message={error} /> : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Refresh people"
            disabled={refreshing}
            onPress={() => loadPeople(true)}
            style={({ pressed }) => [styles.refreshButton, pressed && styles.pressed]}
          >
            {refreshing ? <ActivityIndicator size="small" color="#13795b" /> : <RefreshCw size={16} color="#13795b" />}
            <Text style={styles.refreshText}>Refresh</Text>
          </Pressable>

          {loading ? (
            <ActivityIndicator color="#13795b" style={styles.listLoader} />
          ) : people.length === 0 ? (
            <View style={styles.emptyState}>
              <Users size={30} color="#7b8791" />
              <Text style={styles.emptyTitle}>No colleagues available</Text>
              <Text style={styles.emptyText}>Active colleagues will appear here.</Text>
            </View>
          ) : (
            <View style={styles.userList}>
              {sortedPeople.map((person) => {
                const fullName = [person.first_name, person.last_name].filter(Boolean).join(' ');
                return (
                  <View key={person.id} style={styles.userCard}>
                    <View style={styles.userCardTop}>
                      <View style={styles.userAvatar}>
                        <Text style={styles.userAvatarText}>{companyInitials(fullName)}</Text>
                      </View>
                      <View style={styles.userIdentity}>
                        <Text style={styles.userName}>{fullName}</Text>
                        <Text style={styles.userMeta}>{person.job_title || person.department_names?.join(', ') || 'Colleague'}</Text>
                      </View>
                    </View>

                    {person.job_title && person.department_names?.length ? (
                      <View style={styles.userDetails}>
                        <Text style={styles.userDetailText}>{person.department_names.join(', ')}</Text>
                      </View>
                    ) : null}

                    <Pressable accessibilityRole="button" accessibilityLabel={`Chat with ${fullName}`} onPress={() => setSelectedPerson(person)} style={({ pressed }) => [styles.statusAction, styles.chatAction, pressed && styles.pressed]}>
                      <MessageCircle size={16} color="#13795b" />
                      <Text style={styles.chatActionText}>Message</Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function IncomingCallScreen({ call, busy, onAnswer, onDecline }: { call: Call; busy: boolean; onAnswer: () => void; onDecline: () => void }) {
  const callerName = [call.caller_first_name, call.caller_last_name].filter(Boolean).join(' ') || 'Colleague';
  return (
    <View style={styles.incomingCallPage}>
      <View style={styles.incomingCallAvatar}><Text style={styles.incomingCallAvatarText}>{companyInitials(callerName)}</Text></View>
      <Text style={styles.incomingCallName}>{callerName}</Text>
      <Text style={styles.incomingCallType}>Incoming {call.call_type} call</Text>
      <View style={styles.incomingCallActions}>
        <Pressable accessibilityLabel="Decline call" disabled={busy} onPress={onDecline} style={[styles.incomingCallButton, styles.declineCallButton]}>
          <Phone size={26} color="#ffffff" style={{ transform: [{ rotate: '135deg' }] }} />
        </Pressable>
        <Pressable accessibilityLabel="Answer call" disabled={busy} onPress={onAnswer} style={[styles.incomingCallButton, styles.answerCallButton]}>
          {busy ? <ActivityIndicator color="#ffffff" /> : call.call_type === 'video' ? <Video size={27} color="#ffffff" /> : <Phone size={27} color="#ffffff" />}
        </Pressable>
      </View>
    </View>
  );
}

function ConversationInboxScreen({ conversations, onSelect, onBack, onEnableNotifications, onTestNotification, onLogout }: { conversations: ConversationSummary[]; onSelect: (person: DirectoryUser) => void; onBack: () => void; onEnableNotifications: () => Promise<void>; onTestNotification: () => Promise<boolean>; onLogout: () => Promise<void> }) {
  const [permission, setPermission] = useState(
    Platform.OS === 'web' && typeof Notification !== 'undefined' ? Notification.permission : 'unsupported',
  );
  const [testMessage, setTestMessage] = useState('');

  async function enableNotifications() {
    await onEnableNotifications();
    if (Platform.OS === 'web' && typeof Notification !== 'undefined') setPermission(Notification.permission);
  }

  async function testNotification() {
    const shown = await onTestNotification();
    if (Platform.OS === 'web' && typeof Notification !== 'undefined') setPermission(Notification.permission);
    setTestMessage(shown ? 'Test alert sent. If you do not see it, check macOS Chrome notification settings and Focus mode.' : 'Chrome notification permission is not granted for this site.');
  }

  return (
    <View style={styles.flex}>
      <ScreenHeader>
        <View style={styles.headerIdentity}>
          <IconButton label="Back to people" onPress={onBack} icon={<ChevronLeft size={21} color="#ffffff" />} dark />
          <View><Text style={styles.headerCompany}>Notifications</Text><Text style={styles.headerSection}>Direct messages</Text></View>
        </View>
        <IconButton label="Sign out" onPress={onLogout} icon={<LogOut size={20} color="#ffffff" />} dark />
      </ScreenHeader>
      <ScrollView contentContainerStyle={styles.listPage}>
        <View style={styles.listInner}>
          <View style={styles.listTitleRow}>
            <View style={styles.flex}><Text style={styles.screenTitle}>Messages</Text><Text style={styles.screenSubtitle}>Unread messages and recent conversations.</Text></View>
            <View style={styles.titleActions}>
              {permission === 'default' ? <Pressable accessibilityRole="button" onPress={enableNotifications} style={({ pressed }) => [styles.compactSecondaryButton, pressed && styles.pressed]}><Bell size={16} color="#13795b" /><Text style={styles.compactSecondaryText}>Enable alerts</Text></Pressable> : null}
              {permission === 'granted' ? <Pressable accessibilityRole="button" onPress={testNotification} style={({ pressed }) => [styles.compactSecondaryButton, pressed && styles.pressed]}><Bell size={16} color="#13795b" /><Text style={styles.compactSecondaryText}>Test alert</Text></Pressable> : null}
            </View>
          </View>
          {testMessage ? <FeedbackMessage type={permission === 'granted' ? 'success' : 'error'} message={testMessage} /> : null}
          {permission === 'denied' ? <FeedbackMessage type="error" message="Browser notifications are blocked. Enable them in your browser site settings." /> : null}
          {conversations.length === 0 ? (
            <View style={styles.emptyState}><Bell size={30} color="#7b8791" /><Text style={styles.emptyTitle}>No conversations yet</Text><Text style={styles.emptyText}>Your recent chats and unread messages will appear here.</Text></View>
          ) : (
            <View style={styles.userList}>
              {conversations.map((item) => {
                const fullName = [item.participant_first_name, item.participant_last_name].filter(Boolean).join(' ');
                const preview = item.last_message_type === 'text'
                  ? item.last_message_content || 'New message'
                  : item.last_message_type === 'audio' ? 'Voice message' : item.last_message_type ? 'Attachment' : 'Conversation started';
                const person: DirectoryUser = { id: item.participant_id, first_name: item.participant_first_name, last_name: item.participant_last_name, job_title: item.participant_job_title, profile_photo_url: item.participant_profile_photo_url, department_names: [] };
                return (
                  <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`Open conversation with ${fullName}`} onPress={() => onSelect(person)} style={({ pressed }) => [styles.inboxCard, item.unread_count > 0 && styles.inboxCardUnread, pressed && styles.pressed]}>
                    <View style={styles.userAvatar}><Text style={styles.userAvatarText}>{companyInitials(fullName)}</Text></View>
                    <View style={styles.userIdentity}><Text style={styles.userName}>{fullName}</Text><Text numberOfLines={1} style={styles.inboxPreview}>{preview}</Text></View>
                    <View style={styles.inboxMeta}>
                      {item.last_message_at ? <Text style={styles.inboxTime}>{new Date(item.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text> : null}
                      {item.unread_count > 0 ? <View style={styles.inboxUnreadBadge}><Text style={styles.inboxUnreadText}>{item.unread_count}</Text></View> : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function VoiceMessagePlayer({ token, conversationId, attachment, mine }: { token: string; conversationId: string; attachment: NonNullable<ChatMessage['attachments']>[number]; mine: boolean }) {
  const source = useMemo(
    () => getConversationAttachmentAudioSource(token, conversationId, attachment.id),
    [token, conversationId, attachment.id],
  );
  const player = useAudioPlayer(source, { updateInterval: 250 });
  const status = useAudioPlayerStatus(player);

  async function togglePlayback() {
    if (status.playing) {
      player.pause();
      return;
    }
    if (status.duration > 0 && status.currentTime >= status.duration - 0.2) await player.seekTo(0);
    player.play();
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={status.playing ? 'Pause voice message' : 'Play voice message'}
      onPress={togglePlayback}
      style={[styles.voiceMessageCard, mine && styles.voiceMessageCardMine]}
    >
      <View style={[styles.voicePlayButton, mine && styles.voicePlayButtonMine]}>
        {status.isBuffering ? <ActivityIndicator size="small" color={mine ? '#ffffff' : '#13795b'} /> : status.playing ? <Pause size={17} color={mine ? '#ffffff' : '#13795b'} fill={mine ? '#ffffff' : '#13795b'} /> : <Play size={17} color={mine ? '#ffffff' : '#13795b'} fill={mine ? '#ffffff' : '#13795b'} />}
      </View>
      <View style={styles.voiceMessageIdentity}>
        <View style={styles.voiceWaveform}>
          {[8, 15, 11, 20, 13, 24, 10, 18, 12, 21, 9, 16].map((height, index) => (
            <View key={index} style={[styles.voiceWaveBar, { height }, mine && styles.voiceWaveBarMine]} />
          ))}
        </View>
        <Text style={[styles.voiceDuration, mine && styles.voiceDurationMine]}>
          {formatAudioTime(status.currentTime)} / {formatAudioTime(status.duration)}
        </Text>
      </View>
      <AudioLines size={18} color={mine ? '#cce8dd' : '#52616c'} />
    </Pressable>
  );
}

function DirectChatScreen({ token, person, callBusy, onStartCall, onBack, onLogout }: { token: string; person: DirectoryUser; callBusy: boolean; onStartCall: (callType: CallType, conversationId: string) => void; onBack: () => void; onLogout: () => Promise<void> }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendingVoice, setSendingVoice] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const messageListRef = useRef<ScrollView>(null);
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(audioRecorder, 250);
  const fullName = [person.first_name, person.last_name].filter(Boolean).join(' ');

  async function handleApiError(apiError: unknown, fallback: string) {
    if (apiError instanceof ApiError && apiError.status === 401) await onLogout();
    else setError(apiError instanceof ApiError ? apiError.message : fallback);
  }

  async function loadMessages(id: string, showRefresh = false) {
    if (showRefresh) setRefreshing(true);
    try {
      const result = await getConversationMessages(token, id);
      setMessages(result);
      await markConversationRead(token, id);
    } catch (loadError) {
      await handleApiError(loadError, 'Messages could not be loaded.');
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    Promise.all([getCurrentUser(token), getOrCreateDirectConversation(token, person.id)])
      .then(async ([user, conversation]) => {
        if (!active) return;
        setCurrentUser(user);
        setConversationId(conversation.id);
        const result = await getConversationMessages(token, conversation.id);
        if (active) setMessages(result);
      })
      .catch((loadError) => handleApiError(loadError, 'The conversation could not be opened.'))
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token, person.id]);

  useEffect(() => {
    if (!conversationId) return undefined;
    const interval = setInterval(() => loadMessages(conversationId), 5000);
    return () => clearInterval(interval);
  }, [conversationId, token]);

  useEffect(() => {
    if (Platform.OS !== 'web' || !conversationId || typeof document === 'undefined') return undefined;
    const handlePaste = (event: ClipboardEvent) => {
      const file = event.clipboardData?.files?.[0];
      if (!file) return;
      event.preventDefault();
      handleUpload(file, file.name || `pasted-${Date.now()}.png`);
    };
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [conversationId, token]);

  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;
    const showSubscription = Keyboard.addListener('keyboardDidShow', (event) => {
      setKeyboardHeight(event.endCoordinates.height);
      setTimeout(() => messageListRef.current?.scrollToEnd({ animated: true }), 50);
    });
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => setKeyboardHeight(0));
    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  async function handleSend() {
    const content = draft.trim();
    if (!content || !conversationId || sending) return;
    setSending(true);
    setError('');
    try {
      const message = await sendConversationMessage(token, conversationId, content);
      setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message]);
      setDraft('');
    } catch (sendError) {
      await handleApiError(sendError, 'The message could not be sent.');
    } finally {
      setSending(false);
    }
  }

  async function handleUpload(file: Blob, fileName: string) {
    if (!conversationId || uploading) return;
    if (file.size > 10 * 1024 * 1024) return setError('Files must be 10 MB or smaller.');
    setUploading(true);
    setError('');
    try {
      const message = await uploadConversationAttachment(token, conversationId, file, fileName);
      setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message]);
    } catch (uploadError) {
      await handleApiError(uploadError, 'The attachment could not be uploaded.');
    } finally {
      setUploading(false);
    }
  }

  async function startVoiceRecording() {
    if (!conversationId || sendingVoice || uploading) return;
    setError('');
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setError('Microphone permission is required to send a voice message.');
        return;
      }
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
    } catch {
      setError('Voice recording could not be started.');
    }
  }

  async function finishVoiceRecording(sendRecording: boolean) {
    if (!recorderState.isRecording || sendingVoice) return;
    const durationMillis = recorderState.durationMillis;
    setSendingVoice(true);
    setError('');
    try {
      await audioRecorder.stop();
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
      if (!sendRecording) return;
      if (durationMillis < 500) {
        setError('Hold the recording a little longer before sending.');
        return;
      }
      if (!audioRecorder.uri) throw new Error('Recording file is unavailable');
      const extensionMatch = audioRecorder.uri.match(/\.(m4a|aac|mp3|ogg|wav|webm|3gp)(?:\?|$)/i);
      const extension = extensionMatch?.[1]?.toLowerCase() || (Platform.OS === 'web' ? 'webm' : 'm4a');
      const fileName = `voice-message-${Date.now()}.${extension}`;
      if (Platform.OS === 'web') {
        const response = await fetch(audioRecorder.uri);
        await handleUpload(await response.blob(), fileName);
      } else {
        const mimeType = extension === '3gp' ? 'audio/3gpp' : extension === 'mp3' ? 'audio/mpeg' : extension === 'ogg' ? 'audio/ogg' : extension === 'wav' ? 'audio/wav' : 'audio/mp4';
        const message = await uploadConversationAttachmentFromUri(token, conversationId!, audioRecorder.uri, fileName, mimeType);
        setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message]);
      }
    } catch (voiceError) {
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false }).catch(() => {});
      await handleApiError(voiceError, 'The voice message could not be sent.');
    } finally {
      setSendingVoice(false);
    }
  }

  function handlePickAttachment() {
    if (Platform.OS !== 'web') {
      DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf', 'text/plain', 'text/csv', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
        copyToCacheDirectory: true,
      }).then(async (result) => {
        if (result.canceled) return;
        const asset = result.assets[0];
        if (!asset?.uri) return;
        const response = await fetch(asset.uri);
        const blob = await response.blob();
        await handleUpload(blob, asset.name || `attachment-${Date.now()}`);
      }).catch(() => setError('The selected file could not be attached.'));
      return;
    }
    if (typeof document === 'undefined') return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,.pdf,.txt,.csv,.doc,.docx,.xls,.xlsx';
    input.onchange = () => {
      const file = input.files?.[0];
      if (file) handleUpload(file, file.name);
    };
    input.click();
  }

  async function handleDownload(attachmentId: string, fileName: string) {
    if (!conversationId || Platform.OS !== 'web' || typeof document === 'undefined') return;
    setError('');
    try {
      const blob = await downloadConversationAttachment(token, conversationId, attachmentId);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);
    } catch (downloadError) {
      await handleApiError(downloadError, 'The attachment could not be downloaded.');
    }
  }

  return (
    <View style={styles.flex}>
      <ScreenHeader>
        <View style={styles.headerIdentity}>
          <IconButton label="Back to people" onPress={onBack} icon={<ChevronLeft size={21} color="#ffffff" />} dark />
          <View style={styles.chatHeaderAvatar}><Text style={styles.userAvatarText}>{companyInitials(fullName)}</Text></View>
          <View style={styles.flex}><Text style={styles.headerCompany}>{fullName}</Text><Text style={styles.headerSection}>{person.job_title || person.department_names?.join(', ') || 'Colleague'}</Text></View>
        </View>
        <View style={styles.headerActions}>
          <IconButton label={`Audio call ${fullName}`} disabled={callBusy || !conversationId} onPress={() => { if (conversationId) onStartCall('audio', conversationId); }} icon={<Phone size={19} color="#ffffff" />} dark />
          <IconButton label={`Video call ${fullName}`} disabled={callBusy || !conversationId} onPress={() => { if (conversationId) onStartCall('video', conversationId); }} icon={<Video size={20} color="#ffffff" />} dark />
          <IconButton label="Sign out" onPress={onLogout} icon={<LogOut size={20} color="#ffffff" />} dark />
        </View>
      </ScreenHeader>

      {error ? <View style={styles.chatFeedback}><FeedbackMessage type="error" message={error} /></View> : null}
      {loading ? <View style={[styles.flex, styles.centered]}><ActivityIndicator color="#13795b" /></View> : (
        <View style={styles.chatContent}>
          <ScrollView
            ref={messageListRef}
            style={styles.messageScroller}
            contentContainerStyle={[
              styles.messageList,
              messages.length === 0 && styles.emptyMessageList,
              Platform.OS === 'android' && { paddingBottom: keyboardHeight ? keyboardHeight + 118 : 118 },
            ]}
            onContentSizeChange={() => messageListRef.current?.scrollToEnd({ animated: true })}
          >
            {messages.length === 0 ? (
              <View style={styles.emptyChat}>
                <MessageCircle size={34} color="#7b8791" />
                <Text style={styles.emptyTitle}>Start your conversation</Text>
                <Text style={styles.emptyText}>Send the first message to {person.first_name}.</Text>
              </View>
            ) : messages.map((message) => {
              const mine = message.sender_id === currentUser?.id;
              return (
                <View key={message.id} style={[styles.messageRow, mine ? styles.messageRowMine : styles.messageRowTheirs]}>
                  <View style={[styles.messageBubble, mine ? styles.messageBubbleMine : styles.messageBubbleTheirs]}>
                    {message.content ? <Text style={[styles.messageText, mine && styles.messageTextMine]}>{message.content}</Text> : null}
                    {message.attachments?.map((attachment) => attachment.mime_type?.startsWith('audio/') ? (
                      <VoiceMessagePlayer key={attachment.id} token={token} conversationId={conversationId!} attachment={attachment} mine={mine} />
                    ) : (
                      <Pressable key={attachment.id} accessibilityRole="button" accessibilityLabel={`Download ${attachment.file_name}`} onPress={() => handleDownload(attachment.id, attachment.file_name)} style={[styles.attachmentCard, mine && styles.attachmentCardMine]}>
                        {attachment.mime_type?.startsWith('image/') ? <Paperclip size={17} color={mine ? '#ffffff' : '#13795b'} /> : <FileText size={17} color={mine ? '#ffffff' : '#13795b'} />}
                        <View style={styles.attachmentIdentity}><Text numberOfLines={1} style={[styles.attachmentName, mine && styles.attachmentNameMine]}>{attachment.file_name}</Text><Text style={[styles.attachmentSize, mine && styles.attachmentSizeMine]}>{formatFileSize(Number(attachment.file_size))}</Text></View>
                        <Download size={16} color={mine ? '#ffffff' : '#52616c'} />
                      </Pressable>
                    ))}
                    <Text style={[styles.messageTime, mine && styles.messageTimeMine]}>{new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>
          <Pressable accessibilityRole="button" accessibilityLabel="Refresh messages" disabled={refreshing || !conversationId} onPress={() => conversationId && loadMessages(conversationId, true)} style={({ pressed }) => [styles.chatRefresh, pressed && styles.pressed]}>
            {refreshing ? <ActivityIndicator size="small" color="#13795b" /> : <RefreshCw size={14} color="#13795b" />}
            <Text style={styles.refreshText}>Refresh</Text>
          </Pressable>
          <KeyboardAvoidingView
            style={[
              styles.chatComposerArea,
              Platform.OS === 'android' && { bottom: keyboardHeight ? keyboardHeight : 0, paddingBottom: keyboardHeight ? 8 : 34 },
            ]}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View style={styles.composer}>
              <Pressable accessibilityRole="button" accessibilityLabel={recorderState.isRecording ? 'Cancel voice recording' : 'Attach file'} disabled={uploading || sendingVoice || !conversationId} onPress={recorderState.isRecording ? () => finishVoiceRecording(false) : handlePickAttachment} style={({ pressed }) => [styles.attachButton, (uploading || sendingVoice) && styles.disabled, pressed && styles.pressed]}>
                {uploading ? <ActivityIndicator size="small" color="#13795b" /> : recorderState.isRecording ? <X size={20} color="#a32d25" /> : <Paperclip size={20} color="#13795b" />}
              </Pressable>
              {recorderState.isRecording ? (
                <View style={styles.recordingStatus}>
                  <View style={styles.recordingDot} />
                  <View style={styles.flex}><Text style={styles.recordingTitle}>Recording voice message</Text><Text style={styles.recordingHint}>Tap stop to send · {formatAudioTime(recorderState.durationMillis / 1000)}</Text></View>
                </View>
              ) : (
                <TextInput
                  accessibilityLabel="Message"
                  value={draft}
                  onChangeText={setDraft}
                  onFocus={() => {
                    if (Platform.OS === 'android' && !keyboardHeight) setKeyboardHeight(320);
                    setTimeout(() => messageListRef.current?.scrollToEnd({ animated: true }), 80);
                  }}
                  placeholder="Write a message"
                  placeholderTextColor="#89939d"
                  multiline
                  maxLength={4000}
                  style={styles.composerInput}
                />
              )}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={recorderState.isRecording ? 'Stop and send voice message' : draft.trim() ? 'Send message' : 'Record voice message'}
                disabled={sending || sendingVoice || uploading || !conversationId}
                onPress={recorderState.isRecording ? () => finishVoiceRecording(true) : draft.trim() ? handleSend : startVoiceRecording}
                style={({ pressed }) => [styles.sendButton, (sending || sendingVoice || uploading || !conversationId) && styles.disabled, recorderState.isRecording && styles.recordingStopButton, pressed && styles.primaryButtonPressed]}
              >
                {sending || sendingVoice ? <ActivityIndicator size="small" color="#ffffff" /> : recorderState.isRecording ? <Square size={17} color="#ffffff" fill="#ffffff" /> : draft.trim() ? <Send size={19} color="#ffffff" /> : <Mic size={20} color="#ffffff" />}
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </View>
      )}
    </View>
  );
}

function UserListScreen({
  token,
  onCreate,
  onPeople,
  onEdit,
  onLogout,
}: {
  token: string;
  onCreate: () => void;
  onPeople: () => void;
  onEdit: (user: User) => void;
  onLogout: () => Promise<void>;
}) {
  const [company, setCompany] = useState<Company | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  async function loadUsers(showRefresh = false) {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const [companyResult, currentUserResult, userResults] = await Promise.all([
        getCurrentCompany(token),
        getCurrentUser(token),
        getUsers(token),
      ]);
      setCompany(companyResult);
      setCurrentUser(currentUserResult);
      setUsers(userResults);
    } catch (loadError) {
      if (loadError instanceof ApiError && loadError.status === 401) await onLogout();
      else setError(loadError instanceof ApiError ? loadError.message : 'Users could not be loaded.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, [token]);

  async function handleStatusChange(user: User) {
    const nextStatus = user.status === 'active' ? 'suspended' : 'active';
    setUpdatingId(user.id);
    setError('');
    try {
      const updated = await updateUserStatus(token, user.id, nextStatus);
      setUsers((current) => current.map((item) => (
        item.id === user.id ? { ...item, status: updated.status } : item
      )));
    } catch (statusError) {
      if (statusError instanceof ApiError && statusError.status === 401) await onLogout();
      else setError(statusError instanceof ApiError ? statusError.message : 'The user status could not be updated.');
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <View style={styles.flex}>
      <ScreenHeader>
        <View style={styles.headerIdentity}>
          <View style={styles.smallBrandMark}>
            <Text style={styles.smallBrandMarkText}>{companyInitials(company?.name)}</Text>
          </View>
          <View>
            <Text style={styles.headerCompany}>{company?.name ?? 'BizChat'}</Text>
            <Text style={styles.headerSection}>User administration</Text>
          </View>
        </View>
        <IconButton label="Sign out" onPress={onLogout} icon={<LogOut size={20} color="#ffffff" />} dark />
      </ScreenHeader>
      <ScrollView contentContainerStyle={styles.listPage}>
        <View style={styles.listInner}>
          <View style={styles.listTitleRow}>
            <View style={styles.flex}>
              <Text style={styles.screenTitle}>Users</Text>
              <Text style={styles.screenSubtitle}>{users.length} account{users.length === 1 ? '' : 's'} in this company</Text>
            </View>
            <View style={styles.titleActions}>
              <Pressable accessibilityRole="button" onPress={onPeople} style={({ pressed }) => [styles.compactSecondaryButton, pressed && styles.pressed]}>
                <MessageCircle size={17} color="#13795b" />
                <Text style={styles.compactSecondaryText}>People</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={onCreate} style={({ pressed }) => [styles.compactPrimaryButton, pressed && styles.primaryButtonPressed]}>
                <UserPlus size={17} color="#ffffff" />
                <Text style={styles.compactPrimaryText}>Add user</Text>
              </Pressable>
            </View>
          </View>

          {error ? <FeedbackMessage type="error" message={error} /> : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Refresh users"
            disabled={refreshing}
            onPress={() => loadUsers(true)}
            style={({ pressed }) => [styles.refreshButton, pressed && styles.pressed]}
          >
            {refreshing ? <ActivityIndicator size="small" color="#13795b" /> : <RefreshCw size={16} color="#13795b" />}
            <Text style={styles.refreshText}>Refresh</Text>
          </Pressable>

          {loading ? (
            <ActivityIndicator color="#13795b" style={styles.listLoader} />
          ) : users.length === 0 ? (
            <View style={styles.emptyState}>
              <Users size={30} color="#7b8791" />
              <Text style={styles.emptyTitle}>No users yet</Text>
              <Text style={styles.emptyText}>Create the first employee account for this company.</Text>
            </View>
          ) : (
            <View style={styles.userList}>
              {users.map((user) => {
                const isCurrentUser = user.id === currentUser?.id;
                const isActive = user.status === 'active';
                const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ');
                return (
                  <View key={user.id} style={styles.userCard}>
                    <View style={styles.userCardTop}>
                      <View style={styles.userAvatar}>
                        <Text style={styles.userAvatarText}>{companyInitials(fullName)}</Text>
                      </View>
                      <View style={styles.userIdentity}>
                        <Text style={styles.userName}>{fullName}</Text>
                        <Text style={styles.userMeta}>{user.job_title || user.mobile_number}</Text>
                      </View>
                      <View style={[styles.statusBadge, isActive ? styles.statusBadgeActive : styles.statusBadgeInactive]}>
                        <Text style={[styles.statusText, isActive ? styles.statusTextActive : styles.statusTextInactive]}>{user.status}</Text>
                      </View>
                    </View>

                    <View style={styles.userDetails}>
                      {user.job_title ? <Text style={styles.userDetailText}>{user.mobile_number}</Text> : null}
                      <Text style={styles.userDetailText}>{user.department_names?.length ? user.department_names.join(', ') : 'No department'}</Text>
                      <Text style={styles.userDetailText}>{user.role === 'company_admin' ? 'Company admin' : user.role === 'super_admin' ? 'Super admin' : 'User'}</Text>
                    </View>

                    <View style={styles.cardActions}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`View or edit ${fullName}`}
                        onPress={() => onEdit(user)}
                        style={({ pressed }) => [styles.statusAction, styles.editAction, pressed && styles.pressed]}
                      >
                        <Pencil size={16} color="#315f75" />
                        <Text style={styles.editActionText}>View / Edit</Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        disabled={isCurrentUser || updatingId === user.id}
                        onPress={() => handleStatusChange(user)}
                        style={({ pressed }) => [
                          styles.statusAction,
                          isActive ? styles.statusActionSuspend : styles.statusActionActivate,
                          (isCurrentUser || updatingId === user.id) && styles.disabled,
                          pressed && styles.pressed,
                        ]}
                      >
                        {updatingId === user.id ? (
                          <ActivityIndicator size="small" color={isActive ? '#a32d25' : '#13795b'} />
                        ) : isActive ? (
                          <UserX size={16} color="#a32d25" />
                        ) : (
                          <UserCheck size={16} color="#13795b" />
                        )}
                        <Text style={[styles.statusActionText, isActive ? styles.statusActionTextSuspend : styles.statusActionTextActivate]}>
                          {isCurrentUser ? 'Current user' : isActive ? 'Suspend' : 'Activate'}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function EditUserScreen({
  token,
  user,
  onSaved,
  onPassword,
  onBack,
  onLogout,
}: {
  token: string;
  user: User;
  onSaved: (user: User) => void;
  onPassword: () => void;
  onBack: () => void;
  onLogout: () => Promise<void>;
}) {
  const [form, setForm] = useState<UserEditForm>({
    firstName: user.first_name,
    lastName: user.last_name ?? '',
    employeeCode: user.employee_code ?? '',
    jobTitle: user.job_title ?? '',
    mobileNumber: user.mobile_number,
    countryCode: user.country_code ?? '',
    timezone: user.timezone ?? '',
    email: user.email ?? '',
    role: user.role === 'user' ? 'user' : 'company_admin',
    departmentIds: user.department_ids ?? [],
  });
  const [company, setCompany] = useState<Company | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldName, string>>>({});

  useEffect(() => {
    Promise.all([getDepartments(token), getCurrentCompany(token)])
      .then(([items, currentCompany]) => {
        setDepartments(items.filter((department) => department.status === 'active'));
        setCompany(currentCompany);
      })
      .catch(async (loadError) => {
        if (loadError instanceof ApiError && loadError.status === 401) await onLogout();
        else setError(loadError instanceof ApiError ? loadError.message : 'User details could not be loaded.');
      })
      .finally(() => setLoading(false));
  }, [token, onLogout]);

  function updateField(field: FieldName, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    if (fieldErrors[field]) setFieldErrors((current) => ({ ...current, [field]: undefined }));
  }

  function toggleDepartment(id: string) {
    setForm((current) => ({
      ...current,
      departmentIds: current.departmentIds.includes(id)
        ? current.departmentIds.filter((departmentId) => departmentId !== id)
        : [...current.departmentIds, id],
    }));
  }

  function validateEditForm() {
    const nextErrors: Partial<Record<FieldName, string>> = {};
    if (!form.firstName.trim()) nextErrors.firstName = 'First name is required.';
    if (!/^\+[1-9]\d{6,14}$/.test(form.mobileNumber.trim().replace(/[\s().-]/g, ''))) {
      nextErrors.mobileNumber = 'Use international format, for example +966536547919.';
    }
    if (form.countryCode.trim() && !/^[A-Za-z]{2}$/.test(form.countryCode.trim())) nextErrors.countryCode = 'Use a two-letter code such as IN or SA.';
    if (form.timezone.trim() && !/^[A-Za-z_]+(?:\/[A-Za-z0-9_+\-]+)+$/.test(form.timezone.trim())) nextErrors.timezone = 'Use a timezone such as Asia/Kolkata.';
    if (form.email.trim() && !/^\S+@\S+\.\S+$/.test(form.email.trim())) nextErrors.email = 'Enter a valid email address.';
    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSave() {
    setError('');
    if (!validateEditForm()) return;
    setSubmitting(true);
    try {
      const updated = await updateUser(token, user.id, form, user.role);
      onSaved({ ...user, ...updated, department_ids: form.departmentIds, department_names: departments.filter((item) => form.departmentIds.includes(item.id)).map((item) => item.name) });
    } catch (saveError) {
      if (saveError instanceof ApiError && saveError.status === 401) await onLogout();
      else setError(saveError instanceof ApiError ? saveError.message : 'The user details could not be saved.');
    } finally {
      setSubmitting(false);
    }
  }

  const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ');

  return (
    <View style={styles.flex}>
      <ScreenHeader>
        <View style={styles.headerIdentity}>
          <View style={styles.smallBrandMark}><Text style={styles.smallBrandMarkText}>{companyInitials(company?.name)}</Text></View>
          <View><Text style={styles.headerCompany}>{company?.name ?? 'BizChat'}</Text><Text style={styles.headerSection}>User administration</Text></View>
        </View>
        <View style={styles.headerActions}>
          <IconButton label="Back to users" onPress={onBack} icon={<ChevronLeft size={21} color="#ffffff" />} dark />
          <IconButton label="Sign out" onPress={onLogout} icon={<LogOut size={20} color="#ffffff" />} dark />
        </View>
      </ScreenHeader>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.formPage} keyboardShouldPersistTaps="handled">
          <View style={styles.formInner}>
            <View style={styles.titleRow}><View style={styles.flex}><Text style={styles.screenTitle}>User details</Text><Text style={styles.screenSubtitle}>View and update {fullName}'s account information.</Text></View></View>
            {error ? <FeedbackMessage type="error" message={error} /> : null}
            {loading ? <ActivityIndicator color="#13795b" style={styles.listLoader} /> : (
              <>
                <SectionLabel icon={<Pencil size={17} color="#13795b" />} label="Employee details" />
                <View style={styles.twoColumnRow}>
                  <View style={styles.column}><Field label="First name *" value={form.firstName} onChangeText={(value) => updateField('firstName', value)} error={fieldErrors.firstName} /></View>
                  <View style={styles.column}><Field label="Last name" value={form.lastName} onChangeText={(value) => updateField('lastName', value)} /></View>
                </View>
                <View style={styles.twoColumnRow}>
                  <View style={styles.column}><Field label="Employee code" value={form.employeeCode} onChangeText={(value) => updateField('employeeCode', value)} autoCapitalize="characters" /></View>
                  <View style={styles.column}><Field label="Job title" value={form.jobTitle} onChangeText={(value) => updateField('jobTitle', value)} icon={<BriefcaseBusiness size={18} color="#69737d" />} /></View>
                </View>
                <Field label="Mobile number with country code *" value={form.mobileNumber} onChangeText={(value) => updateField('mobileNumber', value)} keyboardType="phone-pad" error={fieldErrors.mobileNumber} icon={<Phone size={18} color="#69737d" />} />
                <View style={styles.twoColumnRow}>
                  <View style={styles.column}><Field label="Work country code" value={form.countryCode} onChangeText={(value) => updateField('countryCode', value)} placeholder="IN" autoCapitalize="characters" maxLength={2} error={fieldErrors.countryCode} /></View>
                  <View style={styles.column}><Field label="Work timezone" value={form.timezone} onChangeText={(value) => updateField('timezone', value)} placeholder="Asia/Kolkata" autoCapitalize="none" error={fieldErrors.timezone} /></View>
                </View>
                <Field label="Email" value={form.email} onChangeText={(value) => updateField('email', value)} keyboardType="email-address" autoCapitalize="none" error={fieldErrors.email} icon={<Mail size={18} color="#69737d" />} />

                <SectionLabel icon={<ShieldCheck size={17} color="#13795b" />} label="Access" />
                <Text style={styles.inputLabel}>Role</Text>
                {user.role === 'super_admin' ? <View style={styles.readOnlyValue}><Text style={styles.readOnlyValueText}>Super admin</Text></View> : (
                  <View style={styles.segmentedControl}>
                    <Segment label="User" selected={form.role === 'user'} onPress={() => setForm({ ...form, role: 'user' })} />
                    <Segment label="Company admin" selected={form.role === 'company_admin'} onPress={() => setForm({ ...form, role: 'company_admin' })} />
                  </View>
                )}
                <Text style={styles.inputLabel}>Departments</Text>
                <View style={styles.departmentGrid}>
                  {departments.map((department) => {
                    const selected = form.departmentIds.includes(department.id);
                    return <Pressable key={department.id} accessibilityRole="checkbox" accessibilityState={{ checked: selected }} onPress={() => toggleDepartment(department.id)} style={[styles.departmentOption, selected && styles.departmentOptionSelected]}><View style={[styles.checkbox, selected && styles.checkboxSelected]}>{selected ? <Check size={14} strokeWidth={3} color="#ffffff" /> : null}</View><Text style={[styles.departmentText, selected && styles.departmentTextSelected]}>{department.name}</Text></Pressable>;
                  })}
                </View>

                <View style={styles.passwordShortcut}>
                  <View style={styles.flex}><Text style={styles.passwordShortcutTitle}>Account password</Text><Text style={styles.passwordShortcutText}>Set a new password for this user.</Text></View>
                  <Pressable accessibilityRole="button" onPress={onPassword} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}><KeyRound size={16} color="#13795b" /><Text style={styles.secondaryButtonText}>Change password</Text></Pressable>
                </View>
                <View style={styles.footerActions}><PrimaryButton label="Save changes" loading={submitting} onPress={handleSave} icon={<Check size={19} color="#ffffff" />} /></View>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function ChangePasswordScreen({ token, user, onBack, onDone, onLogout }: { token: string; user: User; onBack: () => void; onDone: () => void; onLogout: () => Promise<void> }) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ');

  async function handleChangePassword() {
    setError('');
    if (newPassword.length < 8) return setError('Password must contain at least 8 characters.');
    if (newPassword !== confirmPassword) return setError('The passwords do not match.');
    setSubmitting(true);
    try {
      await changeUserPassword(token, user.id, newPassword);
      onDone();
    } catch (passwordError) {
      if (passwordError instanceof ApiError && passwordError.status === 401) await onLogout();
      else setError(passwordError instanceof ApiError ? passwordError.message : 'The password could not be changed.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.flex}>
      <ScreenHeader>
        <View style={styles.headerIdentity}><View style={styles.smallBrandMark}><KeyRound size={18} color="#202830" /></View><View><Text style={styles.headerCompany}>BizChat</Text><Text style={styles.headerSection}>Password management</Text></View></View>
        <View style={styles.headerActions}><IconButton label="Back to user details" onPress={onBack} icon={<ChevronLeft size={21} color="#ffffff" />} dark /><IconButton label="Sign out" onPress={onLogout} icon={<LogOut size={20} color="#ffffff" />} dark /></View>
      </ScreenHeader>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.formPage} keyboardShouldPersistTaps="handled"><View style={styles.passwordForm}>
          <View style={styles.titleRow}><View style={styles.flex}><Text style={styles.screenTitle}>Change password</Text><Text style={styles.screenSubtitle}>Set a new sign-in password for {fullName}.</Text></View></View>
          {error ? <FeedbackMessage type="error" message={error} /> : null}
          <Field label="New password *" value={newPassword} onChangeText={setNewPassword} secureTextEntry={!showPassword} autoCapitalize="none" rightAction={<IconButton label={showPassword ? 'Hide password' : 'Show password'} onPress={() => setShowPassword(!showPassword)} icon={showPassword ? <EyeOff size={19} color="#4d5964" /> : <Eye size={19} color="#4d5964" />} />} />
          <Field label="Confirm new password *" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry={!showPassword} autoCapitalize="none" />
          <Text style={styles.passwordHint}>Use at least 8 characters. The new password takes effect immediately.</Text>
          <View style={styles.footerActions}><PrimaryButton label="Update password" loading={submitting} onPress={handleChangePassword} icon={<KeyRound size={18} color="#ffffff" />} /></View>
        </View></ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function CreateUserScreen({
  token,
  onCreated,
  onBack,
  onLogout,
}: {
  token: string;
  onCreated: () => void;
  onBack: () => void;
  onLogout: () => Promise<void>;
}) {
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [company, setCompany] = useState<Company | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loadingDepartments, setLoadingDepartments] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldName, string>>>({});

  useEffect(() => {
    Promise.all([getDepartments(token), getCurrentCompany(token)])
      .then(([items, currentCompany]) => {
        setDepartments(items.filter((department) => department.status === 'active'));
        setCompany(currentCompany);
        setForm((current) => ({ ...current, timezone: current.timezone || currentCompany.timezone }));
      })
      .catch((loadError) => {
        if (loadError instanceof ApiError && loadError.status === 401) onLogout();
        else setError('Departments could not be loaded. Pull back and try again.');
      })
      .finally(() => setLoadingDepartments(false));
  }, [token, onLogout]);

  const selectedDepartmentNames = useMemo(
    () => departments.filter((item) => form.departmentIds.includes(item.id)).map((item) => item.name),
    [departments, form.departmentIds],
  );

  function updateField(field: FieldName, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    if (fieldErrors[field]) setFieldErrors((current) => ({ ...current, [field]: undefined }));
    setSuccess('');
  }

  function toggleDepartment(id: string) {
    setForm((current) => ({
      ...current,
      departmentIds: current.departmentIds.includes(id)
        ? current.departmentIds.filter((departmentId) => departmentId !== id)
        : [...current.departmentIds, id],
    }));
  }

  function validateForm() {
    const nextErrors: Partial<Record<FieldName, string>> = {};
    if (!form.firstName.trim()) nextErrors.firstName = 'First name is required.';
    if (!/^\+[1-9]\d{6,14}$/.test(form.mobileNumber.trim().replace(/[\s().-]/g, ''))) {
      nextErrors.mobileNumber = 'Use international format, for example +966536547919.';
    }
    if (form.countryCode.trim() && !/^[A-Za-z]{2}$/.test(form.countryCode.trim())) {
      nextErrors.countryCode = 'Use a two-letter code such as IN or SA.';
    }
    if (form.timezone.trim() && !/^[A-Za-z_]+(?:\/[A-Za-z0-9_+\-]+)+$/.test(form.timezone.trim())) {
      nextErrors.timezone = 'Use a timezone such as Asia/Kolkata.';
    }
    if (form.email.trim() && !/^\S+@\S+\.\S+$/.test(form.email.trim())) nextErrors.email = 'Enter a valid email address.';
    if (form.password.length < 8) nextErrors.password = 'Password must contain at least 8 characters.';
    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleCreateUser() {
    setError('');
    setSuccess('');
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      const user = await createUser(token, form);
      setSuccess(`${user.first_name} was added successfully${selectedDepartmentNames.length ? ` to ${selectedDepartmentNames.join(', ')}` : ''}.`);
      setForm({ ...emptyForm, timezone: company?.timezone ?? '' });
      setShowPassword(false);
      onCreated();
    } catch (createError) {
      if (createError instanceof ApiError && createError.status === 401) {
        await onLogout();
        return;
      }
      setError(createError instanceof ApiError ? createError.message : 'The employee could not be created.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.flex}>
      <ScreenHeader>
        <View style={styles.headerIdentity}>
          <View style={styles.smallBrandMark}>
            <Text style={styles.smallBrandMarkText}>{companyInitials(company?.name)}</Text>
          </View>
          <View>
            <Text style={styles.headerCompany}>{company?.name ?? 'BizChat'}</Text>
            <Text style={styles.headerSection}>User administration</Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          <IconButton label="View users" onPress={onBack} icon={<Users size={20} color="#ffffff" />} dark />
          <IconButton label="Sign out" onPress={onLogout} icon={<LogOut size={20} color="#ffffff" />} dark />
        </View>
      </ScreenHeader>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.formPage} keyboardShouldPersistTaps="handled">
          <View style={styles.formInner}>
            <View style={styles.titleRow}>
              <View style={styles.flex}>
                <Text style={styles.screenTitle}>Create user</Text>
                <Text style={styles.screenSubtitle}>Add an employee and assign their access.</Text>
              </View>
            </View>

            {success ? <FeedbackMessage type="success" message={success} /> : null}
            {error ? <FeedbackMessage type="error" message={error} /> : null}

            <SectionLabel icon={<UserPlus size={17} color="#13795b" />} label="Employee details" />
            <View style={styles.twoColumnRow}>
              <View style={styles.column}>
                <Field label="First name *" value={form.firstName} onChangeText={(value) => updateField('firstName', value)} error={fieldErrors.firstName} />
              </View>
              <View style={styles.column}>
                <Field label="Last name" value={form.lastName} onChangeText={(value) => updateField('lastName', value)} />
              </View>
            </View>
            <View style={styles.twoColumnRow}>
              <View style={styles.column}>
                <Field label="Employee code" value={form.employeeCode} onChangeText={(value) => updateField('employeeCode', value)} autoCapitalize="characters" />
              </View>
              <View style={styles.column}>
                <Field label="Job title" value={form.jobTitle} onChangeText={(value) => updateField('jobTitle', value)} icon={<BriefcaseBusiness size={18} color="#69737d" />} />
              </View>
            </View>
            <Field
              label="Mobile number with country code *"
              value={form.mobileNumber}
              onChangeText={(value) => updateField('mobileNumber', value)}
              keyboardType="phone-pad"
              error={fieldErrors.mobileNumber}
              icon={<Phone size={18} color="#69737d" />}
            />
            <View style={styles.twoColumnRow}>
              <View style={styles.column}>
                <Field
                  label="Work country code"
                  value={form.countryCode}
                  onChangeText={(value) => updateField('countryCode', value)}
                  placeholder="IN"
                  autoCapitalize="characters"
                  maxLength={2}
                  error={fieldErrors.countryCode}
                />
              </View>
              <View style={styles.column}>
                <Field
                  label="Work timezone"
                  value={form.timezone}
                  onChangeText={(value) => updateField('timezone', value)}
                  placeholder="Asia/Kolkata"
                  autoCapitalize="none"
                  error={fieldErrors.timezone}
                />
              </View>
            </View>
            <Field
              label="Email"
              value={form.email}
              onChangeText={(value) => updateField('email', value)}
              keyboardType="email-address"
              autoCapitalize="none"
              error={fieldErrors.email}
              icon={<Mail size={18} color="#69737d" />}
            />

            <SectionLabel icon={<ShieldCheck size={17} color="#13795b" />} label="Access" />
            <Text style={styles.inputLabel}>Role</Text>
            <View style={styles.segmentedControl}>
              <Segment label="User" selected={form.role === 'user'} onPress={() => setForm({ ...form, role: 'user' })} />
              <Segment label="Company admin" selected={form.role === 'company_admin'} onPress={() => setForm({ ...form, role: 'company_admin' })} />
            </View>

            <Text style={styles.inputLabel}>Departments</Text>
            {loadingDepartments ? (
              <ActivityIndicator color="#13795b" style={styles.departmentLoader} />
            ) : (
              <View style={styles.departmentGrid}>
                {departments.map((department) => {
                  const selected = form.departmentIds.includes(department.id);
                  return (
                    <Pressable
                      key={department.id}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: selected }}
                      onPress={() => toggleDepartment(department.id)}
                      style={[styles.departmentOption, selected && styles.departmentOptionSelected]}
                    >
                      <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
                        {selected ? <Check size={14} strokeWidth={3} color="#ffffff" /> : null}
                      </View>
                      <Text style={[styles.departmentText, selected && styles.departmentTextSelected]}>{department.name}</Text>
                    </Pressable>
                  );
                })}
              </View>
            )}

            <Field
              label="Temporary password *"
              value={form.password}
              onChangeText={(value) => updateField('password', value)}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              error={fieldErrors.password}
              rightAction={
                <IconButton
                  label={showPassword ? 'Hide password' : 'Show password'}
                  onPress={() => setShowPassword(!showPassword)}
                  icon={showPassword ? <EyeOff size={19} color="#4d5964" /> : <Eye size={19} color="#4d5964" />}
                />
              }
            />

            <View style={styles.footerActions}>
              <PrimaryButton label="Create user" loading={submitting} onPress={handleCreateUser} icon={<UserPlus size={19} color="#ffffff" />} />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

type FieldProps = React.ComponentProps<typeof TextInput> & {
  label: string;
  error?: string;
  icon?: React.ReactNode;
  rightAction?: React.ReactNode;
};

function Field({ label, error, icon, rightAction, style: _style, ...inputProps }: FieldProps) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <View style={[styles.inputShell, error && styles.inputShellError]}>
        {icon}
        <TextInput
          {...inputProps}
          accessibilityLabel={label.replace(' *', '')}
          placeholderTextColor="#89939d"
          style={[styles.input, icon ? styles.inputWithIcon : null]}
        />
        {rightAction}
      </View>
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

function SectionLabel({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <View style={styles.sectionLabel}>
      {icon}
      <Text style={styles.sectionLabelText}>{label}</Text>
    </View>
  );
}

function Segment({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="radio" accessibilityState={{ selected }} onPress={onPress} style={[styles.segment, selected && styles.segmentSelected]}>
      <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function ScreenHeader({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.appHeader, { paddingTop: Math.max(insets.top, 0) + 10 }]}>
      {children}
    </View>
  );
}

function IconButton({ label, icon, onPress, dark = false, disabled = false }: { label: string; icon: React.ReactNode; onPress: () => void | Promise<void>; dark?: boolean; disabled?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.iconButton, dark && styles.iconButtonDark, disabled && styles.disabled, pressed && styles.pressed]}>
      {icon}
    </Pressable>
  );
}

function PrimaryButton({ label, loading, onPress, icon }: { label: string; loading: boolean; onPress: () => void; icon?: React.ReactNode }) {
  return (
    <Pressable accessibilityRole="button" disabled={loading} onPress={onPress} style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed, loading && styles.disabled]}>
      {loading ? <ActivityIndicator color="#ffffff" /> : <>{icon}<Text style={styles.primaryButtonText}>{label}</Text></>}
    </Pressable>
  );
}

function FeedbackMessage({ type, message }: { type: 'success' | 'error'; message: string }) {
  return (
    <View accessibilityRole="alert" style={[styles.feedback, type === 'success' ? styles.feedbackSuccess : styles.feedbackError]}>
      <Text style={[styles.feedbackText, type === 'success' ? styles.feedbackTextSuccess : styles.feedbackTextError]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f4f6f8' },
  flex: { flex: 1 },
  centered: { alignItems: 'center', justifyContent: 'center' },
  incomingCallPage: { flex: 1, backgroundColor: '#172129', alignItems: 'center', justifyContent: 'center', padding: 30 },
  incomingCallAvatar: { width: 108, height: 108, borderRadius: 54, backgroundColor: '#e2f1eb', alignItems: 'center', justifyContent: 'center' },
  incomingCallAvatarText: { color: '#13795b', fontSize: 32, fontWeight: '800' },
  incomingCallName: { color: '#ffffff', fontSize: 28, fontWeight: '700', marginTop: 25 },
  incomingCallType: { color: '#aeb9c2', fontSize: 15, marginTop: 8 },
  incomingCallActions: { flexDirection: 'row', gap: 58, marginTop: 70 },
  incomingCallButton: { width: 66, height: 66, borderRadius: 33, alignItems: 'center', justifyContent: 'center' },
  declineCallButton: { backgroundColor: '#c83b32' },
  answerCallButton: { backgroundColor: '#16845f' },
  loadingSpinner: { marginTop: 20 },
  loginPage: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 22, paddingVertical: 40 },
  loginInner: { width: '100%', maxWidth: 440, alignSelf: 'center' },
  loginBrandRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 48 },
  brandMark: { width: 54, height: 54, borderRadius: 8, backgroundColor: '#13795b', alignItems: 'center', justifyContent: 'center' },
  brandMarkText: { color: '#ffffff', fontSize: 20, fontWeight: '800', letterSpacing: 0 },
  companyName: { color: '#182129', fontSize: 17, fontWeight: '700', letterSpacing: 0 },
  productLabel: { color: '#69737d', fontSize: 13, marginTop: 3, letterSpacing: 0 },
  loginHeading: { marginBottom: 26 },
  screenTitle: { color: '#182129', fontSize: 25, lineHeight: 31, fontWeight: '700', letterSpacing: 0 },
  screenSubtitle: { color: '#69737d', fontSize: 14, lineHeight: 20, marginTop: 5, letterSpacing: 0 },
  fieldGroup: { marginBottom: 16 },
  inputLabel: { color: '#35414c', fontSize: 13, lineHeight: 18, fontWeight: '600', marginBottom: 7, letterSpacing: 0 },
  inputShell: { minHeight: 48, borderWidth: 1, borderColor: '#cbd2d8', borderRadius: 7, backgroundColor: '#ffffff', paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center' },
  inputShellError: { borderColor: '#b42318' },
  input: { flex: 1, minWidth: 0, height: 46, color: '#182129', fontSize: 15, paddingVertical: 0, letterSpacing: 0 },
  inputWithIcon: { paddingLeft: 10 },
  fieldError: { color: '#b42318', fontSize: 12, marginTop: 5, letterSpacing: 0 },
  iconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  iconButtonDark: { borderWidth: 1, borderColor: '#57616a', borderRadius: 7 },
  pressed: { opacity: 0.65 },
  primaryButton: { minHeight: 50, borderRadius: 7, backgroundColor: '#13795b', flexDirection: 'row', gap: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  primaryButtonPressed: { backgroundColor: '#0e654b' },
  primaryButtonText: { color: '#ffffff', fontSize: 15, fontWeight: '700', letterSpacing: 0 },
  disabled: { opacity: 0.65 },
  feedback: { borderLeftWidth: 4, borderRadius: 5, paddingHorizontal: 13, paddingVertical: 11, marginBottom: 18 },
  feedbackSuccess: { backgroundColor: '#e9f7f0', borderLeftColor: '#13795b' },
  feedbackError: { backgroundColor: '#fff0ee', borderLeftColor: '#b42318' },
  feedbackText: { fontSize: 13, lineHeight: 19, fontWeight: '500', letterSpacing: 0 },
  feedbackTextSuccess: { color: '#095b40' },
  feedbackTextError: { color: '#912018' },
  appHeader: { minHeight: 70, backgroundColor: '#202830', paddingHorizontal: 18, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerIdentity: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 11 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  notificationButtonWrap: { position: 'relative' },
  notificationBadge: { position: 'absolute', top: -5, right: -5, minWidth: 19, height: 19, borderRadius: 10, backgroundColor: '#d13c32', borderWidth: 2, borderColor: '#202830', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  notificationBadgeText: { color: '#ffffff', fontSize: 9, fontWeight: '800' },
  smallBrandMark: { width: 38, height: 38, borderRadius: 7, backgroundColor: '#f3b33d', alignItems: 'center', justifyContent: 'center' },
  smallBrandMarkText: { color: '#202830', fontSize: 14, fontWeight: '800', letterSpacing: 0 },
  headerCompany: { color: '#ffffff', fontSize: 14, fontWeight: '700', letterSpacing: 0 },
  headerSection: { color: '#b8c1c8', fontSize: 11, marginTop: 2, letterSpacing: 0 },
  listPage: { paddingHorizontal: 18, paddingTop: 24, paddingBottom: 44 },
  listInner: { width: '100%', maxWidth: 720, alignSelf: 'center' },
  listTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 18 },
  titleActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end', gap: 8 },
  compactPrimaryButton: { minHeight: 42, borderRadius: 7, backgroundColor: '#13795b', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 14 },
  compactPrimaryText: { color: '#ffffff', fontSize: 13, fontWeight: '700' },
  compactSecondaryButton: { minHeight: 42, borderWidth: 1, borderColor: '#9bcbb7', borderRadius: 7, backgroundColor: '#eef8f4', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 14 },
  compactSecondaryText: { color: '#13795b', fontSize: 13, fontWeight: '700' },
  refreshButton: { alignSelf: 'flex-end', minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 9, marginBottom: 12 },
  refreshText: { color: '#13795b', fontSize: 13, fontWeight: '600' },
  listLoader: { marginVertical: 50 },
  emptyState: { alignItems: 'center', borderWidth: 1, borderColor: '#d8dee3', borderRadius: 8, backgroundColor: '#ffffff', paddingHorizontal: 24, paddingVertical: 42 },
  emptyTitle: { color: '#27343e', fontSize: 16, fontWeight: '700', marginTop: 12 },
  emptyText: { color: '#69737d', fontSize: 13, textAlign: 'center', marginTop: 5 },
  userList: { gap: 12 },
  userCard: { borderWidth: 1, borderColor: '#d8dee3', borderRadius: 8, backgroundColor: '#ffffff', padding: 15 },
  inboxCard: { minHeight: 68, borderWidth: 1, borderColor: '#d8dee3', borderRadius: 8, backgroundColor: '#ffffff', paddingHorizontal: 13, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', gap: 11 },
  inboxCardUnread: { borderColor: '#9bcbb7', backgroundColor: '#f0f9f5' },
  inboxPreview: { color: '#69737d', fontSize: 12, marginTop: 4 },
  inboxMeta: { alignItems: 'flex-end', gap: 7 },
  inboxTime: { color: '#89939d', fontSize: 9 },
  inboxUnreadBadge: { minWidth: 21, height: 21, borderRadius: 11, backgroundColor: '#13795b', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  inboxUnreadText: { color: '#ffffff', fontSize: 10, fontWeight: '800' },
  userCardTop: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  userAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#e2f1eb', alignItems: 'center', justifyContent: 'center' },
  userAvatarText: { color: '#13795b', fontSize: 13, fontWeight: '800' },
  userIdentity: { flex: 1, minWidth: 0 },
  userName: { color: '#1e2a33', fontSize: 15, fontWeight: '700' },
  userMeta: { color: '#69737d', fontSize: 12, marginTop: 3 },
  statusBadge: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  statusBadgeActive: { backgroundColor: '#e7f6ef' },
  statusBadgeInactive: { backgroundColor: '#fcebea' },
  statusText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  statusTextActive: { color: '#13795b' },
  statusTextInactive: { color: '#a32d25' },
  userDetails: { borderTopWidth: 1, borderTopColor: '#edf0f2', marginTop: 13, paddingTop: 11, gap: 5 },
  userDetailText: { color: '#5d6973', fontSize: 12 },
  statusAction: { alignSelf: 'flex-end', minHeight: 36, borderRadius: 6, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 11, marginTop: 12 },
  cardActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end', gap: 8 },
  editAction: { borderColor: '#bfd3dc', backgroundColor: '#f1f7f9' },
  editActionText: { color: '#315f75', fontSize: 12, fontWeight: '700' },
  statusActionSuspend: { borderColor: '#edc1bd', backgroundColor: '#fff5f4' },
  statusActionActivate: { borderColor: '#b8ddcd', backgroundColor: '#eef8f4' },
  statusActionText: { fontSize: 12, fontWeight: '700' },
  statusActionTextSuspend: { color: '#a32d25' },
  statusActionTextActivate: { color: '#13795b' },
  chatComingSoon: { borderColor: '#d4dbe0', backgroundColor: '#f7f9fa' },
  chatComingSoonText: { color: '#69737d', fontSize: 12, fontWeight: '700' },
  chatAction: { borderColor: '#9bcbb7', backgroundColor: '#eef8f4' },
  chatActionText: { color: '#13795b', fontSize: 12, fontWeight: '700' },
  chatHeaderAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#e2f1eb', alignItems: 'center', justifyContent: 'center' },
  chatFeedback: { paddingHorizontal: 16, paddingTop: 14, backgroundColor: '#f4f6f8' },
  chatContent: { flex: 1, position: 'relative', backgroundColor: '#eef1f3' },
  messageScroller: { flex: 1 },
  messageList: { flexGrow: 1, paddingHorizontal: 16, paddingTop: 18, paddingBottom: 12, backgroundColor: '#eef1f3' },
  emptyMessageList: { justifyContent: 'center' },
  emptyChat: { alignItems: 'center', alignSelf: 'center', maxWidth: 300, padding: 24 },
  messageRow: { width: '100%', marginBottom: 9 },
  messageRowMine: { alignItems: 'flex-end' },
  messageRowTheirs: { alignItems: 'flex-start' },
  messageBubble: { maxWidth: '82%', borderRadius: 14, paddingHorizontal: 13, paddingTop: 9, paddingBottom: 7 },
  messageBubbleMine: { backgroundColor: '#13795b', borderBottomRightRadius: 4 },
  messageBubbleTheirs: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#d9dfe3', borderBottomLeftRadius: 4 },
  messageText: { color: '#25323b', fontSize: 15, lineHeight: 21 },
  messageTextMine: { color: '#ffffff' },
  messageTime: { color: '#7b8791', fontSize: 9, marginTop: 4, textAlign: 'right' },
  messageTimeMine: { color: '#cce8dd' },
  attachmentCard: { minWidth: 210, maxWidth: 300, borderWidth: 1, borderColor: '#cfe0d9', borderRadius: 9, backgroundColor: '#f4faf7', paddingHorizontal: 10, paddingVertical: 9, marginTop: 2, flexDirection: 'row', alignItems: 'center', gap: 9 },
  attachmentCardMine: { borderColor: '#62a991', backgroundColor: '#0f6b50' },
  attachmentIdentity: { flex: 1, minWidth: 0 },
  attachmentName: { color: '#25323b', fontSize: 12, fontWeight: '700' },
  attachmentNameMine: { color: '#ffffff' },
  attachmentSize: { color: '#71808a', fontSize: 9, marginTop: 3 },
  attachmentSizeMine: { color: '#cce8dd' },
  voiceMessageCard: { minWidth: 235, maxWidth: 310, borderWidth: 1, borderColor: '#cfe0d9', borderRadius: 12, backgroundColor: '#f4faf7', paddingHorizontal: 10, paddingVertical: 9, marginTop: 2, flexDirection: 'row', alignItems: 'center', gap: 9 },
  voiceMessageCardMine: { borderColor: '#62a991', backgroundColor: '#0f6b50' },
  voicePlayButton: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: '#9bcbb7', backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center' },
  voicePlayButtonMine: { borderColor: '#8dc8b4', backgroundColor: '#13795b' },
  voiceMessageIdentity: { flex: 1, minWidth: 0 },
  voiceWaveform: { height: 25, flexDirection: 'row', alignItems: 'center', gap: 3 },
  voiceWaveBar: { width: 3, borderRadius: 2, backgroundColor: '#5ba98d' },
  voiceWaveBarMine: { backgroundColor: '#bde5d6' },
  voiceDuration: { color: '#61717c', fontSize: 9, marginTop: 2 },
  voiceDurationMine: { color: '#cce8dd' },
  chatRefresh: { minHeight: 32, paddingHorizontal: 16, backgroundColor: '#eef1f3', flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6 },
  chatComposerArea: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#ffffff', paddingBottom: Platform.OS === 'android' ? 34 : 0 },
  composer: { minHeight: 66, borderTopWidth: 1, borderTopColor: '#d5dce1', backgroundColor: '#ffffff', paddingHorizontal: 12, paddingVertical: 9, flexDirection: 'row', alignItems: 'flex-end', gap: 9 },
  composerInput: { flex: 1, maxHeight: 110, minHeight: 46, borderWidth: 1, borderColor: '#cbd2d8', borderRadius: 22, color: '#182129', fontSize: 15, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10 },
  recordingStatus: { flex: 1, minHeight: 46, borderWidth: 1, borderColor: '#efc4c0', borderRadius: 22, backgroundColor: '#fff5f4', paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', gap: 10 },
  recordingDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#c73c33' },
  recordingTitle: { color: '#7f2620', fontSize: 13, fontWeight: '700' },
  recordingHint: { color: '#9c5b56', fontSize: 9, marginTop: 2 },
  attachButton: { width: 42, height: 46, borderRadius: 21, borderWidth: 1, borderColor: '#b8ddcd', backgroundColor: '#eef8f4', alignItems: 'center', justifyContent: 'center' },
  sendButton: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#13795b', alignItems: 'center', justifyContent: 'center' },
  recordingStopButton: { backgroundColor: '#b83229' },
  formPage: { paddingHorizontal: 18, paddingTop: 24, paddingBottom: 44 },
  formInner: { width: '100%', maxWidth: 620, alignSelf: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 24 },
  sectionLabel: { flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: 1, borderBottomColor: '#dce1e5', paddingBottom: 9, marginTop: 8, marginBottom: 17 },
  sectionLabelText: { color: '#27343e', fontSize: 14, fontWeight: '700', letterSpacing: 0 },
  twoColumnRow: { flexDirection: Platform.OS === 'web' ? 'row' : 'column', gap: Platform.OS === 'web' ? 12 : 0 },
  column: { flex: 1, minWidth: 0 },
  segmentedControl: { height: 44, borderWidth: 1, borderColor: '#cbd2d8', borderRadius: 7, backgroundColor: '#e9edf0', padding: 3, flexDirection: 'row', marginBottom: 18 },
  segment: { flex: 1, borderRadius: 5, alignItems: 'center', justifyContent: 'center' },
  segmentSelected: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#cbd2d8' },
  segmentText: { color: '#68737d', fontSize: 13, fontWeight: '600', letterSpacing: 0 },
  segmentTextSelected: { color: '#13795b' },
  departmentLoader: { marginVertical: 18 },
  departmentGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginBottom: 20 },
  departmentOption: { width: '48%', minHeight: 46, borderWidth: 1, borderColor: '#cbd2d8', borderRadius: 7, backgroundColor: '#ffffff', paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 9 },
  departmentOptionSelected: { borderColor: '#13795b', backgroundColor: '#eef8f4' },
  checkbox: { width: 20, height: 20, borderWidth: 1, borderColor: '#aab3ba', borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  checkboxSelected: { borderColor: '#13795b', backgroundColor: '#13795b' },
  departmentText: { flex: 1, color: '#3c4852', fontSize: 13, fontWeight: '500', letterSpacing: 0 },
  departmentTextSelected: { color: '#095b40', fontWeight: '700' },
  readOnlyValue: { minHeight: 44, borderWidth: 1, borderColor: '#d5dce1', borderRadius: 7, backgroundColor: '#f4f6f8', justifyContent: 'center', paddingHorizontal: 13, marginBottom: 18 },
  readOnlyValueText: { color: '#4c5963', fontSize: 13, fontWeight: '600' },
  passwordShortcut: { borderWidth: 1, borderColor: '#d8dee3', borderRadius: 8, backgroundColor: '#ffffff', padding: 14, flexDirection: Platform.OS === 'web' ? 'row' : 'column', alignItems: Platform.OS === 'web' ? 'center' : 'stretch', gap: 12, marginTop: 4, marginBottom: 16 },
  passwordShortcutTitle: { color: '#27343e', fontSize: 14, fontWeight: '700' },
  passwordShortcutText: { color: '#69737d', fontSize: 12, marginTop: 4 },
  secondaryButton: { minHeight: 40, borderWidth: 1, borderColor: '#9bcbb7', borderRadius: 7, backgroundColor: '#eef8f4', paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  secondaryButtonText: { color: '#13795b', fontSize: 12, fontWeight: '700' },
  passwordForm: { width: '100%', maxWidth: 500, alignSelf: 'center' },
  passwordHint: { color: '#69737d', fontSize: 12, lineHeight: 18, marginTop: -4, marginBottom: 16 },
  footerActions: { marginTop: 8 },
});
