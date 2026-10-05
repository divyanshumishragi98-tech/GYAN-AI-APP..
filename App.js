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
  async function choosePhoto() {
    try {
      const permission =
        await ImagePicker
          .requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          "Permission",
          "Gallery permission देना जरूरी है।"
        );
        return;
      }

      const result =
        await ImagePicker.launchImageLibraryAsync({
          mediaTypes:
            ["images"],
          quality: 0.9,
          allowsEditing: false,
        });

      if (
        !result.canceled &&
        result.assets?.length
      ) {
        const asset =
          result.assets[0];

        const item = {
          type: "image",
          name:
            asset.fileName ||
            "Selected image",
          uri: asset.uri,
          mimeType:
            asset.mimeType ||
            "image/*",
        };

        setAttachment(item);

        const next =
          [item, ...imageLibrary];

        setImageLibrary(next);
        await saveLocal(
          IMAGE_LIBRARY_KEY,
          next
        );
      }

      setMenuVisible(false);
    } catch (e) {
      Alert.alert(
        "Gallery",
        String(e?.message || e)
      );
    }
  }


  async function takePhoto() {
    try {
      const permission =
        await ImagePicker
          .requestCameraPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          "Camera",
          "Camera permission देना जरूरी है।"
        );
        return;
      }

      const result =
        await ImagePicker.launchCameraAsync({
          quality: 0.9,
          allowsEditing: false,
        });

      if (
        !result.canceled &&
        result.assets?.length
      ) {
        const asset =
          result.assets[0];

        const item = {
          type: "image",
          name: "Camera photo",
          uri: asset.uri,
          mimeType:
            asset.mimeType ||
            "image/*",
        };

        setAttachment(item);

        const next =
          [item, ...imageLibrary];

        setImageLibrary(next);

        await saveLocal(
          IMAGE_LIBRARY_KEY,
          next
        );
      }

      setMenuVisible(false);
    } catch (e) {
      Alert.alert(
        "Camera",
        String(e?.message || e)
      );
    }
  }


  async function chooseFile() {
    try {
      const result =
        await DocumentPicker
          .getDocumentAsync({
            type: "*/*",
            copyToCacheDirectory: true,
          });

      if (
        !result.canceled &&
        result.assets?.length
      ) {
        const file =
          result.assets[0];

        const item = {
          type: "file",
          name:
            file.name ||
            "Selected file",
          uri: file.uri,
          mimeType:
            file.mimeType ||
            "application/octet-stream",
        };

        setAttachment(item);

        const next =
          [item, ...library];

        setLibrary(next);

        await saveLocal(
          LIBRARY_KEY,
          next
        );
      }

      setMenuVisible(false);
    } catch (e) {
      Alert.alert(
        "File",
        String(e?.message || e)
      );
    }
  }


  function removeAttachment() {
    setAttachment(null);
  }


  function openSearch() {
    const query =
      text.trim();

    if (!query) {
      Alert.alert(
        "Search",
        "पहले search लिखो।"
      );
      return;
    }

    const url =
      "https://www.google.com/search?q=" +
      encodeURIComponent(query);

    setWebUrl(url);
    setWebVisible(true);
    setMenuVisible(false);
  }


  function openYouTube() {
    const query =
      text.trim();

    if (!query) {
      Alert.alert(
        "YouTube",
        "पहले search लिखो।"
      );
      return;
    }

    const url =
      "https://www.youtube.com/results?search_query=" +
      encodeURIComponent(query);

    setWebUrl(url);
    setWebVisible(true);
    setMenuVisible(false);
  }


  async function createProject() {
    Alert.prompt(
      "New Project",
      "Project का नाम लिखो:",
      async value => {
        const name =
          String(value || "").trim();

        if (!name) return;

        const item = {
          id:
            `${Date.now()}`,
          name,
          createdAt:
            new Date().toISOString(),
        };

        const next =
          [item, ...projects];

        setProjects(next);

        await saveLocal(
          PROJECTS_KEY,
          next
        );
      }
    );
  }


  async function createSchedule() {
    Alert.alert(
      "Schedule",
      "Schedule feature तैयार है। अगले चरण में backend/local alarm flow को और advanced करेंगे।"
    );
  }


  function openFutureFeature(title) {
    Alert.alert(
      title,
      `${title} का app structure तैयार है। इसका actual AI/backend connection अगली backend phase में जोड़ेंगे।`
    );
  }


  function renderHistoryItem({ item }) {
    const pinned =
      pinnedChats.some(
        x =>
          String(x.id) ===
          String(item.id)
      );

    return (
      <View style={styles.historyItem}>
        <TouchableOpacity
          style={styles.historyMain}
          onPress={() =>
            openHistoryChat(item)
          }
        >
          <Ionicons
            name="chatbubble-outline"
            size={20}
            color="#38BDF8"
          />

          <View style={{ flex: 1 }}>
            <Text
              style={styles.historyTitle}
              numberOfLines={1}
            >
              {item.title ||
                "Untitled Chat"}
            </Text>

            <Text
              style={styles.historyDate}
              numberOfLines={1}
            >
              {item.updated_at ||
                item.created_at ||
                ""}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.smallAction}
          onPress={() =>
            togglePin(item)
          }
        >
          <Ionicons
            name={
              pinned
                ? "pin"
                : "pin-outline"
            }
            size={19}
            color={
              pinned
                ? "#F5C542"
                : "#8B98A9"
            }
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.smallAction}
          onPress={() =>
            deleteHistoryChat(item)
          }
        >
          <Ionicons
            name="trash-outline"
            size={19}
            color="#FF6577"
          />
        </TouchableOpacity>
      </View>
    );
  }


  function renderSideItem(
    icon,
    title,
    onPress,
    color = "#38BDF8"
  ) {
    return (
      <TouchableOpacity
        style={styles.sideItem}
        onPress={onPress}
      >
        <Ionicons
          name={icon}
          size={23}
          color={color}
        />

        <Text style={styles.sideItemText}>
          {title}
        </Text>

        <Ionicons
          name="chevron-forward"
          size={17}
          color="#536174"
        />
      </TouchableOpacity>
    );
  }


  function renderPanel() {
    if (!activePanel)
      return null;

    const title =
      activePanel === "projects"
        ? "Projects"
        : activePanel === "library"
        ? "Library"
        : activePanel === "schedule"
        ? "Schedule"
        : activePanel === "images"
        ? "Image Library"
        : activePanel === "plugins"
        ? "Plugins"
        : activePanel === "remote"
        ? "Remote"
        : activePanel === "tools"
        ? "AI Tools"
        : "Panel";

    return (
      <Modal
        visible={true}
        animationType="slide"
        transparent
        onRequestClose={() =>
          setActivePanel(null)
        }
      >
        <View style={styles.panelBg}>
          <View style={styles.panel}>
            <View style={styles.panelHeader}>
              <View>
                <Text style={styles.panelTitle}>
                  {title}
                </Text>

                <Text style={styles.panelSubtitle}>
                  Gyan AI
                </Text>
              </View>

              <TouchableOpacity
                onPress={() =>
                  setActivePanel(null)
                }
              >
                <Ionicons
                  name="close"
                  size={27}
                  color="#FFFFFF"
                />
              </TouchableOpacity>
            </View>

            {activePanel ===
              "projects" && (
              <>
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={createProject}
                >
                  <Ionicons
                    name="add"
                    size={20}
                    color="#FFFFFF"
                  />
                  <Text
                    style={styles.primaryButtonText}
                  >
                    New Project
                  </Text>
                </TouchableOpacity>

                <FlatList
                  data={projects}
                  keyExtractor={x =>
                    String(x.id)
                  }
                  renderItem={({ item }) => (
                    <View
                      style={
                        styles.simpleCard
                      }
                    >
                      <Ionicons
                        name="folder-outline"
                        size={23}
                        color="#38BDF8"
                      />

                      <Text
                        style={
                          styles.simpleCardText
                        }
                      >
                        {item.name}
                      </Text>
                    </View>
                  )}
                  ListEmptyComponent={
                    <Text
                      style={
                        styles.emptyText
                      }
                    >
                      अभी कोई project नहीं है।
                    </Text>
                  }
                />
              </>
            )}

            {activePanel ===
              "library" && (
              <FlatList
                data={library}
                keyExtractor={(_, i) =>
                  String(i)
                }
                renderItem={({ item }) => (
                  <View
                    style={
                      styles.simpleCard
                    }
                  >
                    <Ionicons
                      name="document-outline"
                      size={22}
                      color="#38BDF8"
                    />
                    <Text
                      style={
                        styles.simpleCardText
                      }
                      numberOfLines={1}
                    >
                      {item.name}
                    </Text>
                  </View>
                )}
                ListEmptyComponent={
                  <Text
                    style={
                      styles.emptyText
                    }
                  >
                    Library अभी खाली है।
                  </Text>
                }
              />
            )}

            {activePanel ===
              "images" && (
              <FlatList
                data={imageLibrary}
                keyExtractor={(_, i) =>
                  String(i)
                }
                renderItem={({ item }) => (
                  <View
                    style={
                      styles.simpleCard
                    }
                  >
                    <Ionicons
                      name="image-outline"
                      size={22}
                      color="#38BDF8"
                    />
                    <Text
                      style={
                        styles.simpleCardText
                      }
                      numberOfLines={1}
                    >
                      {item.name}
                    </Text>
                  </View>
                )}
                ListEmptyComponent={
                  <Text
                    style={
                      styles.emptyText
                    }
                  >
                    Image Library अभी खाली है।
                  </Text>
                }
              />
            )}

            {activePanel ===
              "schedule" && (
              <>
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={createSchedule}
                >
                  <Ionicons
                    name="alarm-outline"
                    size={20}
                    color="#FFFFFF"
                  />
                  <Text
                    style={
                      styles.primaryButtonText
                    }
                  >
                    Add Reminder
                  </Text>
                </TouchableOpacity>

                <Text
                  style={
                    styles.featureInfo
                  }
                >
                  Voice-based reminders और
                  scheduled notifications यहाँ
                  manage होंगे।
                </Text>

                {schedule.map(
                  (item, index) => (
                    <View
                      key={index}
                      style={
                        styles.simpleCard
                      }
                    >
                      <Ionicons
                        name="alarm-outline"
                        size={22}
                        color="#38BDF8"
                      />
                      <Text
                        style={
                          styles.simpleCardText
                        }
                      >
                        {item.title ||
                          "Reminder"}
                      </Text>
                    </View>
                  )
                )}
              </>
            )}

            {activePanel ===
              "tools" && (
              <>
                {[
                  [
                    "document-text-outline",
                    "Make PDF",
                  ],
                  [
                    "sparkles-outline",
                    "AI Image Edit",
                  ],
                  [
                    "videocam-outline",
                    "AI Video Maker",
                  ],
                ].map(
                  ([icon, name]) => (
                    <TouchableOpacity
                      key={name}
                      style={
                        styles.simpleCard
                      }
                      onPress={() =>
                        openFutureFeature(
                          name
                        )
                      }
                    >
                      <Ionicons
                        name={icon}
                        size={24}
                        color="#38BDF8"
                      />
                      <Text
                        style={
                          styles.simpleCardText
                        }
                      >
                        {name}
                      </Text>
                    </TouchableOpacity>
                  )
                )}
              </>
            )}

            {(activePanel ===
              "plugins" ||
              activePanel ===
                "remote") && (
              <View>
                <Ionicons
                  name={
                    activePanel ===
                    "plugins"
                      ? "extension-puzzle-outline"
                      : "link-outline"
                  }
                  size={55}
                  color="#38BDF8"
                  style={{
                    alignSelf:
                      "center",
                    marginTop: 40,
                  }}
                />

                <Text
                  style={
                    styles.featureInfo
                  }
                >
                  {activePanel ===
                  "plugins"
                    ? "Plugins यहाँ manage होंगे। Backend/plugin APIs बाद में जोड़ेंगे।"
                    : "Remote connections यहाँ manage होंगे।"}
                </Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    );
  }
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
            marginTop: 20,
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


  if (!token) {
    return (
      <AuthScreen
        onLoginSuccess={
          loginSuccess
        }
      />
    );
  }


  return (
    <SafeAreaView
      style={styles.container}
    >
      <StatusBar
        barStyle="light-content"
        backgroundColor="#080C12"
      />

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() =>
            setMenuVisible(true)
          }
        >
          <Ionicons
            name="menu-outline"
            size={28}
            color="#FFFFFF"
          />
        </TouchableOpacity>

        <View
          style={styles.headerCenter}
        >
          <GyanLogo size={38} />

          <View>
            <Text style={styles.title}>
              Gyan AI
            </Text>

            <Text
              style={styles.subtitle}
            >
              {username
                ? `Hi, ${username}`
                : "AI Assistant"}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.headerButton}
          onPress={newChat}
        >
          <Ionicons
            name="create-outline"
            size={24}
            color="#FFFFFF"
          />
        </TouchableOpacity>
      </View>


      <KeyboardAvoidingView
        style={
          styles.keyboardContainer
        }
        behavior={
          Platform.OS === "ios"
            ? "padding"
            : "height"
        }
      >
        {messages.length === 0 ? (
          <View style={styles.welcome}>
            <GyanLogo size={82} />

            <Text
              style={
                styles.welcomeTitle
              }
            >
              Welcome to Gyan AI
            </Text>

            <Text
              style={
                styles.welcomeText
              }
            >
              Ask anything, use voice,
              upload files and continue
              your projects.
            </Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={item =>
              item.id
            }
            renderItem={({
              item,
            }) => (
              <MessageBubble
                item={item}
                onCopy={async value => {
                  await Clipboard.setStringAsync(
                    value
                  );
                  Alert.alert(
                    "Copied",
                    "Answer copied."
                  );
                }}
                onShare={shareText}
                onSpeak={speak}
              />
            )}
            contentContainerStyle={
              styles.messagesContent
            }
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={
              false
            }
          />
        )}


        {loading && (
          <View
            style={
              styles.loadingRow
            }
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
                style={
                  styles.loadingText
                }
              >
                Gyan AI सोच रहा है...
              </Text>
            </View>
          </View>
        )}


        {attachment && (
          <View
            style={
              styles.selectedAttachment
            }
          >
            <Ionicons
              name={
                attachment.type ===
                "image"
                  ? "image-outline"
                  : "document-outline"
              }
              size={20}
              color="#38BDF8"
            />

            <Text
              style={
                styles.selectedAttachmentText
              }
              numberOfLines={1}
            >
              {attachment.name}
            </Text>

            <TouchableOpacity
              onPress={
                removeAttachment
              }
            >
              <Ionicons
                name="close-circle"
                size={22}
                color="#FF6577"
              />
            </TouchableOpacity>
          </View>
        )}


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
              size={26}
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
          />


          <TouchableOpacity
            style={[
              styles.voiceButton,
              listening &&
                styles.voiceActive,
            ]}
            onPress={startVoice}
          >
            <Ionicons
              name={
                listening
                  ? "mic"
                  : "mic-outline"
              }
              size={22}
              color="#FFFFFF"
            />
          </TouchableOpacity>


          <TouchableOpacity
            style={[
              styles.sendButton,
              (!text.trim() ||
                loading) &&
                styles.sendDisabled,
            ]}
            onPress={
              sendMessage
            }
            disabled={
              !text.trim() ||
              loading
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
          <View style={styles.sideMenu}>
            <View
              style={styles.menuHeader}
            >
              <View
                style={styles.menuBrand}
              >
                <GyanLogo size={48} />

                <View>
                  <Text
                    style={styles.menuTitle}
                  >
                    Gyan AI
                  </Text>

                  <Text
                    style={
                      styles.menuSubtitle
                    }
                  >
                    {username ||
                      "AI Assistant"}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={() =>
                  setMenuVisible(false)
                }
              >
                <Ionicons
                  name="close"
                  size={28}
                  color="#FFFFFF"
                />
              </TouchableOpacity>
            </View>


            {renderSideItem(
              "add-circle-outline",
              "New Chat",
              newChat
            )}

            {renderSideItem(
              "time-outline",
              "Chat History",
              loadHistory
            )}

            {renderSideItem(
              "brain-outline",
              "Long-term Memory",
              loadMemory
            )}

            {renderSideItem(
              "folder-outline",
              "Projects",
              () => {
                setMenuVisible(false);
                setActivePanel(
                  "projects"
                );
              }
            )}

            {renderSideItem(
              "library-outline",
              "Library",
              () => {
                setMenuVisible(false);
                setActivePanel(
                  "library"
                );
              }
            )}

            {renderSideItem(
              "calendar-outline",
              "Schedule",
              () => {
                setMenuVisible(false);
                setActivePanel(
                  "schedule"
                );
              }
            )}

            {renderSideItem(
              "images-outline",
              "Image Library",
              () => {
                setMenuVisible(false);
                setActivePanel(
                  "images"
                );
              }
            )}

            {renderSideItem(
              "sparkles-outline",
              "AI Tools",
              () => {
                setMenuVisible(false);
                setActivePanel(
                  "tools"
                );
              }
            )}

            {renderSideItem(
              "extension-puzzle-outline",
              "Plugins",
              () => {
                setMenuVisible(false);
                setActivePanel(
                  "plugins"
                );
              }
            )}

            {renderSideItem(
              "link-outline",
              "Remote",
              () => {
                setMenuVisible(false);
                setActivePanel(
                  "remote"
                );
              }
            )}

            {renderSideItem(
              "globe-outline",
              "Manual Web Search",
              openSearch
            )}

            {renderSideItem(
              "logo-youtube",
              "YouTube Search",
              openYouTube,
              "#FF4D67"
            )}

            <View
              style={
                styles.menuDivider
              }
            />

            {renderSideItem(
              "log-out-outline",
              "Logout",
              logout,
              "#FF6577"
            )}
          </View>

          <Pressable
            style={
              styles.modalOutside
            }
            onPress={() =>
              setMenuVisible(false)
            }
          />
        </View>
      </Modal>


      <Modal
        visible={historyVisible}
        animationType="slide"
        transparent
        onRequestClose={() =>
          setHistoryVisible(false)
        }
      >
        <View
          style={styles.panelBg}
        >
          <View style={styles.panel}>
            <View
              style={styles.panelHeader}
            >
              <View>
                <Text
                  style={
                    styles.panelTitle
                  }
                >
                  Chat History
                </Text>

                <Text
                  style={
                    styles.panelSubtitle
                  }
                >
                  Your backend conversations
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
                  color="#FFFFFF"
                />
              </TouchableOpacity>
            </View>

            {historyLoading ? (
              <View
                style={
                  styles.centerLoading
                }
              >
                <ActivityIndicator
                  size="large"
                  color="#38BDF8"
                />
              </View>
            ) : (
              <FlatList
                data={history}
                keyExtractor={item =>
                  String(item.id)
                }
                renderItem={
                  renderHistoryItem
                }
                ListEmptyComponent={
                  <Text
                    style={
                      styles.emptyText
                    }
                  >
                    अभी कोई पुरानी chat नहीं मिली।
                  </Text>
                }
              />
            )}
          </View>
        </View>
      </Modal>


      <Modal
        visible={memoryVisible}
        animationType="slide"
        transparent
        onRequestClose={() =>
          setMemoryVisible(false)
        }
      >
        <View
          style={styles.panelBg}
        >
          <View style={styles.panel}>
            <View
              style={styles.panelHeader}
            >
              <View>
                <Text
                  style={
                    styles.panelTitle
                  }
                >
                  Long-term Memory
                </Text>

                <Text
                  style={
                    styles.panelSubtitle
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

            <FlatList
              data={memories}
              keyExtractor={item =>
                String(item.id)
              }
              renderItem={({ item }) => (
                <View
                  style={
                    styles.memoryCard
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
              ListEmptyComponent={
                <Text
                  style={
                    styles.emptyText
                  }
                >
                  No memories saved yet.
                </Text>
              }
            />

            <TouchableOpacity
              style={
                styles.dangerButton
              }
              onPress={clearMemory}
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
                  styles.primaryButtonText
                }
              >
                Clear All Memory
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>


      {renderPanel()}


      <Modal
        visible={webVisible}
        animationType="slide"
        onRequestClose={() =>
          setWebVisible(false)
        }
      >
        <SafeAreaView
          style={
            styles.webContainer
          }
        >
          <View
            style={styles.webHeader}
          >
            <TouchableOpacity
              onPress={() =>
                setWebVisible(false)
              }
            >
              <Ionicons
                name="arrow-back"
                size={25}
                color="#FFFFFF"
              />
            </TouchableOpacity>

            <Text
              style={styles.webTitle}
            >
              Gyan AI Web
            </Text>

            <View
              style={{ width: 30 }}
            />
          </View>

          {webUrl ? (
            <WebView
              source={{
                uri: webUrl,
              }}
              style={
                styles.webView
              }
              javaScriptEnabled
              domStorageEnabled
              startInLoadingState
            />
          ) : null}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#080C12",
  },

  keyboardContainer: {
    flex: 1,
  },

  authContainer: {
    flex: 1,
    backgroundColor: "#080C12",
  },

  authContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
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
  },

  authButton: {
    height: 52,
    borderRadius: 13,
    backgroundColor: "#1677C8",
    alignItems: "center",
    justifyContent: "center",
  },

  authButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },

  authLoading: {
    flex: 1,
    backgroundColor: "#080C12",
    alignItems: "center",
    justifyContent: "center",
  },

  authLoadingText: {
    color: "#8A96A7",
    marginTop: 15,
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
  },

  headerCenter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
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
  },

  welcomeText: {
    color: "#8793A4",
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    marginTop: 10,
    maxWidth: 350,
  },

  messagesContent: {
    padding: 12,
    paddingBottom: 15,
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
  },

  actionButton: {
    width: 34,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },

  attachment: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "#0B1621",
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
  },

  attachmentName: {
    flex: 1,
    color: "#C8D3E1",
    fontSize: 12,
  },

  selectedAttachment: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 10,
    marginBottom: 5,
    padding: 9,
    borderRadius: 12,
    backgroundColor: "#101A25",
    borderWidth: 1,
    borderColor: "#24364A",
    gap: 8,
  },

  selectedAttachmentText: {
    flex: 1,
    color: "#DDE6F2",
    fontSize: 12,
  },

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
    padding: 10,
  },

  loadingText: {
    color: "#8E9AAA",
    fontSize: 13,
  },

  composerWrapper: {
    minHeight: 57,
    marginHorizontal: 10,
    marginBottom: 5,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: "#253346",
    backgroundColor: "#0E151E",
    flexDirection: "row",
    alignItems: "flex-end",
    padding: 6,
  },

  plusButton: {
    width: 40,
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
    paddingHorizontal: 6,
    paddingVertical: 10,
  },

  voiceButton: {
    width: 42,
    height: 43,
    borderRadius: 22,
    backgroundColor: "#253342",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 5,
  },

  voiceActive: {
    backgroundColor: "#A83246",
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

  modalBackground: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "rgba(0,0,0,0.65)",
  },

  sideMenu: {
    width: "84%",
    maxWidth: 370,
    height: "100%",
    backgroundColor: "#0B1018",
    paddingTop: Platform.OS === "android"
      ? 32
      : 10,
    paddingHorizontal: 16,
  },

  modalOutside: {
    flex: 1,
  },

  menuHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 20,
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

  sideItem: {
    minHeight: 51,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    borderBottomWidth: 1,
    borderBottomColor: "#111A25",
  },

  sideItemText: {
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

  panelBg: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
    justifyContent: "flex-end",
  },

  panel: {
    height: "82%",
    backgroundColor: "#0B1018",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: "#1D2938",
    padding: 18,
  },

  panelHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#1B2736",
    marginBottom: 12,
  },

  panelTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "800",
  },

  panelSubtitle: {
    color: "#718096",
    fontSize: 11,
    marginTop: 3,
  },

  historyItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#101822",
    borderWidth: 1,
    borderColor: "#1D2A3A",
    borderRadius: 13,
    marginBottom: 9,
    padding: 9,
  },

  historyMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  historyTitle: {
    color: "#E5ECF5",
    fontSize: 14,
    fontWeight: "700",
  },

  historyDate: {
    color: "#69778A",
    fontSize: 10,
    marginTop: 4,
  },

  smallAction: {
    width: 35,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },

  memoryCard: {
    backgroundColor: "#101822",
    borderWidth: 1,
    borderColor: "#1D2A3A",
    borderRadius: 13,
    padding: 13,
    marginBottom: 10,
  },

  memoryKey: {
    color: "#38BDF8",
    fontWeight: "800",
    fontSize: 13,
  },

  memoryValue: {
    color: "#DCE4EF",
    fontSize: 14,
    marginTop: 6,
    lineHeight: 20,
  },

  primaryButton: {
    height: 48,
    borderRadius: 12,
    backgroundColor: "#1677C8",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 14,
  },

  dangerButton: {
    height: 48,
    borderRadius: 12,
    backgroundColor: "#A83246",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 10,
  },

  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },

  simpleCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#101822",
    borderWidth: 1,
    borderColor: "#1D2A3A",
    borderRadius: 13,
    padding: 13,
    marginBottom: 9,
  },

  simpleCardText: {
    flex: 1,
    color: "#DCE4EF",
    fontSize: 14,
    fontWeight: "600",
  },

  emptyText: {
    color: "#718096",
    textAlign: "center",
    marginTop: 35,
    fontSize: 13,
  },

  centerLoading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  featureInfo: {
    color: "#8996A8",
    textAlign: "center",
    lineHeight: 21,
    paddingHorizontal: 20,
    marginTop: 20,
  },

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
    paddingHorizontal: 12,
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
});
