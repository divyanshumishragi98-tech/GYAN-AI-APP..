import React, { useEffect, useRef, useState } from "react";

import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Speech from "expo-speech";
import { Ionicons } from "@expo/vector-icons";
import { WebView } from "react-native-webview";
import * as ClipboardExpo from "expo-clipboard";

const API_BASE = "https://gyan-ai-ef7h.onrender.com";

const LOGIN_ENDPOINT = `${API_BASE}/api/login`;
const REGISTER_ENDPOINT = `${API_BASE}/api/register`;
const CHAT_ENDPOINT = `${API_BASE}/api/chat`;
const LOGOUT_ENDPOINT = `${API_BASE}/api/logout`;
const MEMORY_ENDPOINT = `${API_BASE}/api/memory`;

const TOKEN_KEY = "gyan_auth_token";
const USER_ID_KEY = "gyan_user_id";
const USERNAME_KEY = "gyan_username";

/* ============================================================
   LOGO
============================================================ */

function GyanLogo({ size = 44 }) {
  return (
    <View
      style={[
        styles.logo,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
        },
      ]}
    >
      <View
        style={[
          styles.logoRing,
          {
            width: size - 8,
            height: size - 8,
            borderRadius: (size - 8) / 2,
          },
        ]}
      >
        <Text
          style={[
            styles.logoText,
            {
              fontSize: size * 0.52,
            },
          ]}
        >
          G
        </Text>
      </View>
    </View>
  );
}

/* ============================================================
   LINK TEXT
============================================================ */

function MessageText({ content, onOpenLink }) {
  const parts = String(content || "").split(
    /(https?:\/\/[^\s]+)/g
  );

  return (
    <Text style={styles.messageText}>
      {parts.map((part, index) => {
        const isUrl =
          /^https?:\/\/[^\s]+$/i.test(part);

        if (isUrl) {
          return (
            <Text
              key={index}
              style={styles.linkText}
              onPress={() => onOpenLink(part)}
            >
              {part}
            </Text>
          );
        }

        return (
          <Text key={index}>
            {part}
          </Text>
        );
      })}
    </Text>
  );
}

/* ============================================================
   MESSAGE BUBBLE
============================================================ */

function MessageBubble({
  item,
  onCopy,
  onShare,
  onSpeak,
  onOpenLink,
}) {
  const isUser = item.role === "user";

  return (
    <View
      style={[
        styles.messageRow,
        isUser
          ? styles.userRow
          : styles.aiRow,
      ]}
    >
      {!isUser && <GyanLogo size={32} />}

      <View
        style={[
          styles.messageBubble,
          isUser
            ? styles.userBubble
            : styles.aiBubble,
        ]}
      >
        <MessageText
          content={item.content}
          onOpenLink={onOpenLink}
        />

        {!isUser && (
          <View style={styles.messageActions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() =>
                onCopy(item.content)
              }
            >
              <Ionicons
                name="copy-outline"
                size={17}
                color="#AAB4C3"
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() =>
                onShare(item.content)
              }
            >
              <Ionicons
                name="share-outline"
                size={17}
                color="#AAB4C3"
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() =>
                onSpeak(item.content)
              }
            >
              <Ionicons
                name="volume-medium-outline"
                size={17}
                color="#AAB4C3"
              />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

/* ============================================================
   AUTH SCREEN
============================================================ */

function AuthScreen({ onLoginSuccess }) {
  const [mode, setMode] = useState("login");

  const [username, setUsername] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  async function submitAuth() {
    const cleanUsername =
      username.trim();

    if (!cleanUsername) {
      Alert.alert(
        "Username required",
        "Username डालो।"
      );
      return;
    }

    if (!password) {
      Alert.alert(
        "Password required",
        "Password डालो।"
      );
      return;
    }

    if (password.length < 4) {
      Alert.alert(
        "Password",
        "Password कम से कम 4 characters का होना चाहिए।"
      );
      return;
    }

    setLoading(true);

    try {
      const endpoint =
        mode === "login"
          ? LOGIN_ENDPOINT
          : REGISTER_ENDPOINT;

      const response = await fetch(
        endpoint,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            username: cleanUsername,
            password,
          }),
        }
      );

      let data;

      try {
        data = await response.json();
      } catch {
        throw new Error(
          `Server ने invalid response दिया। HTTP ${response.status}`
        );
      }

      console.log(
        "AUTH RESPONSE:",
        data
      );

      if (!response.ok) {
        throw new Error(
          data?.error ||
            `Server error. HTTP ${response.status}`
        );
      }

      if (!data?.ok) {
        throw new Error(
          data?.error ||
            "Authentication failed."
        );
      }

      if (!data?.token) {
        throw new Error(
          "Server ने login token नहीं भेजा।"
        );
      }

      await AsyncStorage.setItem(
        TOKEN_KEY,
        String(data.token)
      );

      if (data.user_id) {
        await AsyncStorage.setItem(
          USER_ID_KEY,
          String(data.user_id)
        );
      }

      if (data.username) {
        await AsyncStorage.setItem(
          USERNAME_KEY,
          String(data.username)
        );
      }

      setPassword("");

      onLoginSuccess({
        token: String(data.token),
        userId: String(
          data.user_id || ""
        ),
        username: String(
          data.username ||
            cleanUsername
        ),
      });
    } catch (error) {
      console.log(
        "AUTH ERROR:",
        error
      );

      Alert.alert(
        mode === "login"
          ? "Login failed"
          : "Registration failed",
        String(
          error?.message || error
        )
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView
      style={styles.authContainer}
    >
      <StatusBar
        barStyle="light-content"
        backgroundColor="#080C12"
      />

      <View style={styles.authContent}>
        <GyanLogo size={88} />

        <Text style={styles.authTitle}>
          Gyan AI
        </Text>

        <Text style={styles.authSubtitle}>
          Intelligent AI Assistant
        </Text>

        <View style={styles.authCard}>
          <View style={styles.authTabs}>
            <TouchableOpacity
              style={[
                styles.authTab,
                mode === "login" &&
                  styles.authTabActive,
              ]}
              onPress={() =>
                setMode("login")
              }
              disabled={loading}
            >
              <Text
                style={[
                  styles.authTabText,
                  mode === "login" &&
                    styles.authTabTextActive,
                ]}
              >
                Login
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.authTab,
                mode === "register" &&
                  styles.authTabActive,
              ]}
              onPress={() =>
                setMode("register")
              }
              disabled={loading}
            >
              <Text
                style={[
                  styles.authTabText,
                  mode === "register" &&
                    styles.authTabTextActive,
                ]}
              >
                Register
              </Text>
            </TouchableOpacity>
          </View>

          <Text
            style={styles.authLabel}
          >
            Username
          </Text>

          <TextInput
            value={username}
            onChangeText={setUsername}
            placeholder="Enter username"
            placeholderTextColor="#6F7B8C"
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.authInput}
            editable={!loading}
          />

          <Text
            style={styles.authLabel}
          >
            Password
          </Text>

          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Enter password"
            placeholderTextColor="#6F7B8C"
            secureTextEntry
            autoCapitalize="none"
            style={styles.authInput}
            editable={!loading}
          />

          <TouchableOpacity
            style={[
              styles.authButton,
              loading &&
                styles.authButtonDisabled,
            ]}
            onPress={submitAuth}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator
                size="small"
                color="#FFFFFF"
              />
            ) : (
              <Text
                style={styles.authButtonText}
              >
                {mode === "login"
                  ? "Login to Gyan AI"
                  : "Create Account"}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.authFooter}>
          Your account token is saved on this
          device for future sessions.
        </Text>
      </View>
    </SafeAreaView>
  );
}

