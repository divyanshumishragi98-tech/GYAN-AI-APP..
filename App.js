import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
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

import { WebView } from "react-native-webview";

import {
  Ionicons,
  MaterialCommunityIcons,
} from "@expo/vector-icons";

import { StatusBar } from "expo-status-bar";


/* =========================================================
   CONFIG
========================================================= */

const API_BASE = "https://gyan-ai-ef7h.onrender.com";

const STORAGE_USER = "@gyan_ai_user";
const STORAGE_TOKEN = "@gyan_ai_token";


/* =========================================================
   RESPONSE HELPERS
========================================================= */

async function readJSON(response) {
  const raw = await response.text();

  try {
    return JSON.parse(raw);
  } catch {
    return {
      raw,
    };
  }
}


function extractAnswer(data) {
  if (!data) return "";

  if (typeof data === "string") {
    return data.trim();
  }

  if (Array.isArray(data)) {
    for (const item of data) {
      const found = extractAnswer(item);

      if (found) {
        return found;
      }
    }

    return "";
  }

  const possible = [
    data.answer,
    data.response,
    data.reply,
    data.text,
    data.content,
    data.output,
    data.result,

    data.data?.answer,
    data.data?.response,
    data.data?.reply,
    data.data?.text,
    data.data?.content,
    data.data?.output,
    data.data?.result,

    data.result?.answer,
    data.result?.response,
    data.result?.reply,
    data.result?.text,
    data.result?.content,

    data.message?.content,
    data.message?.text,
  ];

  for (const value of possible) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}


function extractSearchResults(data) {
  if (!data) return [];

  if (Array.isArray(data)) {
    return data;
  }

  return (
    data.results ||
    data.data?.results ||
    data.search_results ||
    data.data?.search_results ||
    []
  );
}


function extractYoutubeResults(data) {
  if (!data) return [];

  if (Array.isArray(data)) {
    return data;
  }

  return (
    data.results ||
    data.data?.results ||
    data.videos ||
    data.data?.videos ||
    []
  );
}


/* =========================================================
   WEB SEARCH DETECTION
========================================================= */

function shouldSearchWeb(text) {
  if (!text) return false;

  const q = text.toLowerCase().trim();

  const keywords = [
    "today",
    "todays",
    "आज",
    "अभी",
    "इस समय",
    "latest",
    "current",
    "recent",
    "news",
    "खबर",
    "खबरें",
    "समाचार",
    "क्या हुआ",
    "क्या हो रहा",
    "हुआ है",
    "हो रहा है",
    "live",
    "लाइव",
    "score",
    "स्कोर",
    "weather",
    "मौसम",
    "price",
    "कीमत",
    "रेट",
    "rate",
    "current price",
    "latest price",
    "update",
    "अपडेट",
    "2026",
    "इस साल",
    "आज का",
    "आज की",
    "आज के",
    "कल की",
    "कल के",
    "कौन जीता",
    "कौन जीत",
    "result",
    "result",
    "परिणाम",
    "election",
    "चुनाव",
    "match",
    "मैच",
    "cricket",
    "क्रिकेट",
    "football",
    "फुटबॉल",
  ];

  return keywords.some((keyword) => q.includes(keyword));
}


