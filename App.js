import React, { useEffect, useMemo, useRef, useState } from "react";

import {
  ActivityIndicator,
  Alert,
  FlatList,
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


// ============================================================
// GYAN AI
// ============================================================

const API_BASE = "https://gyan-ai-ef7h.onrender.com";

const STORAGE_USER = "@gyan_ai_user";
const STORAGE_TOKEN = "@gyan_ai_token";


// ============================================================
// SAFE JSON
// ============================================================

async function readJSON(response) {
  const text = await response.text();

  try {
    return JSON.parse(text);
  } catch {
    return {
      raw: text,
    };
  }
}


// ============================================================
// EXTRACT TEXT FROM MANY POSSIBLE BACKEND FORMATS
// ============================================================

function extractAnswer(data) {
  if (!data) return "";

  if (typeof data === "string") {
    return data;
  }

  const possible = [
    data.answer,
    data.response,
    data.reply,
    data.message,
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
    data.result?.answer,
    data.result?.response,
    data.result?.text,
  ];

  for (const value of possible) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}


// ============================================================
// URL EXTRACTION
// ============================================================

function extractUrls(text) {
  if (!text) return [];

  const regex =
    /(https?:\/\/[^\s<>"')\]]+)/gi;

  return text.match(regex) || [];
}


// ============================================================
// LINKIFIED TEXT
// ============================================================

function MessageText({ text, isUser, onOpenUrl }) {
  const parts = [];
  const regex =
    /(https?:\/\/[^\s<>"')\]]+)/gi;

  let last = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) {
      parts.push({
        type: "text",
        value: text.substring(last, match.index),
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
          isUser && styles.userMessageText,
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
        isUser && styles.userMessageText,
      ]}
    >
      {parts.map((part, index) =>
        part.type === "url" ? (
          <Text
            key={index}
            style={styles.linkText}
            onPress={() => onOpenUrl(part.value)}
          >
            {part.value}
          </Text>
        ) : (
          <Text key={index}>{part.value}</Text>
        )
      )}
    </Text>
  );
}


// ============================================================
// MAIN APP
// ============================================================

export default function App() {

  // ----------------------------------------------------------
  // AUTH
  // ----------------------------------------------------------

  const [user, setUser] = useState(null);
  const [token, setToken] = useState("");

  const [authMode, setAuthMode] = useState("login");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [authLoading, setAuthLoading] = useState(false);


  // ----------------------------------------------------------
  // CHAT
  // ----------------------------------------------------------

  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");

  const [loading, setLoading] = useState(false);

  const flatListRef = useRef(null);


  // ----------------------------------------------------------
  // HISTORY
  // ----------------------------------------------------------

  const [history, setHistory] = useState([]);

  const [historyVisible, setHistoryVisible] = useState(false);


  // ----------------------------------------------------------
  // MEMORY
  // ----------------------------------------------------------

  const [memories, setMemories] = useState([]);

  const [memoryVisible, setMemoryVisible] = useState(false);


  // ----------------------------------------------------------
  // SETTINGS
  // ----------------------------------------------------------

  const [settingsVisible, setSettingsVisible] = useState(false);

  const [darkMode, setDarkMode] = useState(true);


  // ----------------------------------------------------------
  // WEBVIEW
  // ----------------------------------------------------------

  const [webVisible, setWebVisible] = useState(false);
  const [webUrl, setWebUrl] = useState("");
  const [webTitle, setWebTitle] = useState("Web");


  // ----------------------------------------------------------
  // WEB SEARCH
  // ----------------------------------------------------------

  const [searchVisible, setSearchVisible] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);


  // ----------------------------------------------------------
  // YOUTUBE
  // ----------------------------------------------------------

  const [youtubeVisible, setYoutubeVisible] = useState(false);
  const [youtubeSearchVisible, setYoutubeSearchVisible] =
    useState(false);

  const [youtubeUrl, setYoutubeUrl] = useState(
    "https://www.youtube.com"
  );

  const [youtubeQuery, setYoutubeQuery] = useState("");
  const [youtubeResults, setYoutubeResults] = useState([]);
  const [youtubeLoading, setYoutubeLoading] = useState(false);


  // ----------------------------------------------------------
  // IMAGE EDIT
  // ----------------------------------------------------------

  const [imageEditVisible, setImageEditVisible] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePrompt, setImagePrompt] = useState("");
  const [imageEditLoading, setImageEditLoading] = useState(false);


  // ----------------------------------------------------------
  // MIC
  // ----------------------------------------------------------

  const [listening, setListening] = useState(false);


  // ----------------------------------------------------------
  // INITIAL LOAD
  // ----------------------------------------------------------

  useEffect(() => {
    loadStoredUser();
  }, []);


  async function loadStoredUser() {
    try {
      const storedUser =
        await AsyncStorage.getItem(STORAGE_USER);

      const storedToken =
        await AsyncStorage.getItem(STORAGE_TOKEN);

      if (storedUser) {
        setUser(JSON.parse(storedUser));
      }

      if (storedToken) {
        setToken(storedToken);
      }
    } catch (error) {
      console.log(error);
    }
  }


  // ==========================================================
  // AUTH
  // ==========================================================

  async function login() {

    if (!email.trim() || !password.trim()) {
      Alert.alert(
        "Gyan AI",
        "Email और password डालो।"
      );
      return;
    }

    setAuthLoading(true);

    try {

      const response = await fetch(
        `${API_BASE}/api/login`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: email.trim(),
            password,
          }),
        }
      );

      const data = await readJSON(response);

      if (!response.ok) {
        throw new Error(
          data.message ||
          data.error ||
          "Login failed"
        );
      }

      const loggedUser =
        data.user ||
        data.data?.user ||
        data;

      const authToken =
        data.token ||
        data.access_token ||
        data.data?.token ||
        "";

      setUser(loggedUser);
      setToken(authToken);

      await AsyncStorage.setItem(
        STORAGE_USER,
        JSON.stringify(loggedUser)
      );

      if (authToken) {
        await AsyncStorage.setItem(
          STORAGE_TOKEN,
          authToken
        );
      }

      setPassword("");

      await loadHistory(loggedUser);
      await loadMemories(loggedUser);

    } catch (error) {

      Alert.alert(
        "Login error",
        error.message
      );

    } finally {
      setAuthLoading(false);
    }
  }


  async function register() {

    if (
      !name.trim() ||
      !email.trim() ||
      !password.trim()
    ) {
      Alert.alert(
        "Gyan AI",
        "Name, email और password डालो।"
      );
      return;
    }

    setAuthLoading(true);

    try {

      const response = await fetch(
        `${API_BASE}/api/register`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: name.trim(),
            email: email.trim(),
            password,
          }),
        }
      );

      const data = await readJSON(response);

      if (!response.ok) {
        throw new Error(
          data.message ||
          data.error ||
          "Registration failed"
        );
      }

      Alert.alert(
        "Gyan AI",
        "Account बन गया। अब Login करो।"
      );

      setAuthMode("login");
      setPassword("");

    } catch (error) {

      Alert.alert(
        "Register error",
        error.message
      );

    } finally {
      setAuthLoading(false);
    }
  }


  async function logout() {

    try {

      if (token) {
        await fetch(
          `${API_BASE}/api/logout`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        );
      }

    } catch {}

    await AsyncStorage.removeItem(STORAGE_USER);
    await AsyncStorage.removeItem(STORAGE_TOKEN);

    setUser(null);
    setToken("");
    setMessages([]);
    setHistory([]);
    setMemories([]);
  }


  // ==========================================================
  // USER ID
  // ==========================================================

  function getUserId() {

    if (!user) return "";

    return (
      user.id ||
      user.user_id ||
      user.username ||
      user.email ||
      ""
    );
  }


  // ==========================================================
  // COMMON HEADERS
  // ==========================================================

  function authHeaders() {

    const headers = {
      "Content-Type": "application/json",
    };

    if (token) {
      headers.Authorization =
        `Bearer ${token}`;
    }

    return headers;
  }


  // ==========================================================
  // HISTORY
  // ==========================================================

  async function loadHistory(currentUser = user) {

    if (!currentUser) return;

    try {

      const response = await fetch(
        `${API_BASE}/api/history`,
        {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({
            user_id:
              currentUser.id ||
              currentUser.user_id ||
              currentUser.email,
          }),
        }
      );

      const data = await readJSON(response);

      const list =
        Array.isArray(data)
          ? data
          : data.history ||
            data.data ||
            data.conversations ||
            [];

      setHistory(list);

    } catch (error) {
      console.log("history", error);
    }
  }


  async function openHistoryItem(item) {

    const id =
      item.id ||
      item.conversation_id ||
      item.chat_id;

    if (!id) return;

    try {

      const response = await fetch(
        `${API_BASE}/api/history/${id}`,
        {
          headers: authHeaders(),
        }
      );

      const data = await readJSON(response);

      const list =
        data.messages ||
        data.history ||
        data.data ||
        [];

      const normalized = Array.isArray(list)
        ? list.map((m, index) => ({
            id:
              m.id ||
              `${Date.now()}-${index}`,
            role:
              m.role ||
              m.sender ||
              (m.user ? "user" : "assistant"),
            content:
              m.content ||
              m.message ||
              m.text ||
              m.answer ||
              "",
          }))
        : [];

      setMessages(normalized);
      setHistoryVisible(false);

      setTimeout(() => {
        flatListRef.current?.scrollToEnd({
          animated: false,
        });
      }, 200);

    } catch (error) {

      Alert.alert(
        "History",
        "Chat history load नहीं हो सकी।"
      );

    }
  }


  async function deleteHistoryItem(item) {

    const id =
      item.id ||
      item.conversation_id ||
      item.chat_id;

    if (!id) return;

    Alert.alert(
      "Delete chat?",
      "क्या यह chat delete करनी है?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {

            try {

              await fetch(
                `${API_BASE}/api/history/${id}`,
                {
                  method: "DELETE",
                  headers: authHeaders(),
                }
              );

              await loadHistory();

            } catch {}
          },
        },
      ]
    );
  }


  // ==========================================================
  // MEMORY
  // ==========================================================

  async function loadMemories(currentUser = user) {

    if (!currentUser) return;

    try {

      const response = await fetch(
        `${API_BASE}/api/memory`,
        {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({
            user_id:
              currentUser.id ||
              currentUser.user_id ||
              currentUser.email,
          }),
        }
      );

      const data = await readJSON(response);

      const list =
        Array.isArray(data)
          ? data
          : data.memories ||
            data.data ||
            [];

      setMemories(list);

    } catch (error) {
      console.log("memory", error);
    }
  }


  async function deleteMemory(memory) {

    const id =
      memory.id ||
      memory.memory_id;

    if (!id) return;

    try {

      await fetch(
        `${API_BASE}/api/memory/${id}`,
        {
          method: "DELETE",
          headers: authHeaders(),
        }
      );

      await loadMemories();

    } catch {}
  }


  // ==========================================================
  // NEW CHAT
  // ==========================================================

  function newChat() {

    setMessages([]);
    setText("");

    setTimeout(() => {
      flatListRef.current?.scrollToOffset({
        offset: 0,
        animated: false,
      });
    }, 100);
  }


  // ==========================================================
  // WEB SEARCH
  // ==========================================================

  async function performWebSearch(query) {

    if (!query.trim()) return [];

    try {

      const response = await fetch(
        `${API_BASE}/api/web-search`,
        {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({
            user_id: getUserId(),
            query: query.trim(),
          }),
        }
      );

      const data = await readJSON(response);

      const results =
        data.results ||
        data.data ||
        data.items ||
        data.search_results ||
        [];

      return Array.isArray(results)
        ? results
        : [];

    } catch (error) {

      console.log(
        "web search error",
        error
      );

      return [];
    }
  }


  async function runManualSearch() {

    if (!searchText.trim()) return;

    setSearchLoading(true);

    const results =
      await performWebSearch(searchText);

    setSearchResults(results);
    setSearchLoading(false);
  }


  // ==========================================================
  // YOUTUBE SEARCH
  // ==========================================================

  async function performYoutubeSearch(query) {

    if (!query.trim()) return [];

    try {

      const response = await fetch(
        `${API_BASE}/api/youtube-search`,
        {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({
            user_id: getUserId(),
            query: query.trim(),
          }),
        }
      );

      const data = await readJSON(response);

      const results =
        data.results ||
        data.data ||
        data.items ||
        [];

      return Array.isArray(results)
        ? results
        : [];

    } catch (error) {

      console.log(
        "youtube error",
        error
      );

      return [];
    }
  }


  async function runYoutubeSearch() {

    if (!youtubeQuery.trim()) return;

    setYoutubeLoading(true);

    const results =
      await performYoutubeSearch(
        youtubeQuery
      );

    setYoutubeResults(results);
    setYoutubeLoading(false);
  }


  // ==========================================================
  // CHAT
  // ==========================================================

  async function sendMessage(customText = null) {

    const message =
      customText !== null
        ? customText
        : text.trim();

    if (!message || loading) return;

    setText("");

    const userMessage = {
      id:
        `user-${Date.now()}`,
      role: "user",
      content: message,
    };

    setMessages(prev => [
      ...prev,
      userMessage,
    ]);

    setLoading(true);

    try {

      // ------------------------------------------------------
      // FIRST WEB SEARCH
      // ------------------------------------------------------

      let webResults = [];

      if (shouldSearchWeb(message)) {
        webResults =
          await performWebSearch(message);
      }


      // ------------------------------------------------------
      // CHAT HISTORY
      // ------------------------------------------------------

      const previousMessages =
        messages
          .slice(-20)
          .map(m => ({
            role: m.role,
            content: m.content,
          }));


      // ------------------------------------------------------
      // CHAT REQUEST
      // ------------------------------------------------------

      const response = await fetch(
        `${API_BASE}/api/chat`,
        {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({

            user_id: getUserId(),

            message,

            prompt: message,

            history: previousMessages,

            web_search:
              webResults.length > 0,

            web_results:
              webResults,

          }),
        }
      );

      const data = await readJSON(response);

      if (!response.ok) {

        throw new Error(
          data.message ||
          data.error ||
          "AI service error"
        );
      }

      let answer =
        extractAnswer(data);

      // ------------------------------------------------------
      // FALLBACK
      // ------------------------------------------------------

      if (!answer) {

        answer =
          "अभी AI service से उत्तर नहीं मिल पाया। कृपया थोड़ी देर बाद फिर कोशिश करें।";
      }


      const assistantMessage = {
        id:
          `assistant-${Date.now()}`,
        role: "assistant",
        content: answer,
        webResults,
      };

      setMessages(prev => [
        ...prev,
        assistantMessage,
      ]);

    } catch (error) {

      console.log(
        "CHAT ERROR:",
        error
      );

      setMessages(prev => [
        ...prev,
        {
          id:
            `error-${Date.now()}`,
          role: "assistant",
          content:
            "अभी AI service से उत्तर नहीं मिल पाया। कृपया दोबारा कोशिश करें।",
        },
      ]);

    } finally {

      setLoading(false);

      setTimeout(() => {
        flatListRef.current?.scrollToEnd({
          animated: true,
        });
      }, 150);
    }
  }


  // ==========================================================
  // SHOULD SEARCH WEB
  // ==========================================================

  function shouldSearchWeb(message) {

    const q =
      message.toLowerCase();

    const keywords = [

      "latest",
      "today",
      "news",
      "current",
      "weather",
      "price",
      "who is",
      "what is today",
      "search",
      "website",
      "youtube",
      "link",
      "2026",

      "आज",
      "अभी",
      "लेटेस्ट",
      "न्यूज़",
      "समाचार",
      "मौसम",
      "कीमत",
      "खोजो",
      "सर्च",
      "लिंक",

    ];

    return keywords.some(
      word => q.includes(word)
    );
  }


  // ==========================================================
  // COPY
  // ==========================================================

  async function copyAnswer(content) {

    try {

      await Clipboard.setStringAsync(
        content
      );

      Alert.alert(
        "Copied",
        "Answer copy हो गया।"
      );

    } catch {

      Alert.alert(
        "Copy",
        "Copy नहीं हो पाया।"
      );
    }
  }


  // ==========================================================
  // SPEAK
  // ==========================================================

  function speakAnswer(content) {

    Speech.stop();

    Speech.speak(content, {
      language: "hi-IN",
      rate: 0.9,
      pitch: 1.0,
    });
  }


  // ==========================================================
  // SHARE
  // ==========================================================

  async function shareAnswer(content) {

    try {

      await Share.share({
        message: content,
      });

    } catch {}
  }


  // ==========================================================
  // MIC
  // ==========================================================

  useSpeechRecognitionEvent(
    "result",
    event => {

      const result =
        event.results?.[0]?.transcript;

      if (result) {
        setText(result);
      }
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
    event => {

      console.log(
        "Speech error",
        event
      );

      setListening(false);
    }
  );


  async function toggleMic() {

    try {

      if (listening) {

        ExpoSpeechRecognitionModule.stop();

        setListening(false);

        return;
      }

      await ExpoSpeechRecognitionModule.requestPermissionsAsync();

      ExpoSpeechRecognitionModule.start({
        lang: "hi-IN",
        interimResults: true,
        continuous: false,
      });

      setListening(true);

    } catch (error) {

      Alert.alert(
        "Voice",
        "Voice input इस build में उपलब्ध नहीं है।"
      );

      console.log(error);
    }
  }


  // ==========================================================
  // URL OPEN INSIDE GYAN AI
  // ==========================================================

  function openUrl(url) {

    if (!url) return;

    setWebUrl(url);
    setWebTitle("Web");
    setWebVisible(true);
  }


  // ==========================================================
  // CAMERA
  // ==========================================================

  async function openCamera() {

    try {

      const permission =
        await ImagePicker.requestCameraPermissionsAsync();

      if (!permission.granted) {

        Alert.alert(
          "Camera",
          "Camera permission चाहिए।"
        );

        return;
      }

      const result =
        await ImagePicker.launchCameraAsync({
          mediaTypes: ["images"],
          quality: 0.9,
        });

      if (
        !result.canceled &&
        result.assets?.[0]?.uri
      ) {

        setSelectedImage(
          result.assets[0]
        );

        setImageEditVisible(true);
      }

    } catch (error) {

      console.log(error);
    }
  }


  // ==========================================================
  // GALLERY
  // ==========================================================

  async function openGallery() {

    try {

      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {

        Alert.alert(
          "Gallery",
          "Gallery permission चाहिए।"
        );

        return;
      }

      const result =
        await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          quality: 0.9,
        });

      if (
        !result.canceled &&
        result.assets?.[0]?.uri
      ) {

        setSelectedImage(
          result.assets[0]
        );

        setImageEditVisible(true);
      }

    } catch (error) {

      console.log(error);
    }
  }


  // ==========================================================
  // FILE PICKER
  // ==========================================================

  async function openFilePicker() {

    try {

      const result =
        await DocumentPicker.getDocumentAsync({
          copyToCacheDirectory: true,
          multiple: false,
        });

      if (
        !result.canceled &&
        result.assets?.[0]
      ) {

        const file =
          result.assets[0];

        Alert.alert(
          "File selected",
          file.name ||
            "File selected successfully."
        );
      }

    } catch (error) {

      console.log(error);
    }
  }


  // ==========================================================
  // IMAGE EDIT
  // ==========================================================

  async function runImageEdit() {

    if (!selectedImage?.uri) {

      Alert.alert(
        "Image",
        "पहले image चुनो।"
      );

      return;
    }

    if (!imagePrompt.trim()) {

      Alert.alert(
        "Image edit",
        "बताओ image में क्या बदलना है।"
      );

      return;
    }

    setImageEditLoading(true);

    try {

      const formData =
        new FormData();

      formData.append(
        "user_id",
        getUserId()
      );

      formData.append(
        "prompt",
        imagePrompt.trim()
      );

      formData.append(
        "image",
        {
          uri: selectedImage.uri,
          name:
            selectedImage.fileName ||
            "image.jpg",
          type:
            selectedImage.mimeType ||
            "image/jpeg",
        }
      );

      const response =
        await fetch(
          `${API_BASE}/api/image-edit`,
          {
            method: "POST",
            headers: token
              ? {
                  Authorization:
                    `Bearer ${token}`,
                }
              : {},
            body: formData,
          }
        );

      const data =
        await readJSON(response);

      if (!response.ok) {

        throw new Error(
          data.message ||
          data.error ||
          "Image edit failed"
        );
      }

      const resultText =
        extractAnswer(data) ||
        data.image_url ||
        data.url ||
        data.result_url ||
        "";

      setImageEditVisible(false);
      setImagePrompt("");

      if (resultText) {

        setMessages(prev => [
          ...prev,
          {
            id:
              `image-${Date.now()}`,
            role: "assistant",
            content:
              `Image edit result:\n${resultText}`,
          },
        ]);

      } else {

        Alert.alert(
          "Image Edit",
          "Image edit request सफल हुआ।"
        );
      }

    } catch (error) {

      Alert.alert(
        "Image Edit",
        error.message
      );

    } finally {

      setImageEditLoading(false);
    }
  }


  // ==========================================================
  // PLUS MENU
  // ==========================================================

  function PlusMenu() {

    return (
      <View style={styles.plusMenu}>

        <TouchableOpacity
          style={styles.plusItem}
          onPress={openCamera}
        >
          <Ionicons
            name="camera-outline"
            size={22}
            color="#fff"
          />

          <Text style={styles.plusText}>
            Camera
          </Text>
        </TouchableOpacity>


        <TouchableOpacity
          style={styles.plusItem}
          onPress={openGallery}
        >
          <Ionicons
            name="image-outline"
            size={22}
            color="#fff"
          />

          <Text style={styles.plusText}>
            Gallery
          </Text>
        </TouchableOpacity>


        <TouchableOpacity
          style={styles.plusItem}
          onPress={openFilePicker}
        >
          <Ionicons
            name="document-outline"
            size={22}
            color="#fff"
          />

          <Text style={styles.plusText}>
            File
          </Text>
        </TouchableOpacity>


        <TouchableOpacity
          style={styles.plusItem}
          onPress={() => {
            setYoutubeSearchVisible(true);
          }}
        >
          <Ionicons
            name="logo-youtube"
            size={22}
            color="#fff"
          />

          <Text style={styles.plusText}>
            YouTube
          </Text>
        </TouchableOpacity>


        <TouchableOpacity
          style={styles.plusItem}
          onPress={() => {
            setSearchVisible(true);
          }}
        >
          <Ionicons
            name="globe-outline"
            size={22}
            color="#fff"
          />

          <Text style={styles.plusText}>
            Web Search
          </Text>
        </TouchableOpacity>

      </View>
    );
  }


  // ==========================================================
  // RENDER MESSAGE
  // ==========================================================

  function renderMessage({
    item,
  }) {

    const isUser =
      item.role === "user";

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
              size={20}
              color="#fff"
            />
          </View>
        )}


        <View
          style={[
            styles.messageBubble,
            isUser &&
              styles.userBubble,
          ]}
        >

          <MessageText
            text={
              item.content ||
              ""
            }
            isUser={isUser}
            onOpenUrl={openUrl}
          />


          {!isUser && (
            <View style={styles.answerActions}>

              <TouchableOpacity
                onPress={() =>
                  copyAnswer(item.content)
                }
              >
                <Ionicons
                  name="copy-outline"
                  size={17}
                  color="#9da7b5"
                />
              </TouchableOpacity>


              <TouchableOpacity
                onPress={() =>
                  speakAnswer(item.content)
                }
              >
                <Ionicons
                  name="volume-medium-outline"
                  size={18}
                  color="#9da7b5"
                />
              </TouchableOpacity>


              <TouchableOpacity>
                <Ionicons
                  name="thumbs-up-outline"
                  size={17}
                  color="#9da7b5"
                />
              </TouchableOpacity>


              <TouchableOpacity>
                <Ionicons
                  name="thumbs-down-outline"
                  size={17}
                  color="#9da7b5"
                />
              </TouchableOpacity>


              <TouchableOpacity
                onPress={() =>
                  shareAnswer(item.content)
                }
              >
                <Ionicons
                  name="share-outline"
                  size={17}
                  color="#9da7b5"
                />
              </TouchableOpacity>


              <TouchableOpacity
                onPress={() => {

                  setMessages(prev =>
                    prev.filter(
                      m =>
                        m.id !== item.id
                    )
                  );

                }}
              >
                <Ionicons
                  name="trash-outline"
                  size={17}
                  color="#9da7b5"
                />
              </TouchableOpacity>

            </View>
          )}

        </View>
      </View>
    );
  }


  // ==========================================================
  // CHAT SCREEN
  // ==========================================================

  function ChatScreen() {

    return (
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={
          Platform.OS === "ios"
            ? "padding"
            : "height"
        }
        keyboardVerticalOffset={0}
      >

        <View style={styles.header}>

          <TouchableOpacity
            onPress={() =>
              setHistoryVisible(true)
            }
          >
            <Ionicons
              name="menu-outline"
              size={28}
              color="#fff"
            />
          </TouchableOpacity>


          <Text style={styles.headerTitle}>
            Gyan AI
          </Text>


          <View style={styles.headerRight}>

            <TouchableOpacity
              onPress={newChat}
              style={styles.headerButton}
            >
              <Ionicons
                name="add"
                size={24}
                color="#fff"
              />
            </TouchableOpacity>


            <TouchableOpacity
              onPress={() =>
                setSettingsVisible(true)
              }
              style={styles.headerButton}
            >
              <Ionicons
                name="settings-outline"
                size={22}
                color="#fff"
              />
            </TouchableOpacity>

          </View>

        </View>


        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={item =>
            String(item.id)
          }
          renderItem={renderMessage}
          contentContainerStyle={[
            styles.chatContent,
            messages.length === 0 &&
              styles.emptyChatContent,
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.welcome}>

              <View style={styles.bigLogo}>
                <MaterialCommunityIcons
                  name="brain"
                  size={45}
                  color="#fff"
                />
              </View>

              <Text style={styles.welcomeTitle}>
                Hi, I'm Gyan AI
              </Text>

              <Text style={styles.welcomeText}>
                Ask me anything
              </Text>

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


  // ==========================================================
  // INPUT BAR
  // ==========================================================

  function InputBar() {

    const [plusVisible, setPlusVisible] =
      useState(false);

    return (
      <View style={styles.inputArea}>

        {plusVisible && (
          <PlusMenu />
        )}


        <View style={styles.inputRow}>

          <TouchableOpacity
            style={styles.roundButton}
            onPress={() =>
              setPlusVisible(
                !plusVisible
              )
            }
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


          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder={
              listening
                ? "सुन रहा हूँ..."
                : "Message Gyan AI..."
            }
            placeholderTextColor="#788291"
            multiline
            maxLength={8000}
            onFocus={() =>
              setPlusVisible(false)
            }
          />


          <TouchableOpacity
            style={[
              styles.micButton,
              listening &&
                styles.micActive,
            ]}
            onPress={toggleMic}
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
            style={styles.sendButton}
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


  // ==========================================================
  // HISTORY MODAL
  // ==========================================================

  function HistoryModal() {

    return (
      <Modal
        visible={historyVisible}
        animationType="slide"
        transparent
        onRequestClose={() =>
          setHistoryVisible(false)
        }
      >

        <View style={styles.modalOverlay}>

          <View style={styles.sideModal}>

            <View style={styles.modalHeader}>

              <Text style={styles.modalTitle}>
                Chat History
              </Text>

              <TouchableOpacity
                onPress={() =>
                  setHistoryVisible(false)
                }
              >
                <Ionicons
                  name="close"
                  size={26}
                  color="#fff"
                />
              </TouchableOpacity>

            </View>


            <TouchableOpacity
              style={styles.newChatButton}
              onPress={() => {
                newChat();
                setHistoryVisible(false);
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
              data={history}
              keyExtractor={(item, index) =>
                String(
                  item.id ||
                  item.conversation_id ||
                  index
                )
              }
              renderItem={({ item }) => (

                <View style={styles.historyRow}>

                  <TouchableOpacity
                    style={styles.historyMain}
                    onPress={() =>
                      openHistoryItem(item)
                    }
                  >

                    <Ionicons
                      name="chatbubble-outline"
                      size={19}
                      color="#9da7b5"
                    />

                    <Text
                      style={styles.historyTitle}
                      numberOfLines={2}
                    >
                      {
                        item.title ||
                        item.name ||
                        item.first_message ||
                        item.message ||
                        "Chat"
                      }
                    </Text>

                  </TouchableOpacity>


                  <TouchableOpacity
                    onPress={() =>
                      deleteHistoryItem(item)
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


  // ==========================================================
  // MEMORY MODAL
  // ==========================================================

  function MemoryModal() {

    return (
      <Modal
        visible={memoryVisible}
        animationType="slide"
        transparent
        onRequestClose={() =>
          setMemoryVisible(false)
        }
      >

        <View style={styles.modalOverlay}>

          <View style={styles.centerModal}>

            <View style={styles.modalHeader}>

              <Text style={styles.modalTitle}>
                Memory
              </Text>

              <TouchableOpacity
                onPress={() =>
                  setMemoryVisible(false)
                }
              >
                <Ionicons
                  name="close"
                  size={26}
                  color="#fff"
                />
              </TouchableOpacity>

            </View>


            <FlatList
              data={memories}
              keyExtractor={(item, index) =>
                String(
                  item.id ||
                  item.memory_id ||
                  index
                )
              }
              renderItem={({ item }) => (

                <View style={styles.memoryRow}>

                  <View style={styles.memoryTextBox}>

                    <Text style={styles.memoryKey}>
                      {
                        item.memory_key ||
                        item.key ||
                        "Memory"
                      }
                    </Text>

                    <Text style={styles.memoryValue}>
                      {
                        item.memory_value ||
                        item.value ||
                        item.content ||
                        item.text ||
                        ""
                      }
                    </Text>

                  </View>


                  <TouchableOpacity
                    onPress={() =>
                      deleteMemory(item)
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
                <Text style={styles.emptyText}>
                  अभी कोई memory नहीं है।
                </Text>
              }
            />

          </View>

        </View>

      </Modal>
    );
  }


  // ==========================================================
  // SETTINGS
  // ==========================================================

  function SettingsModal() {

    return (
      <Modal
        visible={settingsVisible}
        animationType="slide"
        transparent
        onRequestClose={() =>
          setSettingsVisible(false)
        }
      >

        <View style={styles.modalOverlay}>

          <View style={styles.centerModal}>

            <View style={styles.modalHeader}>

              <Text style={styles.modalTitle}>
                Settings
              </Text>

              <TouchableOpacity
                onPress={() =>
                  setSettingsVisible(false)
                }
              >
                <Ionicons
                  name="close"
                  size={26}
                  color="#fff"
                />
              </TouchableOpacity>

            </View>


            <View style={styles.profileBox}>

              <View style={styles.profileAvatar}>
                <Text style={styles.profileLetter}>
                  {
                    (
                      user?.name ||
                      user?.email ||
                      "G"
                    )[0]
                  }
                </Text>
              </View>

              <View>

                <Text style={styles.profileName}>
                  {
                    user?.name ||
                    "Gyan AI User"
                  }
                </Text>

                <Text style={styles.profileEmail}>
                  {
                    user?.email ||
                    ""
                  }
                </Text>

              </View>

            </View>


            <TouchableOpacity
              style={styles.settingRow}
              onPress={() => {
                setSettingsVisible(false);
                setMemoryVisible(true);
              }}
            >

              <Ionicons
                name="brain-outline"
                size={22}
                color="#fff"
              />

              <Text style={styles.settingText}>
                Memory
              </Text>

              <Ionicons
                name="chevron-forward"
                size={19}
                color="#777"
              />

            </TouchableOpacity>


            <View style={styles.settingRow}>

              <Ionicons
                name="moon-outline"
                size={22}
                color="#fff"
              />

              <Text style={styles.settingText}>
                Dark mode
              </Text>

              <TouchableOpacity
                onPress={() =>
                  setDarkMode(!darkMode)
                }
              >
                <Ionicons
                  name={
                    darkMode
                      ? "toggle"
                      : "toggle-outline"
                  }
                  size={30}
                  color="#fff"
                />
              </TouchableOpacity>

            </View>


            <TouchableOpacity
              style={styles.logoutButton}
              onPress={logout}
            >

              <Ionicons
                name="log-out-outline"
                size={21}
                color="#ff6b6b"
              />

              <Text style={styles.logoutText}>
                Logout
              </Text>

            </TouchableOpacity>

          </View>

        </View>

      </Modal>
    );
  }


  // ==========================================================
  // WEB SEARCH MODAL
  // ==========================================================

  function SearchModal() {

    return (
      <Modal
        visible={searchVisible}
        animationType="slide"
        transparent
        onRequestClose={() =>
          setSearchVisible(false)
        }
      >

        <View style={styles.modalOverlay}>

          <View style={styles.centerModal}>

            <View style={styles.modalHeader}>

              <Text style={styles.modalTitle}>
                Web Search
              </Text>

              <TouchableOpacity
                onPress={() =>
                  setSearchVisible(false)
                }
              >
                <Ionicons
                  name="close"
                  size={26}
                  color="#fff"
                />
              </TouchableOpacity>

            </View>


            <View style={styles.searchRow}>

              <TextInput
                value={searchText}
                onChangeText={setSearchText}
                placeholder="Search the web..."
                placeholderTextColor="#777"
                style={styles.searchInput}
                onSubmitEditing={
                  runManualSearch
                }
              />

              <TouchableOpacity
                style={styles.searchButton}
                onPress={runManualSearch}
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
                  margin: 20,
                }}
              />
            )}


            <FlatList
              data={searchResults}
              keyExtractor={(item, index) =>
                String(
                  item.id ||
                  item.url ||
                  index
                )
              }
              renderItem={({ item }) => (

                <TouchableOpacity
                  style={styles.resultCard}
                  onPress={() =>
                    openUrl(
                      item.url ||
                      item.link ||
                      item.href
                    )
                  }
                >

                  <Text style={styles.resultTitle}>
                    {
                      item.title ||
                      item.name ||
                      "Web result"
                    }
                  </Text>

                  <Text style={styles.resultDescription}>
                    {
                      item.description ||
                      item.snippet ||
                      ""
                    }
                  </Text>

                  <Text style={styles.resultUrl}>
                    {
                      item.url ||
                      item.link ||
                      ""
                    }
                  </Text>

                </TouchableOpacity>

              )}
            />

          </View>

        </View>

      </Modal>
    );
  }


  // ==========================================================
  // YOUTUBE SEARCH MODAL
  // ==========================================================

  function YoutubeSearchModal() {

    return (
      <Modal
        visible={youtubeSearchVisible}
        animationType="slide"
        transparent
        onRequestClose={() =>
          setYoutubeSearchVisible(false)
        }
      >

        <View style={styles.modalOverlay}>

          <View style={styles.centerModal}>

            <View style={styles.modalHeader}>

              <Text style={styles.modalTitle}>
                YouTube
              </Text>

              <TouchableOpacity
                onPress={() =>
                  setYoutubeSearchVisible(false)
                }
              >
                <Ionicons
                  name="close"
                  size={26}
                  color="#fff"
                />
              </TouchableOpacity>

            </View>


            <View style={styles.searchRow}>

              <TextInput
                value={youtubeQuery}
                onChangeText={setYoutubeQuery}
                placeholder="Search YouTube..."
                placeholderTextColor="#777"
                style={styles.searchInput}
                onSubmitEditing={
                  runYoutubeSearch
                }
              />

              <TouchableOpacity
                style={styles.searchButton}
                onPress={runYoutubeSearch}
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
                  margin: 20,
                }}
              />
            )}


            <FlatList
              data={youtubeResults}
              keyExtractor={(item, index) =>
                String(
                  item.id ||
                  item.videoId ||
                  index
                )
              }
              renderItem={({ item }) => {

                const videoUrl =
                  item.url ||
                  item.link ||
                  (
                    item.videoId
                      ? `https://www.youtube.com/watch?v=${item.videoId}`
                      : "https://www.youtube.com"
                  );

                return (
                  <TouchableOpacity
                    style={styles.resultCard}
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
                        size={27}
                        color="#fff"
                      />
                    </View>

                    <View style={{
                      flex: 1,
                    }}>

                      <Text
                        style={styles.resultTitle}
                        numberOfLines={2}
                      >
                        {
                          item.title ||
                          item.name ||
                          "YouTube video"
                        }
                      </Text>

                      <Text
                        style={styles.resultDescription}
                        numberOfLines={2}
                      >
                        {
                          item.description ||
                          item.channel ||
                          ""
                        }
                      </Text>

                    </View>

                  </TouchableOpacity>
                );
              }}
            />

          </View>

        </View>

      </Modal>
    );
  }


  // ==========================================================
  // WEBVIEW
  // ==========================================================

  function WebModal() {

    return (
      <Modal
        visible={webVisible}
        animationType="slide"
        onRequestClose={() =>
          setWebVisible(false)
        }
      >

        <SafeAreaView
          style={styles.webContainer}
        >

          <View style={styles.webHeader}>

            <TouchableOpacity
              onPress={() =>
                setWebVisible(false)
              }
            >
              <Ionicons
                name="close"
                size={27}
                color="#fff"
              />
            </TouchableOpacity>

            <Text
              style={styles.webTitle}
              numberOfLines={1}
            >
              {webTitle}
            </Text>

            <View style={{ width: 27 }} />

          </View>


          <WebView
            source={{
              uri:
                webUrl ||
                "https://www.google.com",
            }}
            style={{
              flex: 1,
            }}
            javaScriptEnabled
            domStorageEnabled
            startInLoadingState
            onShouldStartLoadWithRequest={() =>
              true
            }
          />

        </SafeAreaView>

      </Modal>
    );
  }


  // ==========================================================
  // YOUTUBE WEBVIEW
  // ==========================================================

  function YoutubeModal() {

    return (
      <Modal
        visible={youtubeVisible}
        animationType="slide"
        onRequestClose={() =>
          setYoutubeVisible(false)
        }
      >

        <SafeAreaView
          style={styles.webContainer}
        >

          <View style={styles.webHeader}>

            <TouchableOpacity
              onPress={() =>
                setYoutubeVisible(false)
              }
            >
              <Ionicons
                name="close"
                size={27}
                color="#fff"
              />
            </TouchableOpacity>

            <Text style={styles.webTitle}>
              YouTube
            </Text>

            <View style={{ width: 27 }} />

          </View>


          <WebView
            source={{
              uri:
                youtubeUrl ||
                "https://www.youtube.com",
            }}
            style={{
              flex: 1,
            }}
            javaScriptEnabled
            domStorageEnabled
            mediaPlaybackRequiresUserAction={false}
            allowsInlineMediaPlayback
            startInLoadingState
            onShouldStartLoadWithRequest={() =>
              true
            }
          />

        </SafeAreaView>

      </Modal>
    );
  }


  // ==========================================================
  // IMAGE EDIT MODAL
  // ==========================================================

  function ImageEditModal() {

    return (
      <Modal
        visible={imageEditVisible}
        animationType="slide"
        transparent
        onRequestClose={() =>
          setImageEditVisible(false)
        }
      >

        <View style={styles.modalOverlay}>

          <View style={styles.centerModal}>

            <View style={styles.modalHeader}>

              <Text style={styles.modalTitle}>
                Edit Image
              </Text>

              <TouchableOpacity
                onPress={() =>
                  setImageEditVisible(false)
                }
              >
                <Ionicons
                  name="close"
                  size={26}
                  color="#fff"
                />
              </TouchableOpacity>

            </View>


            <View style={styles.imagePreviewBox}>

              <Ionicons
                name="image-outline"
                size={50}
                color="#888"
              />

              <Text style={styles.emptyText}>
                Image selected
              </Text>

            </View>


            <TextInput
              style={styles.imagePrompt}
              value={imagePrompt}
              onChangeText={setImagePrompt}
              placeholder="Image में क्या बदलना है?"
              placeholderTextColor="#777"
              multiline
            />


            <TouchableOpacity
              style={styles.primaryButton}
              onPress={runImageEdit}
              disabled={imageEditLoading}
            >

              {imageEditLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons
                    name="sparkles-outline"
                    size={20}
                    color="#fff"
                  />

                  <Text style={styles.primaryButtonText}>
                    Edit Image
                  </Text>
                </>
              )}

            </TouchableOpacity>

          </View>

        </View>

      </Modal>
    );
  }


  // ==========================================================
  // AUTH SCREEN
  // ==========================================================

  function AuthScreen() {

    return (
      <SafeAreaView
        style={styles.authContainer}
      >

        <StatusBar style="light" />


        <View style={styles.authLogo}>

          <MaterialCommunityIcons
            name="brain"
            size={58}
            color="#fff"
          />

        </View>


        <Text style={styles.authTitle}>
          Gyan AI
        </Text>

        <Text style={styles.authSubtitle}>
          Your intelligent AI assistant
        </Text>


        <View style={styles.authCard}>

          {authMode === "register" && (
            <TextInput
              style={styles.authInput}
              placeholder="Name"
              placeholderTextColor="#777"
              value={name}
              onChangeText={setName}
            />
          )}


          <TextInput
            style={styles.authInput}
            placeholder="Email"
            placeholderTextColor="#777"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />


          <TextInput
            style={styles.authInput}
            placeholder="Password"
            placeholderTextColor="#777"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />


          <TouchableOpacity
            style={styles.authButton}
            onPress={
              authMode === "login"
                ? login
                : register
            }
            disabled={authLoading}
          >

            {authLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.authButtonText}>
                {
                  authMode === "login"
                    ? "Login"
                    : "Create account"
                }
              </Text>
            )}

          </TouchableOpacity>


          <TouchableOpacity
            onPress={() => {

              setAuthMode(
                authMode === "login"
                  ? "register"
                  : "login"
              );

            }}
          >

            <Text style={styles.authSwitch}>
              {
                authMode === "login"
                  ? "New user? Create account"
                  : "Already have an account? Login"
              }
            </Text>

          </TouchableOpacity>

        </View>

      </SafeAreaView>
    );
  }


  // ==========================================================
  // MAIN RETURN
  // ==========================================================

  if (!user) {
    return <AuthScreen />;
  }


  return (
    <SafeAreaView
      style={[
        styles.container,
        darkMode
          ? styles.darkContainer
          : styles.lightContainer,
      ]}
    >

      <StatusBar style="light" />

      <ChatScreen />

      <HistoryModal />

      <MemoryModal />

      <SettingsModal />

      <SearchModal />

      <YoutubeSearchModal />

      <WebModal />

      <YoutubeModal />

      <ImageEditModal />

    </SafeAreaView>
  );
}


// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({

  flex: {
    flex: 1,
  },

  container: {
    flex: 1,
  },

  darkContainer: {
    backgroundColor: "#0b0f14",
  },

  lightContainer: {
    backgroundColor: "#f4f5f7",
  },

  authContainer: {
    flex: 1,
    backgroundColor: "#0b0f14",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },

  authLogo: {
    width: 90,
    height: 90,
    borderRadius: 28,
    backgroundColor: "#151b23",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 15,
  },

  authTitle: {
    color: "#fff",
    fontSize: 34,
    fontWeight: "800",
  },

  authSubtitle: {
    color: "#8b95a3",
    marginTop: 6,
    marginBottom: 30,
    fontSize: 15,
  },

  authCard: {
    width: "100%",
    maxWidth: 430,
  },

  authInput: {
    backgroundColor: "#151b23",
    borderWidth: 1,
    borderColor: "#252d38",
    borderRadius: 14,
    color: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
    fontSize: 16,
  },

  authButton: {
    height: 52,
    borderRadius: 15,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 5,
  },

  authButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },

  authSwitch: {
    color: "#7da7ff",
    textAlign: "center",
    marginTop: 20,
    fontSize: 14,
  },

  header: {
    height: 58,
    paddingHorizontal: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#171d25",
    backgroundColor: "#0b0f14",
  },

  headerTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },

  headerRight: {
    flexDirection: "row",
    alignItems: "center",
  },

  headerButton: {
    marginLeft: 7,
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },

  chatContent: {
    paddingHorizontal: 12,
    paddingTop: 15,
    paddingBottom: 15,
  },

  emptyChatContent: {
    flexGrow: 1,
    justifyContent: "center",
  },

  welcome: {
    alignItems: "center",
    justifyContent: "center",
  },

  bigLogo: {
    width: 84,
    height: 84,
    borderRadius: 28,
    backgroundColor: "#151b23",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 18,
  },

  welcomeTitle: {
    color: "#fff",
    fontSize: 25,
    fontWeight: "800",
  },

  welcomeText: {
    color: "#7f8997",
    marginTop: 8,
    fontSize: 15,
  },

  messageRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginVertical: 6,
  },

  userMessageRow: {
    justifyContent: "flex-end",
  },

  aiAvatar: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#202833",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },

  messageBubble: {
    maxWidth: "84%",
    backgroundColor: "#151b23",
    borderRadius: 17,
    paddingHorizontal: 13,
    paddingVertical: 11,
  },

  userBubble: {
    backgroundColor: "#2563eb",
  },

  messageText: {
    color: "#e9edf2",
    fontSize: 16,
    lineHeight: 23,
  },

  userMessageText: {
    color: "#fff",
  },

  linkText: {
    color: "#73a7ff",
    textDecorationLine: "underline",
  },

  answerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 17,
    marginTop: 10,
    paddingTop: 7,
    borderTopWidth: 1,
    borderTopColor: "#242c36",
  },

  typingBox: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 9,
  },

  aiAvatarSmall: {
    width: 27,
    height: 27,
    borderRadius: 9,
    backgroundColor: "#202833",
    justifyContent: "center",
    alignItems: "center",
  },

  typingText: {
    color: "#88929f",
    fontSize: 13,
  },

  inputArea: {
    paddingHorizontal: 9,
    paddingTop: 7,
    paddingBottom: 5,
    backgroundColor: "#0b0f14",
  },

  inputRow: {
    minHeight: 52,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#28313c",
    backgroundColor: "#151b23",
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 6,
    paddingVertical: 5,
  },

  roundButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },

  input: {
    flex: 1,
    color: "#fff",
    fontSize: 16,
    maxHeight: 120,
    paddingHorizontal: 7,
    paddingTop: 9,
    paddingBottom: 8,
  },

  micButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },

  micActive: {
    backgroundColor: "#8b2635",
  },

  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },

  disclaimer: {
    color: "#555f6c",
    fontSize: 10,
    textAlign: "center",
    paddingVertical: 4,
  },

  plusMenu: {
    backgroundColor: "#151b23",
    borderWidth: 1,
    borderColor: "#29323e",
    borderRadius: 17,
    padding: 7,
    marginBottom: 7,
  },

  plusItem: {
    height: 45,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    gap: 12,
  },

  plusText: {
    color: "#fff",
    fontSize: 14,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
    justifyContent: "flex-end",
  },

  sideModal: {
    height: "92%",
    backgroundColor: "#0f141b",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 16,
  },

  centerModal: {
    maxHeight: "88%",
    backgroundColor: "#0f141b",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 16,
  },

  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },

  modalTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "800",
  },

  newChatButton: {
    height: 48,
    borderRadius: 13,
    backgroundColor: "#1b2430",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    gap: 10,
    marginBottom: 10,
  },

  newChatText: {
    color: "#fff",
    fontWeight: "600",
  },

  historyRow: {
    minHeight: 55,
    borderBottomWidth: 1,
    borderBottomColor: "#202732",
    flexDirection: "row",
    alignItems: "center",
  },

  historyMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  historyTitle: {
    color: "#e6e9ee",
    fontSize: 14,
    flex: 1,
  },

  emptyText: {
    color: "#6e7885",
    textAlign: "center",
    padding: 25,
  },

  memoryRow: {
    minHeight: 70,
    borderBottomWidth: 1,
    borderBottomColor: "#202732",
    flexDirection: "row",
    alignItems: "center",
  },

  memoryTextBox: {
    flex: 1,
  },

  memoryKey: {
    color: "#fff",
    fontWeight: "700",
    marginBottom: 4,
  },

  memoryValue: {
    color: "#909aa7",
    fontSize: 13,
  },

  profileBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#151b23",
    borderRadius: 15,
    padding: 13,
    marginBottom: 10,
  },

  profileAvatar: {
    width: 45,
    height: 45,
    borderRadius: 23,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  profileLetter: {
    color: "#fff",
    fontSize: 19,
    fontWeight: "800",
  },

  profileName: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },

  profileEmail: {
    color: "#7f8997",
    fontSize: 12,
    marginTop: 3,
  },

  settingRow: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#202732",
    gap: 13,
  },

  settingText: {
    flex: 1,
    color: "#fff",
    fontSize: 15,
  },

  logoutButton: {
    height: 50,
    borderRadius: 14,
    marginTop: 18,
    backgroundColor: "#201519",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },

  logoutText: {
    color: "#ff6b6b",
    fontWeight: "700",
  },

  searchRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },

  searchInput: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#151b23",
    borderWidth: 1,
    borderColor: "#29323e",
    color: "#fff",
    paddingHorizontal: 14,
    fontSize: 15,
  },

  searchButton: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#2563eb",
    justifyContent: "center",
    alignItems: "center",
  },

  resultCard: {
    backgroundColor: "#151b23",
    borderRadius: 14,
    padding: 13,
    marginVertical: 5,
    flexDirection: "row",
    gap: 11,
  },

  resultTitle: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 5,
  },

  resultDescription: {
    color: "#919ba8",
    fontSize: 13,
    lineHeight: 18,
  },

  resultUrl: {
    color: "#5d8fe9",
    fontSize: 11,
    marginTop: 6,
  },

  youtubeIcon: {
    width: 43,
    height: 43,
    borderRadius: 12,
    backgroundColor: "#242b34",
    justifyContent: "center",
    alignItems: "center",
  },

  webContainer: {
    flex: 1,
    backgroundColor: "#0b0f14",
  },

  webHeader: {
    height: 54,
    backgroundColor: "#0b0f14",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#202732",
  },

  webTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    flex: 1,
    textAlign: "center",
  },

  imagePreviewBox: {
    height: 150,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#29323e",
    backgroundColor: "#151b23",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },

  imagePrompt: {
    minHeight: 100,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#29323e",
    backgroundColor: "#151b23",
    color: "#fff",
    padding: 13,
    textAlignVertical: "top",
    marginBottom: 12,
  },

  primaryButton: {
    height: 50,
    borderRadius: 14,
    backgroundColor: "#2563eb",
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },

  primaryButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },

});