/* ============================================================
   MAIN APP
============================================================ */

export default function App() {
  const [messages, setMessages] =
    useState([]);

  const [text, setText] =
    useState("");

  const [token, setToken] =
    useState("");

  const [userId, setUserId] =
    useState("");

  const [username, setUsername] =
    useState("");

  const [conversationId, setConversationId] =
    useState(null);

  const [loading, setLoading] =
    useState(false);

  const [authLoading, setAuthLoading] =
    useState(true);

  const [webVisible, setWebVisible] =
    useState(false);

  const [webUrl, setWebUrl] =
    useState("");

  const [menuVisible, setMenuVisible] =
    useState(false);

  const [memoryVisible, setMemoryVisible] =
    useState(false);

  const [memories, setMemories] =
    useState([]);

  const [memoryLoading, setMemoryLoading] =
    useState(false);

  const flatListRef =
    useRef(null);

  /* ==========================================================
     LOAD SAVED AUTH
  ========================================================== */

  useEffect(() => {
    loadSavedAuth();
  }, []);

  useEffect(() => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({
        animated: true,
      });
    }, 80);
  }, [messages]);

  async function loadSavedAuth() {
    try {
      const savedToken =
        await AsyncStorage.getItem(
          TOKEN_KEY
        );

      const savedUserId =
        await AsyncStorage.getItem(
          USER_ID_KEY
        );

      const savedUsername =
        await AsyncStorage.getItem(
          USERNAME_KEY
        );

      if (savedToken) {
        setToken(savedToken);
      }

      if (savedUserId) {
        setUserId(savedUserId);
      }

      if (savedUsername) {
        setUsername(savedUsername);
      }
    } catch (error) {
      console.log(
        "AUTH LOAD ERROR:",
        error
      );
    } finally {
      setAuthLoading(false);
    }
  }

  /* ==========================================================
     LOGIN SUCCESS
  ========================================================== */

  function handleLoginSuccess(data) {
    setToken(data.token);
    setUserId(data.userId);
    setUsername(data.username);
    setMessages([]);
    setConversationId(null);
  }

  /* ==========================================================
     LOGOUT
  ========================================================== */

  async function logout() {
    Alert.alert(
      "Logout",
      "क्या आप Gyan AI से logout करना चाहते हैं?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Logout",
          style: "destructive",
          onPress: performLogout,
        },
      ]
    );
  }

  async function performLogout() {
    try {
      if (token) {
        await fetch(
          LOGOUT_ENDPOINT,
          {
            method: "POST",
            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          }
        );
      }
    } catch (error) {
      console.log(
        "LOGOUT SERVER ERROR:",
        error
      );
    }

    await AsyncStorage.multiRemove([
      TOKEN_KEY,
      USER_ID_KEY,
      USERNAME_KEY,
    ]);

    Speech.stop();

    setToken("");
    setUserId("");
    setUsername("");
    setMessages([]);
    setConversationId(null);
    setMenuVisible(false);
    setMemoryVisible(false);
  }

  /* ==========================================================
     COPY
  ========================================================== */

  async function copyText(value) {
    try {
      await ClipboardExpo.setStringAsync(
        value
      );

      Alert.alert(
        "Copied",
        "Answer copied to clipboard."
      );
    } catch {
      Alert.alert(
        "Copy failed",
        "Text copy नहीं हो पाया।"
      );
    }
  }

  /* ==========================================================
     SHARE
  ========================================================== */

  async function shareText(value) {
    try {
      await Share.share({
        message: value,
      });
    } catch (error) {
      console.log(
        "SHARE ERROR:",
        error
      );
    }
  }

  /* ==========================================================
     SPEAK
  ========================================================== */

  function speakText(value) {
    Speech.stop();

    Speech.speak(value, {
      language: "hi-IN",
      rate: 0.95,
    });
  }

  /* ==========================================================
     WEB
  ========================================================== */

  function openWeb(url) {
    if (!url) return;

    setWebUrl(url);
    setWebVisible(true);
  }

  function searchWeb(queryOverride = "") {
    const query =
      String(
        queryOverride || text
      ).trim();

    if (!query) {
      Alert.alert(
        "Web Search",
        "पहले अपना question लिखो।"
      );
      return;
    }

    const url =
      "https://www.google.com/search?q=" +
      encodeURIComponent(query);

    openWeb(url);
    setMenuVisible(false);
  }

  function searchYouTube(
    queryOverride = ""
  ) {
    const query =
      String(
        queryOverride || text
      ).trim();

    if (!query) {
      Alert.alert(
        "YouTube",
        "पहले अपना question लिखो।"
      );
      return;
    }

    const url =
      "https://www.youtube.com/results?search_query=" +
      encodeURIComponent(query);

    openWeb(url);
    setMenuVisible(false);
  }

  /* ==========================================================
     AUTO SEARCH DETECTION
  ========================================================== */

  function detectSearchType(question) {
    const q =
      String(question || "")
        .toLowerCase()
        .trim();

    const youtubeWords = [
      "youtube",
      "यूट्यूब",
      "video",
      "videos",
      "वीडियो",
      "song",
      "songs",
      "गाना",
      "गाने",
      "channel",
      "चैनल",
      "watch video",
    ];

    const webWords = [
      "search web",
      "web search",
      "google",
      "search online",
      "इंटरनेट पर खोजो",
      "वेब पर खोजो",
      "ऑनलाइन खोजो",
      "latest",
      "latest news",
      "आज की खबर",
      "आज का",
      "आज की",
      "अभी",
      "current",
      "recent",
      "news",
      "weather",
      "मौसम",
      "price",
      "कीमत",
      "link",
      "लिंक",
    ];

    if (
      youtubeWords.some((word) =>
        q.includes(word)
      )
    ) {
      return "youtube";
    }

    if (
      webWords.some((word) =>
        q.includes(word)
      )
    ) {
      return "web";
    }

    return "none";
  }

  /* ==========================================================
     CHAT
  ========================================================== */

  async function sendMessage() {
    const question =
      text.trim();

    if (!question || loading) {
      return;
    }

    if (!token) {
      Alert.alert(
        "Login required",
        "पहले Gyan AI में login करो।"
      );
      return;
    }

    /*
      Some questions can automatically open
      the appropriate search inside the app.
    */

    const searchType =
      detectSearchType(question);

    if (searchType === "youtube") {
      setText("");
      searchYouTube(question);
      return;
    }

    if (searchType === "web") {
      setText("");
      searchWeb(question);
      return;
    }

    const userMessage = {
      id: `${Date.now()}-user`,
      role: "user",
      content: question,
    };

    setMessages((old) => [
      ...old,
      userMessage,
    ]);

    setText("");
    setLoading(true);

    try {
      const response = await fetch(
        CHAT_ENDPOINT,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
            Authorization:
              `Bearer ${token}`,
          },
          body: JSON.stringify({
            message: question,
            conversation_id:
              conversationId,
          }),
        }
      );

      let data;

      try {
        data = await response.json();
      } catch {
        throw new Error(
          `Server ने invalid response दिया। HTTP ${response.status}`
        );
      }

      console.log(
        "CHAT RESPONSE:",
        data
      );

      /*
        If token expired, force login again.
      */

      if (
        data?.error &&
        String(data.error)
          .toLowerCase()
          .includes("login required")
      ) {
        await AsyncStorage.multiRemove([
          TOKEN_KEY,
          USER_ID_KEY,
          USERNAME_KEY,
        ]);

        setToken("");
        setUserId("");
        setUsername("");
        setConversationId(null);

        throw new Error(
          "Login session समाप्त हो गया। कृपया फिर से login करें।"
        );
      }

      if (!response.ok) {
        throw new Error(
          data?.error ||
            `Server error. HTTP ${response.status}`
        );
      }

      if (!data?.ok) {
        throw new Error(
          data?.error ||
            "AI server से उत्तर प्राप्त नहीं हुआ।"
        );
      }

      if (data.user_id) {
        setUserId(
          String(data.user_id)
        );

        await AsyncStorage.setItem(
          USER_ID_KEY,
          String(data.user_id)
        );
      }

      if (data.conversation_id) {
        setConversationId(
          String(
            data.conversation_id
          )
        );
      }

      const answer =
        String(
          data.answer || ""
        ).trim();

      if (!answer) {
        throw new Error(
          "AI server ने खाली answer भेजा।"
        );
      }

      const assistantMessage = {
        id: `${Date.now()}-assistant`,
        role: "assistant",
        content: answer,
      };

      setMessages((old) => [
        ...old,
        assistantMessage,
      ]);
    } catch (error) {
      console.log(
        "CHAT ERROR:",
        error
      );

      setMessages((old) => [
        ...old,
        {
          id: `${Date.now()}-error`,
          role: "assistant",
          content:
            "अभी AI server से उत्तर नहीं मिल पाया।\n\n" +
            String(
              error?.message || error
            ),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  /* ==========================================================
     NEW CHAT
  ========================================================== */

  function newChat() {
    Speech.stop();

    setMessages([]);
    setText("");
    setConversationId(null);
    setMenuVisible(false);
  }

  /* ==========================================================
     MEMORY
  ========================================================== */

  async function loadMemory() {
    if (!token) {
      Alert.alert(
        "Login required",
        "Memory देखने के लिए login जरूरी है।"
      );
      return;
    }

    setMemoryLoading(true);

    try {
      const response =
        await fetch(
          MEMORY_ENDPOINT,
          {
            method: "GET",
            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          }
        );

      const data =
        await response.json();

      console.log(
        "MEMORY RESPONSE:",
        data
      );

      if (!response.ok || !data?.ok) {
        throw new Error(
          data?.error ||
            "Memory load failed."
        );
      }

      setMemories(
        Array.isArray(data.memories)
          ? data.memories
          : []
      );

      setMemoryVisible(true);
      setMenuVisible(false);
    } catch (error) {
      Alert.alert(
        "Memory",
        String(
          error?.message || error
        )
      );
    } finally {
      setMemoryLoading(false);
    }
  }

  async function clearAllMemory() {
    Alert.alert(
      "Clear Memory",
      "क्या आप अपनी सभी saved memories हटाना चाहते हैं?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Clear",
          style: "destructive",
          onPress:
            performClearMemory,
        },
      ]
    );
  }

  async function performClearMemory() {
    try {
      setMemoryLoading(true);

      const response =
        await fetch(
          MEMORY_ENDPOINT,
          {
            method: "DELETE",
            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          }
        );

      const data =
        await response.json();

      if (!response.ok || !data?.ok) {
        throw new Error(
          data?.error ||
            "Memory clear failed."
        );
      }

      setMemories([]);

      Alert.alert(
        "Memory cleared",
        "सभी memories clear हो गईं।"
      );
    } catch (error) {
      Alert.alert(
        "Memory",
        String(
          error?.message || error
        )
      );
    } finally {
      setMemoryLoading(false);
    }
  }

  /* ==========================================================
     RENDER MESSAGE
  ========================================================== */

  function renderMessage({ item }) {
    return (
      <MessageBubble
        item={item}
        onCopy={copyText}
        onShare={shareText}
        onSpeak={speakText}
        onOpenLink={openWeb}
      />
    );
  }

  /* ==========================================================
     AUTH LOADING
  ========================================================== */

  if (authLoading) {
    return (
      <SafeAreaView
        style={styles.authLoading}
      >
        <StatusBar
          barStyle="light-content"
          backgroundColor="#080C12"
        />

        <GyanLogo size={72} />

        <ActivityIndicator
          size="large"
          color="#38BDF8"
          style={{
            marginTop: 22,
          }}
        />

        <Text
          style={styles.authLoadingText}
        >
          Gyan AI शुरू हो रहा है...
        </Text>
      </SafeAreaView>
    );
  }

  /* ==========================================================
     LOGIN SCREEN
  ========================================================== */

  if (!token) {
    return (
      <AuthScreen
        onLoginSuccess={
          handleLoginSuccess
        }
      />
    );
  }

  /* ==========================================================
     MAIN UI
  ========================================================== */

  return (
    <SafeAreaView
      style={styles.container}
    >
      <StatusBar
        barStyle="light-content"
        backgroundColor="#080C12"
      />

      {/* HEADER */}

      <View style={styles.header}>
        <TouchableOpacity
          onPress={() =>
            setMenuVisible(true)
          }
          style={styles.headerButton}
        >
          <Ionicons
            name="menu-outline"
            size={28}
            color="#FFFFFF"
          />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <GyanLogo size={38} />

          <View>
            <Text
              style={styles.title}
            >
              Gyan AI
            </Text>

            <Text
              style={styles.subtitle}
            >
              {username
                ? `Hi, ${username}`
                : "Intelligent AI Assistant"}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={newChat}
          style={styles.headerButton}
        >
          <Ionicons
            name="create-outline"
            size={24}
            color="#FFFFFF"
          />
        </TouchableOpacity>
      </View>

      {/* CHAT */}

      <KeyboardAvoidingView
        style={
          styles.keyboardContainer
        }
        behavior={
          Platform.OS === "ios"
            ? "padding"
            : "height"
        }
        keyboardVerticalOffset={0}
      >
        {messages.length === 0 ? (
          <View
            style={styles.welcome}
          >
            <GyanLogo size={82} />

            <Text
              style={styles.welcomeTitle}
            >
              Welcome to Gyan AI
            </Text>

            <Text
              style={styles.welcomeText}
            >
              Ask anything. Chat with your
              AI assistant or search the web
              and YouTube.
            </Text>

            <View
              style={styles.quickRow}
            >
              <TouchableOpacity
                style={styles.quickCard}
                onPress={() =>
                  searchWeb()
                }
              >
                <Ionicons
                  name="globe-outline"
                  size={25}
                  color="#38BDF8"
                />

                <Text
                  style={styles.quickText}
                >
                  Web Search
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickCard}
                onPress={() =>
                  searchYouTube()
                }
              >
                <Ionicons
                  name="logo-youtube"
                  size={25}
                  color="#FF4D67"
                />

                <Text
                  style={styles.quickText}
                >
                  YouTube
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) =>
              item.id
            }
            renderItem={
              renderMessage
            }
            contentContainerStyle={
              styles.messagesContent
            }
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={
              false
            }
            onContentSizeChange={() =>
              flatListRef.current?.scrollToEnd(
                {
                  animated: true,
                }
              )
            }
          />
        )}

        {/* LOADING */}

        {loading && (
          <View
            style={styles.loadingRow}
          >
            <GyanLogo size={30} />

            <View
              style={
                styles.loadingBubble
              }
            >
              <ActivityIndicator
                size="small"
                color="#38BDF8"
              />

              <Text
                style={styles.loadingText}
              >
                Gyan AI सोच रहा है...
              </Text>
            </View>
          </View>
        )}

        {/* COMPOSER */}

        <View
          style={
            styles.composerWrapper
          }
        >
          <TouchableOpacity
            style={styles.plusButton}
            onPress={() =>
              setMenuVisible(true)
            }
          >
            <Ionicons
              name="add"
              size={25}
              color="#D8E2EF"
            />
          </TouchableOpacity>

          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Message Gyan AI..."
            placeholderTextColor="#6F7B8C"
            multiline
            maxLength={8000}
            style={styles.input}
            returnKeyType="default"
          />

          <TouchableOpacity
            style={[
              styles.sendButton,
              (!text.trim() ||
                loading) &&
                styles.sendDisabled,
            ]}
            onPress={sendMessage}
            disabled={
              !text.trim() || loading
            }
          >
            <Ionicons
              name="arrow-up"
              size={23}
              color="#FFFFFF"
            />
          </TouchableOpacity>
        </View>

        <Text
          style={styles.disclaimer}
        >
          Gyan AI can make mistakes.
          Check important information.
        </Text>
      </KeyboardAvoidingView>

      {/* ======================================================
          SIDE MENU
      ====================================================== */}

      <Modal
        visible={menuVisible}
        animationType="slide"
        transparent
        onRequestClose={() =>
          setMenuVisible(false)
        }
      >
        <View
          style={
            styles.modalBackground
          }
        >
          <View
            style={styles.sideMenu}
          >
            <View
              style={styles.menuHeader}
            >
              <View
                style={styles.menuBrand}
              >
                <GyanLogo size={48} />

                <View>
                  <Text
                    style={
                      styles.menuTitle
                    }
                  >
                    Gyan AI
                  </Text>

                  <Text
                    style={
                      styles.menuSubtitle
                    }
                  >
                    {username ||
                      "Tools & Features"}
                  </Text>
                </View>
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
                  size={28}
                  color="#FFFFFF"
                />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={newChat}
            >
              <Ionicons
                name="add-circle-outline"
                size={23}
                color="#38BDF8"
              />

              <Text
                style={
                  styles.menuItemText
                }
              >
                New Chat
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setMenuVisible(
                  false
                );

                Alert.alert(
                  "Chat History",
                  "Current chat history आपकी backend conversation में सुरक्षित है। New Chat से नई conversation शुरू कर सकते हैं।"
                );
              }}
            >
              <Ionicons
                name="time-outline"
                size={23}
                color="#38BDF8"
              />

              <Text
                style={
                  styles.menuItemText
                }
              >
                Chat History
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={loadMemory}
              disabled={memoryLoading}
            >
              <Ionicons
                name="brain-outline"
                size={23}
                color="#38BDF8"
              />

              <Text
                style={
                  styles.menuItemText
                }
              >
                Long-term Memory
              </Text>

              {memoryLoading && (
                <ActivityIndicator
                  size="small"
                  color="#38BDF8"
                />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() =>
                searchWeb()
              }
            >
              <Ionicons
                name="globe-outline"
                size={23}
                color="#38BDF8"
              />

              <Text
                style={
                  styles.menuItemText
                }
              >
                Web Search
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() =>
                searchYouTube()
              }
            >
              <Ionicons
                name="logo-youtube"
                size={23}
                color="#FF4D67"
              />

              <Text
                style={
                  styles.menuItemText
                }
              >
                YouTube Search
              </Text>
            </TouchableOpacity>

            <View
              style={styles.menuDivider}
            />

            <TouchableOpacity
              style={styles.menuItem}
              onPress={logout}
            >
              <Ionicons
                name="log-out-outline"
                size={23}
                color="#FF6577"
              />

              <Text
                style={[
                  styles.menuItemText,
                  {
                    color: "#FF6577",
                  },
                ]}
              >
                Logout
              </Text>
            </TouchableOpacity>

            <View
              style={styles.menuInfoBox}
            >
              <Text
                style={styles.menuInfo}
              >
                Gyan AI
              </Text>

              <Text
                style={
                  styles.menuInfoSmall
                }
              >
                AI • Web • YouTube • Memory
              </Text>

              {userId ? (
                <Text
                  style={
                    styles.menuInfoSmall
                  }
                >
                  User ID: {userId}
                </Text>
              ) : null}
            </View>
          </View>

          <Pressable
            style={
              styles.modalOutside
            }
            onPress={() =>
              setMenuVisible(
                false
              )
            }
          />
        </View>
      </Modal>

      {/* ======================================================
          MEMORY MODAL
      ====================================================== */}

      <Modal
        visible={memoryVisible}
        animationType="slide"
        transparent
        onRequestClose={() =>
          setMemoryVisible(false)
        }
      >
        <View
          style={
            styles.memoryModalBackground
          }
        >
          <View
            style={styles.memoryPanel}
          >
            <View
              style={
                styles.memoryHeader
              }
            >
              <View>
                <Text
                  style={
                    styles.memoryTitle
                  }
                >
                  Long-term Memory
                </Text>

                <Text
                  style={
                    styles.memorySubtitle
                  }
                >
                  Memories saved by Gyan AI
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
                  color="#FFFFFF"
                />
              </TouchableOpacity>
            </View>

            {memories.length === 0 ? (
              <View
                style={
                  styles.emptyMemory
                }
              >
                <Ionicons
                  name="brain-outline"
                  size={50}
                  color="#38BDF8"
                />

                <Text
                  style={
                    styles.emptyMemoryTitle
                  }
                >
                  No memories saved yet
                </Text>

                <Text
                  style={
                    styles.emptyMemoryText
                  }
                >
                  Gyan AI आपकी बातचीत से
                  useful information याद रख
                  सकता है।
                </Text>
              </View>
            ) : (
              <FlatList
                data={memories}
                keyExtractor={(item) =>
                  String(item.id)
                }
                contentContainerStyle={{
                  paddingBottom: 20,
                }}
                renderItem={({
                  item,
                }) => (
                  <View
                    style={
                      styles.memoryItem
                    }
                  >
                    <Text
                      style={
                        styles.memoryKey
                      }
                    >
                      {item.key}
                    </Text>

                    <Text
                      style={
                        styles.memoryValue
                      }
                    >
                      {item.value}
                    </Text>
                  </View>
                )}
              />
            )}

            <TouchableOpacity
              style={
                styles.clearMemoryButton
              }
              onPress={
                clearAllMemory
              }
              disabled={
                memoryLoading ||
                memories.length === 0
              }
            >
              <Ionicons
                name="trash-outline"
                size={20}
                color="#FFFFFF"
              />

              <Text
                style={
                  styles.clearMemoryText
                }
              >
                Clear All Memory
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ======================================================
          IN-APP WEB
      ====================================================== */}

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
          <View
            style={styles.webHeader}
          >
            <TouchableOpacity
              onPress={() =>
                setWebVisible(false)
              }
              style={styles.webBack}
            >
              <Ionicons
                name="arrow-back"
                size={25}
                color="#FFFFFF"
              />
            </TouchableOpacity>

            <Text
              style={styles.webTitle}
              numberOfLines={1}
            >
              Gyan AI Web
            </Text>

            <View
              style={{
                width: 45,
              }}
            />
          </View>

          {webUrl ? (
            <WebView
              source={{
                uri: webUrl,
              }}
              style={styles.webView}
              startInLoadingState
              javaScriptEnabled
              domStorageEnabled
              allowsBackForwardNavigationGestures
              renderLoading={() => (
                <View
                  style={
                    styles.webLoading
                  }
                >
                  <ActivityIndicator
                    size="large"
                    color="#38BDF8"
                  />

                  <Text
                    style={
                      styles.webLoadingText
                    }
                  >
                    Loading...
                  </Text>
                </View>
              )}
              onShouldStartLoadWithRequest={(
                request
              ) => {
                return true;
              }}
            />
          ) : null}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

