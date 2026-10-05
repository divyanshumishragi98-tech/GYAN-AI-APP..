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
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as Clipboard from "expo-clipboard";
import * as Notifications from "expo-notifications";

import { Ionicons } from "@expo/vector-icons";
import { WebView } from "react-native-webview";

import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";


const API_BASE =
  "https://gyan-ai-ef7h.onrender.com";

const LOGIN_ENDPOINT =
  `${API_BASE}/api/login`;

const REGISTER_ENDPOINT =
  `${API_BASE}/api/register`;

const CHAT_ENDPOINT =
  `${API_BASE}/api/chat`;

const LOGOUT_ENDPOINT =
  `${API_BASE}/api/logout`;

const HISTORY_ENDPOINT =
  `${API_BASE}/api/history`;

const MEMORY_ENDPOINT =
  `${API_BASE}/api/memory`;


const TOKEN_KEY =
  "gyan_auth_token";

const USER_ID_KEY =
  "gyan_user_id";

const USERNAME_KEY =
  "gyan_username";

const PINNED_KEY =
  "gyan_pinned_chats";

const PROJECTS_KEY =
  "gyan_projects";

const LIBRARY_KEY =
  "gyan_library";

const SCHEDULE_KEY =
  "gyan_schedule";

const IMAGE_LIBRARY_KEY =
  "gyan_image_library";


Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});


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
            { fontSize: size * 0.52 },
          ]}
        >
          G
        </Text>
      </View>
    </View>
  );
}


