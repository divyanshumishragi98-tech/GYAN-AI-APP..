import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from "react-native";
import * as Speech from "expo-speech";
import { Ionicons } from "@expo/vector-icons";

const API_BASE = "https://gyan-ai-ef7h.onrender.com";
const CHAT_ENDPOINT = `${API_BASE}/gradio_api/call/chat_submit`;

/* =========================
   GYAN AI LOGO
========================= */

function GyanLogo({ size = 44 }) {
  return (
    <View
      style={[
        styles.gyanLogo,
        {
          width: size,
          height: size,
          borderRadius: size * 0.28,
        },
      ]}
    >
      <Text
        style={[
          styles.gyanLogoText,
          {
            fontSize: size * 0.55,
          },
        ]}
      >
        G
      </Text>
    </View>
  );
}

/* =========================
   APP
========================= */

export default function App() {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);

  const listRef = useRef(null);

  /* =========================
     SEND MESSAGE
  ========================= */

  const sendMessage = async () => {
    const question = text.trim();

    if (!question || loading) return;

    setText("");

    const userMessage = {
      id: Date.now().toString(),
      role: "user",
      text: question,
    };

    setMessages((old) => [...old, userMessage]);
    setLoading(true);

    try {
      const response = await fetch(CHAT_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          data: [question],
        }),
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const result = await response.json();

      if (!result.event_id) {
        throw new Error("No event_id received");
      }

      const eventResponse = await fetch(
        `${CHAT_ENDPOINT}/${result.event_id}`
      );

      const raw = await eventResponse.text();

      let answer = "";

      const lines = raw.split("\n");

      for (const line of lines) {
        if (!line.startsWith("data:")) continue;

        const dataText = line.replace(/^data:\s*/, "").trim();

        if (!dataText || dataText === "[DONE]") continue;

        try {
          const parsed = JSON.parse(dataText);

          if (Array.isArray(parsed)) {
            const last = parsed[parsed.length - 1];

            if (typeof last === "string") {
              answer = last;
            } else if (last?.text) {
              answer = last.text;
            } else if (last?.value) {
              answer = last.value;
            }
          } else if (typeof parsed === "string") {
            answer = parsed;
          } else if (parsed?.text) {
            answer = parsed.text;
          } else if (parsed?.output) {
            answer = parsed.output;
          }
        } catch {
          // Ignore non JSON lines
        }
      }

      if (!answer) {
        throw new Error("No answer text received");
      }

      const aiMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        text: answer,
      };

      setMessages((old) => [...old, aiMessage]);

      setTimeout(() => {
        listRef.current?.scrollToEnd({
          animated: true,
        });
      }, 100);
    } catch (error) {
      console.log("Gyan AI Error:", error);

      setMessages((old) => [
        ...old,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          text: "AI सर्वर से उत्तर प्राप्त नहीं हुआ।",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  /* =========================
     SPEAKER
  ========================= */

  const speakAnswer = async (answer) => {
    try {
      await Speech.stop();

      Speech.speak(answer, {
        language: "hi-IN",
        rate: 0.9,
        pitch: 1,
        volume: 1,
      });
    } catch (error) {
      console.log("Speech error:", error);
    }
  };

  /* =========================
     NEW CHAT
  ========================= */

  const newChat = () => {
    if (messages.length === 0) return;

    Alert.alert(
      "New Chat",
      "क्या आप यह चैट साफ करना चाहते हैं?",
      [
        {
          text: "रद्द करें",
          style: "cancel",
        },
        {
          text: "नया चैट",
          onPress: () => setMessages([]),
        },
      ]
    );
  };

  /* =========================
     MESSAGE
  ========================= */

  const renderMessage = ({ item }) => {
    const isUser = item.role === "user";

    return (
      <View
        style={[
          styles.messageRow,
          isUser
            ? styles.userMessageRow
            : styles.aiMessageRow,
        ]}
      >
        {!isUser && <GyanLogo size={34} />}

        <View
          style={[
            styles.messageBox,
            isUser
              ? styles.userMessageBox
              : styles.aiMessageBox,
          ]}
        >
          <Text style={styles.messageText}>
            {item.text}
          </Text>

          {!isUser && (
            <TouchableOpacity
              style={styles.speakerButton}
              onPress={() => speakAnswer(item.text)}
            >
              <Ionicons
                name="volume-high-outline"
                size={20}
                color="#aeb7c4"
              />
            </TouchableOpacity>
          )}
        </View>

        {isUser && (
          <View style={styles.userAvatar}>
            <Text style={styles.userAvatarText}>
              U
            </Text>
          </View>
        )}
      </View>
    );
  };

  /* =========================
     UI
  ========================= */

  return (
    <SafeAreaView style={styles.container}>

      {/* HEADER */}

      <View style={styles.header}>
        <View style={styles.headerLeft}>

          <GyanLogo size={45} />

          <View style={styles.headerText}>
            <Text style={styles.title}>
              Gyan AI
            </Text>

            <Text style={styles.subtitle}>
              आपका AI Assistant
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.newChatButton}
          onPress={newChat}
        >
          <Ionicons
            name="add-outline"
            size={27}
            color="#ffffff"
          />
        </TouchableOpacity>
      </View>

      {/* CHAT */}

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        style={styles.chat}
        contentContainerStyle={[
          styles.chatContent,
          messages.length === 0 &&
            styles.emptyChat,
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() =>
          listRef.current?.scrollToEnd({
            animated: true,
          })
        }
        ListEmptyComponent={
          <View style={styles.welcome}>

            <GyanLogo size={92} />

            <Text style={styles.welcomeTitle}>
              नमस्ते! मैं Gyan AI हूँ
            </Text>

            <Text style={styles.welcomeText}>
              आप मुझसे कोई भी सवाल पूछ सकते हैं।
            </Text>

            <View style={styles.suggestionBox}>
              <Text style={styles.suggestionText}>
                "भारत की राजधानी क्या है?"
              </Text>
            </View>

            <View style={styles.suggestionBox}>
              <Text style={styles.suggestionText}>
                "मुझे गणित समझाओ"
              </Text>
            </View>

          </View>
        }
      />

      {/* LOADING */}

      {loading && (
        <View style={styles.loadingBox}>
          <ActivityIndicator
            size="small"
            color="#4d9aff"
          />

          <Text style={styles.loadingText}>
            Gyan AI सोच रहा है...
          </Text>
        </View>
      )}

      {/* COMPOSER */}

      <View style={styles.composerArea}>

        <TouchableOpacity
          style={styles.plusButton}
          onPress={() =>
            Alert.alert(
              "Gyan AI",
              "और features जल्द आएंगे।"
            )
          }
        >
          <Ionicons
            name="add"
            size={25}
            color="#dce3ec"
          />
        </TouchableOpacity>

        <View style={styles.inputContainer}>

          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Gyan AI से कुछ पूछें..."
            placeholderTextColor="#7f8996"
            style={styles.input}
            multiline
            maxLength={4000}
            keyboardAppearance="dark"
          />

          <TouchableOpacity
            style={[
              styles.sendButton,
              (!text.trim() || loading) &&
                styles.sendButtonDisabled,
            ]}
            onPress={sendMessage}
            disabled={!text.trim() || loading}
          >
            <Ionicons
              name="arrow-up"
              size={22}
              color="#ffffff"
            />
          </TouchableOpacity>

        </View>
      </View>
    </SafeAreaView>
  );
}

/* =========================
   STYLES
========================= */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0b0f14",
  },

  /* LOGO */

  gyanLogo: {
    backgroundColor: "#1f6feb",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },

  gyanLogoText: {
    color: "#ffffff",
    fontWeight: "900",
  },

  /* HEADER */

  header: {
    height: 70,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#202630",
  },

  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },

  headerText: {
    marginLeft: 11,
  },

  title: {
    color: "#ffffff",
    fontSize: 19,
    fontWeight: "700",
  },

  subtitle: {
    color: "#8993a1",
    fontSize: 12,
    marginTop: 2,
  },

  newChatButton: {
    width: 43,
    height: 43,
    borderRadius: 13,
    backgroundColor: "#171d25",
    justifyContent: "center",
    alignItems: "center",
  },

  /* CHAT */

  chat: {
    flex: 1,
  },

  chatContent: {
    paddingHorizontal: 14,
    paddingTop: 18,
    paddingBottom: 15,
  },

  emptyChat: {
    flexGrow: 1,
    justifyContent: "center",
  },

  /* WELCOME */

  welcome: {
    alignItems: "center",
    paddingHorizontal: 25,
  },

  welcomeTitle: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 22,
  },

  welcomeText: {
    color: "#8f99a6",
    fontSize: 15,
    textAlign: "center",
    marginTop: 9,
  },

  suggestionBox: {
    width: "100%",
    backgroundColor: "#151b23",
    borderWidth: 1,
    borderColor: "#252e39",
    borderRadius: 14,
    padding: 14,
    marginTop: 10,
  },

  suggestionText: {
    color: "#c9d1dc",
    fontSize: 14,
  },

  /* MESSAGES */

  messageRow: {
    flexDirection: "row",
    marginBottom: 18,
    alignItems: "flex-start",
  },

  aiMessageRow: {
    justifyContent: "flex-start",
  },

  userMessageRow: {
    justifyContent: "flex-end",
  },

  messageBox: {
    maxWidth: "80%",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },

  aiMessageBox: {
    backgroundColor: "#151b23",
    borderWidth: 1,
    borderColor: "#252e39",
    marginLeft: 9,
  },

  userMessageBox: {
    backgroundColor: "#1d4f91",
    marginRight: 8,
  },

  messageText: {
    color: "#f2f5f8",
    fontSize: 15.5,
    lineHeight: 23,
  },

  userAvatar: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: "#303742",
    justifyContent: "center",
    alignItems: "center",
  },

  userAvatarText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800",
  },

  speakerButton: {
    marginTop: 8,
    alignSelf: "flex-start",
    padding: 3,
  },

  /* LOADING */

  loadingBox: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 7,
  },

  loadingText: {
    color: "#8f99a6",
    fontSize: 12,
    marginLeft: 8,
  },

  /* INPUT */

  composerArea: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 10,
    borderTopWidth: 1,
    borderTopColor: "#202630",
    backgroundColor: "#0b0f14",
  },

  plusButton: {
    width: 44,
    height: 48,
    borderRadius: 15,
    backgroundColor: "#171d25",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 7,
  },

  inputContainer: {
    flex: 1,
    minHeight: 48,
    maxHeight: 130,
    borderRadius: 17,
    backgroundColor: "#171d25",
    borderWidth: 1,
    borderColor: "#28303b",
    flexDirection: "row",
    alignItems: "flex-end",
    paddingLeft: 13,
    paddingRight: 6,
  },

  input: {
    flex: 1,
    color: "#ffffff",
    fontSize: 15,
    minHeight: 45,
    maxHeight: 120,
    paddingTop: 11,
    paddingBottom: 10,
  },

  sendButton: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: "#1f6feb",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 5,
  },

  sendButtonDisabled: {
    opacity: 0.35,
  },
});