/* ============================================================
   STYLES
============================================================ */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#080C12",
  },

  keyboardContainer: {
    flex: 1,
  },

  /* AUTH */

  authContainer: {
    flex: 1,
    backgroundColor: "#080C12",
  },

  authContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },

  authTitle: {
    color: "#FFFFFF",
    fontSize: 31,
    fontWeight: "900",
    marginTop: 16,
  },

  authSubtitle: {
    color: "#7F8A9A",
    fontSize: 14,
    marginTop: 5,
    marginBottom: 28,
  },

  authCard: {
    width: "100%",
    maxWidth: 430,
    backgroundColor: "#0F151E",
    borderWidth: 1,
    borderColor: "#1B2736",
    borderRadius: 20,
    padding: 18,
  },

  authTabs: {
    flexDirection: "row",
    backgroundColor: "#080C12",
    borderRadius: 12,
    padding: 4,
    marginBottom: 22,
  },

  authTab: {
    flex: 1,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9,
  },

  authTabActive: {
    backgroundColor: "#172B42",
  },

  authTabText: {
    color: "#758296",
    fontSize: 15,
    fontWeight: "700",
  },

  authTabTextActive: {
    color: "#38BDF8",
  },

  authLabel: {
    color: "#D7E0EC",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 8,
  },

  authInput: {
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#243244",
    backgroundColor: "#080C12",
    color: "#FFFFFF",
    paddingHorizontal: 14,
    marginBottom: 16,
    fontSize: 15,
  },

  authButton: {
    height: 52,
    borderRadius: 13,
    backgroundColor: "#1677C8",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },

  authButtonDisabled: {
    opacity: 0.6,
  },

  authButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },

  authFooter: {
    color: "#596678",
    fontSize: 11,
    textAlign: "center",
    marginTop: 20,
    maxWidth: 320,
    lineHeight: 17,
  },

  authLoading: {
    flex: 1,
    backgroundColor: "#080C12",
    alignItems: "center",
    justifyContent: "center",
  },

  authLoadingText: {
    color: "#8A96A7",
    fontSize: 14,
    marginTop: 15,
  },

  /* HEADER */

  header: {
    height: 64,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    backgroundColor: "#0B1018",
    borderBottomWidth: 1,
    borderBottomColor: "#17202D",
  },

  headerButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
  },

  headerCenter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  logo: {
    backgroundColor: "#111827",
    borderWidth: 2,
    borderColor: "#38BDF8",
    alignItems: "center",
    justifyContent: "center",
  },

  logoRing: {
    borderWidth: 2,
    borderColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
  },

  logoText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },

  title: {
    color: "#FFFFFF",
    fontSize: 19,
    fontWeight: "800",
  },

  subtitle: {
    color: "#718096",
    fontSize: 10,
    marginTop: 1,
  },

  /* WELCOME */

  welcome: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },

  welcomeTitle: {
    color: "#FFFFFF",
    fontSize: 26,
    fontWeight: "800",
    marginTop: 20,
    textAlign: "center",
  },

  welcomeText: {
    color: "#8793A4",
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    marginTop: 10,
    maxWidth: 340,
  },

  quickRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 25,
  },

  quickCard: {
    width: 135,
    height: 85,
    borderRadius: 15,
    backgroundColor: "#101822",
    borderWidth: 1,
    borderColor: "#1D2A3A",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },

  quickText: {
    color: "#C7D1DE",
    fontSize: 12,
    fontWeight: "700",
  },

  /* MESSAGES */

  messagesContent: {
    paddingHorizontal: 12,
    paddingTop: 16,
    paddingBottom: 12,
  },

  messageRow: {
    flexDirection: "row",
    marginBottom: 16,
    gap: 8,
  },

  userRow: {
    justifyContent: "flex-end",
  },

  aiRow: {
    justifyContent: "flex-start",
  },

  messageBubble: {
    maxWidth: "84%",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },

  userBubble: {
    backgroundColor: "#155A94",
    borderBottomRightRadius: 5,
  },

  aiBubble: {
    backgroundColor: "#111923",
    borderWidth: 1,
    borderColor: "#1C2938",
    borderBottomLeftRadius: 5,
  },

  messageText: {
    color: "#E8EDF5",
    fontSize: 15,
    lineHeight: 22,
  },

  linkText: {
    color: "#38BDF8",
    textDecorationLine: "underline",
  },

  messageActions: {
    flexDirection: "row",
    marginTop: 7,
    gap: 4,
  },

  actionButton: {
    width: 32,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },

  /* LOADING */

  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    marginBottom: 7,
  },

  loadingBubble: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    backgroundColor: "#111923",
    borderWidth: 1,
    borderColor: "#1C2938",
    borderRadius: 15,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },

  loadingText: {
    color: "#8E9AAA",
    fontSize: 13,
  },

  /* COMPOSER */

  composerWrapper: {
    minHeight: 56,
    marginHorizontal: 10,
    marginBottom: 5,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: "#253346",
    backgroundColor: "#0E151E",
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 7,
    paddingVertical: 6,
  },

  plusButton: {
    width: 42,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },

  input: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 15,
    lineHeight: 21,
    maxHeight: 120,
    paddingHorizontal: 7,
    paddingVertical: 10,
  },

  sendButton: {
    width: 43,
    height: 43,
    borderRadius: 22,
    backgroundColor: "#1677C8",
    alignItems: "center",
    justifyContent: "center",
  },

  sendDisabled: {
    backgroundColor: "#263342",
  },

  disclaimer: {
    color: "#596678",
    fontSize: 9,
    textAlign: "center",
    marginBottom: 5,
  },

  /* SIDE MENU */

  modalBackground: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    flexDirection: "row",
  },

  sideMenu: {
    width: "82%",
    maxWidth: 360,
    height: "100%",
    backgroundColor: "#0B1018",
    borderRightWidth: 1,
    borderRightColor: "#1D2938",
    paddingTop: Platform.OS === "android" ? 32 : 10,
    paddingHorizontal: 16,
  },

  modalOutside: {
    flex: 1,
  },

  menuHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 22,
    borderBottomWidth: 1,
    borderBottomColor: "#1B2736",
  },

  menuBrand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },

  menuTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
  },

  menuSubtitle: {
    color: "#718096",
    fontSize: 11,
    marginTop: 2,
  },

  menuItem: {
    minHeight: 53,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    borderBottomWidth: 1,
    borderBottomColor: "#111A25",
  },

  menuItemText: {
    flex: 1,
    color: "#D9E1EC",
    fontSize: 14,
    fontWeight: "600",
  },

  menuDivider: {
    height: 1,
    backgroundColor: "#1B2736",
    marginVertical: 8,
  },

  menuInfoBox: {
    marginTop: 18,
    padding: 14,
    borderRadius: 13,
    backgroundColor: "#101822",
  },

  menuInfo: {
    color: "#38BDF8",
    fontSize: 14,
    fontWeight: "800",
  },

  menuInfoSmall: {
    color: "#657386",
    fontSize: 10,
    marginTop: 4,
  },

  /* MEMORY */

  memoryModalBackground: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },

  memoryPanel: {
    height: "78%",
    backgroundColor: "#0B1018",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: "#1D2938",
    padding: 18,
  },

  memoryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#1B2736",
  },

  memoryTitle: {
    color: "#FFFFFF",
    fontSize: 19,
    fontWeight: "800",
  },

  memorySubtitle: {
    color: "#718096",
    fontSize: 11,
    marginTop: 3,
  },

  emptyMemory: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
  },

  emptyMemoryTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    marginTop: 15,
  },

  emptyMemoryText: {
    color: "#758296",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 19,
    marginTop: 8,
  },

  memoryItem: {
    backgroundColor: "#101822",
    borderWidth: 1,
    borderColor: "#1D2A3A",
    borderRadius: 13,
    padding: 13,
    marginTop: 12,
  },

  memoryKey: {
    color: "#38BDF8",
    fontSize: 13,
    fontWeight: "800",
  },

  memoryValue: {
    color: "#DCE4EF",
    fontSize: 14,
    marginTop: 6,
    lineHeight: 20,
  },

  clearMemoryButton: {
    height: 48,
    borderRadius: 12,
    backgroundColor: "#A83246",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 10,
  },

  clearMemoryText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },

  /* WEB */

  webContainer: {
    flex: 1,
    backgroundColor: "#080C12",
  },

  webHeader: {
    height: 58,
    backgroundColor: "#0B1018",
    borderBottomWidth: 1,
    borderBottomColor: "#1B2736",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
  },

  webBack: {
    width: 45,
    height: 45,
    alignItems: "center",
    justifyContent: "center",
  },

  webTitle: {
    flex: 1,
    color: "#FFFFFF",
    textAlign: "center",
    fontSize: 15,
    fontWeight: "700",
  },

  webView: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },

  webLoading: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "#080C12",
    alignItems: "center",
    justifyContent: "center",
  },

  webLoadingText: {
    color: "#8793A4",
    marginTop: 12,
    fontSize: 13,
  },
});
