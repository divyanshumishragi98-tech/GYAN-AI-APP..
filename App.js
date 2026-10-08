import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as Speech from "expo-speech";
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";

import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

const API_BASE = "https://gyan-ai-ef7h.onrender.com";

const TOKEN_KEY = "@gyan_ai_token";
const USER_KEY = "@gyan_ai_user";
const PROJECTS_KEY = "@gyan_ai_projects";
const PINS_KEY = "@gyan_ai_pins";
const LIBRARY_KEY = "@gyan_ai_library";
const SCHEDULE_KEY = "@gyan_ai_schedule";

const COLORS = {
  bg: "#0b0f14",
  panel: "#111821",
  panel2: "#151e28",
  border: "#25303c",
  text: "#f4f7fb",
  muted: "#94a3b8",
  accent: "#38bdf8",
  accent2: "#60a5fa",
  user: "#173047",
  assistant: "#121b24",
  danger: "#ef4444",
  success: "#22c55e",
};

function makeId(prefix = "id") {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeMessage(item) {
  if (!item) return null;

  const role =
    item.role ||
    item.sender ||
    (item.is_user ? "user" : "assistant");

  const content =
    item.content ??
    item.message ??
    item.text ??
    item.answer ??
    item.response ??
    "";

  return {
    id: item.id || makeId("msg"),
    role: role === "user" ? "user" : "assistant",
    content: String(content),
  };
}

function extractAnswer(data) {
  if (!data) return "";

  const keys = [
    "answer",
    "response",
    "reply",
    "message",
    "text",
    "content",
    "output",
    "result",
  ];

  for (const key of keys) {
    if (typeof data[key] === "string" && data[key].trim()) {
      return data[key].trim();
    }
  }

  if (Array.isArray(data.history) && data.history.length) {
    for (let i = data.history.length - 1; i >= 0; i--) {
      const m = normalizeMessage(data.history[i]);
      if (m?.role === "assistant" && m.content.trim()) {
        return m.content.trim();
      }
    }
  }

  return "";
}

function isUrl(text) {
  return /^https?:\/\/\S+$/i.test(text);
}

function renderTextWithLinks(text, onLink) {
  const parts = String(text || "").split(
    /(https?:\/\/[^\s<>"']+)/gi
  );

  return parts.map((part, index) => {
    if (isUrl(part)) {
      return (
        <Text
          key={index}
          style={styles.link}
          onPress={() => onLink(part.replace(/[),.!?]+$/, ""))}
        >
          {part}
        </Text>
      );
    }

    return (
      <Text key={index} style={styles.messageText}>
        {part}
      </Text>
    );
  });
}

function formatDate(value) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return String(value);
  }
}