function extractUrls(text) {
  if (!text) return [];

  const regex =
    /(https?:\/\/[^\s<>"')\]]+)/gi;

  return text.match(regex) || [];
}


/* =========================================================
   MESSAGE TEXT
========================================================= */

function MessageText({
  text,
  isUser,
  onOpenUrl,
}) {
  if (!text) {
    return null;
  }

  const parts = [];

  const regex =
    /(https?:\/\/[^\s<>"')\]]+)/gi;

  let last = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) {
      parts.push({
        type: "text",
        value: text.substring(
          last,
          match.index
        ),
      });
    }

    parts.push({
      type: "url",
      value: match[0],
    });

    last = regex.lastIndex;
  }

  if (last < text.length) {
    parts.push({
      type: "text",
      value: text.substring(last),
    });
  }

  if (!parts.length) {
    return (
      <Text
        style={[
          styles.messageText,
          isUser &&
            styles.userMessageText,
        ]}
      >
        {text}
      </Text>
    );
  }

  return (
    <Text
      style={[
        styles.messageText,
        isUser &&
          styles.userMessageText,
      ]}
    >
      {parts.map((part, index) => {
        if (part.type === "url") {
          return (
            <Text
              key={index}
              style={styles.linkText}
              onPress={() =>
                onOpenUrl(part.value)
              }
            >
              {part.value}
            </Text>
          );
        }

        return (
          <Text key={index}>
            {part.value}
          </Text>
        );
      })}
    </Text>
  );
}


/* =========================================================
   APP
========================================================= */

export default function App() {
  /* -------------------------------------------------------
     AUTH
  ------------------------------------------------------- */

  const [user, setUser] = useState(null);
  const [token, setToken] = useState("");

  const [authMode, setAuthMode] =
    useState("login");

  const [name, setName] =
    useState("");

  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [authLoading, setAuthLoading] =
    useState(false);


  /* -------------------------------------------------------
     CHAT
  ------------------------------------------------------- */

  const [messages, setMessages] =
    useState([]);

  const [text, setText] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [listening, setListening] =
    useState(false);

  const flatListRef =
    useRef(null);

  const inputRef =
    useRef(null);


  /* -------------------------------------------------------
     MENU
  ------------------------------------------------------- */

  const [menuVisible, setMenuVisible] =
    useState(false);

  const [historyVisible, setHistoryVisible] =
    useState(false);

  const [memoryVisible, setMemoryVisible] =
    useState(false);


  /* -------------------------------------------------------
     HISTORY
  ------------------------------------------------------- */

  const [history, setHistory] =
    useState([]);


  /* -------------------------------------------------------
     MEMORY
  ------------------------------------------------------- */

  const [memories, setMemories] =
    useState([]);


  /* -------------------------------------------------------
     WEB SEARCH
  ------------------------------------------------------- */

  const [searchVisible, setSearchVisible] =
    useState(false);

  const [searchText, setSearchText] =
    useState("");

  const [searchResults, setSearchResults] =
    useState([]);

  const [searchLoading, setSearchLoading] =
    useState(false);


  /* -------------------------------------------------------
     YOUTUBE
  ------------------------------------------------------- */

  const [youtubeSearchVisible, setYoutubeSearchVisible] =
    useState(false);

  const [youtubeVisible, setYoutubeVisible] =
    useState(false);

  const [youtubeUrl, setYoutubeUrl] =
    useState("");

  const [youtubeQuery, setYoutubeQuery] =
    useState("");

  const [youtubeResults, setYoutubeResults] =
    useState([]);

  const [youtubeLoading, setYoutubeLoading] =
    useState(false);


  /* -------------------------------------------------------
     WEB VIEW
  ------------------------------------------------------- */

  const [webVisible, setWebVisible] =
    useState(false);

  const [webUrl, setWebUrl] =
    useState("");


  /* -------------------------------------------------------
     FILE / IMAGE
  ------------------------------------------------------- */

  const [selectedFile, setSelectedFile] =
    useState(null);

  const [selectedImage, setSelectedImage] =
    useState(null);


  /* =======================================================
     LOAD SAVED USER
  ======================================================= */

  useEffect(() => {
    loadStoredUser();

    return () => {
      Speech.stop();
    };
  }, []);


  async function loadStoredUser() {
    try {
      const savedUser =
        await AsyncStorage.getItem(
          STORAGE_USER
        );

      const savedToken =
        await AsyncStorage.getItem(
          STORAGE_TOKEN
        );

      if (savedUser) {
        setUser(
          JSON.parse(savedUser)
        );
      }

      if (savedToken) {
        setToken(savedToken);
      }
    } catch (error) {
      console.log(
        "Load user error:",
        error
      );
    }
  }


  /* =======================================================
     AUTH HELPERS
  ======================================================= */

  function getUserId() {
    if (user?.id) {
      return String(user.id);
    }

    if (user?.user_id) {
      return String(user.user_id);
    }

    if (email) {
      return email;
    }

    return "guest_user";
  }


  function authHeaders() {
    const headers = {
      "Content-Type":
        "application/json",
    };

    if (token) {
      headers.Authorization =
        `Bearer ${token}`;
    }

    return headers;
  }


  /* =======================================================
     LOGIN
  ======================================================= */

  async function login() {
    if (!email.trim()) {
      Alert.alert(
        "Email",
        "Email डालें।"
      );
      return;
    }

    if (!password) {
      Alert.alert(
        "Password",
        "Password डालें।"
      );
      return;
    }

    setAuthLoading(true);

    try {
      const response =
        await fetch(
          `${API_BASE}/api/login`,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              email:
                email.trim(),
              password,
            }),
          }
        );

      const data =
        await readJSON(response);

      if (!response.ok) {
        throw new Error(
          data.message ||
          data.error ||
          "Login failed"
        );
      }

      const newUser =
        data.user ||
        data.data?.user ||
        data;

      const newToken =
        data.token ||
        data.access_token ||
        data.data?.token ||
        "";

      setUser(newUser);
      setToken(newToken);

      await AsyncStorage.setItem(
        STORAGE_USER,
        JSON.stringify(newUser)
      );

      if (newToken) {
        await AsyncStorage.setItem(
          STORAGE_TOKEN,
          newToken
        );
      }

      setPassword("");

    } catch (error) {
      Alert.alert(
        "Login failed",
        error.message ||
          "Login नहीं हो पाया।"
      );
    } finally {
      setAuthLoading(false);
    }
  }


  /* =======================================================
     REGISTER
  ======================================================= */

  async function register() {
    if (!name.trim()) {
      Alert.alert(
        "Name",
        "अपना नाम डालें।"
      );
      return;
    }

    if (!email.trim()) {
      Alert.alert(
        "Email",
        "Email डालें।"
      );
      return;
    }

    if (!password) {
      Alert.alert(
        "Password",
        "Password डालें।"
      );
      return;
    }

    setAuthLoading(true);

    try {
      const response =
        await fetch(
          `${API_BASE}/api/register`,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              name:
                name.trim(),
              email:
                email.trim(),
              password,
            }),
          }
        );

      const data =
        await readJSON(response);

      if (!response.ok) {
        throw new Error(
          data.message ||
          data.error ||
          "Registration failed"
        );
      }

      const newUser =
        data.user ||
        data.data?.user ||
        data;

      const newToken =
        data.token ||
        data.access_token ||
        data.data?.token ||
        "";

      setUser(newUser);
      setToken(newToken);

      await AsyncStorage.setItem(
        STORAGE_USER,
        JSON.stringify(newUser)
      );

      if (newToken) {
        await AsyncStorage.setItem(
          STORAGE_TOKEN,
          newToken
        );
      }

      setPassword("");

    } catch (error) {
      Alert.alert(
        "Register failed",
        error.message ||
          "Account नहीं बन पाया।"
      );
    } finally {
      setAuthLoading(false);
    }
  }


  /* =======================================================
     LOGOUT
  ======================================================= */

  async function logout() {
    Speech.stop();

    setUser(null);
    setToken("");
    setMessages([]);

    await AsyncStorage.removeItem(
      STORAGE_USER
    );

    await AsyncStorage.removeItem(
      STORAGE_TOKEN
    );
  }


  /* =======================================================
     HISTORY
  ======================================================= */

  async function loadHistory() {
    try {
      const response =
        await fetch(
          `${API_BASE}/api/history?user_id=${encodeURIComponent(
            getUserId()
          )}`,
          {
            headers:
              authHeaders(),
          }
        );

      if (!response.ok) {
        return;
      }

      const data =
        await readJSON(response);

      const list =
        data.history ||
        data.data ||
        data.conversations ||
        data.results ||
        (Array.isArray(data)
          ? data
          : []);

      setHistory(
        Array.isArray(list)
          ? list
          : []
      );
    } catch (error) {
      console.log(
        "History error:",
        error
      );
    }
  }


  async function openHistoryItem(item) {
    try {
      setHistoryVisible(false);

      const conversationId =
        item.id ||
        item.conversation_id ||
        item.chat_id;

      if (!conversationId) {
        return;
      }

      const response =
        await fetch(
          `${API_BASE}/api/history/${conversationId}`,
          {
            headers:
              authHeaders(),
          }
        );

      if (!response.ok) {
        return;
      }

      const data =
        await readJSON(response);

      const list =
        data.messages ||
        data.data ||
        data.history ||
        [];

      if (Array.isArray(list)) {
        setMessages(
          list.map(
            (item, index) => ({
              id:
                item.id ||
                `${Date.now()}-${index}`,
              role:
                item.role ||
                (item.sender === "user"
                  ? "user"
                  : "assistant"),
              content:
                item.content ||
                item.message ||
                item.text ||
                "",
            })
          )
        );
      }
    } catch (error) {
      console.log(
        "Open history error:",
        error
      );
    }
  }


  async function deleteHistoryItem(item) {
    const id =
      item.id ||
      item.conversation_id ||
      item.chat_id;

    if (!id) return;

    try {
      const response =
        await fetch(
          `${API_BASE}/api/history/${id}`,
          {
            method: "DELETE",
            headers:
              authHeaders(),
          }
        );

      if (response.ok) {
        setHistory(
          (prev) =>
            prev.filter(
              (x) =>
                (x.id ||
                  x.conversation_id ||
                  x.chat_id) !== id
            )
        );
      }
    } catch (error) {
      console.log(
        "Delete history error:",
        error
      );
    }
  }


  /* =======================================================
     MEMORY
  ======================================================= */

  async function loadMemories() {
    try {
      const response =
        await fetch(
          `${API_BASE}/api/memories?user_id=${encodeURIComponent(
            getUserId()
          )}`,
          {
            headers:
              authHeaders(),
          }
        );

      if (!response.ok) {
        return;
      }

      const data =
        await readJSON(response);

      const list =
        data.memories ||
        data.data ||
        data.results ||
        (Array.isArray(data)
          ? data
          : []);

      setMemories(
        Array.isArray(list)
          ? list
          : []
      );
    } catch (error) {
      console.log(
        "Memory error:",
        error
      );
    }
  }


  async function deleteMemory(item) {
    const id =
      item.id ||
      item.memory_id;

    if (!id) return;

    try {
      const response =
        await fetch(
          `${API_BASE}/api/memories/${id}`,
          {
            method: "DELETE",
            headers:
              authHeaders(),
          }
        );

      if (response.ok) {
        setMemories(
          (prev) =>
            prev.filter(
              (x) =>
                (x.id ||
                  x.memory_id) !== id
            )
        );
      }
    } catch (error) {
      console.log(
        "Delete memory error:",
        error
      );
    }
  }


  /* =======================================================
     NEW CHAT
  ======================================================= */

  function newChat() {
    Keyboard.dismiss();

    setMessages([]);
    setText("");
    setSelectedFile(null);
    setSelectedImage(null);

    setMenuVisible(false);
  }


  /* =======================================================
     WEB SEARCH
  ======================================================= */

  async function performWebSearch(query) {
    if (!query?.trim()) {
      return [];
    }

    try {
      const response =
        await fetch(
          `${API_BASE}/api/search`,
          {
            method: "POST",
            headers:
              authHeaders(),
            body: JSON.stringify({
              query:
                query.trim(),
              user_id:
                getUserId(),
            }),
          }
        );

      if (!response.ok) {
        return [];
      }

      const data =
        await readJSON(response);

      return extractSearchResults(
        data
      );
    } catch (error) {
      console.log(
        "Web search error:",
        error
      );

      return [];
    }
  }


  async function runManualSearch() {
    if (!searchText.trim()) {
      return;
    }

    setSearchLoading(true);

    try {
      const results =
        await performWebSearch(
          searchText
        );

      setSearchResults(results);
    } finally {
      setSearchLoading(false);
    }
  }


  /* =======================================================
     YOUTUBE SEARCH
  ======================================================= */

  async function performYoutubeSearch(query) {
    if (!query?.trim()) {
      return [];
    }

    try {
      const response =
        await fetch(
          `${API_BASE}/api/youtube-search`,
          {
            method: "POST",
            headers:
              authHeaders(),
            body: JSON.stringify({
              query:
                query.trim(),
            }),
          }
        );

      if (!response.ok) {
        return [];
      }

      const data =
        await readJSON(response);

      return extractYoutubeResults(
        data
      );
    } catch (error) {
      console.log(
        "YouTube search error:",
        error
      );

      return [];
    }
  }


  async function runYoutubeSearch() {
    if (!youtubeQuery.trim()) {
      return;
    }

    setYoutubeLoading(true);

    try {
      const results =
        await performYoutubeSearch(
          youtubeQuery
        );

      setYoutubeResults(results);

      if (!results.length) {
        setYoutubeUrl(
          `https://www.youtube.com/results?search_query=${encodeURIComponent(
            youtubeQuery
          )}`
        );
      }
    } finally {
      setYoutubeLoading(false);
    }
  }


  /* =======================================================
     CHAT
  ======================================================= */

  async function sendMessage(customText = null) {
    const message =
      (
        customText ??
        text
      ).trim();

    if (!message || loading) {
      return;
    }

    Keyboard.dismiss();

    const previousMessages =
      messages.map((item) => ({
        role:
          item.role,
        content:
          item.content,
      }));

    const userMessage = {
      id:
        `user-${Date.now()}`,
      role:
        "user",
      content:
        message,
    };

    setMessages(
      (prev) => [
        ...prev,
        userMessage,
      ]
    );

    setText("");
    setLoading(true);

    try {
      /*
       * Automatic Web Search
       */
      const autoSearch =
        shouldSearchWeb(message);

      let webResults = [];

      if (autoSearch) {
        webResults =
          await performWebSearch(
            message
          );
      }

      /*
       * Send both history and messages.
       * This makes the frontend compatible
       * with different backend implementations.
       */
      const body = {
        user_id:
          getUserId(),

        message,

        prompt:
          message,

        query:
          message,

        history:
          previousMessages,

        messages:
          previousMessages,

        web_search:
          autoSearch,

        search_web:
          autoSearch,

        web_results:
          webResults,

        search_results:
          webResults,
      };

      let response =
        await fetch(
          `${API_BASE}/api/chat`,
          {
            method: "POST",
            headers:
              authHeaders(),
            body:
              JSON.stringify(body),
          }
        );

      let data =
        await readJSON(response);

      /*
       * If /api/chat doesn't work,
       * try the Gradio endpoint.
       *
       * We only use this as a fallback.
       */
      let answer =
        extractAnswer(data);

      if (
        !response.ok ||
        !answer
      ) {
        try {
          const gradioResponse =
            await fetch(
              `${API_BASE}/gradio_api/call/chat_submit`,
              {
                method: "POST",
                headers: {
                  "Content-Type":
                    "application/json",
                },
                body:
                  JSON.stringify({
                    data: [
                      message,
                    ],
                  }),
              }
            );

          const gradioData =
            await readJSON(
              gradioResponse
            );

          answer =
            extractAnswer(
              gradioData
            );

          /*
           * Some Gradio versions return
           * an event_id instead of the
           * final answer.
           */
          if (
            !answer &&
            gradioData?.event_id
          ) {
            const eventResponse =
              await fetch(
                `${API_BASE}/gradio_api/call/chat_submit/${gradioData.event_id}`
              );

            const eventText =
              await eventResponse.text();

            const lines =
              eventText.split("\n");

            for (
              const line of lines
            ) {
              if (
                line.startsWith(
                  "data:"
                )
              ) {
                const value =
                  line
                    .replace(
                      "data:",
                      ""
                    )
                    .trim();

                if (!value) {
                  continue;
                }

                try {
                  const parsed =
                    JSON.parse(
                      value
                    );

                  const found =
                    extractAnswer(
                      parsed
                    );

                  if (found) {
                    answer =
                      found;
                    break;
                  }
                } catch {
                  if (
                    value &&
                    value !== "[DONE]"
                  ) {
                    answer =
                      value;
                    break;
                  }
                }
              }
            }
          }
        } catch (fallbackError) {
          console.log(
            "Gradio fallback:",
            fallbackError
          );
        }
      }

      if (!answer) {
        answer =
          "अभी AI server से उत्तर प्राप्त नहीं हुआ। कृपया थोड़ी देर बाद फिर कोशिश करें।";
      }

      const assistantMessage = {
        id:
          `assistant-${Date.now()}`,

        role:
          "assistant",

        content:
          answer,

        webResults:
          webResults,

        searchedWeb:
          autoSearch,
      };

      setMessages(
        (prev) => [
          ...prev,
          assistantMessage,
        ]
      );

    } catch (error) {
      console.log(
        "Chat error:",
        error
      );

      setMessages(
        (prev) => [
          ...prev,
          {
            id:
              `error-${Date.now()}`,

            role:
              "assistant",

            content:
              "AI server से connection नहीं हो पाया। कृपया थोड़ी देर बाद फिर कोशिश करें।",
          },
        ]
      );
    } finally {
      setLoading(false);

      /*
       * Scroll after response.
       */
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({
          animated: true,
        });
      }, 100);
    }
  }


  /* =======================================================
     COPY
  ======================================================= */

  async function copyAnswer(answer) {
    try {
      await Clipboard.setStringAsync(
        answer
      );

      Alert.alert(
        "Copied",
        "Answer clipboard में copy हो गया।"
      );
    } catch {
      Alert.alert(
        "Error",
        "Copy नहीं हो पाया।"
      );
    }
  }


  /* =======================================================
     SPEAKER
  ======================================================= */

  async function speakAnswer(answer) {
    if (!answer) {
      return;
    }

    try {
      /*
       * Stop previous speech first.
       */
      await Speech.stop();

      /*
       * Speak immediately inside app.
       */
      Speech.speak(
        answer,
        {
          language:
            /[\u0900-\u097F]/.test(
              answer
            )
              ? "hi-IN"
              : "en-US",

          rate:
            0.9,

          pitch:
            1.0,
        }
      );
    } catch (error) {
      console.log(
        "Speech error:",
        error
      );
    }
  }


  /* =======================================================
     SHARE
  ======================================================= */

  async function shareAnswer(answer) {
    try {
      await Share.share({
        message:
          answer,
      });
    } catch (error) {
      console.log(
        "Share error:",
        error
      );
    }
  }


  /* =======================================================
     SPEECH RECOGNITION
  ======================================================= */

  useSpeechRecognitionEvent(
    "start",
    () => {
      setListening(true);
    }
  );


  useSpeechRecognitionEvent(
    "end",
    () => {
      setListening(false);
    }
  );


  useSpeechRecognitionEvent(
    "error",
    (event) => {
      console.log(
        "Speech error:",
        event
      );

      setListening(false);
    }
  );


  useSpeechRecognitionEvent(
    "result",
    (event) => {
      const transcript =
        event?.results?.[0]?.transcript ||
        "";

      if (transcript.trim()) {
        setText(
          transcript
        );
      }
    }
  );


  /* =======================================================
     MIC
  ======================================================= */

  async function toggleMic() {
    try {
      if (listening) {
        ExpoSpeechRecognitionModule.stop();

        setListening(false);

        return;
      }

      /*
       * IMPORTANT:
       * Never call Speech.speak() here.
       * Mic is only for speech-to-text.
       */
      await Speech.stop();

      const permission =
        await ExpoSpeechRecognitionModule.requestPermissionsAsync();

      if (
        !permission?.granted
      ) {
        Alert.alert(
          "Microphone permission",
          "Microphone और speech recognition permission allow करें।"
        );

        return;
      }

      /*
       * Keep existing text and append
       * recognized speech naturally.
       */
      ExpoSpeechRecognitionModule.start({
        lang:
          "hi-IN",

        interimResults:
          true,

        continuous:
          false,
      });

    } catch (error) {
      console.log(
        "Mic error:",
        error
      );

      setListening(false);

      Alert.alert(
        "Mic error",
        "Speech recognition शुरू नहीं हो पाया।"
      );
    }
  }


  /* =======================================================
     URL
  ======================================================= */

  function openUrl(url) {
    if (!url) return;

    setWebUrl(url);
    setWebVisible(true);
  }


  /* =======================================================
     IMAGE PICKER
  ======================================================= */

  async function openGallery() {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (
        !permission.granted
      ) {
        Alert.alert(
          "Permission",
          "Gallery permission allow करें।"
        );

        return;
      }

      const result =
        await ImagePicker.launchImageLibraryAsync({
          mediaTypes:
            ["images"],

          allowsEditing:
            false,

          quality:
            0.8,
        });

      if (
        !result.canceled &&
        result.assets?.length
      ) {
        const image =
          result.assets[0];

        setSelectedImage(
          image
        );

        setMessages(
          (prev) => [
            ...prev,
            {
              id:
                `image-${Date.now()}`,

              role:
                "user",

              content:
                `📷 Image attached: ${
                  image.fileName ||
                  "image"
                }`,
            },
          ]
        );
      }
    } catch (error) {
      console.log(
        "Gallery error:",
        error
      );
    }
  }


  /* =======================================================
     CAMERA
  ======================================================= */

  async function openCamera() {
    try {
      const permission =
        await ImagePicker.requestCameraPermissionsAsync();

      if (
        !permission.granted
      ) {
        Alert.alert(
          "Permission",
          "Camera permission allow करें।"
        );

        return;
      }

      const result =
        await ImagePicker.launchCameraAsync({
          allowsEditing:
            false,

          quality:
            0.8,
        });

      if (
        !result.canceled &&
        result.assets?.length
      ) {
        const image =
          result.assets[0];

        setSelectedImage(
          image
        );

        setMessages(
          (prev) => [
            ...prev,
            {
              id:
                `camera-${Date.now()}`,

              role:
                "user",

              content:
                "📷 Camera image attached",
            },
          ]
        );
      }
    } catch (error) {
      console.log(
        "Camera error:",
        error
      );
    }
  }


  /* =======================================================
     FILE
  ======================================================= */

  async function openFilePicker() {
    try {
      const result =
        await DocumentPicker.getDocumentAsync({
          type:
            "*/*",

          copyToCacheDirectory:
            true,
        });

      if (
        !result.canceled &&
        result.assets?.length
      ) {
        const file =
          result.assets[0];

        setSelectedFile(
          file
        );

        setMessages(
          (prev) => [
            ...prev,
            {
              id:
                `file-${Date.now()}`,

              role:
                "user",

              content:
                `📎 File attached: ${
                  file.name ||
                  "file"
                }`,
            },
          ]
        );
      }
    } catch (error) {
      console.log(
        "File picker error:",
        error
      );
    }
  }


  /* =======================================================
     PLUS MENU
  ======================================================= */

  function PlusMenu({
    closeMenu,
  }) {
    return (
      <View style={styles.plusMenu}>
        <Text style={styles.plusTitle}>
          Add to chat
        </Text>

        <View style={styles.plusGrid}>
          <TouchableOpacity
            style={styles.plusItem}
            onPress={() => {
              closeMenu?.();
              openGallery();
            }}
          >
            <View style={styles.plusIcon}>
              <Ionicons
                name="image-outline"
                size={23}
                color="#fff"
              />
            </View>

            <Text style={styles.plusText}>
              Image
            </Text>
          </TouchableOpacity>


          <TouchableOpacity
            style={styles.plusItem}
            onPress={() => {
              closeMenu?.();
              openFilePicker();
            }}
          >
            <View style={styles.plusIcon}>
              <Ionicons
                name="document-outline"
                size={23}
                color="#fff"
              />
            </View>

            <Text style={styles.plusText}>
              File
            </Text>
          </TouchableOpacity>


          <TouchableOpacity
            style={styles.plusItem}
            onPress={() => {
              closeMenu?.();

              setYoutubeQuery("");
              setYoutubeResults([]);
              setYoutubeSearchVisible(
                true
              );
            }}
          >
            <View style={styles.plusIcon}>
              <Ionicons
                name="logo-youtube"
                size={23}
                color="#fff"
              />
            </View>

            <Text style={styles.plusText}>
              YouTube
            </Text>
          </TouchableOpacity>


          <TouchableOpacity
            style={styles.plusItem}
            onPress={() => {
              closeMenu?.();

              setSearchText("");
              setSearchResults([]);
              setSearchVisible(
                true
              );
            }}
          >
            <View style={styles.plusIcon}>
              <Ionicons
                name="globe-outline"
                size={23}
                color="#fff"
              />
            </View>

            <Text style={styles.plusText}>
              Web Search
            </Text>
          </TouchableOpacity>


          <TouchableOpacity
            style={styles.plusItem}
            onPress={() => {
              closeMenu?.();
              openCamera();
            }}
          >
            <View style={styles.plusIcon}>
              <Ionicons
                name="camera-outline"
                size={23}
                color="#fff"
              />
            </View>

            <Text style={styles.plusText}>
              Camera
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }


  /* =======================================================
     MESSAGE RENDER
  ======================================================= */

  function renderMessage({
    item,
  }) {
    const isUser =
      item.role === "user";

    const urls =
      !isUser
        ? extractUrls(
            item.content
          )
        : [];

    return (
      <View
        style={[
          styles.messageRow,
          isUser &&
            styles.userMessageRow,
        ]}
      >
        {!isUser && (
          <View style={styles.aiAvatar}>
            <MaterialCommunityIcons
              name="brain"
              size={17}
              color="#fff"
            />
          </View>
        )}

        <View
          style={[
            styles.messageBubble,
            isUser
              ? styles.userBubble
              : styles.aiBubble,
          ]}
        >
          <MessageText
            text={
              item.content
            }
            isUser={
              isUser
            }
            onOpenUrl={
              openUrl
            }
          />


          {!isUser && (
            <View style={styles.messageActions}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() =>
                  copyAnswer(
                    item.content
                  )
                }
              >
                <Ionicons
                  name="copy-outline"
                  size={17}
                  color="#8f99a8"
                />
              </TouchableOpacity>


              <TouchableOpacity
                style={styles.actionButton}
                onPress={() =>
                  speakAnswer(
                    item.content
                  )
                }
              >
                <Ionicons
                  name="volume-medium-outline"
                  size={18}
                  color="#8f99a8"
                />
              </TouchableOpacity>


              <TouchableOpacity
                style={styles.actionButton}
                onPress={() =>
                  shareAnswer(
                    item.content
                  )
                }
              >
                <Ionicons
                  name="share-outline"
                  size={17}
                  color="#8f99a8"
                />
              </TouchableOpacity>


              {item.searchedWeb && (
                <View style={styles.webBadge}>
                  <Ionicons
                    name="globe-outline"
                    size={13}
                    color="#aeb7c5"
                  />

                  <Text style={styles.webBadgeText}>
                    Web
                  </Text>
                </View>
              )}
            </View>
          )}


          {!isUser &&
            item.webResults?.length >
              0 && (
              <View style={styles.sourcesBox}>
                <Text style={styles.sourcesTitle}>
                  Web sources
                </Text>

                {item.webResults
                  .slice(0, 4)
                  .map(
                    (
                      result,
                      index
                    ) => {
                      const url =
                        result.url ||
                        result.link ||
                        result.href;

                      return (
                        <TouchableOpacity
                          key={
                            `${url}-${index}`
                          }
                          style={styles.sourceItem}
                          onPress={() =>
                            openUrl(
                              url
                            )
                          }
                        >
                          <Ionicons
                            name="open-outline"
                            size={14}
                            color="#8f99a8"
                          />

                          <Text
                            style={
                              styles.sourceText
                            }
                            numberOfLines={
                              2
                            }
                          >
                            {result.title ||
                              result.name ||
                              url ||
                              "Source"}
                          </Text>
                        </TouchableOpacity>
                      );
                    }
                  )}
              </View>
            )}
        </View>
      </View>
    );
  }


  /* =======================================================
     INPUT BAR
  ======================================================= */

  function InputBar() {
    const [
      plusVisible,
      setPlusVisible,
    ] = useState(false);

    /*
     * IMPORTANT:
     * This component remains mounted.
     * We don't conditionally replace the TextInput.
     * This prevents keyboard/focus loss after typing
     * the first character.
     */

    return (
      <View style={styles.inputArea}>

        {plusVisible && (
          <PlusMenu
            closeMenu={() =>
              setPlusVisible(
                false
              )
            }
          />
        )}


        <View style={styles.inputRow}>

          <TouchableOpacity
            style={styles.roundButton}
            onPress={() => {
              Keyboard.dismiss();

              setPlusVisible(
                (prev) => !prev
              );
            }}
          >
            <Ionicons
              name={
                plusVisible
                  ? "close"
                  : "add"
              }
              size={25}
              color="#fff"
            />
          </TouchableOpacity>


          <View style={styles.textInputContainer}>

            <TextInput
              ref={inputRef}

              style={styles.input}

              value={text}

              onChangeText={
                setText
              }

              placeholder={
                listening
                  ? "सुन रहा हूँ..."
                  : "Message Gyan AI..."
              }

              placeholderTextColor="#77808e"

              multiline

              maxLength={
                8000
              }

              blurOnSubmit={
                false
              }

              returnKeyType="default"

              keyboardType="default"

              textAlignVertical="center"

              onFocus={() => {
                /*
                 * Do NOT set state here.
                 * This is important for keyboard stability.
                 */
              }}

              onSubmitEditing={() => {
                /*
                 * Don't submit on Enter in multiline.
                 */
              }}
            />


            {text.trim().length >
              0 && (
              <TouchableOpacity
                style={styles.clearButton}
                onPress={() => {
                  setText("");
                  inputRef.current?.focus();
                }}
              >
                <Ionicons
                  name="close-circle"
                  size={21}
                  color="#8a94a3"
                />
              </TouchableOpacity>
            )}

          </View>


          <TouchableOpacity
            style={[
              styles.micButton,
              listening &&
                styles.micActive,
            ]}
            onPress={
              toggleMic
            }
          >
            <Ionicons
              name={
                listening
                  ? "stop"
                  : "mic-outline"
              }
              size={22}
              color="#fff"
            />
          </TouchableOpacity>


          <TouchableOpacity
            style={[
              styles.sendButton,
              (!text.trim() ||
                loading) &&
                styles.sendDisabled,
            ]}
            onPress={() =>
              sendMessage()
            }
            disabled={
              loading ||
              !text.trim()
            }
          >
            <Ionicons
              name="arrow-up"
              size={22}
              color="#fff"
            />
          </TouchableOpacity>

        </View>


        <Text style={styles.disclaimer}>
          Gyan AI can make mistakes. Check important information.
        </Text>

      </View>
    );
  }


  /* =======================================================
     CHAT SCREEN
  ======================================================= */

  function ChatScreen() {
    return (
      <KeyboardAvoidingView
        style={styles.chatScreen}
        behavior={
          Platform.OS === "ios"
            ? "padding"
            : "height"
        }
        keyboardVerticalOffset={
          Platform.OS === "ios"
            ? 0
            : 0
        }
      >

        <View style={styles.header}>

          <TouchableOpacity
            style={styles.headerButton}
            onPress={() =>
              setMenuVisible(
                true
              )
            }
          >
            <Ionicons
              name="menu-outline"
              size={28}
              color="#fff"
            />
          </TouchableOpacity>


          <View style={styles.headerCenter}>

            <View style={styles.headerLogo}>
              <MaterialCommunityIcons
                name="brain"
                size={20}
                color="#fff"
              />
            </View>

            <View>
              <Text style={styles.headerTitle}>
                Gyan AI
              </Text>

              <Text style={styles.headerSubtitle}>
                AI Assistant
              </Text>
            </View>

          </View>


          <TouchableOpacity
            style={styles.headerButton}
            onPress={
              newChat
            }
          >
            <Ionicons
              name="create-outline"
              size={23}
              color="#fff"
            />
          </TouchableOpacity>

        </View>


        <FlatList
          ref={
            flatListRef
          }

          data={
            messages
          }

          keyExtractor={(
            item,
            index
          ) =>
            String(
              item.id ||
                index
            )
          }

          renderItem={
            renderMessage
          }

          contentContainerStyle={[
            styles.chatContent,

            messages.length ===
              0 &&
              styles.emptyChatContent,
          ]}

          keyboardShouldPersistTaps="handled"

          keyboardDismissMode="none"

          showsVerticalScrollIndicator={
            false
          }

          onContentSizeChange={() =>
            messages.length > 0 &&
            flatListRef.current?.scrollToEnd(
              {
                animated:
                  true,
              }
            )
          }

          ListEmptyComponent={
            <View style={styles.welcome}>

              <View style={styles.bigLogo}>
                <MaterialCommunityIcons
                  name="brain"
                  size={46}
                  color="#fff"
                />
              </View>

              <Text style={styles.welcomeTitle}>
                Hi, I'm Gyan AI
              </Text>

              <Text style={styles.welcomeText}>
                Ask me anything
              </Text>


              <View style={styles.suggestions}>

                <TouchableOpacity
                  style={styles.suggestion}
                  onPress={() =>
                    setText(
                      "आज भारत की latest news बताओ"
                    )
                  }
                >
                  <Ionicons
                    name="globe-outline"
                    size={18}
                    color="#aeb7c5"
                  />

                  <Text style={styles.suggestionText}>
                    आज की latest news
                  </Text>
                </TouchableOpacity>


                <TouchableOpacity
                  style={styles.suggestion}
                  onPress={() =>
                    setText(
                      "मुझे उत्तर प्रदेश की आज की खबरें बताओ"
                    )
                  }
                >
                  <Ionicons
                    name="newspaper-outline"
                    size={18}
                    color="#aeb7c5"
                  />

                  <Text style={styles.suggestionText}>
                    उत्तर प्रदेश की खबरें
                  </Text>
                </TouchableOpacity>


                <TouchableOpacity
                  style={styles.suggestion}
                  onPress={() =>
                    setText(
                      "Explain Newton's first law"
                    )
                  }
                >
                  <MaterialCommunityIcons
                    name="school-outline"
                    size={18}
                    color="#aeb7c5"
                  />

                  <Text style={styles.suggestionText}>
                    Learn something
                  </Text>
                </TouchableOpacity>

              </View>

            </View>
          }
        />


        {loading && (
          <View style={styles.typingBox}>

            <View style={styles.aiAvatarSmall}>
              <MaterialCommunityIcons
                name="brain"
                size={17}
                color="#fff"
              />
            </View>

            <ActivityIndicator
              size="small"
              color="#fff"
            />

            <Text style={styles.typingText}>
              Gyan AI सोच रहा है...
            </Text>

          </View>
        )}


        <InputBar />

      </KeyboardAvoidingView>
    );
  }


  /* =======================================================
     SIDE MENU
  ======================================================= */

  function SideMenu() {
    return (
      <Modal
        visible={
          menuVisible
        }
        transparent
        animationType="none"
        onRequestClose={() =>
          setMenuVisible(
            false
          )
        }
      >
        <View style={styles.drawerOverlay}>

          <Pressable
            style={styles.drawerBackdrop}
            onPress={() =>
              setMenuVisible(
                false
              )
            }
          />

          <View style={styles.drawer}>

            <View style={styles.drawerTop}>

              <View style={styles.drawerLogo}>
                <MaterialCommunityIcons
                  name="brain"
                  size={25}
                  color="#fff"
                />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.drawerTitle}>
                  Gyan AI
                </Text>

                <Text style={styles.drawerSubtitle}>
                  Your AI assistant
                </Text>
              </View>

              <TouchableOpacity
                onPress={() =>
                  setMenuVisible(
                    false
                  )
                }
              >
                <Ionicons
                  name="close"
                  size={25}
                  color="#fff"
                />
              </TouchableOpacity>

            </View>


            <TouchableOpacity
              style={styles.drawerNewChat}
              onPress={() => {
                newChat();

                setMenuVisible(
                  false
                );
              }}
            >
              <Ionicons
                name="add"
                size={22}
                color="#fff"
              />

              <Text style={styles.drawerNewChatText}>
                New Chat
              </Text>
            </TouchableOpacity>


            <View style={styles.drawerDivider} />


            <TouchableOpacity
              style={styles.drawerItem}
              onPress={() => {
                setMenuVisible(
                  false
                );

                loadHistory();

                setHistoryVisible(
                  true
                );
              }}
            >
              <Ionicons
                name="chatbubbles-outline"
                size={22}
                color="#c6ccd5"
              />

              <Text style={styles.drawerItemText}>
                Chat History
              </Text>
            </TouchableOpacity>


            <TouchableOpacity
              style={styles.drawerItem}
              onPress={() => {
                setMenuVisible(
                  false
                );

                loadMemories();

                setMemoryVisible(
                  true
                );
              }}
            >
              <MaterialCommunityIcons
                name="brain-outline"
                size={22}
                color="#c6ccd5"
              />

              <Text style={styles.drawerItemText}>
                Memory
              </Text>
            </TouchableOpacity>


            <TouchableOpacity
              style={styles.drawerItem}
              onPress={() => {
                setMenuVisible(
                  false
                );

                setYoutubeQuery("");
                setYoutubeResults([]);

                setYoutubeSearchVisible(
                  true
                );
              }}
            >
              <Ionicons
                name="logo-youtube"
                size={22}
                color="#c6ccd5"
              />

              <Text style={styles.drawerItemText}>
                YouTube
              </Text>
            </TouchableOpacity>


            <TouchableOpacity
              style={styles.drawerItem}
              onPress={() => {
                setMenuVisible(
                  false
                );

                setSearchText("");
                setSearchResults([]);

                setSearchVisible(
                  true
                );
              }}
            >
              <Ionicons
                name="globe-outline"
                size={22}
                color="#c6ccd5"
              />

              <Text style={styles.drawerItemText}>
                Web Search
              </Text>
            </TouchableOpacity>


            <View style={styles.drawerBottom}>

              <View style={styles.userMini}>

                <View style={styles.userMiniAvatar}>
                  <Text style={styles.userMiniLetter}>
                    {(
                      user?.name ||
                      user?.email ||
                      "G"
                    )[0].toUpperCase()}
                  </Text>
                </View>

                <View style={{ flex: 1 }}>
                  <Text
                    style={styles.userMiniName}
                    numberOfLines={1}
                  >
                    {user?.name ||
                      "Gyan AI User"}
                  </Text>

                  <Text
                    style={styles.userMiniEmail}
                    numberOfLines={1}
                  >
                    {user?.email ||
                      ""}
                  </Text>
                </View>

              </View>


              <TouchableOpacity
                style={styles.logoutDrawer}
                onPress={() => {
                  setMenuVisible(
                    false
                  );

                  logout();
                }}
              >
                <Ionicons
                  name="log-out-outline"
                  size={21}
                  color="#ff7777"
                />

                <Text style={styles.logoutDrawerText}>
                  Logout
                </Text>
              </TouchableOpacity>

            </View>

          </View>
        </View>
      </Modal>
    );
  }


  /* =======================================================
     HISTORY MODAL
  ======================================================= */

  function HistoryModal() {
    return (
      <Modal
        visible={
          historyVisible
        }
        animationType="slide"
        transparent
        onRequestClose={() =>
          setHistoryVisible(
            false
          )
        }
      >
        <View style={styles.modalOverlay}>

          <View style={styles.fullModal}>

            <View style={styles.modalHeader}>

              <View>
                <Text style={styles.modalTitle}>
                  Chat History
                </Text>

                <Text style={styles.modalSubtitle}>
                  Your previous conversations
                </Text>
              </View>

              <TouchableOpacity
                onPress={() =>
                  setHistoryVisible(
                    false
                  )
                }
              >
                <Ionicons
                  name="close"
                  size={27}
                  color="#fff"
                />
              </TouchableOpacity>

            </View>


            <TouchableOpacity
              style={styles.newChatButton}
              onPress={() => {
                newChat();

                setHistoryVisible(
                  false
                );
              }}
            >
              <Ionicons
                name="add"
                size={20}
                color="#fff"
              />

              <Text style={styles.newChatText}>
                New chat
              </Text>
            </TouchableOpacity>


            <FlatList
              data={
                history
              }

              keyExtractor={(
                item,
                index
              ) =>
                String(
                  item.id ||
                    item.conversation_id ||
                    index
                )
              }

              renderItem={({
                item,
              }) => (
                <View style={styles.historyRow}>

                  <TouchableOpacity
                    style={styles.historyMain}
                    onPress={() =>
                      openHistoryItem(
                        item
                      )
                    }
                  >
                    <Ionicons
                      name="chatbubble-outline"
                      size={19}
                      color="#9da7b5"
                    />

                    <Text
                      style={styles.historyTitle}
                      numberOfLines={
                        2
                      }
                    >
                      {item.title ||
                        item.name ||
                        item.first_message ||
                        item.message ||
                        "Chat"}
                    </Text>
                  </TouchableOpacity>


                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() =>
                      deleteHistoryItem(
                        item
                      )
                    }
                  >
                    <Ionicons
                      name="trash-outline"
                      size={19}
                      color="#777"
                    />
                  </TouchableOpacity>

                </View>
              )}

              ListEmptyComponent={
                <Text style={styles.emptyText}>
                  अभी कोई history नहीं है।
                </Text>
              }
            />

          </View>
        </View>
      </Modal>
    );
  }


  /* =======================================================
     MEMORY MODAL
  ======================================================= */

  function MemoryModal() {
    return (
      <Modal
        visible={
          memoryVisible
        }
        animationType="slide"
        transparent
        onRequestClose={() =>
          setMemoryVisible(
            false
          )
        }
      >
        <View style={styles.modalOverlay}>

          <View style={styles.fullModal}>

            <View style={styles.modalHeader}>

              <View>
                <Text style={styles.modalTitle}>
                  Memory
                </Text>

                <Text style={styles.modalSubtitle}>
                  Things Gyan AI remembers
                </Text>
              </View>

              <TouchableOpacity
                onPress={() =>
                  setMemoryVisible(
                    false
                  )
                }
              >
                <Ionicons
                  name="close"
                  size={27}
                  color="#fff"
                />
              </TouchableOpacity>

            </View>


            <FlatList
              data={
                memories
              }

              keyExtractor={(
                item,
                index
              ) =>
                String(
                  item.id ||
                    item.memory_id ||
                    index
                )
              }

              renderItem={({
                item,
              }) => (
                <View style={styles.memoryRow}>

                  <View style={styles.memoryTextBox}>

                    <Text style={styles.memoryKey}>
                      {item.memory_key ||
                        item.key ||
                        "Memory"}
                    </Text>

                    <Text style={styles.memoryValue}>
                      {item.memory_value ||
                        item.value ||
                        item.content ||
                        item.text ||
                        ""}
                    </Text>

                  </View>


                  <TouchableOpacity
                    onPress={() =>
                      deleteMemory(
                        item
                      )
                    }
                  >
                    <Ionicons
                      name="trash-outline"
                      size={19}
                      color="#888"
                    />
                  </TouchableOpacity>

                </View>
              )}

              ListEmptyComponent={
                <View style={styles.emptyMemory}>

                  <MaterialCommunityIcons
                    name="brain"
                    size={45}
                    color="#596372"
                  />

                  <Text style={styles.emptyText}>
                    अभी कोई memory नहीं है।
                  </Text>

                </View>
              }
            />

          </View>
        </View>
      </Modal>
    );
  }


  /* =======================================================
     SEARCH MODAL
  ======================================================= */

  function SearchModal() {
    return (
      <Modal
        visible={
          searchVisible
        }
        animationType="slide"
        transparent
        onRequestClose={() =>
          setSearchVisible(
            false
          )
        }
      >
        <View style={styles.modalOverlay}>

          <View style={styles.fullModal}>

            <View style={styles.modalHeader}>

              <View>
                <Text style={styles.modalTitle}>
                  Web Search
                </Text>

                <Text style={styles.modalSubtitle}>
                  Search the latest information
                </Text>
              </View>

              <TouchableOpacity
                onPress={() =>
                  setSearchVisible(
                    false
                  )
                }
              >
                <Ionicons
                  name="close"
                  size={27}
                  color="#fff"
                />
              </TouchableOpacity>

            </View>


            <View style={styles.searchRow}>

              <TextInput
                value={
                  searchText
                }

                onChangeText={
                  setSearchText
                }

                placeholder="Search the web..."
                placeholderTextColor="#777"

                style={
                  styles.searchInput
                }

                returnKeyType="search"

                onSubmitEditing={
                  runManualSearch
                }
              />

              <TouchableOpacity
                style={
                  styles.searchButton
                }
                onPress={
                  runManualSearch
                }
              >
                <Ionicons
                  name="search"
                  size={21}
                  color="#fff"
                />
              </TouchableOpacity>

            </View>


            {searchLoading && (
              <ActivityIndicator
                color="#fff"
                style={{
                  margin:
                    20,
                }}
              />
            )}


            <FlatList
              data={
                searchResults
              }

              keyExtractor={(
                item,
                index
              ) =>
                String(
                  item.id ||
                    item.url ||
                    item.link ||
                    index
                )
              }

              renderItem={({
                item,
              }) => {
                const url =
                  item.url ||
                  item.link ||
                  item.href;

                return (
                  <TouchableOpacity
                    style={
                      styles.resultCard
                    }
                    onPress={() =>
                      openUrl(
                        url
                      )
                    }
                  >

                    <View style={styles.resultIcon}>
                      <Ionicons
                        name="globe-outline"
                        size={20}
                        color="#fff"
                      />
                    </View>

                    <View style={{ flex: 1 }}>

                      <Text
                        style={
                          styles.resultTitle
                        }
                        numberOfLines={
                          2
                        }
                      >
                        {item.title ||
                          item.name ||
                          "Web result"}
                      </Text>

                      <Text
                        style={
                          styles.resultDescription
                        }
                        numberOfLines={
                          3
                        }
                      >
                        {item.description ||
                          item.snippet ||
                          ""}
                      </Text>

                      <Text
                        style={
                          styles.resultUrl
                        }
                        numberOfLines={
                          1
                        }
                      >
                        {url || ""}
                      </Text>

                    </View>

                  </TouchableOpacity>
                );
              }}

              ListEmptyComponent={
                !searchLoading ? (
                  <Text style={styles.emptyText}>
                    Search करने के लिए ऊपर query डालें।
                  </Text>
                ) : null
              }
            />

          </View>
        </View>
      </Modal>
    );
  }


  /* =======================================================
     YOUTUBE MODAL
  ======================================================= */

  function YoutubeSearchModal() {
    return (
      <Modal
        visible={
          youtubeSearchVisible
        }
        animationType="slide"
        transparent
        onRequestClose={() =>
          setYoutubeSearchVisible(
            false
          )
        }
      >
        <View style={styles.modalOverlay}>

          <View style={styles.fullModal}>

            <View style={styles.modalHeader}>

              <View>
                <Text style={styles.modalTitle}>
                  YouTube
                </Text>

                <Text style={styles.modalSubtitle}>
                  Search YouTube videos
                </Text>
              </View>

              <TouchableOpacity
                onPress={() =>
                  setYoutubeSearchVisible(
                    false
                  )
                }
              >
                <Ionicons
                  name="close"
                  size={27}
                  color="#fff"
                />
              </TouchableOpacity>

            </View>


            <View style={styles.searchRow}>

              <TextInput
                value={
                  youtubeQuery
                }

                onChangeText={
                  setYoutubeQuery
                }

                placeholder="Search YouTube..."
                placeholderTextColor="#777"

                style={
                  styles.searchInput
                }

                returnKeyType="search"

                onSubmitEditing={
                  runYoutubeSearch
                }
              />

              <TouchableOpacity
                style={
                  styles.searchButton
                }
                onPress={
                  runYoutubeSearch
                }
              >
                <Ionicons
                  name="search"
                  size={21}
                  color="#fff"
                />
              </TouchableOpacity>

            </View>


            {youtubeLoading && (
              <ActivityIndicator
                color="#fff"
                style={{
                  margin:
                    20,
                }}
              />
            )}


            <FlatList
              data={
                youtubeResults
              }

              keyExtractor={(
                item,
                index
              ) =>
                String(
                  item.id ||
                    item.videoId ||
                    index
                )
              }

              renderItem={({
                item,
              }) => {

                const videoUrl =
                  item.url ||
                  item.link ||
                  (
                    item.videoId
                      ? `https://www.youtube.com/watch?v=${item.videoId}`
                      : `https://www.youtube.com/results?search_query=${encodeURIComponent(
                          youtubeQuery
                        )}`
                  );

                return (
                  <TouchableOpacity
                    style={
                      styles.resultCard
                    }
                    onPress={() => {
                      setYoutubeSearchVisible(
                        false
                      );

                      setYoutubeUrl(
                        videoUrl
                      );

                      setYoutubeVisible(
                        true
                      );
                    }}
                  >

                    <View style={styles.youtubeIcon}>
                      <Ionicons
                        name="logo-youtube"
                        size={25}
                        color="#fff"
                      />
                    </View>

                    <View style={{ flex: 1 }}>

                      <Text
                        style={
                          styles.resultTitle
                        }
                        numberOfLines={
                          2
                        }
                      >
                        {item.title ||
                          item.name ||
                          "YouTube video"}
                      </Text>

                      <Text
                        style={
                          styles.resultDescription
                        }
                        numberOfLines={
                          2
                        }
                      >
                        {item.description ||
                          item.channel ||
                          ""}
                      </Text>

                    </View>

                  </TouchableOpacity>
                );
              }}

              ListEmptyComponent={
                !youtubeLoading ? (
                  <Text style={styles.emptyText}>
                    YouTube search करने के लिए query डालें।
                  </Text>
                ) : null
              }
            />

          </View>
        </View>
      </Modal>
    );
  }


  /* =======================================================
     WEB VIEW MODAL
  ======================================================= */

  function WebModal() {
    return (
      <Modal
        visible={
          webVisible
        }
        animationType="slide"
        onRequestClose={() =>
          setWebVisible(
            false
          )
        }
      >
        <SafeAreaView style={styles.webModal}>

          <View style={styles.webHeader}>

            <TouchableOpacity
              onPress={() =>
                setWebVisible(
                  false
                )
              }
            >
              <Ionicons
                name="close"
                size={27}
                color="#fff"
              />
            </TouchableOpacity>

            <Text
              style={styles.webHeaderTitle}
              numberOfLines={
                1
              }
            >
              Web
            </Text>

            <TouchableOpacity
              onPress={() =>
                openUrl(
                  webUrl
                )
              }
            >
              <Ionicons
                name="open-outline"
                size={23}
                color="#fff"
              />
            </TouchableOpacity>

          </View>


          {webUrl ? (
            <WebView
              source={{
                uri: webUrl,
              }}

              startInLoadingState

              renderLoading={() => (
                <View style={styles.webLoading}>
                  <ActivityIndicator
                    size="large"
                    color="#fff"
                  />
                </View>
              )}
            />
          ) : null}

        </SafeAreaView>
      </Modal>
    );
  }


  /* =======================================================
     YOUTUBE VIEW MODAL
  ======================================================= */

  function YoutubeModal() {
    return (
      <Modal
        visible={
          youtubeVisible
        }
        animationType="slide"
        onRequestClose={() =>
          setYoutubeVisible(
            false
          )
        }
      >
        <SafeAreaView style={styles.webModal}>

          <View style={styles.webHeader}>

            <TouchableOpacity
              onPress={() =>
                setYoutubeVisible(
                  false
                )
              }
            >
              <Ionicons
                name="close"
                size={27}
                color="#fff"
              />
            </TouchableOpacity>

            <Text style={styles.webHeaderTitle}>
              YouTube
            </Text>

            <View style={{ width: 27 }} />

          </View>


          {youtubeUrl ? (
            <WebView
              source={{
                uri: youtubeUrl,
              }}

              allowsFullscreenVideo

              javaScriptEnabled

              domStorageEnabled

              startInLoadingState

              renderLoading={() => (
                <View style={styles.webLoading}>
                  <ActivityIndicator
                    size="large"
                    color="#fff"
                  />
                </View>
              )}
            />
          ) : null}

        </SafeAreaView>
      </Modal>
    );
  }


  /* =======================================================
     LOGIN SCREEN
  ======================================================= */

  function LoginScreen() {
    return (
      <SafeAreaView style={styles.authScreen}>

        <StatusBar
          style="light"
        />

        <View style={styles.authContainer}>

          <View style={styles.authLogo}>
            <MaterialCommunityIcons
              name="brain"
              size={48}
              color="#fff"
            />
          </View>


          <Text style={styles.authTitle}>
            Gyan AI
          </Text>

          <Text style={styles.authSubtitle}>
            Your smart AI assistant
          </Text>


          {authMode === "register" && (
            <View style={styles.authInputBox}>

              <Ionicons
                name="person-outline"
                size={20}
                color="#7f8997"
              />

              <TextInput
                style={styles.authInput}
                value={name}
                onChangeText={
                  setName
                }
                placeholder="Your name"
                placeholderTextColor="#687281"
              />

            </View>
          )}


          <View style={styles.authInputBox}>

            <Ionicons
              name="mail-outline"
              size={20}
              color="#7f8997"
            />

            <TextInput
              style={styles.authInput}
              value={email}
              onChangeText={
                setEmail
              }
              placeholder="Email"
              placeholderTextColor="#687281"
              keyboardType="email-address"
              autoCapitalize="none"
            />

          </View>


          <View style={styles.authInputBox}>

            <Ionicons
              name="lock-closed-outline"
              size={20}
              color="#7f8997"
            />

            <TextInput
              style={styles.authInput}
              value={password}
              onChangeText={
                setPassword
              }
              placeholder="Password"
              placeholderTextColor="#687281"
              secureTextEntry
            />

          </View>


          <TouchableOpacity
            style={styles.authButton}
            onPress={
              authMode === "login"
                ? login
                : register
            }
            disabled={
              authLoading
            }
          >

            {authLoading ? (
              <ActivityIndicator
                color="#fff"
              />
            ) : (
              <Text style={styles.authButtonText}>
                {authMode ===
                "login"
                  ? "Login"
                  : "Create Account"}
              </Text>
            )}

          </TouchableOpacity>


          <TouchableOpacity
            style={styles.authSwitch}
            onPress={() =>
              setAuthMode(
                authMode ===
                  "login"
                  ? "register"
                  : "login"
              )
            }
          >
            <Text style={styles.authSwitchText}>
              {authMode ===
              "login"
                ? "New to Gyan AI? Create account"
                : "Already have an account? Login"}
            </Text>
          </TouchableOpacity>


          <Text style={styles.authFooter}>
            Powered by Gyan AI
          </Text>

        </View>

      </SafeAreaView>
    );
  }


  /* =======================================================
     MAIN RETURN
  ======================================================= */

  if (!user) {
    return (
      <LoginScreen />
    );
  }


  return (
    <SafeAreaView style={styles.app}>

      <StatusBar
        style="light"
      />

      <ChatScreen />

      <SideMenu />

      <HistoryModal />

      <MemoryModal />

      <SearchModal />

      <YoutubeSearchModal />

      <WebModal />

      <YoutubeModal />

    </SafeAreaView>
  );
}


