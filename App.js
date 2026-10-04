import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
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
const CHAT_ENDPOINT = `${API_BASE}/api/chat`;

const TOKEN_KEY = "gyan_auth_token";
const USER_ID_KEY = "gyan_user_id";

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
        <Text style={[styles.logoText, { fontSize: size * 0.52 }]}>G</Text>
      </View>
    </View>
  );
}

function MessageBubble({ item, onCopy, onShare, onSpeak }) {
  const isUser = item.role === "user";

  return (
    <View
      style={[
        styles.messageRow,
        isUser ? styles.userRow : styles.aiRow,
      ]}
    >
      {!isUser && <GyanLogo size={32} />}

      <View
        style={[
          styles.messageBubble,
          isUser ? styles.userBubble : styles.aiBubble,
        ]}
      >
        <Text style={styles.messageText}>{item.content}</Text>

        {!isUser && (
          <View style={styles.messageActions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => onCopy(item.content)}
            >
              <Ionicons
                name="copy-outline"
                size={17}
                color="#AAB4C3"
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => onShare(item.content)}
            >
              <Ionicons
                name="share-outline"
                size={17}
                color="#AAB4C3"
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => onSpeak(item.content)}
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

export default function App() {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [token, setToken] = useState("");
  const [userId, setUserId] = useState("");
  const [conversationId, setConversationId] = useState(null);

  const [loading, setLoading] = useState(false);
  const [webVisible, setWebVisible] = useState(false);
  const [webUrl, setWebUrl] = useState("");

  const [menuVisible, setMenuVisible] = useState(false);

  const flatListRef = useRef(null);

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
      const savedToken = await AsyncStorage.getItem(TOKEN_KEY);
      const savedUserId = await AsyncStorage.getItem(USER_ID_KEY);

      if (savedToken) {
        setToken(savedToken);
      }

      if (savedUserId) {
        setUserId(savedUserId);
      }
    } catch (error) {
      console.log("AUTH LOAD ERROR:", error);
    }
  }

  async function copyText(value) {
    try {
      await ClipboardExpo.setStringAsync(value);
      Alert.alert("Copied", "Answer copied to clipboard.");
    } catch {
      Alert.alert("Copy failed", "Text copy नहीं हो पाया।");
    }
  }

  async function shareText(value) {
    try {
      await Share.share({
        message: value,
      });
    } catch (error) {
      console.log("SHARE ERROR:", error);
    }
  }

  function speakText(value) {
    Speech.stop();

    Speech.speak(value, {
      language: "hi-IN",
      rate: 0.95,
    });
  }

  function openWeb(url) {
    setWebUrl(url);
    setWebVisible(true);
  }

  function searchWeb() {
    const query = text.trim();

    if (!query) {
      Alert.alert("Web Search", "पहले अपना question लिखो।");
      return;
    }

    const url =
      "https://www.google.com/search?q=" +
      encodeURIComponent(query);

    openWeb(url);
  }

  function searchYouTube() {
    const query = text.trim();

    if (!query) {
      Alert.alert("YouTube", "पहले अपना question लिखो।");
      return;
    }

    const url =
      "https://www.youtube.com/results?search_query=" +
      encodeURIComponent(query);

    openWeb(url);
  }

  async function sendMessage() {
    const question = text.trim();

    if (!question || loading) {
      return;
    }

    if (!token) {
      Alert.alert(
        "Login required",
        "Gyan AI server chat के लिए login token चाहिए।"
      );
      return;
    }

    const userMessage = {
      id: `${Date.now()}-user`,
      role: "user",
      content: question,
    };

    setMessages((old) => [...old, userMessage]);
    setText("");
    setLoading(true);

    try {
      const response = await fetch(CHAT_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: question,
          conversation_id: conversationId,
        }),
      });

      let data;

      try {
        data = await response.json();
      } catch {
        throw new Error(
          `Server ने invalid response दिया. HTTP ${response.status}`
        );
      }

      console.log("CHAT RESPONSE:", data);

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
        setUserId(String(data.user_id));

        await AsyncStorage.setItem(
          USER_ID_KEY,
          String(data.user_id)
        );
      }

      if (data.conversation_id) {
        setConversationId(
          String(data.conversation_id)
        );
      }

      const answer = String(data.answer || "").trim();

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
      console.log("CHAT ERROR:", error);

      setMessages((old) => [
        ...old,
        {
          id: `${Date.now()}-error`,
          role: "assistant",
          content:
            "अभी AI server से उत्तर नहीं मिल पाया।\n\n" +
            String(error?.message || error),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function newChat() {
    Speech.stop();
    setMessages([]);
    setText("");
    setConversationId(null);
    setMenuVisible(false);
  }

  function addWebSearchToQuestion() {
    searchWeb();
    setMenuVisible(false);
  }

  function addYouTubeSearchToQuestion() {
    searchYouTube();
    setMenuVisible(false);
  }

  function renderMessage({ item }) {
    return (
      <MessageBubble
        item={item}
        onCopy={copyText}
        onShare={shareText}
        onSpeak={speakText}
      />
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="#080C12"
      />

      {/* HEADER */}

      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => setMenuVisible(true)}
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
            <Text style={styles.title}>Gyan AI</Text>
            <Text style={styles.subtitle}>
              Intelligent AI Assistant
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
        style={styles.keyboardContainer}
        behavior={
          Platform.OS === "ios"
            ? "padding"
            : "height"
        }
        keyboardVerticalOffset={0}
      >
        {messages.length === 0 ? (
          <View style={styles.welcome}>
            <GyanLogo size={82} />

            <Text style={styles.welcomeTitle}>
              Welcome to Gyan AI
            </Text>

            <Text style={styles.welcomeText}>
              Ask anything. Search the web, explore
              YouTube and chat with your AI assistant.
            </Text>

            <View style={styles.quickRow}>
              <TouchableOpacity
                style={styles.quickCard}
                onPress={searchWeb}
              >
                <Ionicons
                  name="globe-outline"
                  size={25}
                  color="#38BDF8"
                />
                <Text style={styles.quickText}>
                  Web Search
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickCard}
                onPress={searchYouTube}
              >
                <Ionicons
                  name="logo-youtube"
                  size={25}
                  color="#FF4D67"
                />
                <Text style={styles.quickText}>
                  YouTube
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            contentContainerStyle={
              styles.messagesContent
            }
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() =>
              flatListRef.current?.scrollToEnd({
                animated: true,
              })
            }
          />
        )}

        {/* LOADING */}

        {loading && (
          <View style={styles.loadingRow}>
            <GyanLogo size={30} />

            <View style={styles.loadingBubble}>
              <ActivityIndicator
                size="small"
                color="#38BDF8"
              />

              <Text style={styles.loadingText}>
                Gyan AI सोच रहा है...
              </Text>
            </View>
          </View>
        )}

        {/* COMPOSER */}

        <View style={styles.composerWrapper}>
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
              (!text.trim() || loading) &&
                styles.sendDisabled,
            ]}
            onPress={sendMessage}
            disabled={!text.trim() || loading}
          >
            <Ionicons
              name="arrow-up"
              size={23}
              color="#FFFFFF"
            />
          </TouchableOpacity>
        </View>

        <Text style={styles.disclaimer}>
          Gyan AI can make mistakes. Check important
          information.
        </Text>
      </KeyboardAvoidingView>

      {/* SIDE MENU */}

      <Modal
        visible={menuVisible}
        animationType="slide"
        transparent
        onRequestClose={() =>
          setMenuVisible(false)
        }
      >
        <View style={styles.modalBackground}>
          <View style={styles.sideMenu}>
            <View style={styles.menuHeader}>
              <View style={styles.menuBrand}>
                <GyanLogo size={48} />

                <View>
                  <Text style={styles.menuTitle}>
                    Gyan AI
                  </Text>

                  <Text style={styles.menuSubtitle}>
                    Tools & Features
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

            <TouchableOpacity
              style={styles.menuItem}
              onPress={newChat}
            >
              <Ionicons
                name="add-circle-outline"
                size={23}
                color="#38BDF8"
              />

              <Text style={styles.menuItemText}>
                New Chat
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setMenuVisible(false);
                Alert.alert(
                  "Chat History",
                  "History backend में saved है। इसका पूरा history screen अगली build में जोड़ सकते हैं।"
                );
              }}
            >
              <Ionicons
                name="time-outline"
                size={23}
                color="#38BDF8"
              />

              <Text style={styles.menuItemText}>
                Chat History
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setMenuVisible(false);

                Alert.alert(
                  "Long-term Memory",
                  "Memory backend में उपलब्ध है।"
                );
              }}
            >
              <Ionicons
                name="brain-outline"
                size={23}
                color="#38BDF8"
              />

              <Text style={styles.menuItemText}>
                Long-term Memory
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={addWebSearchToQuestion}
            >
              <Ionicons
                name="globe-outline"
                size={23}
                color="#38BDF8"
              />

              <Text style={styles.menuItemText}>
                Web Search
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={addYouTubeSearchToQuestion}
            >
              <Ionicons
                name="logo-youtube"
                size={23}
                color="#FF4D67"
              />

              <Text style={styles.menuItemText}>
                YouTube Search
              </Text>
            </TouchableOpacity>

            <View style={styles.menuDivider} />

            <Text style={styles.menuInfo}>
              Gyan AI
              {"\n"}
              AI • Web • YouTube • Memory
            </Text>
          </View>

          <Pressable
            style={styles.modalOutside}
            onPress={() =>
              setMenuVisible(false)
            }
          />
        </View>
      </Modal>

      {/* IN-APP WEB */}

      <Modal
        visible={webVisible}
        animationType="slide"
        onRequestClose={() =>
          setWebVisible(false)
        }
      >
        <SafeAreaView style={styles.webContainer}>
          <View style={styles.webHeader}>
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

            <TouchableOpacity
              onPress={() =>
                Linking.openURL(webUrl)
              }
              style={styles.webBack}
            >
              <Ionicons
                name="open-outline"
                size={23}
                color="#FFFFFF"
              />
            </TouchableOpacity>
          </View>

          {webUrl ? (
            <WebView
              source={{ uri: webUrl }}
              style={styles.webView}
              startInLoadingState
              renderLoading={() => (
                <View style={styles.webLoading}>
                  <ActivityIndicator
                    size="large"
                    color="#38BDF8"
                  />
                  <Text
                    style={styles.webLoadingText}
                  >
                    Loading...
                  </Text>
                </View>
              )}
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
    minHeight: 90,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "#1C2A3A",
    backgroundColor: "#0E151F",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  quickText: {
    color: "#DCE6F2",
    fontSize: 12,
    fontWeight: "700",
  },

  messagesContent: {
    paddingHorizontal: 12,
    paddingTop: 15,
    paddingBottom: 15,
  },

  messageRow: {
    flexDirection: "row",
    marginBottom: 14,
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
    backgroundColor: "#1D4ED8",
    borderBottomRightRadius: 5,
  },

  aiBubble: {
    backgroundColor: "#111923",
    borderWidth: 1,
    borderColor: "#1B2735",
    borderBottomLeftRadius: 5,
  },

  messageText: {
    color: "#F4F7FA",
    fontSize: 15,
    lineHeight: 22,
  },

  messageActions: {
    flexDirection: "row",
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "#202B38",
  },

  actionButton: {
    width: 34,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 3,
  },

  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 13,
    paddingBottom: 7,
    gap: 8,
  },

  loadingBubble: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    backgroundColor: "#111923",
    borderWidth: 1,
    borderColor: "#1B2735",
    borderRadius: 16,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },

  loadingText: {
    color: "#94A3B8",
    fontSize: 12,
  },

  composerWrapper: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginHorizontal: 10,
    marginBottom: 4,
    minHeight: 52,
    borderRadius: 27,
    backgroundColor: "#111923",
    borderWidth: 1,
    borderColor: "#253243",
    paddingHorizontal: 6,
    paddingVertical: 5,
  },

  plusButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },

  input: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 15,
    maxHeight: 120,
    paddingHorizontal: 8,
    paddingVertical: 9,
    textAlignVertical: "center",
  },

  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
  },

  sendDisabled: {
    opacity: 0.35,
  },

  disclaimer: {
    textAlign: "center",
    color: "#536071",
    fontSize: 9,
    paddingBottom: 4,
  },

  modalBackground: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "rgba(0,0,0,0.55)",
  },

  sideMenu: {
    width: "82%",
    maxWidth: 360,
    backgroundColor: "#0B1119",
    paddingTop: 45,
    paddingHorizontal: 18,
    borderRightWidth: 1,
    borderRightColor: "#1A2634",
  },

  modalOutside: {
    flex: 1,
  },

  menuHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: "#1A2634",
  },

  menuBrand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  menuTitle: {
    color: "#FFFFFF",
    fontSize: 19,
    fontWeight: "800",
  },

  menuSubtitle: {
    color: "#718096",
    fontSize: 11,
    marginTop: 2,
  },

  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    height: 56,
    gap: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#121C28",
  },

  menuItemText: {
    color: "#DCE5EF",
    fontSize: 15,
    fontWeight: "600",
  },

  menuDivider: {
    height: 1,
    backgroundColor: "#1A2634",
    marginVertical: 20,
  },

  menuInfo: {
    color: "#566477",
    fontSize: 12,
    lineHeight: 20,
  },

  webContainer: {
    flex: 1,
    backgroundColor: "#080C12",
  },

  webHeader: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    backgroundColor: "#0B1018",
    borderBottomWidth: 1,
    borderBottomColor: "#1A2634",
  },

  webBack: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },

  webTitle: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
    marginHorizontal: 8,
  },

  webView: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },

  webLoading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#080C12",
  },

  webLoadingText: {
    color: "#8A97A8",
    marginTop: 10,
  },
});