function MessageText({ content }) {
  const parts = String(content || "")
    .split(/(https?:\/\/[^\s]+)/g);

  return (
    <Text style={styles.messageText}>
      {parts.map((part, index) => {
        if (/^https?:\/\//i.test(part)) {
          const cleanUrl =
            part.replace(/[),.!?;:]+$/, "");

          return (
            <Text
              key={index}
              style={styles.linkText}
              onPress={() =>
                Linking.openURL(cleanUrl)
              }
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


function MessageBubble({
  item,
  onCopy,
  onShare,
  onSpeak,
}) {
  const isUser =
    item.role === "user";

  return (
    <View
      style={[
        styles.messageRow,
        isUser
          ? styles.userRow
          : styles.aiRow,
      ]}
    >
      {!isUser && (
        <GyanLogo size={32} />
      )}

      <View
        style={[
          styles.messageBubble,
          isUser
            ? styles.userBubble
            : styles.aiBubble,
        ]}
      >
        {item.attachment && (
          <View style={styles.attachment}>
            <Ionicons
              name={
                item.attachment.type ===
                "image"
                  ? "image-outline"
                  : "document-outline"
              }
              size={18}
              color="#38BDF8"
            />

            <Text
              style={styles.attachmentName}
              numberOfLines={1}
            >
              {item.attachment.name}
            </Text>
          </View>
        )}

        <MessageText
          content={item.content}
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


function AuthScreen({
  onLoginSuccess,
}) {
  const [mode, setMode] =
    useState("login");

  const [username, setUsername] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [loading, setLoading] =
    useState(false);


  async function submitAuth() {
    const name =
      username.trim();

    if (!name || !password) {
      Alert.alert(
        "Login",
        "Username और password दोनों डालो।"
      );
      return;
    }

    setLoading(true);

    try {
      const endpoint =
        mode === "login"
          ? LOGIN_ENDPOINT
          : REGISTER_ENDPOINT;

      const response =
        await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            username: name,
            password,
          }),
        });

      const data =
        await response.json();

      if (!response.ok || !data?.ok) {
        throw new Error(
          data?.error ||
          `Server error ${response.status}`
        );
      }

      if (!data.token) {
        throw new Error(
          "Login token नहीं मिला।"
        );
      }

      await AsyncStorage.multiSet([
        [
          TOKEN_KEY,
          String(data.token),
        ],
        [
          USER_ID_KEY,
          String(data.user_id || ""),
        ],
        [
          USERNAME_KEY,
          String(
            data.username || name
          ),
        ],
      ]);

      onLoginSuccess({
        token: String(data.token),
        userId: String(
          data.user_id || ""
        ),
        username: String(
          data.username || name
        ),
      });

      setPassword("");
    } catch (error) {
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

          <Text style={styles.authLabel}>
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
          />

          <Text style={styles.authLabel}>
            Password
          </Text>

          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Enter password"
            placeholderTextColor="#6F7B8C"
            secureTextEntry
            style={styles.authInput}
          />

          <TouchableOpacity
            style={styles.authButton}
            onPress={submitAuth}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator
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
      </View>
    </SafeAreaView>
  );
}
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

  const [menuVisible, setMenuVisible] =
    useState(false);

  const [historyVisible, setHistoryVisible] =
    useState(false);

  const [memoryVisible, setMemoryVisible] =
    useState(false);

  const [history, setHistory] =
    useState([]);

  const [memories, setMemories] =
    useState([]);

  const [historyLoading, setHistoryLoading] =
    useState(false);

  const [memoryLoading, setMemoryLoading] =
    useState(false);

  const [pinnedChats, setPinnedChats] =
    useState([]);

  const [projects, setProjects] =
    useState([]);

  const [library, setLibrary] =
    useState([]);

  const [schedule, setSchedule] =
    useState([]);

  const [imageLibrary, setImageLibrary] =
    useState([]);

  const [attachment, setAttachment] =
    useState(null);

  const [listening, setListening] =
    useState(false);

  const [webVisible, setWebVisible] =
    useState(false);

  const [webUrl, setWebUrl] =
    useState("");

  const [activePanel, setActivePanel] =
    useState(null);

  const flatListRef =
    useRef(null);


  useSpeechRecognitionEvent(
    "start",
    () => setListening(true)
  );

  useSpeechRecognitionEvent(
    "end",
    () => setListening(false)
  );

  useSpeechRecognitionEvent(
    "result",
    event => {
      const value =
        event?.results?.[0]?.transcript;

      if (value) {
        setText(value);
      }
    }
  );

  useSpeechRecognitionEvent(
    "error",
    () => setListening(false)
  );


  useEffect(() => {
    loadAuth();
  }, []);


  useEffect(() => {
    if (token) {
      loadLocalData();
    }
  }, [token]);


  useEffect(() => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({
        animated: true,
      });
    }, 80);
  }, [messages]);


  async function loadAuth() {
    try {
      const values =
        await AsyncStorage.multiGet([
          TOKEN_KEY,
          USER_ID_KEY,
          USERNAME_KEY,
        ]);

      const savedToken =
        values[0][1];

      const savedUser =
        values[1][1];

      const savedName =
        values[2][1];

      if (savedToken)
        setToken(savedToken);

      if (savedUser)
        setUserId(savedUser);

      if (savedName)
        setUsername(savedName);
    } catch (e) {
      console.log(e);
    } finally {
      setAuthLoading(false);
    }
  }


  async function loadLocalData() {
    try {
      const data =
        await AsyncStorage.multiGet([
          PINNED_KEY,
          PROJECTS_KEY,
          LIBRARY_KEY,
          SCHEDULE_KEY,
          IMAGE_LIBRARY_KEY,
        ]);

      if (data[0][1])
        setPinnedChats(
          JSON.parse(data[0][1])
        );

      if (data[1][1])
        setProjects(
          JSON.parse(data[1][1])
        );

      if (data[2][1])
        setLibrary(
          JSON.parse(data[2][1])
        );

      if (data[3][1])
        setSchedule(
          JSON.parse(data[3][1])
        );

      if (data[4][1])
        setImageLibrary(
          JSON.parse(data[4][1])
        );
    } catch (e) {
      console.log(
        "LOCAL LOAD ERROR",
        e
      );
    }
  }


  async function saveLocal(key, value) {
    await AsyncStorage.setItem(
      key,
      JSON.stringify(value)
    );
  }


  function loginSuccess(data) {
    setToken(data.token);
    setUserId(data.userId);
    setUsername(data.username);
    setMessages([]);
    setConversationId(null);
  }


  async function logout() {
    try {
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
    } catch {}

    await AsyncStorage.multiRemove([
      TOKEN_KEY,
      USER_ID_KEY,
      USERNAME_KEY,
    ]);

    setToken("");
    setUserId("");
    setUsername("");
    setMessages([]);
    setConversationId(null);
    setMenuVisible(false);
  }


  function speak(textValue) {
    Speech.stop();

    Speech.speak(
      String(textValue || ""),
      {
        language: "hi-IN",
        rate: 0.95,
      }
    );
  }


  async function startVoice() {
    try {
      const permission =
        await ExpoSpeechRecognitionModule
          .requestPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          "Permission",
          "Microphone permission देना जरूरी है।"
        );
        return;
      }

      if (listening) {
        ExpoSpeechRecognitionModule.stop();
      } else {
        ExpoSpeechRecognitionModule.start({
          lang: "hi-IN",
          interimResults: true,
          continuous: false,
        });
      }
    } catch (e) {
      Alert.alert(
        "Voice",
        String(e?.message || e)
      );
    }
  }


  async function sendMessage() {
    const question =
      text.trim();

    if (!question || loading)
      return;

    if (!token) {
      Alert.alert(
        "Login",
        "पहले login करो।"
      );
      return;
    }

    const userMessage = {
      id:
        `${Date.now()}-u`,
      role: "user",
      content: question,
      attachment,
    };

    setMessages(old => [
      ...old,
      userMessage,
    ]);

    setText("");
    setAttachment(null);
    setLoading(true);

    try {
      const response =
        await fetch(
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
              message:
                attachment
                  ? `${question}\n\n[Attached: ${attachment.name}]`
                  : question,
              conversation_id:
                conversationId,
            }),
          }
        );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data?.ok
      ) {
        throw new Error(
          data?.error ||
          "AI server से answer नहीं मिला।"
        );
      }

      if (data.conversation_id) {
        setConversationId(
          String(
            data.conversation_id
          )
        );
      }

      if (data.user_id) {
        setUserId(
          String(data.user_id)
        );
      }

      const answer =
        String(
          data.answer || ""
        ).trim();

      if (!answer) {
        throw new Error(
          "AI server ने empty answer भेजा।"
        );
      }

      setMessages(old => [
        ...old,
        {
          id:
            `${Date.now()}-a`,
          role: "assistant",
          content: answer,
        },
      ]);
    } catch (error) {
      setMessages(old => [
        ...old,
        {
          id:
            `${Date.now()}-e`,
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


  async function loadHistory() {
    setHistoryLoading(true);

    try {
      const response =
        await fetch(
          HISTORY_ENDPOINT,
          {
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
          "History load failed."
        );
      }

      setHistory(
        Array.isArray(data.history)
          ? data.history
          : []
      );

      setHistoryVisible(true);
      setMenuVisible(false);
    } catch (e) {
      Alert.alert(
        "History",
        String(e?.message || e)
      );
    } finally {
      setHistoryLoading(false);
    }
  }


  async function openHistoryChat(item) {
    try {
      setHistoryLoading(true);

      const response =
        await fetch(
          `${HISTORY_ENDPOINT}/${item.id}`,
          {
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
          "Conversation load failed."
        );
      }

      const converted =
        (data.messages || [])
          .map((m, index) => ({
            id:
              `${item.id}-${index}`,
            role:
              m.role ||
              "assistant",
            content:
              String(
                m.content || ""
              ),
          }));

      setMessages(converted);
      setConversationId(
        String(item.id)
      );

      setHistoryVisible(false);
      setActivePanel(null);
    } catch (e) {
      Alert.alert(
        "Chat",
        String(e?.message || e)
      );
    } finally {
      setHistoryLoading(false);
    }
  }


  async function deleteHistoryChat(item) {
    Alert.alert(
      "Delete Chat",
      `"${item.title || "Chat"}" delete करें?`,
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
              const response =
                await fetch(
                  `${HISTORY_ENDPOINT}/${item.id}`,
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

              if (
                !response.ok ||
                !data?.ok
              ) {
                throw new Error(
                  data?.error ||
                  "Delete failed."
                );
              }

              setHistory(old =>
                old.filter(
                  x =>
                    String(x.id) !==
                    String(item.id)
                )
              );

              if (
                String(conversationId) ===
                String(item.id)
              ) {
                setMessages([]);
                setConversationId(null);
              }
            } catch (e) {
              Alert.alert(
                "Delete",
                String(
                  e?.message || e
                )
              );
            }
          },
        },
      ]
    );
  }


  async function togglePin(item) {
    const exists =
      pinnedChats.some(
        x =>
          String(x.id) ===
          String(item.id)
      );

    const next = exists
      ? pinnedChats.filter(
          x =>
            String(x.id) !==
            String(item.id)
        )
      : [...pinnedChats, item];

    setPinnedChats(next);

    await saveLocal(
      PINNED_KEY,
      next
    );
  }


  async function loadMemory() {
    setMemoryLoading(true);

    try {
      const response =
        await fetch(
          MEMORY_ENDPOINT,
          {
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
    } catch (e) {
      Alert.alert(
        "Memory",
        String(e?.message || e)
      );
    } finally {
      setMemoryLoading(false);
    }
  }


  async function clearMemory() {
    Alert.alert(
      "Clear Memory",
      "सभी saved memories हटाएँ?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            try {
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

              if (
                !response.ok ||
                !data?.ok
              ) {
                throw new Error(
                  data?.error ||
                  "Memory clear failed."
                );
              }

              setMemories([]);
            } catch (e) {
              Alert.alert(
                "Memory",
                String(
                  e?.message || e
                )
              );
            }
          },
        },
      ]
    );
  }


  function newChat() {
    Speech.stop();
    setMessages([]);
    setConversationId(null);
    setText("");
    setAttachment(null);
    setMenuVisible(false);
  }