/* =========================================================
   STYLES
========================================================= */

const styles =
  StyleSheet.create({

    /* -----------------------------------------------------
       APP
    ----------------------------------------------------- */

    app: {
      flex: 1,
      backgroundColor:
        "#0b0f14",
    },

    chatScreen: {
      flex: 1,
      backgroundColor:
        "#0b0f14",
    },


    /* -----------------------------------------------------
       HEADER
    ----------------------------------------------------- */

    header: {
      height: 62,
      flexDirection:
        "row",
      alignItems:
        "center",
      paddingHorizontal:
        10,
      borderBottomWidth:
        1,
      borderBottomColor:
        "#1c222b",
      backgroundColor:
        "#0b0f14",
    },

    headerButton: {
      width: 44,
      height: 44,
      alignItems:
        "center",
      justifyContent:
        "center",
      borderRadius:
        22,
    },

    headerCenter: {
      flex: 1,
      flexDirection:
        "row",
      alignItems:
        "center",
      justifyContent:
        "center",
    },

    headerLogo: {
      width: 36,
      height: 36,
      borderRadius:
        11,
      backgroundColor:
        "#171d26",
      alignItems:
        "center",
      justifyContent:
        "center",
      marginRight:
        9,
    },

    headerTitle: {
      color:
        "#fff",
      fontSize:
        17,
      fontWeight:
        "700",
    },

    headerSubtitle: {
      color:
        "#737e8d",
      fontSize:
        10,
      marginTop:
        1,
      textAlign:
        "center",
    },


    /* -----------------------------------------------------
       CHAT
    ----------------------------------------------------- */

    chatContent: {
      paddingHorizontal:
        14,
      paddingTop:
        18,
      paddingBottom:
        20,
    },

    emptyChatContent: {
      flexGrow: 1,
      justifyContent:
        "center",
    },

    welcome: {
      alignItems:
        "center",
      paddingHorizontal:
        20,
    },

    bigLogo: {
      width: 82,
      height: 82,
      borderRadius:
        26,
      backgroundColor:
        "#171e28",
      alignItems:
        "center",
      justifyContent:
        "center",
      marginBottom:
        18,
      borderWidth:
        1,
      borderColor:
        "#28313d",
    },

    welcomeTitle: {
      color:
        "#fff",
      fontSize:
        26,
      fontWeight:
        "700",
      marginBottom:
        7,
    },

    welcomeText: {
      color:
        "#87919f",
      fontSize:
        15,
      marginBottom:
        25,
    },

    suggestions: {
      width:
        "100%",
      maxWidth:
        430,
    },

    suggestion: {
      minHeight:
        48,
      borderWidth:
        1,
      borderColor:
        "#252d38",
      borderRadius:
        14,
      paddingHorizontal:
        14,
      flexDirection:
        "row",
      alignItems:
        "center",
      marginBottom:
        9,
      backgroundColor:
        "#11161d",
    },

    suggestionText: {
      color:
        "#c7ced8",
      fontSize:
        14,
      marginLeft:
        11,
    },


    /* -----------------------------------------------------
       MESSAGES
    ----------------------------------------------------- */

    messageRow: {
      flexDirection:
        "row",
      alignItems:
        "flex-start",
      marginBottom:
        18,
      paddingHorizontal:
        2,
    },

    userMessageRow: {
      justifyContent:
        "flex-end",
    },

    aiAvatar: {
      width: 30,
      height: 30,
      borderRadius:
        10,
      backgroundColor:
        "#1a222d",
      alignItems:
        "center",
      justifyContent:
        "center",
      marginRight:
        8,
      marginTop:
        2,
    },

    messageBubble: {
      maxWidth:
        "88%",
      borderRadius:
        17,
      paddingHorizontal:
        14,
      paddingVertical:
        11,
    },

    aiBubble: {
      backgroundColor:
        "#11171f",
      borderWidth:
        1,
      borderColor:
        "#1e2732",
      borderTopLeftRadius:
        5,
    },

    userBubble: {
      backgroundColor:
        "#202a36",
      borderTopRightRadius:
        5,
    },

    messageText: {
      color:
        "#e7ebf0",
      fontSize:
        15,
      lineHeight:
        22,
    },

    userMessageText: {
      color:
        "#fff",
    },

    linkText: {
      color:
        "#8ab4ff",
      textDecorationLine:
        "underline",
    },

    messageActions: {
      flexDirection:
        "row",
      alignItems:
        "center",
      marginTop:
        9,
      paddingTop:
        8,
      borderTopWidth:
        1,
      borderTopColor:
        "#222b35",
    },

    actionButton: {
      width: 32,
      height: 30,
      alignItems:
        "center",
      justifyContent:
        "center",
      marginRight:
        3,
    },

    webBadge: {
      flexDirection:
        "row",
      alignItems:
        "center",
      paddingHorizontal:
        7,
      paddingVertical:
        4,
      borderRadius:
        8,
      backgroundColor:
        "#1b222c",
      marginLeft:
        5,
    },

    webBadgeText: {
      color:
        "#8f99a8",
      fontSize:
        10,
      marginLeft:
        3,
    },

    sourcesBox: {
      marginTop:
        10,
      paddingTop:
        9,
      borderTopWidth:
        1,
      borderTopColor:
        "#222b35",
    },

    sourcesTitle: {
      color:
        "#8f99a8",
      fontSize:
        11,
      fontWeight:
        "600",
      marginBottom:
        5,
    },

    sourceItem: {
      flexDirection:
        "row",
      alignItems:
        "center",
      marginVertical:
        4,
    },

    sourceText: {
      flex: 1,
      color:
        "#8aa9d6",
      fontSize:
        11,
      marginLeft:
        5,
    },


    /* -----------------------------------------------------
       TYPING
    ----------------------------------------------------- */

    typingBox: {
      flexDirection:
        "row",
      alignItems:
        "center",
      paddingHorizontal:
        18,
      paddingVertical:
        7,
    },

    aiAvatarSmall: {
      width: 27,
      height: 27,
      borderRadius:
        9,
      backgroundColor:
        "#1a222d",
      alignItems:
        "center",
      justifyContent:
        "center",
      marginRight:
        9,
    },

    typingText: {
      color:
        "#7f8997",
      fontSize:
        12,
      marginLeft:
        8,
    },


    /* -----------------------------------------------------
       INPUT
    ----------------------------------------------------- */

    inputArea: {
      paddingHorizontal:
        10,
      paddingTop:
        7,
      paddingBottom:
        Platform.OS ===
        "android"
          ? 8
          : 9,
      backgroundColor:
        "#0b0f14",
      borderTopWidth:
        1,
      borderTopColor:
        "#171e27",
    },

    inputRow: {
      minHeight:
        54,
      flexDirection:
        "row",
      alignItems:
        "flex-end",
      backgroundColor:
        "#151b23",
      borderWidth:
        1,
      borderColor:
        "#29323e",
      borderRadius:
        18,
      paddingHorizontal:
        6,
      paddingVertical:
        6,
    },

    roundButton: {
      width: 40,
      height: 40,
      borderRadius:
        20,
      alignItems:
        "center",
      justifyContent:
        "center",
      marginBottom:
        0,
    },

    textInputContainer: {
      flex: 1,
      minHeight:
        40,
      maxHeight:
        120,
      justifyContent:
        "center",
      position:
        "relative",
    },

    input: {
      flex: 1,
      color:
        "#fff",
      fontSize:
        15,
      lineHeight:
        21,
      paddingHorizontal:
        5,
      paddingTop:
        Platform.OS ===
        "android"
          ? 8
          : 9,
      paddingBottom:
        Platform.OS ===
        "android"
          ? 8
          : 9,
      minHeight:
        40,
      maxHeight:
        110,
    },

    clearButton: {
      position:
        "absolute",
      right:
        4,
      bottom:
        9,
      width: 25,
      height: 25,
      alignItems:
        "center",
      justifyContent:
        "center",
    },

    micButton: {
      width: 40,
      height: 40,
      borderRadius:
        20,
      alignItems:
        "center",
      justifyContent:
        "center",
    },

    micActive: {
      backgroundColor:
        "#713c3c",
    },

    sendButton: {
      width: 40,
      height: 40,
      borderRadius:
        20,
      backgroundColor:
        "#fff",
      alignItems:
        "center",
      justifyContent:
        "center",
    },

    sendDisabled: {
      opacity:
        0.3,
    },

    disclaimer: {
      textAlign:
        "center",
      color:
        "#626d7b",
      fontSize:
        9,
      marginTop:
        6,
    },


    /* -----------------------------------------------------
       PLUS MENU
    ----------------------------------------------------- */

    plusMenu: {
      marginBottom:
        9,
      backgroundColor:
        "#151b23",
      borderWidth:
        1,
      borderColor:
        "#29323e",
      borderRadius:
        16,
      padding:
        13,
    },

    plusTitle: {
      color:
        "#d9dee6",
      fontSize:
        13,
      fontWeight:
        "600",
      marginBottom:
        11,
    },

    plusGrid: {
      flexDirection:
        "row",
      flexWrap:
        "wrap",
    },

    plusItem: {
      width:
        "20%",
      minWidth:
        62,
      alignItems:
        "center",
      marginBottom:
        5,
    },

    plusIcon: {
      width: 42,
      height: 42,
      borderRadius:
        13,
      backgroundColor:
        "#202832",
      alignItems:
        "center",
      justifyContent:
        "center",
      marginBottom:
        5,
    },

    plusText: {
      color:
        "#aeb7c5",
      fontSize:
        10,
    },


    /* -----------------------------------------------------
       DRAWER
    ----------------------------------------------------- */

    drawerOverlay: {
      flex: 1,
      flexDirection:
        "row",
    },

    drawerBackdrop: {
      flex: 1,
      backgroundColor:
        "rgba(0,0,0,0.65)",
    },

    drawer: {
      width:
        "82%",
      maxWidth:
        330,
      backgroundColor:
        "#0f141b",
      borderRightWidth:
        1,
      borderRightColor:
        "#222b35",
      paddingTop:
        Platform.OS ===
        "android"
          ? 14
          : 4,
    },

    drawerTop: {
      flexDirection:
        "row",
      alignItems:
        "center",
      padding:
        17,
    },

    drawerLogo: {
      width: 45,
      height: 45,
      borderRadius:
        14,
      backgroundColor:
        "#1b232e",
      alignItems:
        "center",
      justifyContent:
        "center",
      marginRight:
        11,
    },

    drawerTitle: {
      color:
        "#fff",
      fontSize:
        18,
      fontWeight:
        "700",
    },

    drawerSubtitle: {
      color:
        "#727d8c",
      fontSize:
        11,
      marginTop:
        2,
    },

    drawerNewChat: {
      height: 48,
      marginHorizontal:
        13,
      borderRadius:
        13,
      backgroundColor:
        "#1c2530",
      flexDirection:
        "row",
      alignItems:
        "center",
      paddingHorizontal:
        14,
    },

    drawerNewChatText: {
      color:
        "#fff",
      fontSize:
        14,
      fontWeight:
        "600",
      marginLeft:
        9,
    },

    drawerDivider: {
      height: 1,
      backgroundColor:
        "#222b35",
      marginVertical:
        13,
    },

    drawerItem: {
      height: 51,
      marginHorizontal:
        9,
      paddingHorizontal:
        11,
      borderRadius:
        11,
      flexDirection:
        "row",
      alignItems:
        "center",
    },

    drawerItemText: {
      color:
        "#c5ccd6",
      fontSize:
        14,
      marginLeft:
        13,
    },

    drawerBottom: {
      marginTop:
        "auto",
      borderTopWidth:
        1,
      borderTopColor:
        "#222b35",
      padding:
        14,
    },

    userMini: {
      flexDirection:
        "row",
      alignItems:
        "center",
      marginBottom:
        13,
    },

    userMiniAvatar: {
      width: 38,
      height: 38,
      borderRadius:
        19,
      backgroundColor:
        "#2a3441",
      alignItems:
        "center",
      justifyContent:
        "center",
      marginRight:
        9,
    },

    userMiniLetter: {
      color:
        "#fff",
      fontWeight:
        "700",
      fontSize:
        16,
    },

    userMiniName: {
      color:
        "#e4e8ed",
      fontSize:
        13,
      fontWeight:
        "600",
    },

    userMiniEmail: {
      color:
        "#707b89",
      fontSize:
        10,
      marginTop:
        2,
    },

    logoutDrawer: {
      flexDirection:
        "row",
      alignItems:
        "center",
      height:
        42,
      paddingHorizontal:
        10,
    },

    logoutDrawerText: {
      color:
        "#ff7777",
      fontSize:
        13,
      marginLeft:
        9,
    },


    /* -----------------------------------------------------
       MODALS
    ----------------------------------------------------- */

    modalOverlay: {
      flex: 1,
      backgroundColor:
        "rgba(0,0,0,0.68)",
      justifyContent:
        "flex-end",
    },

    fullModal: {
      height:
        "88%",
      backgroundColor:
        "#0e131a",
      borderTopLeftRadius:
        23,
      borderTopRightRadius:
        23,
      padding:
        16,
    },

    modalHeader: {
      flexDirection:
        "row",
      alignItems:
        "center",
      justifyContent:
        "space-between",
      marginBottom:
        15,
    },

    modalTitle: {
      color:
        "#fff",
      fontSize:
        21,
      fontWeight:
        "700",
    },

    modalSubtitle: {
      color:
        "#747f8e",
      fontSize:
        11,
      marginTop:
        3,
    },

    newChatButton: {
      height:
        47,
      backgroundColor:
        "#1d2732",
      borderRadius:
        13,
      flexDirection:
        "row",
      alignItems:
        "center",
      paddingHorizontal:
        14,
      marginBottom:
        10,
    },

    newChatText: {
      color:
        "#fff",
      fontSize:
        14,
      fontWeight:
        "600",
      marginLeft:
        8,
    },

    historyRow: {
      flexDirection:
        "row",
      alignItems:
        "center",
      borderBottomWidth:
        1,
      borderBottomColor:
        "#1d252f",
      minHeight:
        57,
    },

    historyMain: {
      flex: 1,
      flexDirection:
        "row",
      alignItems:
        "center",
      paddingVertical:
        10,
    },

    historyTitle: {
      flex: 1,
      color:
        "#c8ced7",
      fontSize:
        13,
      marginLeft:
        10,
    },

    deleteButton: {
      width: 42,
      height: 42,
      alignItems:
        "center",
      justifyContent:
        "center",
    },

    emptyText: {
      color:
        "#697484",
      textAlign:
        "center",
      fontSize:
        13,
      marginTop:
        30,
    },

    memoryRow: {
      flexDirection:
        "row",
      alignItems:
        "center",
      paddingVertical:
        13,
      borderBottomWidth:
        1,
      borderBottomColor:
        "#1d252f",
    },

    memoryTextBox: {
      flex: 1,
    },

    memoryKey: {
      color:
        "#8d99a8",
      fontSize:
        11,
      marginBottom:
        4,
    },

    memoryValue: {
      color:
        "#e1e5ea",
      fontSize:
        14,
      lineHeight:
        20,
    },

    emptyMemory: {
      alignItems:
        "center",
      marginTop:
        70,
    },


    /* -----------------------------------------------------
       SEARCH
    ----------------------------------------------------- */

    searchRow: {
      flexDirection:
        "row",
      alignItems:
        "center",
      marginBottom:
        13,
    },

    searchInput: {
      flex: 1,
      height:
        47,
      backgroundColor:
        "#171d25",
      borderWidth:
        1,
      borderColor:
        "#28323e",
      borderRadius:
        13,
      color:
        "#fff",
      paddingHorizontal:
        13,
      fontSize:
        14,
    },

    searchButton: {
      width: 47,
      height: 47,
      borderRadius:
        13,
      backgroundColor:
        "#25303c",
      alignItems:
        "center",
      justifyContent:
        "center",
      marginLeft:
        8,
    },

    resultCard: {
      flexDirection:
        "row",
      backgroundColor:
        "#141a22",
      borderWidth:
        1,
      borderColor:
        "#202a35",
      borderRadius:
        14,
      padding:
        12,
      marginBottom:
        9,
    },

    resultIcon: {
      width: 38,
      height: 38,
      borderRadius:
        11,
      backgroundColor:
        "#202a35",
      alignItems:
        "center",
      justifyContent:
        "center",
      marginRight:
        10,
    },

    resultTitle: {
      color:
        "#e8ecf1",
      fontSize:
        14,
      fontWeight:
        "600",
      lineHeight:
        19,
    },

    resultDescription: {
      color:
        "#8b96a5",
      fontSize:
        11,
      lineHeight:
        16,
      marginTop:
        4,
    },

    resultUrl: {
      color:
        "#607fa9",
      fontSize:
        9,
      marginTop:
        5,
    },

    youtubeIcon: {
      width: 43,
      height: 43,
      borderRadius:
        12,
      backgroundColor:
        "#27222a",
      alignItems:
        "center",
      justifyContent:
        "center",
      marginRight:
        10,
    },


    /* -----------------------------------------------------
       WEB
    ----------------------------------------------------- */

    webModal: {
      flex: 1,
      backgroundColor:
        "#0b0f14",
    },

    webHeader: {
      height:
        55,
      backgroundColor:
        "#11171f",
      flexDirection:
        "row",
      alignItems:
        "center",
      justifyContent:
        "space-between",
      paddingHorizontal:
        14,
      borderBottomWidth:
        1,
      borderBottomColor:
        "#222b35",
    },

    webHeaderTitle: {
      flex: 1,
      textAlign:
        "center",
      color:
        "#fff",
      fontSize:
        15,
      fontWeight:
        "600",
    },

    webLoading: {
      position:
        "absolute",
      left:
        0,
      right:
        0,
      top:
        55,
      bottom:
        0,
      alignItems:
        "center",
      justifyContent:
        "center",
      backgroundColor:
        "#0b0f14",
    },


    /* -----------------------------------------------------
       AUTH
    ----------------------------------------------------- */

    authScreen: {
      flex: 1,
      backgroundColor:
        "#0b0f14",
    },

    authContainer: {
      flex: 1,
      justifyContent:
        "center",
      paddingHorizontal:
        25,
    },

    authLogo: {
      alignSelf:
        "center",
      width: 88,
      height: 88,
      borderRadius:
        28,
      backgroundColor:
        "#171e28",
      borderWidth:
        1,
      borderColor:
        "#2a3440",
      alignItems:
        "center",
      justifyContent:
        "center",
      marginBottom:
        18,
    },

    authTitle: {
      color:
        "#fff",
      fontSize:
        31,
      fontWeight:
        "800",
      textAlign:
        "center",
    },

    authSubtitle: {
      color:
        "#788493",
      fontSize:
        14,
      textAlign:
        "center",
      marginTop:
        5,
      marginBottom:
        27,
    },

    authInputBox: {
      height:
        52,
      flexDirection:
        "row",
      alignItems:
        "center",
      backgroundColor:
        "#151b23",
      borderWidth:
        1,
      borderColor:
        "#27313d",
      borderRadius:
        14,
      paddingHorizontal:
        14,
      marginBottom:
        11,
    },

    authInput: {
      flex: 1,
      color:
        "#fff",
      fontSize:
        14,
      marginLeft:
        10,
    },

    authButton: {
      height:
        52,
      borderRadius:
        14,
      backgroundColor:
        "#fff",
      alignItems:
        "center",
      justifyContent:
        "center",
      marginTop:
        5,
    },

    authButtonText: {
      color:
        "#0b0f14",
      fontSize:
        15,
      fontWeight:
        "700",
    },

    authSwitch: {
      alignItems:
        "center",
      paddingVertical:
        18,
    },

    authSwitchText: {
      color:
        "#9aa5b4",
      fontSize:
        12,
    },

    authFooter: {
      color:
        "#4f5a68",
      fontSize:
        10,
      textAlign:
        "center",
      marginTop:
        25,
    },

  });