function App() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [token, setToken] = useState("");
  const [username, setUsername] = useState("");

  const [authMode, setAuthMode] = useState("login");
  const [authUsername, setAuthUsername] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");

  const [conversationId, setConversationId] = useState(null);
  const [conversationTitle, setConversationTitle] = useState("New Chat");

  const [history, setHistory] = useState([]);
  const [memories, setMemories] = useState([]);

  const [menuVisible, setMenuVisible] = useState(false);
  const [historyVisible, setHistoryVisible] = useState(false);
  const [memoryVisible, setMemoryVisible] = useState(false);
  const [projectsVisible, setProjectsVisible] = useState(false);
  const [libraryVisible, setLibraryVisible] = useState(false);
  const [scheduleVisible, setScheduleVisible] = useState(false);
  const [moreVisible, setMoreVisible] = useState(false);

  const [projects, setProjects] = useState([]);
  const [activeProject, setActiveProject] = useState(null);

  const [library, setLibrary] = useState([]);

  const [schedules, setSchedules] = useState([]);

  const [pinnedChats, setPinnedChats] = useState({});

  const [attachment, setAttachment] = useState(null);

  const [isListening, setIsListening] = useState(false);

  const [speakingMessageId, setSpeakingMessageId] = useState(null);

  const listRef = useRef(null);

  useSpeechRecognitionEvent("start", () => {
    setIsListening(true);
  });

  useSpeechRecognitionEvent("end", () => {
    setIsListening(false);
  });

  useSpeechRecognitionEvent("result", (event) => {
    try {
      const transcript =
        event?.results?.[0]?.transcript ||
        event?.results?.[0]?.[0]?.transcript ||
        "";

      if (transcript) {
        setText(transcript);
      }
    } catch (error) {
      console.log("Speech result error:", error);
    }
  });

  useSpeechRecognitionEvent("error", (event) => {
    console.log("Speech recognition error:", event);
    setIsListening(false);
  });

  useEffect(() => {
    bootstrap();
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        listRef.current?.scrollToEnd?.({ animated: true });
      }, 100);
    }
  }, [messages]);

  async function bootstrap() {
    try {
      const [
        savedToken,
        savedUser,
        savedProjects,
        savedLibrary,
        savedSchedules,
        savedPins,
      ] = await Promise.all([
        AsyncStorage.getItem(TOKEN_KEY),
        AsyncStorage.getItem(USER_KEY),
        AsyncStorage.getItem(PROJECTS_KEY),
        AsyncStorage.getItem(LIBRARY_KEY),
        AsyncStorage.getItem(SCHEDULE_KEY),
        AsyncStorage.getItem(PINS_KEY),
      ]);

      if (savedToken) {
        setToken(savedToken);
      }

      if (savedUser) {
        try {
          const user = JSON.parse(savedUser);
          setUsername(user.username || "");
        } catch {
          setUsername(savedUser);
        }
      }

      if (savedProjects) {
        setProjects(JSON.parse(savedProjects));
      }

      if (savedLibrary) {
        setLibrary(JSON.parse(savedLibrary));
      }

      if (savedSchedules) {
        setSchedules(JSON.parse(savedSchedules));
      }

      if (savedPins) {
        setPinnedChats(JSON.parse(savedPins));
      }

      if (savedToken) {
        await Promise.all([
          loadHistory(savedToken),
          loadMemories(savedToken),
        ]);
      }
    } catch (error) {
      console.log("Bootstrap error:", error);
    } finally {
      setLoading(false);
    }
  }

  async function saveProjects(next) {
    setProjects(next);
    await AsyncStorage.setItem(PROJECTS_KEY, JSON.stringify(next));
  }

  async function saveLibrary(next) {
    setLibrary(next);
    await AsyncStorage.setItem(LIBRARY_KEY, JSON.stringify(next));
  }

  async function saveSchedules(next) {
    setSchedules(next);
    await AsyncStorage.setItem(SCHEDULE_KEY, JSON.stringify(next));
  }

  async function savePins(next) {
    setPinnedChats(next);
    await AsyncStorage.setItem(PINS_KEY, JSON.stringify(next));
  }

  async function requestJson(path, options = {}, authToken = token) {
    const headers = {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    };

    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`;
    }

    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });

    let data = null;

    try {
      data = await response.json();
    } catch {
      data = {};
    }

    if (response.status === 401) {
      await handleExpiredSession();
    }

    return data;
  }

  async function handleExpiredSession() {
    await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);

    setToken("");
    setUsername("");
    setMessages([]);
    setHistory([]);
    setMemories([]);
    setConversationId(null);

    Alert.alert(
      "Session expired",
      "कृपया फिर से login करें।"
    );
  }

  async function handleAuth() {
  const u = authUsername.trim();
  const p = authPassword;

  if (!u || !p) {
    Alert.alert(
      "Required",
      "Username और password दोनों भरें।"
    );
    return;
  }

  setAuthLoading(true);

  try {
    const endpoint =
      authMode === "login"
        ? "/api/login"
        : "/api/register";

    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username: u,
        password: p,
      }),
    });

    let data = {};

    try {
      data = await response.json();
    } catch {
      data = {};
    }

    console.log("AUTH STATUS:", response.status);
    console.log("AUTH RESPONSE:", data);

    if (!response.ok || !data?.success || !data?.token) {
      const errorMessage =
        data?.detail ||
        data?.error ||
        "Username या password गलत है।";

      Alert.alert(
        authMode === "login"
          ? "Login failed"
          : "Registration failed",
        errorMessage
      );

      return;
    }

    const user = data.user || {};

    await AsyncStorage.setItem(
      TOKEN_KEY,
      data.token
    );

    await AsyncStorage.setItem(
      USER_KEY,
      JSON.stringify({
        user_id: user.id || "",
        username: user.username || u,
      })
    );

    setToken(data.token);
    setUsername(user.username || u);

    setAuthUsername("");
    setAuthPassword("");
    setMessages([]);
    setConversationId(null);
    setConversationTitle("New Chat");

    await Promise.all([
      loadHistory(data.token),
      loadMemories(data.token),
    ]);

  } catch (error) {
    console.log("AUTH ERROR:", error);

    Alert.alert(
      "Network error",
      "Server से connection नहीं हो पाया।"
    );
  } finally {
    setAuthLoading(false);
  }
}
      

  async function logout() {
    try {
      if (token) {
        await requestJson(
          "/api/logout",
          { method: "POST" },
          token
        );
      }
    } catch {}

    await AsyncStorage.multiRemove([
      TOKEN_KEY,
      USER_KEY,
    ]);

    setToken("");
    setUsername("");
    setMessages([]);
    setHistory([]);
    setMemories([]);
    setConversationId(null);
    setMenuVisible(false);
  }

  async function loadHistory(currentToken = token) {
    if (!currentToken) return;

    try {
      const data = await requestJson(
        "/api/history",
        { method: "GET" },
        currentToken
      );

      if (data?.ok && Array.isArray(data.history)) {
        setHistory(data.history);
      }
    } catch (error) {
      console.log("History error:", error);
    }
  }

  async function openConversation(id) {
    if (!id) return;

    setBusy(true);

    try {
      const data = await requestJson(
        `/api/history/${encodeURIComponent(id)}`,
        { method: "GET" }
      );

      if (!data?.ok) {
        Alert.alert(
          "History",
          data?.error || "Chat load नहीं हुई।"
        );
        return;
      }

      const normalized = Array.isArray(data.messages)
        ? data.messages
            .map(normalizeMessage)
            .filter(Boolean)
        : [];

      setMessages(normalized);
      setConversationId(data.conversation?.id || id);
      setConversationTitle(
        data.conversation?.title || "Chat"
      );

      setHistoryVisible(false);
      setMenuVisible(false);
    } catch {
      Alert.alert(
        "History",
        "Chat load नहीं हो पाई।"
      );
    } finally {
      setBusy(false);
    }
  }

  async function deleteConversation(id) {
    Alert.alert(
      "Delete chat?",
      "यह conversation delete हो जाएगी।",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const data = await requestJson(
                `/api/history/${encodeURIComponent(id)}`,
                { method: "DELETE" }
              );

              if (!data?.ok) {
                Alert.alert(
                  "Delete failed",
                  data?.error || "Chat delete नहीं हुई।"
                );
                return;
              }

              const next = history.filter(
                (item) => item.id !== id
              );

              setHistory(next);

              const pins = { ...pinnedChats };
              delete pins[id];
              await savePins(pins);

              if (conversationId === id) {
                startNewChat();
              }
            } catch {
              Alert.alert(
                "Delete failed",
                "Server से chat delete नहीं हो पाई।"
              );
            }
          },
        },
      ]
    );
  }

  async function togglePin(id) {
    if (!id) return;

    const next = {
      ...pinnedChats,
      [id]: !pinnedChats[id],
    };

    await savePins(next);
  }

  async function loadMemories(currentToken = token) {
    if (!currentToken) return;

    try {
      const data = await requestJson(
        "/api/memory",
        { method: "GET" },
        currentToken
      );

      if (data?.ok && Array.isArray(data.memories)) {
        setMemories(data.memories);
      }
    } catch (error) {
      console.log("Memory error:", error);
    }
  }

  async function deleteMemory(id) {
    try {
      const data = await requestJson(
        `/api/memory/${encodeURIComponent(id)}`,
        { method: "DELETE" }
      );

      if (!data?.ok) {
        Alert.alert(
          "Memory",
          data?.error || "Memory delete नहीं हुई।"
        );
        return;
      }

      setMemories((old) =>
        old.filter((item) => item.id !== id)
      );
    } catch {
      Alert.alert(
        "Memory",
        "Memory delete नहीं हो पाई।"
      );
    }
  }

  async function clearMemories() {
    Alert.alert(
      "Clear memory?",
      "सारी saved memories हट जाएँगी।",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            try {
              const data = await requestJson(
                "/api/memory",
                { method: "DELETE" }
              );

              if (data?.ok) {
                setMemories([]);
              } else {
                Alert.alert(
                  "Memory",
                  data?.error || "Memory clear नहीं हुई।"
                );
              }
            } catch {
              Alert.alert(
                "Memory",
                "Memory clear नहीं हो पाई।"
              );
            }
          },
        },
      ]
    );
  }

  function startNewChat() {
    setMessages([]);
    setConversationId(null);
    setConversationTitle("New Chat");
    setAttachment(null);
    setText("");
    setMenuVisible(false);
  }

  async function sendMessage() {
    const message = text.trim();

    if (!message && !attachment) return;

    if (!token) {
      Alert.alert(
        "Login required",
        "पहले login करें।"
      );
      return;
    }

    const finalMessage = attachment
      ? `${message || "Please process this attachment."}\n\n[Attachment: ${attachment.name || "file"}]`
      : message;

    const localUserMessage = {
      id: makeId("user"),
      role: "user",
      content: message || `📎 ${attachment.name}`,
    };

    setMessages((old) => [...old, localUserMessage]);
    setText("");
    setBusy(true);

    const sentAttachment = attachment;
    setAttachment(null);

    try {
      const data = await requestJson(
        "/api/chat",
        {
          method: "POST",
          body: JSON.stringify({
            message: finalMessage,
            conversation_id: conversationId,
            project_id: activeProject?.id || null,
            attachment: sentAttachment
              ? {
                  name: sentAttachment.name,
                  type: sentAttachment.type,
                  uri: sentAttachment.uri,
                }
              : null,
          }),
        }
      );

      if (!data?.ok) {
        const errorText =
          data?.error ||
          data?.answer ||
          "AI server se answer nahi mila.";

        setMessages((old) => [
          ...old,
          {
            id: makeId("error"),
            role: "assistant",
            content: `⚠️ ${errorText}`,
          },
        ]);

        return;
      }

      const answer = extractAnswer(data);

      if (data.conversation_id) {
        setConversationId(data.conversation_id);
      }

      if (answer) {
        setMessages((old) => [
          ...old,
          {
            id: makeId("assistant"),
            role: "assistant",
            content: answer,
          },
        ]);
      } else {
        setMessages((old) => [
          ...old,
          {
            id: makeId("assistant"),
            role: "assistant",
            content:
              "AI ने response भेजा लेकिन answer text नहीं मिला।",
          },
        ]);
      }

      if (Array.isArray(data.memory)) {
        await loadMemories();
      }

      await loadHistory();
    } catch (error) {
      console.log("Chat error:", error);

      setMessages((old) => [
        ...old,
        {
          id: makeId("error"),
          role: "assistant",
          content:
            "⚠️ AI server से connection नहीं हो पाया। थोड़ी देर बाद फिर कोशिश करें।",
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  async function copyMessage(content) {
    try {
      await Clipboard.setStringAsync(content);
      Alert.alert("Copied", "Message clipboard में copy हो गया।");
    } catch {
      Alert.alert("Copy", "Copy नहीं हो पाया।");
    }
  }

  function openLink(url) {
    Linking.openURL(url).catch(() => {
      Alert.alert(
        "Link",
        "इस link को खोलने के लिए browser उपलब्ध नहीं है।"
      );
    });
  }

  async function speakMessage(message) {
    try {
      if (speakingMessageId === message.id) {
        Speech.stop();
        setSpeakingMessageId(null);
        return;
      }

      Speech.stop();

      setSpeakingMessageId(message.id);

      Speech.speak(message.content, {
        language: /[\u0900-\u097F]/.test(message.content)
          ? "hi-IN"
          : "en-US",
        rate: 0.95,
        pitch: 1,
        onDone: () => setSpeakingMessageId(null),
        onStopped: () => setSpeakingMessageId(null),
        onError: () => setSpeakingMessageId(null),
      });
    } catch {
      setSpeakingMessageId(null);
    }
  }

  async function startVoiceInput() {
    try {
      const permission =
        await ExpoSpeechRecognitionModule.requestPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          "Microphone permission",
          "Voice input के लिए microphone और speech recognition permission चाहिए।"
        );
        return;
      }

      if (isListening) {
        ExpoSpeechRecognitionModule.stop();
        return;
      }

      ExpoSpeechRecognitionModule.start({
        lang: "hi-IN",
        interimResults: true,
        continuous: false,
      });
    } catch (error) {
      console.log("Voice input error:", error);

      Alert.alert(
        "Voice input",
        "Voice input शुरू नहीं हो पाया।"
      );
    }
  }

  async function pickImage() {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          "Permission",
          "Photo चुनने के लिए gallery permission चाहिए।"
        );
        return;
      }

      const result =
        await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          allowsEditing: false,
          quality: 0.85,
        });

      if (result.canceled || !result.assets?.length) {
        return;
      }

      const asset = result.assets[0];

      const item = {
        id: makeId("img"),
        name: asset.fileName || "image.jpg",
        uri: asset.uri,
        type: asset.mimeType || "image/jpeg",
        createdAt: new Date().toISOString(),
        kind: "image",
      };

      setAttachment(item);

      const next = [
        item,
        ...library.filter((x) => x.uri !== item.uri),
      ].slice(0, 100);

      await saveLibrary(next);
    } catch (error) {
      console.log("Image picker error:", error);
    }
  }

  async function takePhoto() {
    try {
      const permission =
        await ImagePicker.requestCameraPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          "Camera permission",
          "Photo लेने के लिए camera permission चाहिए।"
        );
        return;
      }

      const result =
        await ImagePicker.launchCameraAsync({
          allowsEditing: false,
          quality: 0.85,
        });

      if (result.canceled || !result.assets?.length) {
        return;
      }

      const asset = result.assets[0];

      const item = {
        id: makeId("camera"),
        name: asset.fileName || "camera-photo.jpg",
        uri: asset.uri,
        type: asset.mimeType || "image/jpeg",
        createdAt: new Date().toISOString(),
        kind: "image",
      };

      setAttachment(item);

      await saveLibrary([item, ...library].slice(0, 100));
    } catch (error) {
      console.log("Camera error:", error);
    }
  }

  async function pickFile() {
    try {
      const result =
        await DocumentPicker.getDocumentAsync({
          type: "*/*",
          copyToCacheDirectory: true,
          multiple: false,
        });

      if (result.canceled || !result.assets?.length) {
        return;
      }

      const asset = result.assets[0];

      const item = {
        id: makeId("file"),
        name: asset.name || "file",
        uri: asset.uri,
        type: asset.mimeType || "application/octet-stream",
        size: asset.size || 0,
        createdAt: new Date().toISOString(),
        kind: "file",
      };

      setAttachment(item);

      await saveLibrary([item, ...library].slice(0, 100));
    } catch (error) {
      console.log("File picker error:", error);
    }
  }

  function removeAttachment() {
    setAttachment(null);
  }

  function showImageEditInfo() {
    setMenuVisible(false);

    if (!attachment) {
      Alert.alert(
        "Image Edit",
        "पहले Gallery या Camera से photo चुनें।"
      );
      return;
    }

    Alert.alert(
      "Image Edit",
      "Photo तैयार है। Image-edit backend API connect होने के बाद यहाँ AI editing शुरू होगी।"
    );
  }

  function showVideoInfo() {
    setMoreVisible(false);

    Alert.alert(
      "Photo → Video",
      "Photo-to-video generation के लिए AI video backend/API चाहिए। App में feature structure तैयार है; generation backend connect होने के बाद चलेगा।"
    );
  }

  function showSearchInfo() {
    setMoreVisible(false);

    Alert.alert(
      "AI Web Search",
      "अभी question पूछने पर browser अपने-आप नहीं खुलेगा। Backend में AI search API जोड़ने के बाद search यहीं से AI द्वारा किया जा सकेगा।"
    );
  }

  async function createProject() {
    Alert.prompt(
      "New Project",
      "Project का नाम लिखें:",
      async (name) => {
        const clean = String(name || "").trim();

        if (!clean) return;

        const project = {
          id: makeId("project"),
          name: clean,
          createdAt: new Date().toISOString(),
        };

        const next = [project, ...projects];

        await saveProjects(next);
        setActiveProject(project);
      },
      "plain-text",
      ""
    );
  }

  async function deleteProject(id) {
    const next = projects.filter(
      (project) => project.id !== id
    );

    await saveProjects(next);

    if (activeProject?.id === id) {
      setActiveProject(null);
    }
  }

  function selectProject(project) {
    setActiveProject(project);
    setProjectsVisible(false);
  }

  async function scheduleReminder() {
    Alert.alert(
      "Schedule",
      "इस version में reminder list तैयार है। Actual Android scheduled notification के लिए expo-notifications package को workflow में install/configure करना होगा।"
    );
  }

  async function addLocalSchedule() {
    Alert.prompt(
      "Reminder",
      "उदाहरण: 8:00 AM - School time",
      async (value) => {
        const clean = String(value || "").trim();

        if (!clean) return;

        const item = {
          id: makeId("schedule"),
          text: clean,
          createdAt: new Date().toISOString(),
        };

        await saveSchedules([item, ...schedules]);
      },
      "plain-text",
      ""
    );
  }

  async function deleteSchedule(id) {
    await saveSchedules(
      schedules.filter((item) => item.id !== id)
    );
  }

  function generatePdfInfo() {
    Alert.alert(
      "PDF",
      "PDF export UI तैयार है। Direct PDF file बनाने के लिए expo-print + expo-sharing packages जोड़ने होंगे।"
    );
  }

  function openLibraryItem(item) {
    if (!item?.uri) return;

    Linking.openURL(item.uri).catch(() => {
      Alert.alert(
        "File",
        "यह file सीधे open नहीं हो पाई।"
      );
    });
  }

  function openRemoteInfo() {
    Alert.alert(
      "Remote",
      "Remote connections के लिए बाद में backend/plugin connector जोड़ा जा सकता है।"
    );
  }

  function openPluginInfo() {
    Alert.alert(
      "Plugins",
      "Plugin system के लिए backend integrations बाद में connect किए जा सकते हैं।"
    );
  }

  function openPinInfo() {
    setHistoryVisible(true);
  }

  const sortedHistory = useMemo(() => {
    return [...history].sort((a, b) => {
      const ap = !!pinnedChats[a.id];
      const bp = !!pinnedChats[b.id];

      if (ap !== bp) return bp - ap;

      return (
        new Date(b.updated_at || 0).getTime() -
        new Date(a.updated_at || 0).getTime()
      );
    });
  }, [history, pinnedChats]);

  function renderMessage({ item }) {
    const isUser = item.role === "user";

    return (
      <View
        style={[
          styles.messageRow,
          isUser
            ? styles.messageRowUser
            : styles.messageRowAssistant,
        ]}
      >
        <View
          style={[
            styles.messageBubble,
            isUser
              ? styles.userBubble
              : styles.assistantBubble,
          ]}
        >
          <Text style={styles.roleText}>
            {isUser ? "You" : "Gyan AI"}
          </Text>

          <Text style={styles.messageText}>
            {renderTextWithLinks(
              item.content,
              openLink
            )}
          </Text>

          {!isUser && (
            <View style={styles.messageActions}>
              <Pressable
                style={styles.smallButton}
                onPress={() =>
                  copyMessage(item.content)
                }
              >
                <Ionicons
                  name="copy-outline"
                  size={17}
                  color={COLORS.muted}
                />
              </Pressable>

              <Pressable
                style={styles.smallButton}
                onPress={() =>
                  speakMessage(item)
                }
              >
                <Ionicons
                  name={
                    speakingMessageId === item.id
                      ? "stop-circle-outline"
                      : "volume-medium-outline"
                  }
                  size={18}
                  color={
                    speakingMessageId === item.id
                      ? COLORS.accent
                      : COLORS.muted
                  }
                />
              </Pressable>

              <Pressable
                style={styles.smallButton}
                onPress={generatePdfInfo}
              >
                <MaterialCommunityIcons
                  name="file-pdf-box"
                  size={19}
                  color={COLORS.muted}
                />
              </Pressable>
            </View>
          )}
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <StatusBar
          barStyle="light-content"
          backgroundColor={COLORS.bg}
        />

        <View style={styles.loadingLogo}>
          <Text style={styles.loadingLogoText}>G</Text>
        </View>

        <Text style={styles.loadingTitle}>
          Gyan AI
        </Text>

        <ActivityIndicator
          size="large"
          color={COLORS.accent}
          style={{ marginTop: 20 }}
        />
      </SafeAreaView>
    );
  }

  if (!token) {
    return (
      <SafeAreaView style={styles.authScreen}>
        <StatusBar
          barStyle="light-content"
          backgroundColor={COLORS.bg}
        />

        <View style={styles.authCard}>
          <View style={styles.authLogo}>
            <Text style={styles.authLogoText}>G</Text>
          </View>

          <Text style={styles.authTitle}>
            Gyan AI
          </Text>

          <Text style={styles.authSubtitle}>
            Your intelligent AI assistant
          </Text>

          <TextInput
            style={styles.authInput}
            placeholder="Username"
            placeholderTextColor="#64748b"
            value={authUsername}
            onChangeText={setAuthUsername}
            autoCapitalize="none"
          />

          <TextInput
            style={styles.authInput}
            placeholder="Password"
            placeholderTextColor="#64748b"
            value={authPassword}
            onChangeText={setAuthPassword}
            secureTextEntry
          />

          <Pressable
            style={styles.primaryButton}
            onPress={handleAuth}
            disabled={authLoading}
          >
            {authLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryButtonText}>
                {authMode === "login"
                  ? "Login"
                  : "Create Account"}
              </Text>
            )}
          </Pressable>

          <Pressable
            onPress={() =>
              setAuthMode((old) =>
                old === "login"
                  ? "register"
                  : "login"
              )
            }
            style={{ marginTop: 18 }}
          >
            <Text style={styles.switchText}>
              {authMode === "login"
                ? "New user? Create account"
                : "Already have an account? Login"}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={COLORS.bg}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={
          Platform.OS === "ios" ? "padding" : undefined
        }
      >
        <View style={styles.header}>
          <Pressable
            style={styles.headerButton}
            onPress={() => setMenuVisible(true)}
          >
            <Ionicons
              name="menu"
              size={25}
              color={COLORS.text}
            />
          </Pressable>

          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>
              Gyan AI
            </Text>

            <Text
              style={styles.headerSubtitle}
              numberOfLines={1}
            >
              {activeProject
                ? `Project: ${activeProject.name}`
                : conversationTitle}
            </Text>
          </View>

          <Pressable
            style={styles.headerButton}
            onPress={startNewChat}
          >
            <Ionicons
              name="create-outline"
              size={23}
              color={COLORS.text}
            />
          </Pressable>
        </View>

        {messages.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyLogo}>
              <Text style={styles.emptyLogoText}>
                G
              </Text>
            </View>

            <Text style={styles.emptyTitle}>
              Hi, {username || "there"} 👋
            </Text>

            <Text style={styles.emptySubtitle}>
              मैं Gyan AI हूँ। कुछ भी पूछ सकते हैं।
            </Text>

            <View style={styles.suggestionGrid}>
              {[
                "मुझे पढ़ाई में मदद करो",
                "एक नया project शुरू करें",
                "मेरी पुरानी chats दिखाओ",
                "मेरी memory दिखाओ",
              ].map((item) => (
                <Pressable
                  key={item}
                  style={styles.suggestion}
                  onPress={() => setText(item)}
                >
                  <Text style={styles.suggestionText}>
                    {item}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            contentContainerStyle={
              styles.messagesContent
            }
            keyboardShouldPersistTaps="handled"
          />
        )}

        {busy && (
          <View style={styles.typingBar}>
            <ActivityIndicator
              size="small"
              color={COLORS.accent}
            />
            <Text style={styles.typingText}>
              Gyan AI सोच रहा है...
            </Text>
          </View>
        )}

        {attachment && (
          <View style={styles.attachmentBar}>
            {attachment.kind === "image" ? (
              <Image
                source={{ uri: attachment.uri }}
                style={styles.attachmentImage}
              />
            ) : (
              <MaterialCommunityIcons
                name="file-document-outline"
                size={28}
                color={COLORS.accent}
              />
            )}

            <View style={{ flex: 1 }}>
              <Text
                style={styles.attachmentName}
                numberOfLines={1}
              >
                {attachment.name}
              </Text>

              <Text style={styles.attachmentHint}>
                Attachment ready
              </Text>
            </View>

            <Pressable onPress={removeAttachment}>
              <Ionicons
                name="close-circle"
                size={23}
                color={COLORS.muted}
              />
            </Pressable>
          </View>
        )}

        <View style={styles.composerArea}>
          <Pressable
            style={styles.plusButton}
            onPress={() => setMenuVisible(true)}
          >
            <Ionicons
              name="add"
              size={26}
              color={COLORS.text}
            />
          </Pressable>

          <TextInput
            style={styles.composer}
            placeholder="Message Gyan AI..."
            placeholderTextColor="#64748b"
            value={text}
            onChangeText={setText}
            multiline
            maxLength={12000}
          />

          <Pressable
            style={[
              styles.voiceButton,
              isListening && styles.voiceButtonActive,
            ]}
            onPress={startVoiceInput}
          >
            <Ionicons
              name={
                isListening
                  ? "mic"
                  : "mic-outline"
              }
              size={22}
              color={
                isListening
                  ? COLORS.accent
                  : COLORS.text
              }
            />
          </Pressable>

          <Pressable
            style={[
              styles.sendButton,
              !text.trim() &&
                !attachment &&
                styles.sendButtonDisabled,
            ]}
            onPress={sendMessage}
            disabled={
              busy ||
              (!text.trim() && !attachment)
            }
          >
            <Ionicons
              name="arrow-up"
              size={22}
              color="#fff"
            />
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {/* MAIN MENU */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setMenuVisible(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setMenuVisible(false)}
        >
          <Pressable
            style={styles.bottomSheet}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.sheetHandle} />

            <Text style={styles.sheetTitle}>
              Gyan AI
            </Text>

            <MenuItem
              icon="images-outline"
              text="Gallery"
              onPress={() => {
                setMenuVisible(false);
                pickImage();
              }}
            />

            <MenuItem
              icon="camera-outline"
              text="Camera"
              onPress={() => {
                setMenuVisible(false);
                takePhoto();
              }}
            />

            <MenuItem
              icon="document-attach-outline"
              text="File"
              onPress={() => {
                setMenuVisible(false);
                pickFile();
              }}
            />

            <MenuItem
              icon="image-outline"
              text="AI Image Edit"
              onPress={showImageEditInfo}
            />

            <MenuItem
              icon="folder-outline"
              text="Projects"
              onPress={() => {
                setMenuVisible(false);
                setProjectsVisible(true);
              }}
            />

            <MenuItem
              icon="library-outline"
              text="Library"
              onPress={() => {
                setMenuVisible(false);
                setLibraryVisible(true);
              }}
            />

            <MenuItem
              icon="calendar-outline"
              text="Schedule"
              onPress={() => {
                setMenuVisible(false);
                setScheduleVisible(true);
              }}
            />

            <MenuItem
              icon="time-outline"
              text="Chat History"
              onPress={() => {
                setMenuVisible(false);
                loadHistory();
                setHistoryVisible(true);
              }}
            />

            <MenuItem
              icon="bulb-outline"
              text="Memory"
              onPress={() => {
                setMenuVisible(false);
                loadMemories();
                setMemoryVisible(true);
              }}
            />

            <MenuItem
              icon="ellipsis-horizontal-circle-outline"
              text="More"
              onPress={() => {
                setMenuVisible(false);
                setMoreVisible(true);
              }}
            />

            <MenuItem
              icon="log-out-outline"
              text="Logout"
              danger
              onPress={logout}
            />
          </Pressable>
        </Pressable>
      </Modal>

      {/* HISTORY */}
      <Modal
        visible={historyVisible}
        animationType="slide"
        onRequestClose={() => setHistoryVisible(false)}
      >
        <SafeAreaView style={styles.fullModal}>
          <ModalHeader
            title="Chat History"
            onBack={() => setHistoryVisible(false)}
          />

          {sortedHistory.length === 0 ? (
            <EmptyModalText text="अभी कोई saved chat नहीं मिली।" />
          ) : (
            <FlatList
              data={sortedHistory}
              keyExtractor={(item) => String(item.id)}
              contentContainerStyle={styles.modalList}
              renderItem={({ item }) => (
                <View style={styles.historyItem}>
                  <Pressable
                    style={{ flex: 1 }}
                    onPress={() =>
                      openConversation(item.id)
                    }
                  >
                    <View style={styles.historyTitleRow}>
                      <Text
                        style={styles.historyTitle}
                        numberOfLines={1}
                      >
                        {item.title || "Chat"}
                      </Text>

                      {pinnedChats[item.id] && (
                        <Ionicons
                          name="pin"
                          size={15}
                          color={COLORS.accent}
                        />
                      )}
                    </View>

                    <Text style={styles.historyDate}>
                      {formatDate(item.updated_at)}
                    </Text>
                  </Pressable>

                  <Pressable
                    style={styles.historyAction}
                    onPress={() =>
                      togglePin(item.id)
                    }
                  >
                    <Ionicons
                      name={
                        pinnedChats[item.id]
                          ? "pin"
                          : "pin-outline"
                      }
                      size={20}
                      color={COLORS.accent}
                    />
                  </Pressable>

                  <Pressable
                    style={styles.historyAction}
                    onPress={() =>
                      deleteConversation(item.id)
                    }
                  >
                    <Ionicons
                      name="trash-outline"
                      size={20}
                      color={COLORS.danger}
                    />
                  </Pressable>
                </View>
              )}
            />
          )}
        </SafeAreaView>
      </Modal>

      {/* MEMORY */}
      <Modal
        visible={memoryVisible}
        animationType="slide"
        onRequestClose={() => setMemoryVisible(false)}
      >
        <SafeAreaView style={styles.fullModal}>
          <ModalHeader
            title="Gyan AI Memory"
            onBack={() => setMemoryVisible(false)}
          />

          <View style={styles.memoryTopActions}>
            <Text style={styles.memoryCount}>
              {memories.length} saved
            </Text>

            <Pressable
              style={styles.clearMemoryButton}
              onPress={clearMemories}
            >
              <Text style={styles.clearMemoryText}>
                Clear all
              </Text>
            </Pressable>
          </View>

          {memories.length === 0 ? (
            <EmptyModalText text="अभी कोई memory saved नहीं है।" />
          ) : (
            <FlatList
              data={memories}
              keyExtractor={(item) =>
                String(item.id)
              }
              contentContainerStyle={styles.modalList}
              renderItem={({ item }) => (
                <View style={styles.memoryItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.memoryKey}>
                      {item.key || "Memory"}
                    </Text>

                    <Text style={styles.memoryValue}>
                      {item.value || ""}
                    </Text>
                  </View>

                  <Pressable
                    onPress={() =>
                      deleteMemory(item.id)
                    }
                  >
                    <Ionicons
                      name="trash-outline"
                      size={21}
                      color={COLORS.danger}
                    />
                  </Pressable>
                </View>
              )}
            />
          )}
        </SafeAreaView>
      </Modal>

      {/* PROJECTS */}
      <Modal
        visible={projectsVisible}
        animationType="slide"
        onRequestClose={() => setProjectsVisible(false)}
      >
        <SafeAreaView style={styles.fullModal}>
          <ModalHeader
            title="Projects"
            onBack={() => setProjectsVisible(false)}
            right={
              <Pressable
                onPress={createProject}
                style={styles.modalHeaderButton}
              >
                <Ionicons
                  name="add"
                  size={24}
                  color={COLORS.text}
                />
              </Pressable>
            }
          />

          {projects.length === 0 ? (
            <EmptyModalText text="अभी कोई project नहीं है। ऊपर + दबाकर बनाएं।" />
          ) : (
            <FlatList
              data={projects}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.modalList}
              renderItem={({ item }) => (
                <View style={styles.projectItem}>
                  <Pressable
                    style={{ flex: 1 }}
                    onPress={() =>
                      selectProject(item)
                    }
                  >
                    <Text style={styles.projectName}>
                      {item.name}
                    </Text>

                    <Text style={styles.historyDate}>
                      {activeProject?.id === item.id
                        ? "Active project"
                        : "Project"}
                    </Text>
                  </Pressable>

                  {activeProject?.id === item.id && (
                    <Ionicons
                      name="checkmark-circle"
                      size={23}
                      color={COLORS.success}
                    />
                  )}

                  <Pressable
                    onPress={() =>
                      deleteProject(item.id)
                    }
                    style={{ marginLeft: 15 }}
                  >
                    <Ionicons
                      name="trash-outline"
                      size={20}
                      color={COLORS.danger}
                    />
                  </Pressable>
                </View>
              )}
            />
          )}
        </SafeAreaView>
      </Modal>

      {/* LIBRARY */}
      <Modal
        visible={libraryVisible}
        animationType="slide"
        onRequestClose={() => setLibraryVisible(false)}
      >
        <SafeAreaView style={styles.fullModal}>
          <ModalHeader
            title="Library"
            onBack={() => setLibraryVisible(false)}
          />

          {library.length === 0 ? (
            <EmptyModalText text="अभी Library खाली है। Gallery या File से कुछ add करें।" />
          ) : (
            <FlatList
              data={library}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.modalList}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.libraryItem}
                  onPress={() =>
                    openLibraryItem(item)
                  }
                >
                  {item.kind === "image" ? (
                    <Image
                      source={{ uri: item.uri }}
                      style={styles.libraryThumb}
                    />
                  ) : (
                    <View style={styles.fileThumb}>
                      <MaterialCommunityIcons
                        name="file-document"
                        size={30}
                        color={COLORS.accent}
                      />
                    </View>
                  )}

                  <View style={{ flex: 1 }}>
                    <Text
                      style={styles.libraryName}
                      numberOfLines={1}
                    >
                      {item.name}
                    </Text>

                    <Text style={styles.historyDate}>
                      {formatDate(item.createdAt)}
                    </Text>
                  </View>
                </Pressable>
              )}
            />
          )}
        </SafeAreaView>
      </Modal>

      {/* SCHEDULE */}
      <Modal
        visible={scheduleVisible}
        animationType="slide"
        onRequestClose={() => setScheduleVisible(false)}
      >
        <SafeAreaView style={styles.fullModal}>
          <ModalHeader
            title="Schedule"
            onBack={() => setScheduleVisible(false)}
            right={
              <Pressable
                onPress={addLocalSchedule}
                style={styles.modalHeaderButton}
              >
                <Ionicons
                  name="add"
                  size={24}
                  color={COLORS.text}
                />
              </Pressable>
            }
          />

          <View style={styles.scheduleInfo}>
            <Ionicons
              name="information-circle-outline"
              size={21}
              color={COLORS.accent}
            />

            <Text style={styles.scheduleInfoText}>
              उदाहरण: “8:00 AM - Wake up” या
              “8:09 AM - School time”
            </Text>
          </View>

          {schedules.length === 0 ? (
            <EmptyModalText text="अभी कोई reminder नहीं है। ऊपर + दबाकर जोड़ें।" />
          ) : (
            <FlatList
              data={schedules}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.modalList}
              renderItem={({ item }) => (
                <View style={styles.scheduleItem}>
                  <Ionicons
                    name="alarm-outline"
                    size={25}
                    color={COLORS.accent}
                  />

                  <Text
                    style={styles.scheduleText}
                    numberOfLines={2}
                  >
                    {item.text}
                  </Text>

                  <Pressable
                    onPress={() =>
                      deleteSchedule(item.id)
                    }
                  >
                    <Ionicons
                      name="trash-outline"
                      size={20}
                      color={COLORS.danger}
                    />
                  </Pressable>
                </View>
              )}
            />
          )}

          <Pressable
            style={styles.scheduleBackendButton}
            onPress={scheduleReminder}
          >
            <Ionicons
              name="notifications-outline"
              size={20}
              color="#fff"
            />

            <Text style={styles.scheduleBackendText}>
              Notification setup
            </Text>
          </Pressable>
        </SafeAreaView>
      </Modal>

      {/* MORE */}
      <Modal
        visible={moreVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setMoreVisible(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setMoreVisible(false)}
        >
          <Pressable
            style={styles.bottomSheet}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.sheetHandle} />

            <Text style={styles.sheetTitle}>
              More Features
            </Text>

            <MenuItem
              icon="videocam-outline"
              text="Photo → Video"
              onPress={showVideoInfo}
            />

            <MenuItem
              icon="globe-outline"
              text="AI Web Search"
              onPress={showSearchInfo}
            />

            <MenuItem
              icon="cloud-outline"
              text="Remote"
              onPress={() => {
                setMoreVisible(false);
                openRemoteInfo();
              }}
            />

            <MenuItem
              icon="extension-puzzle-outline"
              text="Plugins"
              onPress={() => {
                setMoreVisible(false);
                openPluginInfo();
              }}
            />

            <MenuItem
              icon="pin-outline"
              text="Pinned Chats"
              onPress={() => {
                setMoreVisible(false);
                openPinInfo();
              }}
            />

            <MenuItem
              icon="file-pdf-outline"
              text="Create PDF"
              onPress={() => {
                setMoreVisible(false);
                generatePdfInfo();
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function MenuItem({
  icon,
  text,
  onPress,
  danger = false,
}) {
  return (
    <Pressable
      style={styles.menuItem}
      onPress={onPress}
    >
      <View
        style={[
          styles.menuIcon,
          danger && styles.menuIconDanger,
        ]}
      >
        <Ionicons
          name={icon}
          size={22}
          color={
            danger ? COLORS.danger : COLORS.text
          }
        />
      </View>

      <Text
        style={[
          styles.menuText,
          danger && styles.menuTextDanger,
        ]}
      >
        {text}
      </Text>

      <Ionicons
        name="chevron-forward"
        size={18}
        color={COLORS.muted}
      />
    </Pressable>
  );
}

function ModalHeader({
  title,
  onBack,
  right = null,
}) {
  return (
    <View style={styles.modalHeader}>
      <Pressable
        style={styles.modalHeaderButton}
        onPress={onBack}
      >
        <Ionicons
          name="arrow-back"
          size={24}
          color={COLORS.text}
        />
      </Pressable>

      <Text
        style={styles.modalHeaderTitle}
        numberOfLines={1}
      >
        {title}
      </Text>

      <View style={{ width: 42 }}>
        {right}
      </View>
    </View>
  );
}

function EmptyModalText({ text }) {
  return (
    <View style={styles.emptyModal}>
      <Ionicons
        name="file-tray-outline"
        size={48}
        color="#475569"
      />

      <Text style={styles.emptyModalText}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },

  loadingScreen: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: "center",
    justifyContent: "center",
  },

  loadingLogo: {
    width: 78,
    height: 78,
    borderRadius: 24,
    backgroundColor: "#10283a",
    borderWidth: 1,
    borderColor: COLORS.accent,
    alignItems: "center",
    justifyContent: "center",
  },

  loadingLogoText: {
    fontSize: 48,
    fontWeight: "900",
    color: COLORS.accent,
  },

  loadingTitle: {
    color: COLORS.text,
    fontSize: 28,
    fontWeight: "800",
    marginTop: 15,
  },

  authScreen: {
    flex: 1,
    backgroundColor: COLORS.bg,
    justifyContent: "center",
    padding: 22,
  },

  authCard: {
    backgroundColor: COLORS.panel,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 24,
  },

  authLogo: {
    width: 76,
    height: 76,
    borderRadius: 23,
    backgroundColor: "#10283a",
    borderWidth: 1,
    borderColor: COLORS.accent,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },

  authLogoText: {
    fontSize: 46,
    fontWeight: "900",
    color: COLORS.accent,
  },

  authTitle: {
    color: COLORS.text,
    fontSize: 30,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 15,
  },

  authSubtitle: {
    color: COLORS.muted,
    textAlign: "center",
    marginTop: 5,
    marginBottom: 25,
  },

  authInput: {
    height: 53,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.panel2,
    borderRadius: 15,
    paddingHorizontal: 16,
    color: COLORS.text,
    marginBottom: 12,
    fontSize: 16,
  },

  primaryButton: {
    height: 53,
    borderRadius: 15,
    backgroundColor: COLORS.accent2,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 5,
  },

  primaryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
  },

  switchText: {
    color: COLORS.accent,
    textAlign: "center",
    fontWeight: "700",
  },

  header: {
    height: 67,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },

  headerButton: {
    width: 45,
    height: 45,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },

  headerTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "800",
  },

  headerSubtitle: {
    color: COLORS.muted,
    fontSize: 11,
    marginTop: 2,
  },

  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 25,
  },

  emptyLogo: {
    width: 84,
    height: 84,
    borderRadius: 27,
    backgroundColor: "#10283a",
    borderWidth: 1,
    borderColor: COLORS.accent,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },

  emptyLogoText: {
    color: COLORS.accent,
    fontSize: 50,
    fontWeight: "900",
  },

  emptyTitle: {
    color: COLORS.text,
    fontSize: 25,
    fontWeight: "800",
  },

  emptySubtitle: {
    color: COLORS.muted,
    fontSize: 15,
    marginTop: 8,
    textAlign: "center",
  },

  suggestionGrid: {
    width: "100%",
    marginTop: 25,
    gap: 10,
  },

  suggestion: {
    backgroundColor: COLORS.panel,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    borderRadius: 15,
  },

  suggestionText: {
    color: COLORS.text,
    fontSize: 14,
  },

  messagesContent: {
    paddingHorizontal: 12,
    paddingVertical: 15,
    paddingBottom: 20,
  },

  messageRow: {
    width: "100%",
    marginBottom: 13,
  },

  messageRowUser: {
    alignItems: "flex-end",
  },

  messageRowAssistant: {
    alignItems: "flex-start",
  },

  messageBubble: {
    maxWidth: "91%",
    borderRadius: 18,
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderWidth: 1,
  },

  userBubble: {
    backgroundColor: COLORS.user,
    borderColor: "#24577e",
  },

  assistantBubble: {
    backgroundColor: COLORS.assistant,
    borderColor: COLORS.border,
  },

  roleText: {
    color: COLORS.muted,
    fontSize: 10,
    fontWeight: "800",
    marginBottom: 5,
  },

  messageText: {
    color: COLORS.text,
    fontSize: 15,
    lineHeight: 22,
  },

  link: {
    color: COLORS.accent,
    textDecorationLine: "underline",
    fontSize: 15,
    lineHeight: 22,
  },

  messageActions: {
    flexDirection: "row",
    marginTop: 9,
    gap: 5,
  },

  smallButton: {
    width: 34,
    height: 32,
    borderRadius: 9,
    backgroundColor: "#0c131b",
    alignItems: "center",
    justifyContent: "center",
  },

  typingBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingBottom: 6,
    gap: 8,
  },

  typingText: {
    color: COLORS.muted,
    fontSize: 12,
  },

  attachmentBar: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 10,
    marginBottom: 6,
    backgroundColor: COLORS.panel,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 8,
    gap: 10,
  },

  attachmentImage: {
    width: 45,
    height: 45,
    borderRadius: 9,
  },

  attachmentName: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "700",
  },

  attachmentHint: {
    color: COLORS.muted,
    fontSize: 11,
    marginTop: 2,
  },

  composerArea: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 8,
    paddingTop: 7,
    paddingBottom: Platform.OS === "android" ? 7 : 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.bg,
    gap: 6,
  },

  plusButton: {
    width: 44,
    height: 48,
    borderRadius: 15,
    backgroundColor: COLORS.panel,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },

  composer: {
    flex: 1,
    minHeight: 48,
    maxHeight: 125,
    borderRadius: 17,
    backgroundColor: COLORS.panel,
    borderWidth: 1,
    borderColor: COLORS.border,
    color: COLORS.text,
    paddingHorizontal: 15,
    paddingTop: 13,
    paddingBottom: 10,
    fontSize: 15,
  },

  voiceButton: {
    width: 44,
    height: 48,
    borderRadius: 15,
    backgroundColor: COLORS.panel,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },

  voiceButtonActive: {
    borderColor: COLORS.accent,
    backgroundColor: "#10283a",
  },

  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: COLORS.accent2,
    alignItems: "center",
    justifyContent: "center",
  },

  sendButtonDisabled: {
    opacity: 0.35,
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.58)",
    justifyContent: "flex-end",
  },

  bottomSheet: {
    backgroundColor: COLORS.panel,
    borderTopLeftRadius: 27,
    borderTopRightRadius: 27,
    padding: 18,
    paddingBottom: Platform.OS === "android" ? 24 : 30,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  sheetHandle: {
    width: 42,
    height: 4,
    borderRadius: 10,
    backgroundColor: "#475569",
    alignSelf: "center",
    marginBottom: 18,
  },

  sheetTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 8,
  },

  menuItem: {
    minHeight: 53,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 5,
    gap: 12,
  },

  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.panel2,
    alignItems: "center",
    justifyContent: "center",
  },

  menuIconDanger: {
    backgroundColor: "#291519",
  },

  menuText: {
    flex: 1,
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "600",
  },

  menuTextDanger: {
    color: COLORS.danger,
  },

  fullModal: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },

  modalHeader: {
    height: 65,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingHorizontal: 8,
  },

  modalHeaderButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  modalHeaderTitle: {
    flex: 1,
    color: COLORS.text,
    fontSize: 19,
    fontWeight: "800",
    marginLeft: 4,
  },

  modalList: {
    padding: 12,
    paddingBottom: 30,
  },

  historyItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.panel,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 13,
    marginBottom: 9,
  },

  historyTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  historyTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "700",
    flex: 1,
  },

  historyDate: {
    color: COLORS.muted,
    fontSize: 11,
    marginTop: 4,
  },

  historyAction: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },

  memoryTopActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
  },

  memoryCount: {
    color: COLORS.muted,
    fontSize: 13,
  },

  clearMemoryButton: {
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#291519",
  },

  clearMemoryText: {
    color: COLORS.danger,
    fontWeight: "700",
    fontSize: 12,
  },

  memoryItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.panel,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 14,
    marginBottom: 9,
  },

  memoryKey: {
    color: COLORS.accent,
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 5,
  },

  memoryValue: {
    color: COLORS.text,
    fontSize: 14,
    lineHeight: 20,
  },

  projectItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.panel,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 14,
    marginBottom: 9,
  },

  projectName: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "700",
  },

  libraryItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.panel,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 10,
    marginBottom: 9,
    gap: 12,
  },

  libraryThumb: {
    width: 55,
    height: 55,
    borderRadius: 11,
  },

  fileThumb: {
    width: 55,
    height: 55,
    borderRadius: 11,
    backgroundColor: COLORS.panel2,
    alignItems: "center",
    justifyContent: "center",
  },

  libraryName: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "700",
  },

  scheduleInfo: {
    margin: 13,
    padding: 13,
    borderRadius: 15,
    backgroundColor: "#10283a",
    borderWidth: 1,
    borderColor: "#1d526f",
    flexDirection: "row",
    gap: 10,
  },

  scheduleInfoText: {
    flex: 1,
    color: COLORS.text,
    fontSize: 13,
    lineHeight: 19,
  },

  scheduleItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: COLORS.panel,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 14,
    marginBottom: 9,
  },

  scheduleText: {
    flex: 1,
    color: COLORS.text,
    fontSize: 14,
    lineHeight: 20,
  },

  scheduleBackendButton: {
    margin: 14,
    minHeight: 50,
    borderRadius: 15,
    backgroundColor: COLORS.accent2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  scheduleBackendText: {
    color: "#fff",
    fontWeight: "800",
  },

  emptyModal: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 30,
  },

  emptyModalText: {
    color: COLORS.muted,
    textAlign: "center",
    marginTop: 14,
    fontSize: 14,
    lineHeight: 21,
  },
});

export default App;
